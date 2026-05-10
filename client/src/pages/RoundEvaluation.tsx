import { useState, useMemo, useEffect } from "react";
import { useMatches, useUsers, useRounds, useCreateRound, useDeleteRound } from "@/hooks/use-game-data";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { GameIcon } from "@/components/ui/GameIcon";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Trophy, Medal, Award, Calculator, Check, Save, Trash2, FolderOpen, ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function RoundEvaluation() {
  const { data: matches, isLoading: matchesLoading } = useMatches();
  const { data: users } = useUsers();
  const { data: savedRounds, isLoading: roundsLoading } = useRounds();
  const createRound = useCreateRound();
  const deleteRound = useDeleteRound();

  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<number>>(new Set());
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
  const [roundName, setRoundName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [viewingRoundId, setViewingRoundId] = useState<number | null>(null);

  // Initialize selectedMemberIds when users load
  useEffect(() => {
    if (users && selectedMemberIds.size === 0) {
      setSelectedMemberIds(new Set(users.map((u: any) => u.id)));
    }
  }, [users]);

  const toggleMatch = (matchId: number) => {
    setSelectedMatchIds(prev => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  };

  const toggleMember = (userId: number) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        if (next.size <= 1) return prev; // keep at least 1 member
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (matches) {
      setSelectedMatchIds(new Set(matches.map((m: any) => m.id)));
    }
  };

  const clearSelection = () => {
    setSelectedMatchIds(new Set());
    setViewingRoundId(null);
  };

  const handleSaveRound = () => {
    if (selectedMatchIds.size === 0 || !roundName.trim()) return;
    
    createRound.mutate({
      name: roundName.trim(),
      matchIds: Array.from(selectedMatchIds),
    }, {
      onSuccess: () => {
        setShowSaveDialog(false);
        setRoundName("");
        clearSelection();
      }
    });
  };

  const handleViewRound = (round: any) => {
    const matchIds = round.matches.map((m: any) => m.id);
    setSelectedMatchIds(new Set(matchIds));
    setViewingRoundId(round.id);
  };

  const handleDeleteRound = (roundId: number) => {
    deleteRound.mutate(roundId);
    if (viewingRoundId === roundId) {
      clearSelection();
    }
  };

  const roundResults = useMemo(() => {
    if (!matches || !users || selectedMatchIds.size === 0) return null;

    const selectedMatches = matches.filter((m: any) => selectedMatchIds.has(m.id));
    
    const userTotals: Record<number, { 
      userId: number; 
      userName: string; 
      totalRankPoints: number; 
      matchCount: number;
      rankDetails: number[];
    }> = {};

    // Only initialize for selected members
    users.forEach((user: any) => {
      if (selectedMemberIds.has(user.id)) {
        userTotals[user.id] = {
          userId: user.id,
          userName: user.name,
          totalRankPoints: 0,
          matchCount: 0,
          rankDetails: [],
        };
      }
    });

    selectedMatches.forEach((match: any) => {
      const matchYear = new Date(match.playedAt).getFullYear();
      
      // Only include scores for selected members
      const filteredScores = match.scores.filter((score: any) => selectedMemberIds.has(score.userId));
      
      const scoresWithAdjusted = filteredScores.map((score: any) => {
        let adjustedScore = score.scoreValue;
        if (match.gameType === 'golf') {
          const storedHandicap = score.handicap || 0;
          const bonusPoints = score.bonusPoints || 0;
          adjustedScore = score.scoreValue - storedHandicap + bonusPoints;
        }
        return { ...score, adjustedScore };
      });
      
      if (scoresWithAdjusted.length === 0) return;
      
      const sortedScores = [...scoresWithAdjusted].sort((a, b) => a.adjustedScore - b.adjustedScore);
      
      sortedScores.forEach((score: any, index: number) => {
        let rankPoints = index + 1;
        
        if (match.gameType === 'golf') {
          const tiedPlayers = sortedScores.filter((s: any) => s.adjustedScore === score.adjustedScore);
          if (tiedPlayers.length > 1) {
            const firstTiedIndex = sortedScores.findIndex((s: any) => s.adjustedScore === score.adjustedScore);
            const lastTiedIndex = firstTiedIndex + tiedPlayers.length - 1;
            rankPoints = lastTiedIndex + 1;
          }
        }
        
        if (userTotals[score.userId]) {
          userTotals[score.userId].totalRankPoints += rankPoints;
          userTotals[score.userId].matchCount += 1;
          userTotals[score.userId].rankDetails.push(rankPoints);
        }
      });
    });

    const totalsArray = Object.values(userTotals)
      .filter(u => u.matchCount > 0)
      .sort((a, b) => a.totalRankPoints - b.totalRankPoints)
      .map((u, index) => ({
        ...u,
        rank: index + 1,
        scoreValue: u.totalRankPoints,
        totalScore: u.totalRankPoints,
      }));

    return totalsArray;
  }, [matches, users, selectedMatchIds, selectedMemberIds]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: Trophy, color: "text-amber-600 bg-amber-100 border-amber-200" };
    if (rank === 2) return { icon: Medal, color: "text-slate-500 bg-slate-100 border-slate-200" };
    if (rank === 3) return { icon: Award, color: "text-orange-600 bg-orange-100 border-orange-200" };
    return { icon: null, color: "text-muted-foreground bg-background border-border" };
  };

  if (matchesLoading || roundsLoading) {
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
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display font-bold">Round Evaluation</h1>
          <p className="text-muted-foreground">
            Select matches and members to calculate combined scores, save rounds, and track victory rankings
          </p>
        </div>

        {/* Member Filter */}
        {users && users.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
                <Users className="w-4 h-4" />
                <span>Members in round:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {users.map((user: any) => {
                  const isSelected = selectedMemberIds.has(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleMember(user.id)}
                      data-testid={`toggle-member-${user.id}`}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary/30 text-muted-foreground border-border hover:border-primary/40"
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        isSelected ? "bg-primary-foreground" : "bg-muted-foreground/40"
                      )} />
                      {user.name}
                    </button>
                  );
                })}
              </div>
              {users && selectedMemberIds.size < users.length && (
                <button
                  onClick={() => setSelectedMemberIds(new Set(users.map((u: any) => u.id)))}
                  className="text-xs text-primary underline underline-offset-2 ml-auto"
                  data-testid="button-select-all-members"
                >
                  모두 선택
                </button>
              )}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary" />
                Saved Rounds
              </h2>
            </div>

            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {savedRounds && savedRounds.length > 0 ? (
                savedRounds.map((round: any) => (
                  <div
                    key={round.id}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all group",
                      viewingRoundId === round.id
                        ? "bg-primary/10 border-primary/30"
                        : "bg-secondary/30 border-transparent hover:border-border"
                    )}
                    onClick={() => handleViewRound(round)}
                    data-testid={`saved-round-${round.id}`}
                  >
                    <Trophy className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{round.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {round.matches.length} matches
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 h-8 w-8 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRound(round.id);
                      }}
                      data-testid={`delete-round-${round.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No rounds saved yet
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                Select Matches
              </h2>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={selectAll}
                  data-testid="button-select-all"
                >
                  All
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearSelection}
                  data-testid="button-clear"
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {matches && matches.length > 0 ? (
                matches.map((match: any) => {
                  const isSelected = selectedMatchIds.has(match.id);
                  const winner = match.scores.find((s: any) => s.isWinner === 1);
                  
                  return (
                    <div
                      key={match.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                        isSelected 
                          ? "bg-primary/5 border-primary/30" 
                          : "bg-secondary/30 border-transparent hover:border-border"
                      )}
                      onClick={() => toggleMatch(match.id)}
                      data-testid={`match-select-${match.id}`}
                    >
                      <Checkbox 
                        checked={isSelected}
                        onCheckedChange={() => toggleMatch(match.id)}
                        className="pointer-events-none"
                      />
                      <GameIcon type={match.gameType} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium capitalize text-sm">{match.gameType}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(match.playedAt), "yyyy-MM-dd")}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No matches recorded yet
                </div>
              )}
            </div>

            {selectedMatchIds.size > 0 && !viewingRoundId && (
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <Badge variant="secondary" className="text-sm">
                  {selectedMatchIds.size} match(es)
                </Badge>
                <Button 
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                  data-testid="button-save-round"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Round
                </Button>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-primary" />
              Round Rankings
              {viewingRoundId && savedRounds && (
                <Badge variant="outline" className="ml-2 font-normal">
                  {savedRounds.find((r: any) => r.id === viewingRoundId)?.name}
                </Badge>
              )}
            </h2>

            {roundResults ? (
              <div className="space-y-3">
                {roundResults.map((result: any) => {
                  const rankInfo = getRankBadge(result.rank);
                  const RankIcon = rankInfo.icon;
                  
                  return (
                    <div
                      key={result.userId}
                      data-testid={`round-result-${result.userId}`}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl transition-all",
                        result.rank === 1
                          ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-100 dark:border-amber-900/50 shadow-sm"
                          : "bg-secondary/30 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border",
                          rankInfo.color
                        )}>
                          {RankIcon ? <RankIcon className="w-4 h-4" /> : result.rank}
                        </div>
                        <div>
                          <div className="font-bold flex items-center gap-2">
                            {result.userName}
                            {result.rank === 1 && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">1st</span>}
                            {result.rank === 2 && <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">2nd</span>}
                            {result.rank === 3 && <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full font-medium">3rd</span>}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <span>{result.matchCount} game(s)</span>
                            <span className="text-muted-foreground/50">|</span>
                            <span className="font-mono">[{result.rankDetails?.join(', ')}]</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-display font-bold tabular-nums">
                          {result.totalRankPoints}
                        </div>
                        <div className="text-xs text-muted-foreground">Total Points</div>
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground text-center pt-2">
                  * 순위 점수: 1등=1점, 2등=2점, 3등=3점, 4등=4점 (낮을수록 좋음)
                </p>
                {selectedMemberIds.size < (users?.length ?? 0) && (
                  <p className="text-xs text-primary/70 text-center">
                    * {selectedMemberIds.size}명 기준으로 순위 재산정
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Calculator className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">Select matches or a saved round</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Round</DialogTitle>
            <DialogDescription>
              Give this round a name to save it for later reference.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="e.g., January Meetup, New Year Championship..."
              value={roundName}
              onChange={(e) => setRoundName(e.target.value)}
              data-testid="input-round-name"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveRound}
              disabled={!roundName.trim() || createRound.isPending}
              data-testid="button-confirm-save"
            >
              {createRound.isPending ? "Saving..." : "Save Round"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
