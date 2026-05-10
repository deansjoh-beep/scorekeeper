
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // === Users ===
  app.get(api.users.list.path, async (req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  app.post(api.users.create.path, async (req, res) => {
    try {
      const input = api.users.create.input.parse(req.body);
      const user = await storage.createUser(input.name, input.avatarColor);
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.delete(api.users.delete.path, async (req, res) => {
    const result = await storage.deleteUser(Number(req.params.id));
    if (result === 'not_found') return res.status(404).json({ message: '멤버를 찾을 수 없습니다.' });
    if (result === 'has_scores') return res.status(400).json({ message: '게임 기록이 있는 멤버는 삭제할 수 없습니다.' });
    res.status(204).send();
  });

  app.patch(api.users.updateHandicap.path, async (req, res) => {
    try {
      const input = api.users.updateHandicap.input.parse(req.body);
      const user = await storage.updateUserHandicap(Number(req.params.id), input.golfHandicap);
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  // === Date-based Handicaps ===
  // IMPORTANT: /api/handicaps/by-date/:date must be registered BEFORE /api/handicaps/:id
  app.get(api.handicaps.list.path, async (req, res) => {
    const handicaps = await storage.getHandicaps();
    res.json(handicaps);
  });

  app.get(api.handicaps.getByDate.path, async (req, res) => {
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: '날짜는 YYYY-MM-DD 형식이어야 합니다.' });
    }
    const handicaps = await storage.getHandicapsByDate(date);
    res.json(handicaps);
  });

  app.put(api.handicaps.upsert.path, async (req, res) => {
    try {
      const input = api.handicaps.upsert.input.parse(req.body);
      const handicap = await storage.upsertHandicap(input.userId, input.handicapDate, input.golfHandicap);
      res.json(handicap);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.delete(api.handicaps.delete.path, async (req, res) => {
    const deleted = await storage.deleteHandicap(Number(req.params.id));
    if (!deleted) return res.status(404).json({ message: '핸디캡 기록을 찾을 수 없습니다.' });
    res.status(204).send();
  });

  // === Matches ===
  app.get(api.matches.list.path, async (req, res) => {
    const gameType = req.query.gameType as string | undefined;
    const matches = await storage.getMatches(gameType);
    res.json(matches);
  });

  app.post(api.matches.create.path, async (req, res) => {
    try {
      const input = api.matches.create.input.parse(req.body);
      const match = await storage.createMatch(input);
      res.status(201).json(match);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.get(api.matches.get.path, async (req, res) => {
    const match = await storage.getMatch(Number(req.params.id));
    if (!match) return res.status(404).json({ message: 'Match not found' });
    res.json(match);
  });

  app.delete(api.matches.delete.path, async (req, res) => {
    await storage.deleteMatch(Number(req.params.id));
    res.status(204).send();
  });

  app.put(api.matches.update.path, async (req, res) => {
    try {
      const input = api.matches.update.input.parse(req.body);
      const match = await storage.updateMatch(Number(req.params.id), input);
      if (!match) return res.status(404).json({ message: 'Match not found' });
      res.json(match);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  // === Stats ===
  app.get(api.stats.get.path, async (req, res) => {
    const stats = await storage.getUserStats();
    res.json(stats);
  });

  // === Rounds ===
  app.get(api.rounds.list.path, async (req, res) => {
    const rounds = await storage.getRounds();
    res.json(rounds);
  });

  app.post(api.rounds.create.path, async (req, res) => {
    try {
      const input = api.rounds.create.input.parse(req.body);
      const round = await storage.createRound(input);
      res.status(201).json(round);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.get(api.rounds.get.path, async (req, res) => {
    const round = await storage.getRound(Number(req.params.id));
    if (!round) return res.status(404).json({ message: 'Round not found' });
    res.json(round);
  });

  app.delete(api.rounds.delete.path, async (req, res) => {
    await storage.deleteRound(Number(req.params.id));
    res.status(204).send();
  });

  // === Posts ===
  app.get(api.posts.list.path, async (req, res) => {
    const posts = await storage.getPosts();
    res.json(posts);
  });

  app.post(api.posts.create.path, async (req, res) => {
    try {
      const input = api.posts.create.input.parse(req.body);
      const post = await storage.createPost(input.authorName, input.title, input.content);
      res.status(201).json(post);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.get(api.posts.get.path, async (req, res) => {
    const post = await storage.getPost(Number(req.params.id));
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json(post);
  });

  app.delete(api.posts.delete.path, async (req, res) => {
    const deleted = await storage.deletePost(Number(req.params.id));
    if (!deleted) return res.status(404).json({ message: 'Post not found' });
    res.status(204).send();
  });

  // === Comments ===
  app.post(api.comments.create.path, async (req, res) => {
    try {
      const input = api.comments.create.input.parse(req.body);
      const comment = await storage.createComment(Number(req.params.postId), input.authorName, input.content);
      if (!comment) return res.status(404).json({ message: 'Post not found' });
      res.status(201).json(comment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.delete(api.comments.delete.path, async (req, res) => {
    const deleted = await storage.deleteComment(Number(req.params.id));
    if (!deleted) return res.status(404).json({ message: 'Comment not found' });
    res.status(204).send();
  });

  return httpServer;
}
