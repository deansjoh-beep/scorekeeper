
import { z } from 'zod';
import { insertMatchSchema, insertScoreSchema, matches, users, rounds, userHandicaps, posts, comments } from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/users',
      input: z.object({
        name: z.string().min(1, "이름을 입력해주세요").max(20, "이름은 20자 이하로 입력해주세요"),
        avatarColor: z.string().optional(),
      }),
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/users/:id',
      responses: {
        204: z.void(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    updateHandicap: {
      method: 'PATCH' as const,
      path: '/api/users/:id/handicap',
      input: z.object({
        golfHandicap: z.number().min(0).max(54),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  handicaps: {
    list: {
      method: 'GET' as const,
      path: '/api/handicaps',
      responses: {
        200: z.array(z.custom<typeof userHandicaps.$inferSelect>()),
      },
    },
    getByDate: {
      method: 'GET' as const,
      path: '/api/handicaps/by-date/:date',
      responses: {
        200: z.array(z.custom<typeof userHandicaps.$inferSelect>()),
      },
    },
    upsert: {
      method: 'PUT' as const,
      path: '/api/handicaps',
      input: z.object({
        userId: z.number(),
        handicapDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식으로 입력해주세요"),
        golfHandicap: z.number().min(0).max(54),
      }),
      responses: {
        200: z.custom<typeof userHandicaps.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/handicaps/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  matches: {
    list: {
      method: 'GET' as const,
      path: '/api/matches',
      input: z.object({
        gameType: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.any()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/matches',
      input: z.object({
        gameType: z.string(),
        playedAt: z.string(),
        notes: z.string().optional(),
        scores: z.array(z.object({
          userId: z.number(),
          scoreValue: z.number(),
          handicap: z.number().optional(),
          bonusPoints: z.number().optional(),
          isWinner: z.number().optional(),
        })),
      }),
      responses: {
        201: z.custom<typeof matches.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/matches/:id',
      responses: {
        200: z.any(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/matches/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/matches/:id',
      input: z.object({
        gameType: z.string().optional(),
        playedAt: z.string().optional(),
        notes: z.string().optional(),
        scores: z.array(z.object({
          userId: z.number(),
          scoreValue: z.number(),
          handicap: z.number().optional(),
          bonusPoints: z.number().optional(),
          isWinner: z.number().optional(),
        })).optional(),
      }),
      responses: {
        200: z.custom<typeof matches.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    }
  },
  stats: {
    get: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.array(z.object({
          userId: z.number(),
          userName: z.string(),
          totalGames: z.number(),
          wins: z.number(),
        })),
      },
    }
  },
  rounds: {
    list: {
      method: 'GET' as const,
      path: '/api/rounds',
      responses: {
        200: z.array(z.any()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/rounds',
      input: z.object({
        name: z.string().min(1, "Name is required"),
        matchIds: z.array(z.number()),
      }),
      responses: {
        201: z.custom<typeof rounds.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/rounds/:id',
      responses: {
        200: z.any(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/rounds/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  posts: {
    list: {
      method: 'GET' as const,
      path: '/api/posts',
      responses: {
        200: z.array(z.any()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/posts',
      input: z.object({
        authorName: z.string().min(1, "작성자 이름을 입력해주세요").max(50),
        title: z.string().min(1, "제목을 입력해주세요").max(200),
        content: z.string().min(1, "내용을 입력해주세요"),
      }),
      responses: {
        201: z.custom<typeof posts.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/posts/:id',
      responses: {
        200: z.any(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/posts/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  comments: {
    create: {
      method: 'POST' as const,
      path: '/api/posts/:postId/comments',
      input: z.object({
        authorName: z.string().min(1, "작성자 이름을 입력해주세요").max(50),
        content: z.string().min(1, "댓글 내용을 입력해주세요"),
      }),
      responses: {
        201: z.custom<typeof comments.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/comments/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// ============================================
// TYPE HELPERS
// ============================================
export type CreateMatchInput = z.infer<typeof api.matches.create.input>;
export type UpdateMatchInput = z.infer<typeof api.matches.update.input>;
export type CreateRoundInput = z.infer<typeof api.rounds.create.input>;
