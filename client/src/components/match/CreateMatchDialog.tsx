import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Trophy, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUsers, useCreateMatch, calculateRankings, useHandicapsByDate, getHandicapForUser } from "@/hooks/use-game-data";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { GameIcon } from "@/components/ui/GameIcon";

const AVATAR_COLORS = [
  "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
  "bg-sky-500", "bg-orange-500", "bg-teal-500", "bg-pink-500",
];

const formSchema = z.object({
  gameType: z.enum(["billiards", "golf", "card"]),
  playedAt: z.date(),
  notes: z.string().optional(),
  scores: z.record(z.string(), z.object({
    scoreValue: z.string().min(1, "Required"),
    handicap: z.string().optional(),
    bonusPoints: z.string().optional(),
    isWinner: z.boolean().default(false),
  })),
});

export function CreateMatchDialog() {
  const [open, setOpen] = useState(false);
  const { data: users } = useUsers();
  const createMatch = useCreateMatch();

  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (users) {
      setSelectedUserIds(new Set(users.map((u: any) => u.id)));
    }
  }, [users]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gameType: "billiards",
      playedAt: new Date(),
      notes: "",
      scores: {},
    },
  });

  const gameType = form.watch("gameType");
  const playedAt = form.watch("playedAt");
  const matchDateStr = playedAt ? format(playedAt, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

  // Fetch effective handicaps for the match date (only when golf is selected)
  const { data: dateHandicaps } = useHandicapsByDate(matchDateStr, gameType === 'golf');

  // Auto-populate handicaps for selected users when golf is chosen
  useEffect(() => {
    if (gameType === 'golf' && users) {
      const currentScores = form.getValues("scores");
      const updatedScores = { ...currentScores };

      users.forEach((user: any) => {
        if (!selectedUserIds.has(user.id)) return;
        const handicapValue = getHandicapForUser(dateHandicaps, user.id) ?? 0;

        if (!updatedScores[user.id]) {
          updatedScores[user.id] = {
            scoreValue: "",
            handicap: handicapValue.toString(),
            bonusPoints: "0",
            isWinner: false,
          };
        } else {
          updatedScores[user.id] = {
            ...updatedScores[user.id],
            handicap: handicapValue.toString(),
          };
        }
      });

      form.setValue("scores", updatedScores);
    }
  }, [gameType, dateHandicaps, users, matchDateStr, selectedUserIds]);

  const toggleUser = (userId: number) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        if (next.size <= 2) return prev;
        next.delete(userId);
        // Remove the deselected user's score entry to avoid stale validation failures
        const currentScores = form.getValues("scores");
        const updatedScores = { ...currentScores };
        delete updatedScores[userId];
        form.setValue("scores", updatedScores);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const gameConfig = {
    billiards: { label: "Billiards", unit: "Score" },
    golf: { label: "Golf", unit: "Strokes" },
    card: { label: "Card Game", unit: "Points" },
  };

  const currentConfig = gameConfig[gameType as keyof typeof gameConfig] || gameConfig.billiards;
  const participatingUsers = users?.filter((u: any) => selectedUserIds.has(u.id)) ?? [];

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!users) return;

    const scoresPayload = participatingUsers.map((user: any) => {
      const userScore = values.scores[user.id.toString()];
      const scoreValue = parseInt(userScore?.scoreValue || "0");
      const handicap = values.gameType === 'golf' ? parseInt(userScore?.handicap || "0") : 0;
      const bonusPoints = values.gameType === 'golf' ? parseInt(userScore?.bonusPoints || "0") : 0;
      const adjustedScore = values.gameType === 'golf' ? scoreValue - handicap + bonusPoints : scoreValue;
      return { userId: user.id, scoreValue, handicap, bonusPoints, adjustedScore };
    });

    const rankedScores = calculateRankings(
      scoresPayload.map(s => ({ userId: s.userId, scoreValue: s.adjustedScore })),
      values.gameType
    );

    const finalScores = scoresPayload.map(s => {
      const ranked = rankedScores.find(r => r.userId === s.userId);
      return {
        userId: s.userId,
        scoreValue: s.scoreValue,
        handicap: s.handicap,
        bonusPoints: s.bonusPoints,
        isWinner: ranked?.rank === 1 ? 1 : 0,
      };
    });

    const formattedDate = format(values.playedAt, "yyyy-MM-dd");

    createMatch.mutate({
      gameType: values.gameType,
      playedAt: formattedDate,
      notes: values.notes,
      scores: finalScores,
    }, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        if (users) setSelectedUserIds(new Set(users.map((u: any) => u.id)));
      }
    });
  };

  const handleDialogChange = (o: boolean) => {
    setOpen(o);
    if (!o) {
      form.reset();
      if (users) setSelectedUserIds(new Set(users.map((u: any) => u.id)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button size="lg" className="rounded-full h-14 px-8 shadow-xl shadow-primary/30 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 text-base font-semibold">
          <Plus className="w-5 h-5 mr-2" />
          New Match
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">Record New Match</DialogTitle>
          <DialogDescription>
            Enter the details and scores for the recent game.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gameType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Game Type</FormLabel>
                    <Select onValueChange={(val) => {
                      field.onChange(val);
                      // Clear all score entries when switching game type
                      form.setValue("scores", {});
                    }} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl">
                          <SelectValue placeholder="Select a game" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="billiards">
                          <div className="flex items-center gap-2">
                            <GameIcon type="billiards" size="sm" /> <span>Billiards</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="golf">
                          <div className="flex items-center gap-2">
                            <GameIcon type="golf" size="sm" /> <span>Golf</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="card">
                          <div className="flex items-center gap-2">
                            <GameIcon type="card" size="sm" /> <span>Card Game</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="playedAt"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="mb-1">Date Played</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "h-12 rounded-xl pl-3 text-left font-normal border-input hover:bg-background hover:text-foreground",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Participant Selection ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">참석자 선택</span>
                <span className="text-xs text-muted-foreground ml-auto">{selectedUserIds.size}명 참가 · 최소 2명</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {users?.map((user: any, idx: number) => {
                  const isSelected = selectedUserIds.has(user.id);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleUser(user.id)}
                      data-testid={`participant-toggle-${user.id}`}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-medium transition-all",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-secondary/30 text-muted-foreground border-border line-through opacity-50 hover:opacity-70"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold",
                        AVATAR_COLORS[idx % AVATAR_COLORS.length]
                      )}>
                        {user.name[0]}
                      </div>
                      {user.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Scores ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-lg">Scores</h3>
                <span className="text-sm text-muted-foreground">
                  {gameType === 'golf' ? `핸디캡 기준일: ${matchDateStr}` : `Unit: ${currentConfig.unit}`}
                </span>
              </div>

              <div className="grid gap-4">
                {participatingUsers.map((user: any, idx: number) => {
                  const userScores = form.watch(`scores.${user.id}`);
                  const scoreValue = parseInt(userScores?.scoreValue || "0");
                  const handicap = parseInt(userScores?.handicap || "0");
                  const bonusPoints = parseInt(userScores?.bonusPoints || "0");
                  const finalAdjustedScore = scoreValue - handicap + bonusPoints;
                  const hasValidScore = userScores?.scoreValue && userScores.scoreValue !== "";
                  const globalIdx = users?.findIndex((u: any) => u.id === user.id) ?? idx;

                  return (
                    <div key={user.id} className="flex items-center gap-2 p-3 rounded-xl bg-secondary/30 border border-transparent hover:border-border transition-colors">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0",
                        AVATAR_COLORS[globalIdx % AVATAR_COLORS.length]
                      )}>
                        {user.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{user.name}</div>
                        {gameType === 'golf' && hasValidScore && (
                          <div className="text-xs text-muted-foreground">
                            최종: <span className="font-mono font-semibold text-primary">{finalAdjustedScore}</span>
                            <span className="ml-1 text-emerald-600">(HC -{handicap})</span>
                            {bonusPoints !== 0 && <span className="ml-1 text-amber-600">(+{bonusPoints})</span>}
                          </div>
                        )}
                      </div>

                      <FormField
                        control={form.control}
                        name={`scores.${user.id}.scoreValue`}
                        render={({ field }) => (
                          <FormItem className="m-0 space-y-0 w-16">
                            <FormControl>
                              <Input
                                type="number"
                                placeholder={gameType === 'golf' ? "타수" : "0"}
                                className="h-10 text-center font-mono font-medium"
                                data-testid={`score-input-${user.id}`}
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {gameType === 'golf' && (
                        <>
                          <FormField
                            control={form.control}
                            name={`scores.${user.id}.handicap`}
                            render={({ field }) => (
                              <FormItem className="m-0 space-y-0 w-14">
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="HC"
                                    className="h-10 text-center font-mono font-medium text-emerald-600"
                                    {...field}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`scores.${user.id}.bonusPoints`}
                            render={({ field }) => (
                              <FormItem className="m-0 space-y-0 w-14">
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="가산"
                                    className="h-10 text-center font-mono font-medium text-amber-600"
                                    {...field}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </>
                      )}

                      <FormField
                        control={form.control}
                        name={`scores.${user.id}.isWinner`}
                        render={({ field }) => (
                          <FormItem className="m-0 space-y-0">
                            <FormControl>
                              <div
                                className={cn(
                                  "w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer transition-all",
                                  field.value
                                    ? "bg-amber-100 text-amber-600 border border-amber-200 shadow-sm"
                                    : "bg-background border border-input text-muted-foreground hover:bg-secondary"
                                )}
                                onClick={() => field.onChange(!field.value)}
                                title="Mark as Winner"
                              >
                                <Trophy className={cn("w-5 h-5", field.value && "fill-current")} />
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  );
                })}
              </div>

              {gameType === 'golf' && (
                <p className="text-xs text-muted-foreground">
                  * 최종 조정 스코어 = 타수 - 핸디캡 + 가산점 (낮을수록 좋음)
                </p>
              )}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Monthly meetup, Birthday game..." {...field} className="h-12 rounded-xl" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-12 px-6 rounded-xl">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMatch.isPending}
                className="h-12 px-8 rounded-xl font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
              >
                {createMatch.isPending ? "Saving..." : "Save Match"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
