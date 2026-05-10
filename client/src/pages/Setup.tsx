import { useState } from "react";
import { useUsers, useAllHandicaps, useHandicapsByDate, getHandicapRecordForUser } from "@/hooks/use-game-data";
import { Layout } from "@/components/layout/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Save, Users, Plus, Trash2, UserPlus, Calendar as CalendarIcon, ChevronLeft, ChevronRight, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { format, parseISO, subDays, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Setup() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: users, isLoading: usersLoading } = useUsers();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [handicaps, setHandicaps] = useState<Record<number, number>>({});
  const [handicapErrors, setHandicapErrors] = useState<Record<number, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  const [newMemberName, setNewMemberName] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Effective handicaps for selected date
  const { data: effectiveHandicaps, isLoading: handicapsLoading } = useHandicapsByDate(selectedDateStr);

  // All handicap records for history
  const { data: allHandicaps, isLoading: allHandicapsLoading } = useAllHandicaps();

  const getEffectiveHandicap = (userId: number): number => {
    const h = effectiveHandicaps?.find((h: any) => h.userId === userId);
    return h?.golfHandicap ?? 0;
  };

  const getHandicapSourceDate = (userId: number): string | null => {
    const record = getHandicapRecordForUser(effectiveHandicaps, userId);
    if (!record) return null;
    return record.handicapDate; // the date the handicap was actually set
  };

  const upsertHandicap = useMutation({
    mutationFn: async ({ userId, handicapDate, golfHandicap }: { userId: number; handicapDate: string; golfHandicap: number }) => {
      const validationResult = api.handicaps.upsert.input.safeParse({ userId, handicapDate, golfHandicap });
      if (!validationResult.success) {
        throw new Error(validationResult.error.errors[0].message);
      }
      const res = await apiRequest(api.handicaps.upsert.method, api.handicaps.upsert.path, { userId, handicapDate, golfHandicap });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.handicaps.getByDate.path, selectedDateStr] });
      queryClient.invalidateQueries({ queryKey: [api.handicaps.list.path] });
      toast({
        title: "저장 완료",
        description: `${selectedDateStr} 핸디캡이 업데이트되었습니다.`,
      });
      setEditingId(null);
      setHandicapErrors({});
    },
    onError: (error: Error) => {
      toast({
        title: "오류",
        description: error.message || "핸디캡 저장에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const deleteHandicap = useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.handicaps.delete.path, { id });
      const res = await apiRequest(api.handicaps.delete.method, url);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.handicaps.getByDate.path, selectedDateStr] });
      queryClient.invalidateQueries({ queryKey: [api.handicaps.list.path] });
      toast({ title: "삭제 완료", description: "핸디캡 기록이 삭제되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const createUser = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest(api.users.create.method, api.users.create.path, { name });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
      toast({ title: "멤버 추가 완료", description: "새 멤버가 등록되었습니다." });
      setNewMemberName("");
      setIsAddingMember(false);
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message || "멤버 추가에 실패했습니다.", variant: "destructive" });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest(api.users.delete.method, api.users.delete.path.replace(':id', String(userId)));
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
      toast({ title: "멤버 삭제 완료", description: "멤버가 삭제되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "삭제 실패", description: error.message || "멤버 삭제에 실패했습니다.", variant: "destructive" });
    },
  });

  const handleAddMember = () => {
    if (newMemberName.trim()) createUser.mutate(newMemberName.trim());
  };

  const validateHandicap = (value: string, userId: number): number | null => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      setHandicapErrors(prev => ({ ...prev, [userId]: "숫자를 입력해주세요" }));
      return null;
    }
    if (num < 0 || num > 54) {
      setHandicapErrors(prev => ({ ...prev, [userId]: "0~54 사이의 값을 입력해주세요" }));
      return null;
    }
    setHandicapErrors(prev => ({ ...prev, [userId]: "" }));
    return num;
  };

  const handleSave = (userId: number) => {
    const newHandicap = handicaps[userId];
    if (newHandicap !== undefined && !handicapErrors[userId]) {
      upsertHandicap.mutate({ userId, handicapDate: selectedDateStr, golfHandicap: newHandicap });
    }
  };

  const startEditing = (userId: number, currentHandicap: number) => {
    setEditingId(userId);
    setHandicaps(prev => ({ ...prev, [userId]: currentHandicap }));
  };

  const changeDate = (delta: number) => {
    setSelectedDate(prev => delta > 0 ? addDays(prev, delta) : subDays(prev, -delta));
    setEditingId(null);
    setHandicapErrors({});
  };

  // Group all handicap records by date for history display
  const groupedHistory = allHandicaps?.reduce((acc: Record<string, any[]>, h: any) => {
    const d = h.handicapDate;
    if (!acc[d]) acc[d] = [];
    acc[d].push(h);
    return acc;
  }, {}) ?? {};

  const sortedDates = Object.keys(groupedHistory).sort((a, b) => b.localeCompare(a));

  const getUserName = (userId: number) => {
    return users?.find((u: any) => u.id === userId)?.name ?? `User ${userId}`;
  };

  if (usersLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display font-bold">Setup</h1>
          <p className="text-muted-foreground">날짜별 골프 핸디캡을 관리합니다</p>
        </div>

        {/* ── 골프 핸디캡 (날짜별) ── */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg">골프 핸디캡</h2>
                <p className="text-sm text-muted-foreground">날짜별로 핸디캡을 설정합니다</p>
              </div>
            </div>
          </div>

          {/* Date picker */}
          <div className="flex items-center justify-center gap-3 mb-6 p-4 bg-secondary/30 rounded-xl">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => changeDate(-1)}
              data-testid="button-prev-date"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 px-4 rounded-xl font-medium min-w-[150px] justify-center"
                  data-testid="button-select-date"
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {format(selectedDate, "yyyy-MM-dd")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => {
                    if (d) {
                      setSelectedDate(d);
                      setEditingId(null);
                      setHandicapErrors({});
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => changeDate(1)}
              disabled={format(selectedDate, "yyyy-MM-dd") >= today}
              data-testid="button-next-date"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <div className="mb-3">
            <p className="text-xs text-muted-foreground text-center">
              이 날짜 기준으로 가장 최근에 저장된 핸디캡이 표시됩니다
            </p>
          </div>

          {handicapsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {users?.map((user: any) => {
                const isEditing = editingId === user.id;
                const savedHandicap = getEffectiveHandicap(user.id);
                const currentHandicap = handicaps[user.id] ?? savedHandicap;

                return (
                  <div
                    key={user.id}
                    data-testid={`user-handicap-${user.id}`}
                    className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-transparent"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: user.avatarColor }}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold">{user.name}</div>
                        {(() => {
                          const sourceDate = getHandicapSourceDate(user.id);
                          const isDirectSet = sourceDate === selectedDateStr;
                          const isInherited = sourceDate && !isDirectSet;
                          return (
                            <div className="text-xs text-muted-foreground">
                              {isDirectSet ? (
                                <>
                                  <span className="text-emerald-600 font-medium">이 날짜 설정</span>
                                  {" · "}핸디캡: <span className="font-semibold text-foreground">{savedHandicap}</span>
                                </>
                              ) : isInherited ? (
                                <>
                                  <span className="text-amber-600 font-medium">{sourceDate} 기준 적용</span>
                                  {" · "}핸디캡: <span className="font-semibold text-foreground">{savedHandicap}</span>
                                </>
                              ) : (
                                <>핸디캡: <span className="font-semibold text-foreground">0</span> <span className="text-muted-foreground/60">(미설정)</span></>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {isEditing ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              max={54}
                              value={currentHandicap}
                              onChange={(e) => {
                                const validated = validateHandicap(e.target.value, user.id);
                                if (validated !== null) {
                                  setHandicaps(prev => ({ ...prev, [user.id]: validated }));
                                }
                              }}
                              className={`w-20 text-center ${handicapErrors[user.id] ? 'border-destructive' : ''}`}
                              data-testid={`input-handicap-${user.id}`}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSave(user.id)}
                              disabled={upsertHandicap.isPending || !!handicapErrors[user.id]}
                              data-testid={`button-save-handicap-${user.id}`}
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingId(null);
                                setHandicapErrors(prev => ({ ...prev, [user.id]: "" }));
                              }}
                              data-testid={`button-cancel-handicap-${user.id}`}
                            >
                              취소
                            </Button>
                          </div>
                          {handicapErrors[user.id] && (
                            <span className="text-xs text-destructive" data-testid={`error-handicap-${user.id}`}>
                              {handicapErrors[user.id]}
                            </span>
                          )}
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditing(user.id, savedHandicap)}
                          data-testid={`button-edit-handicap-${user.id}`}
                        >
                          이 날짜로 저장
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 pt-6 border-t text-sm text-muted-foreground">
            <p>
              핸디캡은 0~54 사이의 값입니다. 골프 경기 입력 시 경기 날짜 기준 가장 최근 핸디캡이 자동 적용됩니다.
            </p>
          </div>
        </Card>

        {/* ── 핸디캡 기록 히스토리 ── */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">핸디캡 기록</h2>
              <p className="text-sm text-muted-foreground">저장된 모든 핸디캡 내역</p>
            </div>
          </div>

          {allHandicapsLoading ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : sortedDates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              저장된 핸디캡 기록이 없습니다
            </div>
          ) : (
            <div className="space-y-4">
              {sortedDates.map(date => (
                <div key={date} className="rounded-xl border overflow-hidden">
                  <div className="px-4 py-2 bg-secondary/50 flex items-center gap-2">
                    <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold">{date}</span>
                  </div>
                  <div className="divide-y">
                    {groupedHistory[date].map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: users?.find((u: any) => u.id === h.userId)?.avatarColor ?? '#888' }}
                          >
                            {getUserName(h.userId).charAt(0)}
                          </div>
                          <span className="text-sm font-medium">{getUserName(h.userId)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono font-bold text-emerald-600">HC {h.golfHandicap}</span>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="w-7 h-7 text-muted-foreground hover:text-destructive"
                                data-testid={`button-delete-handicap-${h.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>핸디캡 기록 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {date}의 {getUserName(h.userId)} 핸디캡(HC {h.golfHandicap}) 기록을 삭제하시겠습니까?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteHandicap.mutate(h.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── 멤버 관리 ── */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 text-violet-600 rounded-lg">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg">멤버 관리</h2>
                <p className="text-sm text-muted-foreground">새 멤버를 추가하거나 삭제합니다</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddingMember(true)}
              disabled={isAddingMember}
              data-testid="button-add-member"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              멤버 추가
            </Button>
          </div>

          {isAddingMember && (
            <div className="mb-6 p-4 rounded-xl bg-secondary/30 border border-primary/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Input
                  type="text"
                  placeholder="새 멤버 이름"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="flex-1"
                  data-testid="input-new-member-name"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember(); }}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddMember}
                    disabled={!newMemberName.trim() || createUser.isPending}
                    data-testid="button-confirm-add-member"
                  >
                    {createUser.isPending ? "추가 중..." : "추가"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setIsAddingMember(false); setNewMemberName(""); }}
                    data-testid="button-cancel-add-member"
                  >
                    취소
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {users?.map((user: any) => (
              <div
                key={user.id}
                data-testid={`member-item-${user.id}`}
                className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-transparent"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: user.avatarColor }}
                  >
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold">{user.name}</div>
                    <div className="text-xs text-muted-foreground">멤버 ID: {user.id}</div>
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground"
                      data-testid={`button-delete-member-${user.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>멤버 삭제</AlertDialogTitle>
                      <AlertDialogDescription>
                        정말 "{user.name}" 멤버를 삭제하시겠습니까?
                        <br />
                        <span className="text-destructive font-medium">
                          게임 기록이 있는 멤버는 삭제할 수 없습니다.
                        </span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteUser.mutate(user.id)}
                        className="bg-destructive text-destructive-foreground"
                        data-testid={`button-confirm-delete-member-${user.id}`}
                      >
                        삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t text-sm text-muted-foreground">
            <p>게임 기록이 있는 멤버는 삭제할 수 없습니다. 새 멤버를 추가하면 자동으로 색상이 지정됩니다.</p>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
