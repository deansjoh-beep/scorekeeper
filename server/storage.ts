
import { db } from "./db";
import {
  users,
  matches,
  scores,
  rounds,
  roundMatches,
  userHandicaps,
  posts,
  comments,
  type User,
  type Match,
  type Score,
  type Round,
  type UserHandicap,
  type Post,
  type Comment,
  type CreateMatchRequest,
  type UpdateMatchRequest,
  type CreateRoundRequest,
  type MatchWithDetails,
  type RoundWithDetails,
  type PostWithComments,
  type UserStats
} from "@shared/schema";
import { eq, desc, sql, inArray, and, lte } from "drizzle-orm";

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  createUser(name: string, avatarColor?: string): Promise<User>;
  deleteUser(id: number): Promise<'deleted' | 'not_found' | 'has_scores'>;
  updateUserHandicap(id: number, golfHandicap: number): Promise<User | undefined>;
  
  // Date-based Handicaps
  getHandicaps(): Promise<UserHandicap[]>;
  getHandicapsByDate(date: string): Promise<UserHandicap[]>;
  upsertHandicap(userId: number, handicapDate: string, golfHandicap: number): Promise<UserHandicap>;
  deleteHandicap(id: number): Promise<boolean>;
  
  // Matches
  createMatch(matchData: CreateMatchRequest): Promise<Match>;
  updateMatch(id: number, matchData: UpdateMatchRequest): Promise<Match | undefined>;
  getMatches(gameType?: string): Promise<MatchWithDetails[]>;
  getMatch(id: number): Promise<MatchWithDetails | undefined>;
  deleteMatch(id: number): Promise<void>;

  // Rounds
  createRound(roundData: CreateRoundRequest): Promise<Round>;
  getRounds(): Promise<RoundWithDetails[]>;
  getRound(id: number): Promise<RoundWithDetails | undefined>;
  deleteRound(id: number): Promise<void>;

  // Stats
  getUserStats(): Promise<UserStats[]>;

  // Posts
  createPost(authorName: string, title: string, content: string): Promise<Post>;
  getPosts(): Promise<PostWithComments[]>;
  getPost(id: number): Promise<PostWithComments | undefined>;
  deletePost(id: number): Promise<boolean>;

  // Comments
  createComment(postId: number, authorName: string, content: string): Promise<Comment | null>;
  deleteComment(id: number): Promise<boolean>;

  // Seed
  seedUsers(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.id);
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async updateUserHandicap(id: number, golfHandicap: number): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ golfHandicap })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async createUser(name: string, avatarColor?: string): Promise<User> {
    const colors = [
      "hsl(221.2 83.2% 53.3%)",
      "hsl(142.1 76.2% 36.3%)",
      "hsl(346.8 77.2% 49.8%)",
      "hsl(47.9 95.8% 53.1%)",
      "hsl(262.1 83.3% 57.8%)",
      "hsl(24.6 95% 53.1%)",
      "hsl(198.6 88.7% 48.4%)",
      "hsl(330.4 81.2% 60.4%)",
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const [newUser] = await db.insert(users).values({
      name,
      avatarColor: avatarColor || randomColor,
    }).returning();
    return newUser;
  }

  async deleteUser(id: number): Promise<'deleted' | 'not_found' | 'has_scores'> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) return 'not_found';
    
    const userScores = await db.select().from(scores).where(eq(scores.userId, id));
    if (userScores.length > 0) return 'has_scores';
    
    await db.delete(userHandicaps).where(eq(userHandicaps.userId, id));
    await db.delete(users).where(eq(users.id, id));
    return 'deleted';
  }

  // === Date-based Handicaps ===

  async getHandicaps(): Promise<UserHandicap[]> {
    return await db.select().from(userHandicaps).orderBy(desc(userHandicaps.handicapDate), userHandicaps.userId);
  }

  async getHandicapsByDate(date: string): Promise<UserHandicap[]> {
    // Get all records on or before the date, then take most recent per user
    const allRecords = await db
      .select()
      .from(userHandicaps)
      .where(lte(userHandicaps.handicapDate, date))
      .orderBy(userHandicaps.userId, desc(userHandicaps.handicapDate));

    const seenUsers = new Set<number>();
    const result: UserHandicap[] = [];
    for (const record of allRecords) {
      if (!seenUsers.has(record.userId)) {
        seenUsers.add(record.userId);
        result.push(record);
      }
    }
    return result;
  }

  async upsertHandicap(userId: number, handicapDate: string, golfHandicap: number): Promise<UserHandicap> {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(userHandicaps)
        .where(and(eq(userHandicaps.userId, userId), eq(userHandicaps.handicapDate, handicapDate)));
      
      if (existing) {
        const [updated] = await tx
          .update(userHandicaps)
          .set({ golfHandicap })
          .where(and(eq(userHandicaps.userId, userId), eq(userHandicaps.handicapDate, handicapDate)))
          .returning();
        return updated;
      } else {
        const [inserted] = await tx
          .insert(userHandicaps)
          .values({ userId, handicapDate, golfHandicap })
          .returning();
        return inserted;
      }
    });
  }

  async deleteHandicap(id: number): Promise<boolean> {
    const result = await db.delete(userHandicaps).where(eq(userHandicaps.id, id)).returning();
    return result.length > 0;
  }

  async createMatch(matchData: CreateMatchRequest): Promise<Match> {
    return await db.transaction(async (tx) => {
      const [newMatch] = await tx.insert(matches).values({
        gameType: matchData.gameType,
        playedAt: matchData.playedAt,
        notes: matchData.notes,
      }).returning();

      if (matchData.scores.length > 0) {
        await tx.insert(scores).values(
          matchData.scores.map(s => ({
            matchId: newMatch.id,
            userId: s.userId,
            scoreValue: s.scoreValue,
            handicap: s.handicap || 0,
            bonusPoints: s.bonusPoints || 0,
            isWinner: s.isWinner || 0,
          }))
        );
      }

      return newMatch;
    });
  }

  async getMatches(gameType?: string): Promise<MatchWithDetails[]> {
    let query = db.select().from(matches).orderBy(desc(matches.playedAt));
    
    if (gameType) {
      query = query.where(eq(matches.gameType, gameType)) as any;
    }

    const foundMatches = await query;
    
    const results: MatchWithDetails[] = [];
    
    for (const match of foundMatches) {
      const matchScores = await db.select()
        .from(scores)
        .where(eq(scores.matchId, match.id));
      
      const scoresWithUsers = await Promise.all(matchScores.map(async (s) => {
        const [user] = await db.select().from(users).where(eq(users.id, s.userId));
        return { ...s, user };
      }));

      results.push({ ...match, scores: scoresWithUsers });
    }

    return results;
  }

  async getMatch(id: number): Promise<MatchWithDetails | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    if (!match) return undefined;

    const matchScores = await db.select()
      .from(scores)
      .where(eq(scores.matchId, match.id));
    
    const scoresWithUsers = await Promise.all(matchScores.map(async (s) => {
      const [user] = await db.select().from(users).where(eq(users.id, s.userId));
      return { ...s, user };
    }));

    return { ...match, scores: scoresWithUsers };
  }

  async updateMatch(id: number, matchData: UpdateMatchRequest): Promise<Match | undefined> {
    return await db.transaction(async (tx) => {
      const [existingMatch] = await tx.select().from(matches).where(eq(matches.id, id));
      if (!existingMatch) return undefined;

      const updateData: Partial<Match> = {};
      if (matchData.gameType !== undefined) updateData.gameType = matchData.gameType;
      if (matchData.playedAt !== undefined) updateData.playedAt = matchData.playedAt;
      if (matchData.notes !== undefined) updateData.notes = matchData.notes;

      let updatedMatch = existingMatch;
      if (Object.keys(updateData).length > 0) {
        const [result] = await tx.update(matches)
          .set(updateData)
          .where(eq(matches.id, id))
          .returning();
        updatedMatch = result;
      }

      if (matchData.scores && matchData.scores.length > 0) {
        await tx.delete(scores).where(eq(scores.matchId, id));
        await tx.insert(scores).values(
          matchData.scores.map(s => ({
            matchId: id,
            userId: s.userId,
            scoreValue: s.scoreValue,
            handicap: s.handicap || 0,
            bonusPoints: s.bonusPoints || 0,
            isWinner: s.isWinner || 0,
          }))
        );
      }

      return updatedMatch;
    });
  }

  async deleteMatch(id: number): Promise<void> {
    await db.delete(roundMatches).where(eq(roundMatches.matchId, id));
    await db.delete(scores).where(eq(scores.matchId, id));
    await db.delete(matches).where(eq(matches.id, id));
  }

  async createRound(roundData: CreateRoundRequest): Promise<Round> {
    return await db.transaction(async (tx) => {
      const [newRound] = await tx.insert(rounds).values({
        name: roundData.name,
      }).returning();

      if (roundData.matchIds.length > 0) {
        await tx.insert(roundMatches).values(
          roundData.matchIds.map(matchId => ({
            roundId: newRound.id,
            matchId: matchId,
          }))
        );
      }

      return newRound;
    });
  }

  async getRounds(): Promise<RoundWithDetails[]> {
    const allRounds = await db.select().from(rounds).orderBy(desc(rounds.createdAt));
    
    const results: RoundWithDetails[] = [];
    
    for (const round of allRounds) {
      const roundMatchLinks = await db.select()
        .from(roundMatches)
        .where(eq(roundMatches.roundId, round.id));
      
      const matchIds = roundMatchLinks.map(rm => rm.matchId);
      
      const matchesWithDetails: MatchWithDetails[] = [];
      for (const matchId of matchIds) {
        const match = await this.getMatch(matchId);
        if (match) matchesWithDetails.push(match);
      }
      
      results.push({ ...round, matches: matchesWithDetails });
    }
    
    return results;
  }

  async getRound(id: number): Promise<RoundWithDetails | undefined> {
    const [round] = await db.select().from(rounds).where(eq(rounds.id, id));
    if (!round) return undefined;

    const roundMatchLinks = await db.select()
      .from(roundMatches)
      .where(eq(roundMatches.roundId, round.id));
    
    const matchIds = roundMatchLinks.map(rm => rm.matchId);
    
    const matchesWithDetails: MatchWithDetails[] = [];
    for (const matchId of matchIds) {
      const match = await this.getMatch(matchId);
      if (match) matchesWithDetails.push(match);
    }

    return { ...round, matches: matchesWithDetails };
  }

  async deleteRound(id: number): Promise<void> {
    await db.delete(roundMatches).where(eq(roundMatches.roundId, id));
    await db.delete(rounds).where(eq(rounds.id, id));
  }

  async getUserStats(): Promise<UserStats[]> {
    const allUsers = await this.getUsers();
    
    const stats = await Promise.all(allUsers.map(async (user) => {
      const userScores = await db.select().from(scores).where(eq(scores.userId, user.id));
      const wins = userScores.filter(s => s.isWinner === 1).length;
      
      return {
        userId: user.id,
        userName: user.name,
        totalGames: userScores.length,
        wins: wins,
      };
    }));

    return stats;
  }

  async createPost(authorName: string, title: string, content: string): Promise<Post> {
    const [newPost] = await db.insert(posts).values({ authorName, title, content }).returning();
    return newPost;
  }

  async getPosts(): Promise<PostWithComments[]> {
    const allPosts = await db.select().from(posts).orderBy(desc(posts.createdAt));
    
    const results: PostWithComments[] = [];
    for (const post of allPosts) {
      const postComments = await db.select()
        .from(comments)
        .where(eq(comments.postId, post.id))
        .orderBy(comments.createdAt);
      results.push({ ...post, comments: postComments });
    }
    
    return results;
  }

  async getPost(id: number): Promise<PostWithComments | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    if (!post) return undefined;

    const postComments = await db.select()
      .from(comments)
      .where(eq(comments.postId, post.id))
      .orderBy(comments.createdAt);

    return { ...post, comments: postComments };
  }

  async deletePost(id: number): Promise<boolean> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    if (!post) return false;
    
    await db.delete(comments).where(eq(comments.postId, id));
    await db.delete(posts).where(eq(posts.id, id));
    return true;
  }

  async createComment(postId: number, authorName: string, content: string): Promise<Comment | null> {
    const [post] = await db.select().from(posts).where(eq(posts.id, postId));
    if (!post) return null;
    
    const [newComment] = await db.insert(comments).values({ postId, authorName, content }).returning();
    return newComment;
  }

  async deleteComment(id: number): Promise<boolean> {
    const result = await db.delete(comments).where(eq(comments.id, id)).returning();
    return result.length > 0;
  }

  async seedUsers(): Promise<void> {
    const existing = await this.getUsers();
    if (existing.length === 0) {
      await db.insert(users).values([
        { name: "정성욱", avatarColor: "hsl(221.2 83.2% 53.3%)" },
        { name: "정간채", avatarColor: "hsl(142.1 76.2% 36.3%)" },
        { name: "오세진", avatarColor: "hsl(346.8 77.2% 49.8%)" },
        { name: "김태정", avatarColor: "hsl(47.9 95.8% 53.1%)" },
      ]);
    }
  }
}

export const storage = new DatabaseStorage();
