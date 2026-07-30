import cors from 'cors';
import express from 'express';
import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PasteRow, Visibility } from './db.js';

const tagsSchema = z.array(z.string().trim().min(1).max(30)).max(10).default([]);
const pasteSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
  content: z.string().min(1).max(100_000),
  language: z.string().trim().min(1).max(40).default('Plain Text'),
  visibility: z.enum(['public', 'unlisted', 'secret']).default('public'),
  tags: tagsSchema,
  expiresAt: z.string().datetime().nullable().optional(),
});
const importSchema = z.object({ pastes: z.array(pasteSchema).min(1).max(50) });

const openapi = {
  openapi: '3.0.3',
  info: { title: 'PasteBin API', version: '2.0.0', description: 'A production-minded API for versioned, shareable code pastes.' },
  paths: {
    '/health': { get: { summary: 'Liveness and uptime' } },
    '/ready': { get: { summary: 'Database readiness' } },
    '/metrics': { get: { summary: 'Non-sensitive operational metrics' } },
    '/api/pastes': { get: { summary: 'Search, filter, sort, and paginate pastes' }, post: { summary: 'Create a paste' } },
    '/api/pastes/{id}': { get: { summary: 'Retrieve a paste' }, put: { summary: 'Edit and version a paste' }, delete: { summary: 'Delete a paste' } },
    '/api/pastes/{id}/meta': { get: { summary: 'Non-consuming paste metadata for secret warnings' } },
    '/api/pastes/{id}/favorite': { patch: { summary: 'Set favorite state' } },
    '/api/pastes/{id}/fork': { post: { summary: 'Fork a public paste' } },
    '/api/pastes/{id}/raw': { get: { summary: 'Raw text or source download' } },
    '/api/pastes/{id}/revisions': { get: { summary: 'List version history' } },
    '/api/pastes/{id}/revisions/{version}/restore': { post: { summary: 'Restore an older version' } },
    '/api/activity': { get: { summary: 'Recent persisted activity' } },
    '/api/analytics': { get: { summary: 'Real aggregate analytics' } },
    '/api/export': { post: { summary: 'Export selected pastes as JSON' } },
    '/api/import': { post: { summary: 'Validate and import PasteBin JSON' } },
  },
};

const extensionMap: Record<string, string> = {
  JavaScript: 'js', TypeScript: 'ts', React: 'tsx', Python: 'py', SQL: 'sql',
  JSON: 'json', YAML: 'yaml', Markdown: 'md', Bash: 'sh', Dockerfile: 'dockerfile', 'Environment Variables': 'env',
};

function serialize(row: PasteRow) {
  return { ...row, favorite: Boolean(row.favorite), tags: JSON.parse(row.tags || '[]') as string[] };
}

function isExpired(row: PasteRow) {
  return Boolean(row.expires_at && new Date(row.expires_at).getTime() <= Date.now());
}

function safeFilename(title: string, language: string) {
  const base = title.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'paste';
  return `${base}.${extensionMap[language] || 'txt'}`;
}

