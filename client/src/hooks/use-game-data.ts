import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateMatchInput, type UpdateMatchInput, type CreateRoundInput } from "@shared/routes";
import { type User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// Types
export interface StatItem {
  userId: number;
  userName: string;
  totalGames: number;
  wins: number;
}

export function useUsers() {
  return useQuery({
    queryKey: [api.users.list.path],
    queryFn: async () => {
      const res = await fetch(api.users.list.path);
      if (!res.ok) throw new Error("Failed to fetch users");
      return api.users.list.responses[200].parse(await res.json());
    },
  });
}

export function useMatches(gameType?: string) {
  return useQuery({
    queryKey: [api.matches.list.path, { gameType }],
    queryFn: async () => {
      const url = new URL(api.matches.list.path, window.location.origin);
      if (gameType) url.searchParams.append("gameType", gameType);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch matches");
      return await res.json() as any[];
    },
  });
}

export function useMatch(id: number) {
  return useQuery({
    queryKey: [api.matches.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.matches.get.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch match details");
      return await res.json();
    },
    enabled: !!id,
  });
}

export function useStats() {
  return useQuery({
    queryKey: [api.stats.get.path],
    queryFn: async () => {
      const res = await fetch(api.stats.get.path);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.stats.get.responses[200].parse(await res.json());
    },
  });
}

export function useCreateMatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateMatchInput) => {
      const res = await fetch(api.matches.create.path, {
        method: api.matches.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create match");
      }
      return api.matches.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.matches.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
      toast({
        title: "경기 기록 완료!",
        description: "게임 점수가 저장되었습니다.",
      });
    },
    onError: (err) => {
      toast({
        title: "오류",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteMatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.matches.delete.path, { id });
      const res = await fetch(url, { method: api.matches.delete.method });
      if (!res.ok) throw new Error("Failed to delete match");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.matches.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
      toast({
        title: "삭제 완료",
        description: "경기 기록이 삭제되었습니다.",
      });
    },
  });
}

export function useUpdateMatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateMatchInput }) => {
      const url = buildUrl(api.matches.update.path, { id });
      const res = await fetch(url, {
        method: api.matches.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update match");
      }
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.matches.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.matches.get.path, variables.id] });
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
      toast({
        title: "수정 완료!",
        description: "경기가 업데이트되었습니다.",
      });
    },
    onError: (err) => {
      toast({
        title: "오류",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}

// Helper function to calculate rankings based on game type
// All games: lower score is better (ascending order)
export function calculateRankings(scores: any[], gameType: string) {
  const scoresWithAdjusted = scores.map(score => ({
    ...score,
    adjustedScore: gameType === 'golf'
      ? score.scoreValue - (score.handicap || 0)
      : score.scoreValue
  }));

  const sorted = [...scoresWithAdjusted].sort((a, b) => a.adjustedScore - b.adjustedScore);
  
  let currentRank = 1;
  return sorted.map((score, index) => {
    if (index > 0) {
      const prevAdjustedScore = sorted[index - 1].adjustedScore;
      if (score.adjustedScore !== prevAdjustedScore) {
        currentRank = index + 1;
      }
    }
    return { ...score, rank: currentRank };
  });
}

// === Date-based Handicaps ===
export function useAllHandicaps() {
  return useQuery({
    queryKey: [api.handicaps.list.path],
    queryFn: async () => {
      const res = await fetch(api.handicaps.list.path);
      if (!res.ok) throw new Error("Failed to fetch handicaps");
      return await res.json() as any[];
    },
  });
}

export function useHandicapsByDate(date: string, enabled: boolean = true) {
  return useQuery({
    queryKey: [api.handicaps.getByDate.path, date],
    queryFn: async () => {
      const url = buildUrl(api.handicaps.getByDate.path, { date });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch handicaps");
      return await res.json() as any[];
    },
    enabled: enabled && !!date,
  });
}

// Get effective handicap for a user from an array of handicap records.
// Returns undefined when handicaps haven't loaded yet OR no record exists for this user.
export function getHandicapForUser(
  handicaps: any[] | undefined,
  userId: number
): number | undefined {
  if (!handicaps) return undefined;
  const found = handicaps.find(h => h.userId === userId);
  return found?.golfHandicap; // undefined when not found
}

// Get the full handicap record (including source date) for a user
export function getHandicapRecordForUser(
  handicaps: any[] | undefined,
  userId: number
): any | undefined {
  if (!handicaps) return undefined;
  return handicaps.find(h => h.userId === userId);
}

// === Rounds ===
export function useRounds() {
  return useQuery({
    queryKey: [api.rounds.list.path],
    queryFn: async () => {
      const res = await fetch(api.rounds.list.path);
      if (!res.ok) throw new Error("Failed to fetch rounds");
      return await res.json() as any[];
    },
  });
}

export function useRound(id: number) {
  return useQuery({
    queryKey: [api.rounds.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.rounds.get.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch round details");
      return await res.json();
    },
    enabled: !!id,
  });
}

export function useCreateRound() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateRoundInput) => {
      const res = await fetch(api.rounds.create.path, {
        method: api.rounds.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create round");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.rounds.list.path] });
      toast({
        title: "라운드 저장 완료!",
        description: "라운드가 저장되었습니다.",
      });
    },
    onError: (err) => {
      toast({
        title: "오류",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteRound() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.rounds.delete.path, { id });
      const res = await fetch(url, { method: api.rounds.delete.method });
      if (!res.ok) throw new Error("Failed to delete round");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.rounds.list.path] });
      toast({
        title: "삭제 완료",
        description: "라운드가 삭제되었습니다.",
      });
    },
  });
}
