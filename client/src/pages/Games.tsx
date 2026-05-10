import { useState, useEffect, useRef, useCallback } from "react";
import { useUsers } from "@/hooks/use-game-data";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Shuffle, Timer, Play, Pause, RotateCcw, Users, ChevronUp, ChevronDown, RefreshCw, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Shared ────────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleAvoidingFirst<T>(arr: T[], avoidFirst: T): T[] {
  if (arr.length <= 1) return [...arr];
  let result: T[];
  let attempts = 0;
  do { result = shuffleArray(arr); attempts++; } while (result[0] === avoidFirst && attempts < 20);
  return result;
}

const AVATAR_COLORS = [
  "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
  "bg-sky-500", "bg-orange-500", "bg-teal-500", "bg-pink-500",
];

const PATH_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

// ─── Ladder Logic ──────────────────────────────────────────────────────────

const LADDER_ROWS = 12;
const COL_SPACING = 72;
const ROW_SPACING = 34;
const MARGIN_X = 36;
const HEADER_H = 52;
const FOOTER_H = 52;

function generateRungs(n: number): boolean[][] {
  const rungs: boolean[][] = [];
  for (let r = 0; r < LADDER_ROWS; r++) {
    const row = new Array<boolean>(n - 1).fill(false);
    for (let g = 0; g < n - 1; g++) {
      if (g === 0 || !row[g - 1]) row[g] = Math.random() < 0.45;
    }
    rungs.push(row);
  }
  return rungs;
}

function tracePath(startCol: number, rungs: boolean[][]): number[] {
  const cols: number[] = [startCol];
  let col = startCol;
  const n = (rungs[0]?.length ?? 0) + 1;
  for (const row of rungs) {
    if (col < n - 1 && row[col]) col++;
    else if (col > 0 && row[col - 1]) col--;
    cols.push(col);
  }
  return cols;
}

function buildPathPoints(cols: number[]): string {
  const colX = (c: number) => MARGIN_X + c * COL_SPACING;
  const rungY = (r: number) => HEADER_H + (r + 0.5) * ROW_SPACING;
  const pts: string[] = [];
  pts.push(`${colX(cols[0])},${HEADER_H}`);
  for (let r = 0; r < cols.length - 1; r++) {
    const from = cols[r], to = cols[r + 1];
    const y = rungY(r);
    pts.push(`${colX(from)},${y}`);
    if (from !== to) pts.push(`${colX(to)},${y}`);
  }
  pts.push(`${colX(cols[cols.length - 1])},${HEADER_H + LADDER_ROWS * ROW_SPACING}`);
  return pts.join(" ");
}

// ─── Ladder Game Component ─────────────────────────────────────────────────

const DEFAULT_RESULTS = ["술 사기 🍺", "안주 사기 🍗", "면제 😊", "벌칙 🎯"];

