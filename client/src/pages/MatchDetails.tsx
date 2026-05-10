import { useMatch, useDeleteMatch } from "@/hooks/use-game-data";
import { useRoute, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { GameIcon } from "@/components/ui/GameIcon";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowLeft, Trash2, Calendar, Trophy, FileText, Medal, Award } from "lucide-react";
import { EditMatchDialog } from "@/components/match/EditMatchDialog";
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
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function MatchDetails() {
  const [match, params] = useRoute("/matches/:id");
  const [, setLocation] = useLocation();
  const { data: matchData, isLoading } = useMatch(Number(params?.id));
  const deleteMatch = useDeleteMatch();

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6 max-w-3xl mx-auto mt-8">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      </Layout>
    );
  }

  if (!matchData) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold">Match not found</h2>
          <Button onClick={() => setLocation("/")} className="mt-4">Go Home</Button>
        </div>
      </Layout>
    );
  }

  const handleDelete = () => {
    deleteMatch.mutate(Number(params?.id), {
      onSuccess: () => setLocation("/"),
    });
  };

  // Determine scoring display logic
  const isGolf = matchData.gameType === 'golf';
  const scoreLabel = isGolf ? "Strokes" : (matchData.gameType === 'billiards' ? 'Score' : 'Points');
  const matchYear = new Date(matchData.playedAt).getFullYear();
  
  // Use stored handicap values from scores (applied at time of match entry)
  const scoresWithAdjusted = matchData.scores.map((score: any) => {
    let adjustedScore = score.scoreValue;
    const storedHandicap = score.handicap || 0;
    const bonusPoints = score.bonusPoints || 0;
    if (isGolf) {
      adjustedScore = score.scoreValue - storedHandicap + bonusPoints;
    }
    return { ...score, adjustedScore, yearHandicap: storedHandicap, bonusPoints };
  });
  
  const sortedScores = [...scoresWithAdjusted].sort((a, b) => a.adjustedScore - b.adjustedScore);
  let currentRank = 1;
  const rankedScores = sortedScores.map((score, index) => {
    if (index > 0) {
      const prevAdjustedScore = sortedScores[index - 1].adjustedScore;
      if (score.adjustedScore !== prevAdjustedScore) {
        currentRank = index + 1;
      }
    }
    return { ...score, rank: currentRank };
  });

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: Trophy, color: "text-amber-600 bg-amber-100 border-amber-200" };
    if (rank === 2) return { icon: Medal, color: "text-slate-500 bg-slate-100 border-slate-200" };
    if (rank === 3) return { icon: Award, color: "text-orange-600 bg-orange-100 border-orange-200" };
    return { icon: null, color: "text-muted-foreground bg-background" };
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6 pb-20">
        
        {/* Navigation & Actions */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary gap-2" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Button>

          <div className="flex items-center gap-2">
            <EditMatchDialog match={matchData} />
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10" data-testid="button-delete-match">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this match record.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Record
                </AlertDialogAction>
              </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Hero Card */}
        <div className="bg-card rounded-[2rem] border border-border/50 shadow-xl shadow-black/5 overflow-hidden">
          
          {/* Header Banner */}
          <div className={cn(
            "p-8 text-center relative overflow-hidden",
            matchData.gameType === 'billiards' ? "bg-cyan-50" : 
            matchData.gameType === 'golf' ? "bg-emerald-50" : "bg-rose-50"
          )}>
            <div className="relative z-10 flex flex-col items-center gap-4">
              <GameIcon type={matchData.gameType} size="lg" className="shadow-lg shadow-white/50" />
              <div>
                <h1 className="text-3xl font-display font-bold capitalize text-foreground">{matchData.gameType} Match</h1>
                <div className="flex items-center justify-center gap-2 text-muted-foreground mt-2">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(matchData.playedAt), "EEEE, MMMM do, yyyy")}</span>
                </div>
              </div>
              {matchData.notes && (
                <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-sm text-foreground/80 font-medium">
                  <FileText className="w-3.5 h-3.5 opacity-50" />
                  {matchData.notes}
                </div>
              )}
            </div>
          </div>

          {/* Score Table */}
          <div className="p-6 md:p-8">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Final Scores
            </h3>

            <div className="space-y-3">
              {rankedScores.map((score: any) => {
                const rankInfo = getRankBadge(score.rank);
                const RankIcon = rankInfo.icon;
                return (
                  <div 
                    key={score.id}
                    data-testid={`score-row-${score.userId}`}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl transition-all",
                      score.rank === 1 
                        ? "bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 shadow-sm" 
                        : "bg-secondary/30 border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border",
                        rankInfo.color
                      )}>
                        {RankIcon ? <RankIcon className="w-5 h-5" /> : score.rank}
                      </div>
                      <div>
                        <div className="font-bold text-lg flex items-center gap-2">
                          {score.user.name}
                          {score.rank === 1 && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">1st</span>}
                          {score.rank === 2 && <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">2nd</span>}
                          {score.rank === 3 && <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full font-medium">3rd</span>}
                          {score.rank >= 4 && <span className="text-xs px-2 py-0.5 bg-secondary text-muted-foreground rounded-full font-medium">{score.rank}th</span>}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {score.rank === 1 ? "Winner" : "Participant"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-3xl font-display font-bold tabular-nums">
                        {score.scoreValue}
                      </div>
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                        {scoreLabel}
                      </div>
                      {isGolf && (score.yearHandicap > 0 || score.bonusPoints !== 0) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          최종: {score.adjustedScore} 
                          {score.yearHandicap > 0 && <span className="text-emerald-600"> (HC -{score.yearHandicap})</span>}
                          {score.bonusPoints !== 0 && <span className="text-amber-600"> (+{score.bonusPoints})</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
