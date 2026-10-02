import express, { type ErrorRequestHandler, type Response } from 'express';

import { computeLevels, computeOverview } from './analytics/aggregate';
import { analyticsBatchSchema, formatIssues, type ValidationIssue } from './analytics/schema';
import type { AnalyticsStore } from './analytics/store';

export const MAX_BODY_SIZE = '64kb';

const sendError = (res: Response, status: number, code: string, message: string, issues?: ValidationIssue[]) => {
  res.status(status).json({ error: { code, message, ...(issues && { issues }) } });
};

export const createApp = (store: AnalyticsStore, log: (...args: unknown[]) => void = console.error) => {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Write API: validates the whole batch first and stores it atomically, or rejects it entirely.
  app.post('/api/analytics/events', express.json({ limit: MAX_BODY_SIZE }), async (req, res) => {
    if (!req.is('application/json')) {
      sendError(res, 415, 'unsupported_media_type', 'Content-Type must be application/json.');
      return;
    }
    const parsed = analyticsBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'invalid_events', 'The event batch is invalid; no events were stored.', formatIssues(parsed.error));
      return;
    }
    await store.saveEvents(parsed.data.events);
    res.status(201).json({ accepted: parsed.data.events.length });
  });

  // Read API for the dashboard. Finished plays (gameplay_end events) are the unit of analysis.
  app.get('/api/analytics/overview', async (_req, res) => {
    res.json(computeOverview(await store.listPlayOutcomes()));
  });

  app.get('/api/analytics/levels', async (_req, res) => {
    res.json(computeLevels(await store.listPlayOutcomes()));
  });

  app.use('/api', (_req, res) => {
    sendError(res, 404, 'not_found', 'Not found.');
  });

  // Client errors from the JSON parser keep their status; everything else is a generic 500 without
  // internal details.
  const handleError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error?.type === 'entity.parse.failed') {
      sendError(res, 400, 'invalid_json', 'Request body is not valid JSON.');
    } else if (error?.type === 'entity.too.large') {
      sendError(res, 413, 'payload_too_large', `Request body exceeds ${MAX_BODY_SIZE}.`);
    } else if (typeof error?.status === 'number' && error.status >= 400 && error.status < 500) {
      sendError(res, error.status, 'bad_request', 'Bad request.');
    } else {
      log('[analytics] request failed', error);
      sendError(res, 500, 'internal_error', 'Internal server error.');
    }
  };
  app.use(handleError);

  return app;
};
