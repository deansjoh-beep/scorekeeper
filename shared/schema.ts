
import { pgTable, text, serial, integer, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  avatarColor: text("avatar_color").default("blue"),
  golfHandicap: integer("golf_handicap").default(0),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  gameType: text("game_type").notNull(),
  playedAt: date("played_at").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scores = pgTable("scores", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  userId: integer("user_id").notNull(),
  scoreValue: integer("score_value").notNull(),
  handicap: integer("handicap").default(0),
  bonusPoints: integer("bonus_points").default(0),
  isWinner: integer("is_winner").default(0),
});

// 날짜별 핸디캡 테이블 (YYYY-MM-DD 형식)
export const userHandicaps = pgTable("user_handicaps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  handicapDate: text("handicap_date").notNull(), // YYYY-MM-DD
  golfHandicap: integer("golf_handicap").default(0).notNull(),
}, (table) => ({
  userDateIdx: uniqueIndex("user_date_idx").on(table.userId, table.handicapDate),
}));

export const rounds = pgTable("rounds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const roundMatches = pgTable("round_matches", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id").notNull(),
  matchId: integer("match_id").notNull(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorName: text("author_name").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const matchesRelations = relations(matches, ({ many }) => ({
  scores: many(scores),
  roundMatches: many(roundMatches),
}));

export const scoresRelations = relations(scores, ({ one }) => ({
  match: one(matches, {
    fields: [scores.matchId],
    references: [matches.id],
  }),
  user: one(users, {
    fields: [scores.userId],
    references: [users.id],
  }),
}));

export const roundsRelations = relations(rounds, ({ many }) => ({
  roundMatches: many(roundMatches),
}));

export const roundMatchesRelations = relations(roundMatches, ({ one }) => ({
  round: one(rounds, {
    fields: [roundMatches.roundId],
    references: [rounds.id],
  }),
  match: one(matches, {
    fields: [roundMatches.matchId],
    references: [matches.id],
  }),
}));

export const userHandicapsRelations = relations(userHandicaps, ({ one }) => ({
  user: one(users, {
    fields: [userHandicaps.userId],
    references: [users.id],
  }),
}));

export const postsRelations = relations(posts, ({ many }) => ({
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
}));

// === BASE SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertMatchSchema = createInsertSchema(matches).omit({ id: true, createdAt: true });
export const insertScoreSchema = createInsertSchema(scores).omit({ id: true });
export const insertRoundSchema = createInsertSchema(rounds).omit({ id: true, createdAt: true });
export const insertRoundMatchSchema = createInsertSchema(roundMatches).omit({ id: true });
export const insertUserHandicapSchema = createInsertSchema(userHandicaps).omit({ id: true });
export const insertPostSchema = createInsertSchema(posts).omit({ id: true, createdAt: true });
export const insertCommentSchema = createInsertSchema(comments).omit({ id: true, createdAt: true });

// === EXPLICIT API CONTRACT TYPES ===

export type User = typeof users.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Score = typeof scores.$inferSelect;
export type Round = typeof rounds.$inferSelect;
export type RoundMatch = typeof roundMatches.$inferSelect;
export type UserHandicap = typeof userHandicaps.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;

export type CreateMatchRequest = {
  gameType: string;
  playedAt: string;
  notes?: string;
  scores: {
    userId: number;
    scoreValue: number;
    handicap?: number;
    bonusPoints?: number;
    isWinner?: number;
  }[];
};

export type UpdateMatchRequest = {
  gameType?: string;
  playedAt?: string;
  notes?: string;
  scores?: {
    userId: number;
    scoreValue: number;
    handicap?: number;
    bonusPoints?: number;
    isWinner?: number;
  }[];
};

export type MatchWithDetails = Match & {
  scores: (Score & { user: User })[];
};

export type UserStats = {
  userId: number;
  userName: string;
  totalGames: number;
  wins: number;
  averageScore?: number;
};

export type CreateRoundRequest = {
  name: string;
  matchIds: number[];
};

export type RoundWithDetails = Round & {
  matches: MatchWithDetails[];
};

export type PostWithComments = Post & {
  comments: Comment[];
};