function LadderGame({ users }: { users: any[] }) {
  const [ladderIds, setLadderIds] = useState<number[]>([]);
  const [results, setResults] = useState<string[]>([]);
  const [rungs, setRungs] = useState<boolean[][]>([]);
  const [generated, setGenerated] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [editingResults, setEditingResults] = useState(false);

  const n = ladderIds.length;

  useEffect(() => {
    if (users && ladderIds.length === 0) {
      setLadderIds(users.map((u: any) => u.id));
    }
  }, [users]);

  useEffect(() => {
    setResults(Array.from({ length: n }, (_, i) => DEFAULT_RESULTS[i] ?? `결과 ${i + 1}`));
  }, [n]);

  const toggleLadderMember = (id: number) => {
    setLadderIds(prev =>
      prev.includes(id)
        ? prev.length > 2 ? prev.filter(x => x !== id) : prev
        : [...prev, id]
    );
    setGenerated(false);
    setRevealed(new Set());
  };

  const generate = () => {
    if (n < 2) return;
    setRungs(generateRungs(n));
    setGenerated(true);
    setRevealed(new Set());
    setEditingResults(false);
  };

  const revealPlayer = (idx: number) => {
    setRevealed(prev => new Set([...prev, idx]));
  };

  const revealAll = () => {
    setRevealed(new Set(ladderIds.map((_, i) => i)));
  };

  const reset = () => {
    setGenerated(false);
    setRevealed(new Set());
  };

  // All paths (column indices at each row level)
  const paths = generated && rungs.length > 0
    ? ladderIds.map((_, i) => tracePath(i, rungs))
    : [];

  const colX = (c: number) => MARGIN_X + c * COL_SPACING;
  const rungY = (r: number) => HEADER_H + (r + 0.5) * ROW_SPACING;
  const svgWidth = MARGIN_X * 2 + Math.max(0, n - 1) * COL_SPACING;
  const svgHeight = HEADER_H + LADDER_ROWS * ROW_SPACING + FOOTER_H;

  const getUserByIndex = (i: number) => users?.find((u: any) => u.id === ladderIds[i]);
  const userColorIndex = (i: number) => users?.findIndex((u: any) => u.id === ladderIds[i]) ?? i;

  const allRevealed = revealed.size === n;

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">🪜</div>
          <div>
            <h2 className="text-xl font-bold">사다리타기</h2>
            <p className="text-sm text-white/80">랜덤 사다리로 결과 정하기</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Member selection */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">참여 멤버 (최소 2명)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {users?.map((user: any, idx: number) => {
              const isOn = ladderIds.includes(user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => toggleLadderMember(user.id)}
                  data-testid={`ladder-member-${user.id}`}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-medium transition-all",
                    isOn
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-secondary/30 text-muted-foreground border-border hover:border-primary/40"
                  )}
                >
                  <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold", AVATAR_COLORS[idx % AVATAR_COLORS.length])}>
                    {user.name[0]}
                  </div>
                  {user.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Result labels editor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">결과 항목</span>
            <button
              onClick={() => setEditingResults(e => !e)}
              className="text-xs text-primary underline underline-offset-2"
              data-testid="button-edit-results"
            >
              {editingResults ? "완료" : "수정"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {results.map((r, i) => (
              editingResults ? (
                <Input
                  key={i}
                  value={r}
                  onChange={e => {
                    const next = [...results];
                    next[i] = e.target.value;
                    setResults(next);
                  }}
                  className="w-32 h-8 text-sm"
                  data-testid={`result-input-${i}`}
                />
              ) : (
                <span key={i} className="px-3 py-1 bg-secondary/50 rounded-full text-sm border border-border">
                  {r}
                </span>
              )
            ))}
          </div>
        </div>

        {/* Ladder SVG */}
        {generated && rungs.length > 0 ? (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <svg
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="mx-auto block"
                style={{ maxWidth: "100%" }}
              >
                {/* Vertical columns */}
                {ladderIds.map((_, i) => (
                  <line
                    key={`col-${i}`}
                    x1={colX(i)} y1={HEADER_H}
                    x2={colX(i)} y2={HEADER_H + LADDER_ROWS * ROW_SPACING}
                    stroke="currentColor"
                    strokeWidth={2}
                    className="text-border"
                  />
                ))}

                {/* Horizontal rungs */}
                {rungs.map((row, r) =>
                  row.map((hasRung, g) =>
                    hasRung ? (
                      <line
                        key={`rung-${r}-${g}`}
                        x1={colX(g)} y1={rungY(r)}
                        x2={colX(g + 1)} y2={rungY(r)}
                        stroke="currentColor"
                        strokeWidth={2}
                        className="text-border"
                      />
                    ) : null
                  )
                )}

                {/* Player paths (revealed) */}
                {paths.map((cols, i) => {
                  const isRevealed = revealed.has(i);
                  const color = PATH_COLORS[i % PATH_COLORS.length];
                  const pts = buildPathPoints(cols);
                  return (
                    <polyline
                      key={`path-${i}`}
                      points={pts}
                      fill="none"
                      stroke={color}
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pathLength={1}
                      style={{
                        strokeDasharray: 1,
                        strokeDashoffset: isRevealed ? 0 : 1,
                        transition: isRevealed ? "stroke-dashoffset 1.2s ease-in-out" : "none",
                        opacity: isRevealed ? 1 : 0,
                      }}
                    />
                  );
                })}

                {/* Player name labels at top */}
                {ladderIds.map((_, i) => {
                  const user = getUserByIndex(i);
                  const isRevealed = revealed.has(i);
                  const color = PATH_COLORS[i % PATH_COLORS.length];
                  return (
                    <g key={`top-${i}`}>
                      <rect
                        x={colX(i) - 26} y={4}
                        width={52} height={26}
                        rx={13}
                        fill={isRevealed ? color : "hsl(var(--secondary))"}
                        style={{ transition: "fill 0.3s" }}
                      />
                      <text
                        x={colX(i)} y={21}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight="600"
                        fill={isRevealed ? "white" : "hsl(var(--muted-foreground))"}
                        style={{ transition: "fill 0.3s", userSelect: "none" }}
                      >
                        {user?.name ?? "?"}
                      </text>
                    </g>
                  );
                })}

                {/* Result labels at bottom */}
                {ladderIds.map((_, i) => {
                  // Find which player ends at column i
                  const playerIdx = paths.findIndex(cols => cols[cols.length - 1] === i);
                  const isRevealed = playerIdx !== -1 && revealed.has(playerIdx);
                  const color = playerIdx !== -1 ? PATH_COLORS[playerIdx % PATH_COLORS.length] : undefined;
                  const label = results[i] ?? `결과 ${i + 1}`;
                  return (
                    <g key={`bottom-${i}`}>
                      <rect
                        x={colX(i) - 26} y={HEADER_H + LADDER_ROWS * ROW_SPACING + 6}
                        width={52} height={26}
                        rx={13}
                        fill={isRevealed && color ? color : "hsl(var(--secondary))"}
                        style={{ transition: "fill 0.3s" }}
                      />
                      <text
                        x={colX(i)} y={HEADER_H + LADDER_ROWS * ROW_SPACING + 23}
                        textAnchor="middle"
                        fontSize={9}
                        fontWeight="600"
                        fill={isRevealed ? "white" : "hsl(var(--muted-foreground))"}
                        style={{ transition: "fill 0.3s", userSelect: "none" }}
                      >
                        {label.length > 6 ? label.slice(0, 5) + "…" : label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Reveal buttons per player */}
            <div className="space-y-2">
              {ladderIds.map((_, i) => {
                const user = getUserByIndex(i);
                const isRevealed = revealed.has(i);
                const finalCol = paths[i]?.[paths[i].length - 1] ?? i;
                const result = results[finalCol] ?? `결과 ${finalCol + 1}`;
                const color = PATH_COLORS[i % PATH_COLORS.length];
                const uIdx = userColorIndex(i);
                return (
                  <div
                    key={i}
                    data-testid={`ladder-reveal-row-${i}`}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all",
                      isRevealed ? "border-transparent" : "bg-secondary/30 border-border"
                    )}
                    style={isRevealed ? { backgroundColor: `${color}18`, borderColor: `${color}40` } : {}}
                  >
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0", AVATAR_COLORS[uIdx % AVATAR_COLORS.length])}>
                      {user?.name[0]}
                    </div>
                    <div className="flex-1 font-medium">{user?.name}</div>
                    {isRevealed ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color }}>{result}</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => revealPlayer(i)}
                        data-testid={`button-reveal-${i}`}
                        className="gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        공개
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              {!allRevealed && (
                <Button variant="outline" className="flex-1 gap-2" onClick={revealAll} data-testid="button-reveal-all">
                  <EyeOff className="w-4 h-4" />
                  전체 공개
                </Button>
              )}
              <Button variant="ghost" onClick={reset} data-testid="button-ladder-reset" className={allRevealed ? "flex-1 gap-2" : "gap-2"}>
                <RotateCcw className="w-4 h-4" />
                {allRevealed ? "다시 하기" : "초기화"}
              </Button>
              <Button variant="outline" onClick={generate} data-testid="button-ladder-regenerate" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                재생성
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 rounded-2xl border border-dashed border-border text-muted-foreground">
            <div className="text-4xl mb-2">🪜</div>
            <p className="text-sm mb-4">아래 버튼을 눌러 사다리를 생성하세요</p>
          </div>
        )}

        <Button
          className="w-full h-12 text-base font-bold gap-2"
          onClick={generate}
          disabled={n < 2}
          data-testid="button-generate-ladder"
        >
          <RefreshCw className="w-5 h-5" />
          {generated ? "사다리 다시 생성" : "사다리 생성"}
        </Button>
      </div>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function Games() {
  const { data: users } = useUsers();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [prevFirstId, setPrevFirstId] = useState<number | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [hasShuffled, setHasShuffled] = useState(false);

  const [timerMinutes, setTimerMinutes] = useState(10);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [noRepeatFirst, setNoRepeatFirst] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = timerMinutes * 60 + timerSeconds;

  useEffect(() => {
    if (users && selectedIds.length === 0) {
      setSelectedIds(users.map((u: any) => u.id));
    }
  }, [users]);

  const toggleMember = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter(x => x !== id) : prev
        : [...prev, id]
    );
  };

  const doShuffle = useCallback((avoidFirst: number | null) => {
    if (selectedIds.length === 0) return;
    setIsShuffling(true);
    setTimeout(() => {
      const newOrder = avoidFirst !== null && noRepeatFirst
        ? shuffleAvoidingFirst(selectedIds, avoidFirst)
        : shuffleArray(selectedIds);
      setOrder(newOrder);
      setHasShuffled(true);
      setIsShuffling(false);
    }, 400);
  }, [selectedIds, noRepeatFirst]);

  const handleShuffle = () => {
    const avoid = hasShuffled && order.length > 0 ? order[0] : null;
    setPrevFirstId(order[0] ?? null);
    doShuffle(avoid);
    if (timerRunning) setRemaining(totalSeconds);
  };

  const startTimer = () => {
    if (totalSeconds === 0) return;
    setRemaining(totalSeconds);
    setTimerRunning(true);
  };
  const pauseTimer = () => setTimerRunning(false);
  const resetTimer = () => { setTimerRunning(false); setRemaining(totalSeconds); };

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            const avoid = order.length > 0 ? order[0] : null;
            setPrevFirstId(order[0] ?? null);
            doShuffle(avoid);
            return totalSeconds;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning, order, doShuffle, totalSeconds]);

  const displayRemaining = timerRunning || remaining > 0 ? remaining : totalSeconds;
  const mins = Math.floor(displayRemaining / 60);
  const secs = displayRemaining % 60;
  const progress = totalSeconds > 0 ? (displayRemaining / totalSeconds) * 100 : 100;

  const getUserById = (id: number) => users?.find((u: any) => u.id === id);

  const rankLabels = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
  const rankColors = [
    "from-amber-400 to-orange-400",
    "from-slate-400 to-slate-500",
    "from-orange-400 to-red-400",
    "from-violet-400 to-purple-500",
  ];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display font-bold">Games</h1>
          <p className="text-muted-foreground">게임 도우미 기능 모음</p>
        </div>

        {/* ── Feature 1: Billiards Order ── */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">🎱</div>
              <div>
                <h2 className="text-xl font-bold">당구 순서 정하기</h2>
                <p className="text-sm text-white/80">랜덤으로 순서를 정하고 타이머로 자동 교체</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">참여 멤버 선택</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {users?.map((user: any, idx: number) => {
                  const isOn = selectedIds.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleMember(user.id)}
                      data-testid={`member-toggle-${user.id}`}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-medium transition-all",
                        isOn
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-secondary/30 text-muted-foreground border-border hover:border-primary/40"
                      )}
                    >
                      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold", AVATAR_COLORS[idx % AVATAR_COLORS.length])}>
                        {user.name[0]}
                      </div>
                      {user.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 py-3 px-4 bg-secondary/30 rounded-xl">
              <Switch id="no-repeat" checked={noRepeatFirst} onCheckedChange={setNoRepeatFirst} data-testid="switch-no-repeat" />
              <Label htmlFor="no-repeat" className="text-sm cursor-pointer">순서 바꿀 때 앞 사람 반복 안됨</Label>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground mb-3">현재 순서</div>
              {!hasShuffled ? (
                <div className="text-center py-10 rounded-2xl border border-dashed border-border text-muted-foreground">
                  <div className="text-4xl mb-2">🎱</div>
                  <p className="text-sm">아래 버튼을 눌러 순서를 정해주세요</p>
                </div>
              ) : (
                <div className={cn("space-y-2 transition-all duration-300", isShuffling && "opacity-30 blur-sm scale-95")}>
                  {order.map((userId, idx) => {
                    const user = getUserById(userId);
                    if (!user) return null;
                    const userIdx = users?.findIndex((u: any) => u.id === userId) ?? 0;
                    return (
                      <div
                        key={userId}
                        data-testid={`order-slot-${idx}`}
                        className={cn(
                          "flex items-center gap-4 p-3 rounded-xl transition-all",
                          idx === 0
                            ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/50"
                            : "bg-secondary/30 border border-transparent"
                        )}
                      >
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md bg-gradient-to-br", rankColors[idx] ?? "from-gray-400 to-gray-500")}>
                          {idx + 1}
                        </div>
                        <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white font-bold", AVATAR_COLORS[userIdx % AVATAR_COLORS.length])}>
                          {user.name[0]}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{rankLabels[idx] ?? `${idx + 1}번째`}</div>
                        </div>
                        {idx === 0 && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">🎱 선공</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Button
              className="w-full h-12 text-base font-bold gap-2"
              onClick={handleShuffle}
              disabled={isShuffling || selectedIds.length === 0}
              data-testid="button-shuffle"
            >
              <Shuffle className={cn("w-5 h-5", isShuffling && "animate-spin")} />
              {hasShuffled ? "순서 다시 정하기" : "랜덤 순서 정하기"}
            </Button>

            {/* Timer */}
            <div className="border-t border-border pt-5 space-y-4">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">자동 교체 타이머</span>
              </div>
              <div className="relative flex items-center justify-center py-4">
                <div className="relative w-36 h-36">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="8" className="text-secondary" />
                    <circle
                      cx="50" cy="50" r="44" fill="none"
                      stroke="currentColor" strokeWidth="8"
                      className={cn("transition-all duration-1000", timerRunning ? "text-cyan-500" : "text-primary/50")}
                      strokeDasharray={`${2 * Math.PI * 44}`}
                      strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-display font-bold tabular-nums">
                      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                    </span>
                  </div>
                </div>
              </div>

              {!timerRunning && (
                <div className="flex items-center justify-center gap-6">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">분</span>
                    <div className="flex flex-col items-center">
                      <button onClick={() => setTimerMinutes(m => Math.min(99, m + 1))} className="p-1 hover:text-primary" data-testid="btn-min-up"><ChevronUp className="w-4 h-4" /></button>
                      <span className="text-2xl font-bold tabular-nums w-10 text-center">{String(timerMinutes).padStart(2, "0")}</span>
                      <button onClick={() => setTimerMinutes(m => Math.max(0, m - 1))} className="p-1 hover:text-primary" data-testid="btn-min-down"><ChevronDown className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-muted-foreground mt-4">:</span>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">초</span>
                    <div className="flex flex-col items-center">
                      <button onClick={() => setTimerSeconds(s => s >= 55 ? 0 : s + 5)} className="p-1 hover:text-primary" data-testid="btn-sec-up"><ChevronUp className="w-4 h-4" /></button>
                      <span className="text-2xl font-bold tabular-nums w-10 text-center">{String(timerSeconds).padStart(2, "0")}</span>
                      <button onClick={() => setTimerSeconds(s => s <= 0 ? 55 : s - 5)} className="p-1 hover:text-primary" data-testid="btn-sec-down"><ChevronDown className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {!timerRunning ? (
                  <Button className="flex-1 gap-2" onClick={startTimer} disabled={totalSeconds === 0 || !hasShuffled} data-testid="button-timer-start">
                    <Play className="w-4 h-4" />타이머 시작
                  </Button>
                ) : (
                  <Button variant="outline" className="flex-1 gap-2" onClick={pauseTimer} data-testid="button-timer-pause">
                    <Pause className="w-4 h-4" />일시정지
                  </Button>
                )}
                <Button variant="ghost" onClick={resetTimer} data-testid="button-timer-reset">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
              {timerRunning && (
                <p className="text-xs text-center text-muted-foreground">
                  타이머가 끝나면 자동으로 순서가 바뀝니다{noRepeatFirst && " (앞 사람 반복 없음)"}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* ── Feature 2: Ladder Game ── */}
        {users && <LadderGame users={users} />}
      </div>
    </Layout>
  );
}