export function createApp(db: Database.Database, options: { rateLimit?: number } = {}) {
  const app = express();
  const startedAt = Date.now();
  let requestCount = 0;
  let errorCount = 0;
  const rateLimit = options.rateLimit ?? Number(process.env.RATE_LIMIT_MAX || 300);
  const buckets = new Map<string, { count: number; reset: number }>();

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const requestId = req.header('x-request-id')?.slice(0, 80) || randomUUID();
    const started = Date.now();
    requestCount += 1;
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    res.locals.requestId = requestId;
    res.on('finish', () => console.info(JSON.stringify({
      level: 'info', requestId, method: req.method, path: req.path, status: res.statusCode,
      durationMs: Date.now() - started, at: new Date().toISOString(),
    })));
    next();
  });
  app.use(cors({
    origin(origin, callback) {
      const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:8080').split(',');
      callback(null, !origin || allowed.includes(origin));
    },
  }));
  app.use(express.json({ limit: process.env.BODY_LIMIT || '150kb' }));
  app.use('/api', (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    const bucket = buckets.get(key);
    const active = !bucket || bucket.reset <= now ? { count: 0, reset: now + 60_000 } : bucket;
    active.count += 1;
    buckets.set(key, active);
    res.setHeader('x-ratelimit-limit', rateLimit);
    res.setHeader('x-ratelimit-remaining', Math.max(0, rateLimit - active.count));
    if (active.count > rateLimit) return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' }, requestId: res.locals.requestId });
    next();
  });

  const fail = (res: express.Response, status: number, code: string, message: string, details?: unknown) =>
    res.status(status).json({ error: { code, message, ...(details ? { details } : {}) }, requestId: res.locals.requestId });
  const event = (type: string, pasteId: string | null, detail = '') =>
    db.prepare('INSERT INTO activity_events (paste_id, type, detail) VALUES (?, ?, ?)').run(pasteId, type, detail);
  const find = (id: string) => db.prepare('SELECT * FROM pastes WHERE id = ?').get(id) as PasteRow | undefined;

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'pastebin-api', uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), timestamp: new Date().toISOString() }));
  app.get('/ready', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ready', database: 'connected' });
    } catch {
      fail(res, 503, 'NOT_READY', 'Database is unavailable');
    }
  });
  app.get('/metrics', (_req, res) => res.json({
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), requests: requestCount, errors: errorCount,
    pastes: (db.prepare('SELECT COUNT(*) total FROM pastes').get() as { total: number }).total,
  }));
  app.get('/openapi.json', (_req, res) => res.json(openapi));
  app.get('/api-docs', (_req, res) => res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>PasteBin API</title><style>body{font:16px system-ui;max-width:960px;margin:50px auto;padding:0 24px;background:#111220;color:#e5e7eb}a{color:#a78bfa}code{background:#232541;padding:3px 7px;border-radius:6px}.route{padding:18px;margin:14px 0;border:1px solid #393b5c;border-radius:12px}</style></head><body><h1>PasteBin REST API v2</h1><p>Machine-readable contract: <a href="/openapi.json">OpenAPI JSON</a></p>${Object.entries(openapi.paths).map(([path, methods]) => `<div class="route"><strong>${path}</strong><p>${Object.entries(methods).map(([method, value]) => `<code>${method.toUpperCase()}</code> ${(value as { summary: string }).summary}`).join('<br><br>')}</p></div>`).join('')}</body></html>`));

  app.get('/api/pastes', (req, res) => {
    const scope = String(req.query.scope || 'mine');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const where = [`visibility != 'secret'`, `(expires_at IS NULL OR datetime(expires_at) > datetime('now'))`];
    const values: unknown[] = [];
    if (scope === 'public') where.push(`visibility = 'public'`);
    if (scope === 'favorites') where.push(`favorite = 1`);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) { where.push('(title LIKE ? OR description LIKE ? OR content LIKE ? OR language LIKE ? OR tags LIKE ?)'); values.push(...Array(5).fill(`%${search}%`)); }
    for (const [key, column] of [['language', 'language'], ['visibility', 'visibility']] as const) {
      if (typeof req.query[key] === 'string' && req.query[key]) { where.push(`${column} = ?`); values.push(req.query[key]); }
    }
    if (req.query.favorite === 'true') where.push('favorite = 1');
    if (typeof req.query.tag === 'string' && req.query.tag) { where.push('tags LIKE ?'); values.push(`%"${req.query.tag}"%`); }
    const order: Record<string, string> = {
      newest: 'datetime(created_at) DESC', oldest: 'datetime(created_at) ASC', views: 'views DESC',
      forks: 'forks DESC', title: 'title COLLATE NOCASE ASC', size: 'LENGTH(content) DESC',
      trending: `(views * 3 + forks * 5 + favorite * 2) DESC, datetime(updated_at) DESC`,
    };
    const orderBy = order[String(req.query.sort || 'newest')] || order.newest;
    const count = (db.prepare(`SELECT COUNT(*) total FROM pastes WHERE ${where.join(' AND ')}`).get(...values) as { total: number }).total;
    const rows = db.prepare(`SELECT * FROM pastes WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...values, limit, (page - 1) * limit) as PasteRow[];
    res.json({ data: rows.map(serialize), pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  });

  app.post('/api/pastes', (req, res) => {
    const parsed = pasteSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Paste validation failed', parsed.error.flatten().fieldErrors);
    if (parsed.data.expiresAt && new Date(parsed.data.expiresAt).getTime() <= Date.now()) return fail(res, 400, 'VALIDATION_ERROR', 'Expiration must be in the future');
    const paste = { id: nanoid(10), ...parsed.data, tags: JSON.stringify(parsed.data.tags), expires_at: parsed.data.expiresAt || null };
    db.prepare(`INSERT INTO pastes (id,title,description,content,language,visibility,tags,expires_at) VALUES (@id,@title,@description,@content,@language,@visibility,@tags,@expires_at)`).run(paste);
    event('created', paste.id, paste.title);
    return res.status(201).location(`/api/pastes/${paste.id}`).json(serialize(find(paste.id)!));
  });

  app.get('/api/pastes/:id/meta', (req, res) => {
    const row = find(req.params.id);
    if (!row) return fail(res, 404, 'NOT_FOUND', 'Paste not found.');
    if (isExpired(row)) return fail(res, 410, 'EXPIRED', 'This paste has expired.');
    res.json({ id: row.id, title: row.title, visibility: row.visibility, language: row.language, expires_at: row.expires_at });
  });

  const retrieve = (id: string, countView: boolean): { row?: PasteRow; status?: number; code?: string } => {
    const transaction = db.transaction(() => {
      const row = find(id);
      if (!row) return { status: 404, code: 'NOT_FOUND' };
      if (isExpired(row)) return { status: 410, code: 'EXPIRED' };
      if (row.visibility === 'secret') {
        db.prepare('DELETE FROM pastes WHERE id = ?').run(id);
        event('burned', id, row.title);
        return { row: { ...row, views: row.views + 1 } };
      }
      if (countView) {
        db.prepare('UPDATE pastes SET views = views + 1 WHERE id = ?').run(id);
        db.prepare('INSERT INTO view_events (paste_id) VALUES (?)').run(id);
        return { row: { ...row, views: row.views + 1 } };
      }
      return { row };
    });
    return transaction();
  };

  app.get('/api/pastes/:id', (req, res) => {
    const result = retrieve(req.params.id, true);
    if (!result.row) return fail(res, result.status!, result.code!, result.code === 'EXPIRED' ? 'This paste has expired.' : 'Paste not found.');
    res.json(serialize(result.row));
  });

  app.put('/api/pastes/:id', (req, res) => {
    const current = find(req.params.id);
    if (!current) return fail(res, 404, 'NOT_FOUND', 'Paste not found.');
    if (isExpired(current)) return fail(res, 410, 'EXPIRED', 'This paste has expired.');
    if (current.visibility === 'secret') return fail(res, 409, 'SECRET_IMMUTABLE', 'Secret pastes cannot be edited.');
    const parsed = pasteSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Paste validation failed', parsed.error.flatten().fieldErrors);
    db.transaction(() => {
      db.prepare(`INSERT INTO revisions (paste_id,version,title,description,content,language,visibility,tags) VALUES (?,?,?,?,?,?,?,?)`)
        .run(current.id, current.version, current.title, current.description, current.content, current.language, current.visibility, current.tags);
      db.prepare(`UPDATE pastes SET title=?,description=?,content=?,language=?,visibility=?,tags=?,expires_at=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(parsed.data.title, parsed.data.description, parsed.data.content, parsed.data.language, parsed.data.visibility, JSON.stringify(parsed.data.tags), parsed.data.expiresAt || null, current.id);
      event('updated', current.id, parsed.data.title);
    })();
    res.json(serialize(find(current.id)!));
  });

  app.patch('/api/pastes/:id/favorite', (req, res) => {
    const parsed = z.object({ favorite: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'favorite must be a boolean');
    const result = db.prepare('UPDATE pastes SET favorite=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(parsed.data.favorite ? 1 : 0, req.params.id);
    if (!result.changes) return fail(res, 404, 'NOT_FOUND', 'Paste not found.');
    event(parsed.data.favorite ? 'favorited' : 'unfavorited', req.params.id, find(req.params.id)!.title);
    res.json(serialize(find(req.params.id)!));
  });

  app.post('/api/pastes/:id/fork', (req, res) => {
    const source = find(req.params.id);
    if (!source || source.visibility !== 'public' || isExpired(source)) return fail(res, 404, 'NOT_FOUND', 'Public paste not found.');
    const id = nanoid(10);
    db.transaction(() => {
      db.prepare(`INSERT INTO pastes (id,title,description,content,language,visibility,tags,source_id) VALUES (?,?,?,?,?,?,?,?)`)
        .run(id, `Remix of ${source.title}`.slice(0, 120), source.description, source.content, source.language, 'unlisted', source.tags, source.id);
      db.prepare('UPDATE pastes SET forks=forks+1 WHERE id=?').run(source.id);
      event('forked', id, source.title);
    })();
    res.status(201).json(serialize(find(id)!));
  });

  app.get('/api/pastes/:id/raw', (req, res) => {
    const result = retrieve(req.params.id, true);
    if (!result.row) return fail(res, result.status!, result.code!, result.code === 'EXPIRED' ? 'This paste has expired.' : 'Paste not found.');
    if (req.query.download === '1') res.attachment(safeFilename(result.row.title, result.row.language));
    res.type('text/plain; charset=utf-8');
    res.send(result.row.content);
  });

  app.get('/api/pastes/:id/revisions', (req, res) => {
    const paste = find(req.params.id);
    if (!paste) return fail(res, 404, 'NOT_FOUND', 'Paste not found.');
    const historical = db.prepare('SELECT * FROM revisions WHERE paste_id=? ORDER BY version DESC').all(paste.id);
    res.json({ data: [{ ...serialize(paste), current: true }, ...historical.map((row: any) => ({ ...row, tags: JSON.parse(row.tags), current: false }))] });
  });

  app.post('/api/pastes/:id/revisions/:version/restore', (req, res) => {
    const current = find(req.params.id);
    const revision = db.prepare('SELECT * FROM revisions WHERE paste_id=? AND version=?').get(req.params.id, Number(req.params.version)) as any;
    if (!current || !revision) return fail(res, 404, 'NOT_FOUND', 'Revision not found.');
    db.transaction(() => {
      db.prepare(`INSERT INTO revisions (paste_id,version,title,description,content,language,visibility,tags) VALUES (?,?,?,?,?,?,?,?)`)
        .run(current.id, current.version, current.title, current.description, current.content, current.language, current.visibility, current.tags);
      db.prepare(`UPDATE pastes SET title=?,description=?,content=?,language=?,visibility=?,tags=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(revision.title, revision.description, revision.content, revision.language, revision.visibility, revision.tags, current.id);
      event('restored', current.id, `Version ${revision.version}`);
    })();
    res.json(serialize(find(current.id)!));
  });

  app.get('/api/activity', (_req, res) => {
    const rows = db.prepare(`SELECT a.*,p.title FROM activity_events a LEFT JOIN pastes p ON p.id=a.paste_id ORDER BY datetime(a.created_at) DESC LIMIT 12`).all();
    res.json({ data: rows });
  });

  app.get('/api/analytics', (_req, res) => {
    const active = `(expires_at IS NULL OR datetime(expires_at) > datetime('now'))`;
    const stats = db.prepare(`SELECT COUNT(*) total,SUM(visibility='public') public,SUM(favorite) favorites,COALESCE(SUM(views),0) views,COALESCE(SUM(forks),0) forks,COALESCE(SUM(LENGTH(content)),0) bytes,SUM(${active}) active,SUM(NOT ${active}) expired FROM pastes`).get();
    const languages = db.prepare(`SELECT language label,COUNT(*) value FROM pastes WHERE ${active} GROUP BY language ORDER BY value DESC`).all();
    const visibility = db.prepare(`SELECT visibility label,COUNT(*) value FROM pastes WHERE ${active} GROUP BY visibility ORDER BY value DESC`).all();
    const created = db.prepare(`SELECT date(created_at) label,COUNT(*) value FROM pastes GROUP BY date(created_at) ORDER BY label DESC LIMIT 14`).all().reverse();
    const viewsOverTime = db.prepare(`SELECT date(created_at) label,COUNT(*) value FROM view_events GROUP BY date(created_at) ORDER BY label DESC LIMIT 14`).all().reverse();
    const mostViewed = db.prepare(`SELECT id,title,views value FROM pastes WHERE ${active} ORDER BY views DESC LIMIT 5`).all();
    const mostForked = db.prepare(`SELECT id,title,forks value FROM pastes WHERE ${active} ORDER BY forks DESC LIMIT 5`).all();
    res.json({ stats, languages, visibility, created, viewsOverTime, mostViewed, mostForked, uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) });
  });

  app.post('/api/export', (req, res) => {
    const parsed = z.object({ ids: z.array(z.string()).min(1).max(100) }).safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Provide 1–100 paste ids.');
    const placeholders = parsed.data.ids.map(() => '?').join(',');
    const rows = db.prepare(`SELECT title,description,content,language,visibility,tags,expires_at FROM pastes WHERE id IN (${placeholders}) AND visibility!='secret'`).all(...parsed.data.ids) as PasteRow[];
    res.json({ format: 'pastebin-export', version: 1, exportedAt: new Date().toISOString(), pastes: rows.map(serialize) });
  });

  app.post('/api/import', (req, res) => {
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Import validation failed', parsed.error.flatten());
    const ids = db.transaction(() => parsed.data.pastes.map((item) => {
      const id = nanoid(10);
      db.prepare(`INSERT INTO pastes (id,title,description,content,language,visibility,tags,expires_at) VALUES (?,?,?,?,?,?,?,?)`)
        .run(id, item.title, item.description, item.content, item.language, item.visibility, JSON.stringify(item.tags), item.expiresAt || null);
      event('imported', id, item.title);
      return id;
    }))();
    res.status(201).json({ imported: ids.length, ids });
  });

  app.delete('/api/pastes/:id', (req, res) => {
    const row = find(req.params.id);
    if (!row) return fail(res, 404, 'NOT_FOUND', 'Paste not found.');
    db.prepare('DELETE FROM pastes WHERE id=?').run(row.id);
    event('deleted', row.id, row.title);
    res.status(204).send();
  });

  app.use((_req, res) => fail(res, 404, 'ROUTE_NOT_FOUND', 'Route not found.'));
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    errorCount += 1;
    console.error(JSON.stringify({ level: 'error', requestId: res.locals.requestId, message: error.message }));
    fail(res, 500, 'INTERNAL_ERROR', 'Internal server error.');
  });
  return app;
}
