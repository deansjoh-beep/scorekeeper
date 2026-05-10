import { Target, Club, Spade } from "lucide-react";
import { cn } from "@/lib/utils";

export type GameType = "billiards" | "golf" | "card";

interface GameIconProps {
  type: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function GameIcon({ type, className, size = "md" }: GameIconProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const containerSizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const containerClasses = {
    billiards: "bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
    golf: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    card: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
  };

  const normalizedType = type.toLowerCase() as GameType;
  const colorClass = containerClasses[normalizedType] || "bg-gray-100 text-gray-600";
  
  const Icon = () => {
    switch (normalizedType) {
      case "billiards": return <Target className={cn(sizeClasses[size], className)} />;
      case "golf": return <Club className={cn(sizeClasses[size], className)} />;
      case "card": return <Spade className={cn(sizeClasses[size], className)} />;
      default: return <Target className={cn(sizeClasses[size], className)} />;
    }
  };

  return (
    <div className={cn(
      "rounded-xl flex items-center justify-center shrink-0",
      containerSizes[size],
      colorClass
    )}>
      <Icon />
    </div>
  );
}
