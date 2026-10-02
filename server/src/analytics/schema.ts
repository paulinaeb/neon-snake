import { z } from 'zod';

// Wire format of the game's analytics events (src/analytics/events.ts in the game). Objects are
// strict: unknown fields are rejected instead of being stored. z.number() rejects NaN and Infinity.

export const MAX_BATCH_SIZE = 100;

const base = {
  playId: z.uuid(),
  level: z.number().int().positive(),
  timestamp: z.iso.datetime()
};
const score = z.number().int().nonnegative();
const progress = z.number().min(0).max(1);

export const gameplayStartSchema = z.strictObject({
  type: z.literal('gameplay_start'),
  ...base
});

export const scoreChangeSchema = z.strictObject({
  type: z.literal('score_change'),
  ...base,
  score,
  progress
});

export const gameplayEndSchema = z.strictObject({
  type: z.literal('gameplay_end'),
  ...base,
  result: z.enum(['complete', 'fail', 'quit']),
  score,
  progress,
  durationMs: z.number().nonnegative()
});

export const analyticsEventSchema = z.discriminatedUnion('type', [
  gameplayStartSchema,
  scoreChangeSchema,
  gameplayEndSchema
]);

export const analyticsBatchSchema = z.strictObject({
  events: z.array(analyticsEventSchema).min(1).max(MAX_BATCH_SIZE)
});

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type GameplayResult = z.infer<typeof gameplayEndSchema>['result'];

export type ValidationIssue = { path: string; message: string };

export const formatIssues = (error: z.ZodError, limit = 20): ValidationIssue[] =>
  error.issues.slice(0, limit).map((issue) => ({
    path: issue.path.map(String).join('.') || '(root)',
    message: issue.message
  }));
