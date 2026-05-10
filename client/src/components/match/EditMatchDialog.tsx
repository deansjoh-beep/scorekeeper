import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calendar as CalendarIcon, Trophy, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUsers, useUpdateMatch, calculateRankings, useHandicapsByDate, getHandicapForUser } from "@/hooks/use-game-data";
import { format } from "date-fns";

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

const formSchema = z.object({
  gameType: z.enum(["billiards", "golf", "card"]),
  playedAt: z.date(),
  notes: z.string().optional(),
  scores: z.record(z.string(), z.object({
    scoreValue: z.string().min(1, "Required"),
    handicap: z.string().optional(), // Golf handicap
    bonusPoints: z.string().optional(), // Golf side game bonus
  })),
});

interface EditMatchDialogProps {
  match: any;
  onSuccess?: () => void;
}

export function EditMatchDialog({ match, onSuccess }: EditMatchDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: users } = useUsers();
  const updateMatch = useUpdateMatch();

  const playedAt = new Date(match.playedAt);
  const matchDateStr = format(playedAt, "yyyy-MM-dd");

  // Fetch date-based handicaps for the match date
  const { data: dateHandicaps } = useHandicapsByDate(matchDateStr, match.gameType === 'golf');

  // Initialize scores from match data with date-based handicaps
  const initialScores = () => {
    const scoresMap: Record<string, { scoreValue: string; handicap: string; bonusPoints: string }> = {};
    if (match?.scores && users) {
      match.scores.forEach((s: any) => {
        // Use date-based handicap from settings if available, otherwise fall back to stored handicap
        const dateHandicap = getHandicapForUser(dateHandicaps, s.userId);
        const handicapValue = dateHandicap !== undefined ? dateHandicap : (s.handicap ?? 0);
        
        scoresMap[s.userId.toString()] = {
          scoreValue: s.scoreValue.toString(),
          handicap: handicapValue.toString(),
          bonusPoints: (s.bonusPoints || 0).toString(),
        };
      });
    }
    return scoresMap;
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gameType: match.gameType as "billiards" | "golf" | "card",
      playedAt: new Date(match.playedAt),
      notes: match.notes || "",
      scores: initialScores(),
    },
  });

  // Reset form when dialog opens or dateHandicaps loads
  useEffect(() => {
    if (open) {
      form.reset({
        gameType: match.gameType as "billiards" | "golf" | "card",
        playedAt: new Date(match.playedAt),
        notes: match.notes || "",
        scores: initialScores(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dateHandicaps]);

  const gameType = form.watch("gameType");

  const gameConfig = {
    billiards: { label: "Billiards", unit: "Score", higherIsBetter: false },
    golf: { label: "Golf", unit: "Strokes", higherIsBetter: false },
    card: { label: "Card Game", unit: "Points", higherIsBetter: false },
  };

  const currentConfig = gameConfig[gameType as keyof typeof gameConfig] || gameConfig.billiards;

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!users) return;

    // Transform form data to API payload
    const scoresPayload = users.map(user => {
      const userScore = values.scores[user.id.toString()];
      const scoreValue = parseInt(userScore?.scoreValue || "0");
      const handicap = values.gameType === 'golf' ? parseInt(userScore?.handicap || "0") : 0;
      const bonusPoints = values.gameType === 'golf' ? parseInt(userScore?.bonusPoints || "0") : 0;
      // For golf, final adjusted score = (score - handicap) + bonusPoints
      const adjustedScore = values.gameType === 'golf' ? scoreValue - handicap + bonusPoints : scoreValue;
      return {
        userId: user.id,
        scoreValue: scoreValue,
        handicap: handicap,
        bonusPoints: bonusPoints,
        adjustedScore: adjustedScore,
      };
    });

    // Calculate winners based on adjusted score for golf
    const rankedScores = calculateRankings(
      scoresPayload.map(s => ({ userId: s.userId, scoreValue: s.adjustedScore })),
      values.gameType
    );
    
    // Map back with original scores and handicaps
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

    // Format date as YYYY-MM-DD for database date column
    const formattedDate = format(values.playedAt, "yyyy-MM-dd");
    
    updateMatch.mutate({
      id: match.id,
      data: {
        gameType: values.gameType,
        playedAt: formattedDate,
        notes: values.notes,
        scores: finalScores,
      }
    }, {
      onSuccess: () => {
        setOpen(false);
        onSuccess?.();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-edit-match">
          <Pencil className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">Edit Match</DialogTitle>
          <DialogDescription>
            Update the match details and scores.
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl" data-testid="select-game-type">
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
                            data-testid="button-date-picker"
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-lg">Scores</h3>
                <span className="text-sm text-muted-foreground">
                  {gameType === 'golf' ? 'Score / Handicap' : `Lower is better (${currentConfig.unit})`}
                </span>
              </div>
              
              <div className="grid gap-4">
                {users?.map((user) => {
                  const userScores = form.watch(`scores.${user.id}`);
                  const scoreValue = parseInt(userScores?.scoreValue || "0");
                  const handicap = parseInt(userScores?.handicap || "0");
                  const bonusPoints = parseInt(userScores?.bonusPoints || "0");
                  const finalAdjustedScore = scoreValue - handicap + bonusPoints;
                  const hasValidScore = userScores?.scoreValue && userScores.scoreValue !== "";
                  
                  return (
                    <div key={user.id} className="flex items-center gap-2 p-3 rounded-xl bg-secondary/30 border border-transparent hover:border-border transition-colors">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                        {user.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{user.name}</div>
                        {gameType === 'golf' && hasValidScore && (
                          <div className="text-xs text-muted-foreground">
                            최종: <span className="font-mono font-semibold text-primary">{finalAdjustedScore}</span>
                            <span className="ml-1 text-emerald-600">(HC -{handicap})</span>
                            {bonusPoints !== 0 && (
                              <span className="ml-1 text-amber-600">(+{bonusPoints})</span>
                            )}
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
                                data-testid={`input-score-${user.id}`}
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
                                    data-testid={`input-handicap-${user.id}`}
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
                                    data-testid={`input-bonus-${user.id}`}
                                    {...field} 
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </>
                      )}
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
                    <Input 
                      placeholder="e.g. Monthly meetup, Birthday game..." 
                      {...field} 
                      className="h-12 rounded-xl" 
                      data-testid="input-notes"
                    />
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
                disabled={updateMatch.isPending}
                className="h-12 px-8 rounded-xl font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                data-testid="button-save-match"
              >
                {updateMatch.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
