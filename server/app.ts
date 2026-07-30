import cors from 'cors';
import express from 'express';
import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import type { PasteRow } from './db.js';

const pasteSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().min(1).max(100_000),
  language: z.string().trim().min(1).max(40).default('Plain Text'),
  visibility: z.enum(['public', 'unlisted', 'private']).default('public'),
});

const openapi = {
  openapi: '3.0.3',
  info: { title: 'PasteBin API', version: '1.0.0', description: 'Create, retrieve, list, and delete text or code pastes.' },
  servers: [{ url: 'http://localhost:3001' }],
  paths: {
    '/health': { get: { summary: 'Service health check', responses: { '200': { description: 'Healthy' } } } },
    '/api/pastes': {
      get: { summary: 'List and search pastes', responses: { '200': { description: 'Paste collection' } } },
      post: { summary: 'Create a paste', responses: { '201': { description: 'Paste created' }, '400': { description: 'Validation error' } } },
    },
    '/api/pastes/{id}': {
      get: { summary: 'Retrieve a paste', responses: { '200': { description: 'Paste' }, '404': { description: 'Not found' } } },
      delete: { summary: 'Delete a paste', responses: { '204': { description: 'Deleted' }, '404': { description: 'Not found' } } },
    },
    '/api/stats': { get: { summary: 'Dashboard statistics', responses: { '200': { description: 'Statistics' } } } },
  },
};

export function createApp(db: Database.Database) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'] }));
  app.use(express.json({ limit: '110kb' }));

  app.use((req, _res, next) => {
    const started = Date.now();
    console.info(JSON.stringify({ level: 'info', method: req.method, path: req.path, at: new Date().toISOString() }));
    req.on('close', () => console.info(JSON.stringify({ level: 'info', method: req.method, path: req.path, durationMs: Date.now() - started })));
    next();
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'pastebin-api', timestamp: new Date().toISOString() }));
  app.get('/openapi.json', (_req, res) => res.json(openapi));
  app.get('/api-docs', (_req, res) => res.type('html').send(`
    <!doctype html><html><head><title>PasteBin API Docs</title>
    <style>body{font:16px system-ui;max-width:900px;margin:50px auto;padding:0 24px;background:#111220;color:#e5e7eb}code{background:#232541;padding:3px 7px;border-radius:6px}.route{padding:18px;margin:14px 0;border:1px solid #393b5c;border-radius:12px}</style></head>
    <body><h1>PasteBin API v1</h1><p>JSON REST API. The machine-readable specification is at <a href="/openapi.json">/openapi.json</a>.</p>
    ${Object.entries(openapi.paths).map(([path, methods]) => `<div class="route"><strong>${path}</strong><p>${Object.entries(methods).map(([method, value]) => `<code>${method.toUpperCase()}</code> ${(value as { summary: string }).summary}`).join('<br><br>')}</p></div>`).join('')}
    </body></html>`));

  app.get('/api/pastes', (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const rows = search
      ? db.prepare(`SELECT * FROM pastes WHERE title LIKE ? OR language LIKE ? ORDER BY datetime(created_at) DESC LIMIT ?`).all(`%${search}%`, `%${search}%`, limit)
      : db.prepare(`SELECT * FROM pastes ORDER BY datetime(created_at) DESC LIMIT ?`).all(limit);
    res.json({ data: rows });
  });

  app.get('/api/stats', (_req, res) => {
    const stats = db.prepare(`
      SELECT COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN visibility = 'public' THEN 1 ELSE 0 END), 0) AS public,
        COALESCE(SUM(views), 0) AS views,
        COALESCE(SUM(LENGTH(content)), 0) AS bytes
      FROM pastes
    `).get();
    res.json(stats);
  });

  app.post('/api/pastes', (req, res) => {
    const parsed = pasteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid paste', details: parsed.error.flatten().fieldErrors });
    const paste = { id: nanoid(10), ...parsed.data };
    db.prepare(`INSERT INTO pastes (id, title, content, language, visibility) VALUES (@id, @title, @content, @language, @visibility)`).run(paste);
    const row = db.prepare('SELECT * FROM pastes WHERE id = ?').get(paste.id);
    return res.status(201).location(`/api/pastes/${paste.id}`).json(row);
  });

  app.get('/api/pastes/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM pastes WHERE id = ?').get(req.params.id) as PasteRow | undefined;
    if (!row) return res.status(404).json({ error: 'Paste not found' });
    db.prepare('UPDATE pastes SET views = views + 1 WHERE id = ?').run(req.params.id);
    return res.json({ ...row, views: row.views + 1 });
  });

  app.delete('/api/pastes/:id', (req, res) => {
    const result = db.prepare('DELETE FROM pastes WHERE id = ?').run(req.params.id);
    return result.changes ? res.status(204).send() : res.status(404).json({ error: 'Paste not found' });
  });

  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(JSON.stringify({ level: 'error', message: error.message }));
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

