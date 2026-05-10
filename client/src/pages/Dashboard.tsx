import { useState, useMemo } from "react";
import { useMatches, useStats, useUsers, useRounds } from "@/hooks/use-game-data";
import { Layout } from "@/components/layout/Layout";
import { CreateMatchDialog } from "@/components/match/CreateMatchDialog";
import { GameIcon, GameType } from "@/components/ui/GameIcon";
import { format } from "date-fns";
import { Link } from "wouter";
import { Calendar, ChevronRight, Trophy, TrendingUp, Medal, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Dashboard() {
  const { data: matches, isLoading: loadingMatches } = useMatches();
  const { data: stats, isLoading: loadingStats } = useStats();
  const { data: users } = useUsers();
  const { data: savedRounds } = useRounds();
  const [selectedRoundId, setSelectedRoundId] = useState<string>("latest");

  const overallRankings = useMemo(() => {
    if (!matches || !users || matches.length === 0) return null;

    let filteredMatches = matches;
    
    if (selectedRoundId === "latest" && matches.length > 0) {
      filteredMatches = [matches[0]];
    } else if (selectedRoundId !== "all" && savedRounds) {
      const selectedRound = savedRounds.find((r: any) => r.id === Number(selectedRoundId));
      if (selectedRound) {
        const matchIdsInRound = new Set(selectedRound.matches.map((m: any) => m.id));
        filteredMatches = matches.filter((m: any) => matchIdsInRound.has(m.id));
      }
    }

    const userTotals: Record<number, { 
      userId: number; 
      userName: string; 
      totalRankPoints: number; 
      matchCount: number;
      rankDetails: number[];
    }> = {};

    users.forEach((user: any) => {
      userTotals[user.id] = {
        userId: user.id,
        userName: user.name,
        totalRankPoints: 0,
        matchCount: 0,
        rankDetails: [],
      };
    });

    filteredMatches.forEach((match: any) => {
      const matchYear = new Date(match.playedAt).getFullYear();
      
      const scoresWithAdjusted = match.scores.map((score: any) => {
        let adjustedScore = score.scoreValue;
        if (match.gameType === 'golf') {
          const storedHandicap = score.handicap || 0;
          const bonusPoints = score.bonusPoints || 0;
          adjustedScore = score.scoreValue - storedHandicap + bonusPoints;
        }
        return { ...score, adjustedScore };
      });
      
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
        totalScore: u.totalRankPoints,
      }));

    return totalsArray;
  }, [matches, users, savedRounds, selectedRoundId]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: Trophy, color: "text-amber-600 bg-amber-100" };
    if (rank === 2) return { icon: Medal, color: "text-slate-500 bg-slate-100" };
    if (rank === 3) return { icon: Award, color: "text-orange-600 bg-orange-100" };
    return { icon: null, color: "text-muted-foreground bg-secondary" };
  };

  const selectedRoundName = useMemo(() => {
    if (selectedRoundId === "latest") return "Latest Match";
    if (selectedRoundId === "all") return "All Matches";
    const round = savedRounds?.find((r: any) => r.id === Number(selectedRoundId));
    return round?.name || "Selected Round";
  }, [savedRounds, selectedRoundId]);

  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    
    if (selectedRoundId === "latest" && matches.length > 0) {
      return [matches[0]];
    } else if (selectedRoundId !== "all" && savedRounds) {
      const selectedRound = savedRounds.find((r: any) => r.id === Number(selectedRoundId));
      if (selectedRound) {
        const matchIdsInRound = new Set(selectedRound.matches.map((m: any) => m.id));
        return matches.filter((m: any) => matchIdsInRound.has(m.id));
      }
    }
    return matches;
  }, [matches, savedRounds, selectedRoundId]);

  return (
    <Layout>
      <div className="space-y-8 pb-20">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground">Four Friends Funny Club</h2>
            <p className="text-muted-foreground mt-1">carpe diem ; 오늘을 즐겨라</p>
          </div>
          <div className="shrink-0">
            <CreateMatchDialog />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card rounded-3xl p-6 border border-border/50 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg">Victory Leaderboard</h3>
                  <p className="text-sm text-muted-foreground">{selectedRoundName}</p>
                </div>
              </div>
              <Select value={selectedRoundId} onValueChange={setSelectedRoundId}>
                <SelectTrigger className="w-[180px]" data-testid="select-round-filter">
                  <SelectValue placeholder="Filter by round" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest Match</SelectItem>
                  <SelectItem value="all">All Matches</SelectItem>
                  {savedRounds && savedRounds.map((round: any) => (
                    <SelectItem key={round.id} value={String(round.id)}>
                      {round.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {overallRankings && overallRankings.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {overallRankings.map((player: any) => {
                    const rankInfo = getRankBadge(player.rank);
                    const RankIcon = rankInfo.icon;
                    return (
                      <div
                        key={player.userId}
                        data-testid={`leaderboard-rank-${player.userId}`}
                        className={cn(
                          "relative p-4 rounded-2xl border transition-all",
                          player.rank === 1
                            ? "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-900/50"
                            : "bg-secondary/30 border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                            rankInfo.color
                          )}>
                            {RankIcon ? <RankIcon className="w-5 h-5" /> : player.rank}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold truncate">{player.userName}</div>
                            <div className="text-xs text-muted-foreground">{player.matchCount} games</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-display font-bold tabular-nums">{player.totalRankPoints}</div>
                            <div className="text-xs text-muted-foreground">Points</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {selectedRoundId === "all" ? "No matches recorded yet" : "No matches in this round"}
              </div>
            )}

            {selectedRoundId === "all" && stats && stats.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-muted-foreground">Total Wins</span>
                </div>
                <div className="h-[180px] w-full">
                  {loadingStats ? (
                    <div className="w-full h-full flex items-end justify-between gap-4 px-4">
                      {[1,2,3,4].map(i => <Skeleton key={i} className="w-full h-1/2 rounded-t-lg" />)}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <XAxis 
                          dataKey="userName" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                          dy={10}
                        />
                        <Tooltip 
                          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Bar dataKey="wins" radius={[8, 8, 8, 8]} barSize={40}>
                          {stats?.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.6)'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-primary to-violet-600 rounded-3xl p-6 text-primary-foreground shadow-lg shadow-primary/20 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            
            <div>
              <div className="flex items-center gap-2 mb-2 opacity-90">
                <TrendingUp className="w-5 h-5" />
                <span className="font-medium">{selectedRoundName}</span>
              </div>
              <div className="text-5xl font-display font-bold">
                {filteredMatches.length}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between p-2.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-300" />
                  <span className="text-sm font-medium">Billiards</span>
                </div>
                <span className="font-mono font-bold">{filteredMatches.filter(m => m.gameType === 'billiards').length}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-300" />
                  <span className="text-sm font-medium">Golf</span>
                </div>
                <span className="font-mono font-bold">{filteredMatches.filter(m => m.gameType === 'golf').length}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-300" />
                  <span className="text-sm font-medium">Card</span>
                </div>
                <span className="font-mono font-bold">{filteredMatches.filter(m => m.gameType === 'card').length}</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-bold text-xl">Recent Matches</h3>
          </div>

          <div className="space-y-4">
            {loadingMatches ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-card border border-border/50 animate-pulse" />
              ))
            ) : matches && matches.length > 0 ? (
              matches.map((match: any) => (
                <Link key={match.id} href={`/matches/${match.id}`}>
                  <div className="group bg-card hover:bg-white dark:hover:bg-card/80 rounded-2xl p-4 border border-border/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer flex items-center justify-between gap-4">
                    
                    <div className="flex items-center gap-4">
                      <GameIcon type={match.gameType} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-foreground capitalize">{match.gameType}</h4>
                          {match.notes && (
                            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-secondary text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                              {match.notes}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{format(new Date(match.playedAt), "MMM d, yyyy")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="hidden sm:flex -space-x-3">
                        {match.scores
                          .filter((s: any) => s.isWinner === 1)
                          .map((s: any, i: number) => (
                            <div key={i} className="w-8 h-8 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center text-amber-700 font-bold text-xs relative z-10" title={`Winner: ${s.user.name}`}>
                              <Medal className="w-4 h-4" />
                            </div>
                          ))}
                        {match.scores.filter((s: any) => s.isWinner === 1).length === 0 && (
                          <span className="text-sm text-muted-foreground">No winner marked</span>
                        )}
                      </div>

                      <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                    </div>

                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
                <div className="mx-auto w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <Trophy className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-display font-bold text-lg">No matches yet</h3>
                <p className="text-muted-foreground mb-6">Record your first game to start tracking stats!</p>
                <CreateMatchDialog />
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
