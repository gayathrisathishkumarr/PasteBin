import cors from 'cors';
import express from 'express';
import { nanoid } from 'nanoid';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Visibility } from './db.js';

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
  info: {
    title: 'PasteBin API',
    version: '2.1.0',
    description: 'A persistent, production-minded API for versioned and shareable code pastes.',
  },
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
    '/api/lineage': { get: { summary: 'Map forks, revisions, and deterministic code similarity' } },
    '/api/pastes/{id}/related': { get: { summary: 'Explain related snippets and similarity scores' } },
    '/api/activity': { get: { summary: 'Recent persisted activity' } },
    '/api/analytics': { get: { summary: 'Real aggregate analytics' } },
    '/api/export': { post: { summary: 'Export selected pastes as JSON' } },
    '/api/import': { post: { summary: 'Validate and import PasteBin JSON' } },
  },
};

const extensionMap: Record<string, string> = {
  JavaScript: 'js', TypeScript: 'ts', React: 'tsx', Java: 'java', Python: 'py', SQL: 'sql',
  JSON: 'json', YAML: 'yaml', Markdown: 'md', Bash: 'sh', Dockerfile: 'dockerfile', 'Environment Variables': 'env',
};

interface StoredPaste {
  id: string;
  title: string;
  description: string;
  content: string;
  language: string;
  visibility: Visibility;
  tags: string[];
  favorite: boolean;
  views: number;
  forks: number;
  source_id: string | null;
  expires_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

interface Revision extends StoredPaste {
  current?: boolean;
}

interface ActivityEvent {
  id: number;
  paste_id: string | null;
  type: string;
  detail: string;
  title?: string;
  created_at: string;
}

type LineagePaste = StoredPaste & { revision_count: number };
type RedisArgument = string | number;
type RedisCommand = RedisArgument[];
type RedisResult<T> = { result?: T; error?: string };

const KEY_PREFIX = 'pastebin:v1:';
const PASTES_KEY = `${KEY_PREFIX}pastes`;
const ACTIVITY_KEY = `${KEY_PREFIX}activity`;
const VIEW_DAYS_KEY = `${KEY_PREFIX}view-days`;
const pasteKey = (id: string) => `${KEY_PREFIX}paste:${id}`;
const revisionKey = (id: string) => `${KEY_PREFIX}revisions:${id}`;
const lockKey = (id: string) => `${KEY_PREFIX}lock:${id}`;

function redisConfig() {
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
  };
}

export function hasKvEnvironment() {
  const { url, token } = redisConfig();
  return Boolean(url && token);
}

async function command<T>(args: RedisCommand): Promise<T> {
  const { url, token } = redisConfig();
  if (!url || !token) throw new Error('Persistent database environment variables are missing.');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await response.json() as RedisResult<T>;
  if (!response.ok || body.error) throw new Error(body.error || `Database request failed (${response.status}).`);
  return body.result as T;
}

async function transaction(commands: RedisCommand[]) {
  const { url, token } = redisConfig();
  if (!url || !token) throw new Error('Persistent database environment variables are missing.');
  const response = await fetch(`${url.replace(/\/$/, '')}/multi-exec`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  const body = await response.json() as RedisResult<unknown> | RedisResult<unknown>[];
  if (!response.ok || !Array.isArray(body)) {
    throw new Error(!Array.isArray(body) && body.error ? body.error : `Database transaction failed (${response.status}).`);
  }
  const failed = body.find((item) => item.error);
  if (failed?.error) throw new Error(failed.error);
  return body.map((item) => item.result);
}

function decode<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return JSON.parse(value) as T;
  return value as T;
}

async function getPaste(id: string) {
  return decode<StoredPaste>(await command<string | null>(['GET', pasteKey(id)]));
}

async function getPastes(ids: string[]) {
  if (!ids.length) return [];
  const raw = await command<(string | null)[]>(['MGET', ...ids.map(pasteKey)]);
  return raw.map((value) => decode<StoredPaste>(value)).filter((paste): paste is StoredPaste => Boolean(paste));
}

async function allPastes() {
  const ids = await command<string[]>(['ZRANGE', PASTES_KEY, 0, -1]);
  return getPastes(ids || []);
}

async function acquireLock(id: string) {
  const token = randomUUID();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await command<string | null>(['SET', lockKey(id), token, 'NX', 'PX', 10_000]);
    if (result === 'OK') return token;
    await new Promise((resolve) => setTimeout(resolve, 25 + attempt * 5));
  }
  throw new Error('The paste is busy. Please try again.');
}

async function releaseLock(id: string, token: string) {
  const script = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
  await command<number>(['EVAL', script, 1, lockKey(id), token]);
}

async function withLock<T>(id: string, action: () => Promise<T>) {
  const token = await acquireLock(id);
  try {
    return await action();
  } finally {
    await releaseLock(id, token).catch(() => undefined);
  }
}

function activityCommands(type: string, pasteId: string | null, detail = '', title?: string): RedisCommand[] {
  const event: ActivityEvent = {
    id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    paste_id: pasteId,
    type,
    detail,
    ...(title ? { title } : {}),
    created_at: new Date().toISOString(),
  };
  return [['LPUSH', ACTIVITY_KEY, JSON.stringify(event)], ['LTRIM', ACTIVITY_KEY, 0, 199]];
}

function isExpired(paste: StoredPaste) {
  return Boolean(paste.expires_at && new Date(paste.expires_at).getTime() <= Date.now());
}

function safeFilename(title: string, language: string) {
  const base = title.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'paste';
  return `${base}.${extensionMap[language] || 'txt'}`;
}

function codeTokens(content: string) {
  return new Set(
    content.toLowerCase()
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|\s)\/\/.*$/gm, ' ')
      .replace(/(^|\s)#.*$/gm, ' ')
      .match(/[a-z_$][\w$]*|\d+(?:\.\d+)?|===|!==|=>|==|!=|<=|>=|&&|\|\||[{}()[\].,:;+*/%<>-]/g)
      ?.slice(0, 2_000) || [],
  );
}

function similarity(left: LineagePaste, right: LineagePaste) {
  if (left.language !== right.language) return { score: 0, shared: 0 };
  const a = codeTokens(left.content);
  const b = codeTokens(right.content);
  if (a.size < 4 || b.size < 4) return { score: 0, shared: 0 };
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return { score: shared / (a.size + b.size - shared), shared };
}

function overlap(left: string[], right: string[]) {
  const b = new Set(right);
  return left.filter((tag) => b.has(tag));
}

function lineageNode(row: LineagePaste) {
  return {
    id: row.id,
    title: row.title,
    language: row.language,
    visibility: row.visibility,
    tags: row.tags,
    version: row.version,
    revisionCount: row.revision_count,
    forks: row.forks,
    sourceId: row.source_id,
    updatedAt: row.updated_at,
    size: row.content.length,
  };
}

function lineageData(rows: LineagePaste[]) {
  const ids = new Set(rows.map((row) => row.id));
  const edges: { source: string; target: string; type: 'fork' | 'similar'; score: number; reasons: string[] }[] = [];
  for (const row of rows) {
    if (row.source_id && ids.has(row.source_id)) {
      edges.push({ source: row.source_id, target: row.id, type: 'fork', score: 1, reasons: ['Forked from the source snippet'] });
    }
  }
  const candidates: typeof edges = [];
  for (let left = 0; left < rows.length; left += 1) {
    for (let right = left + 1; right < rows.length; right += 1) {
      if (rows[right].source_id === rows[left].id || rows[left].source_id === rows[right].id) continue;
      const match = similarity(rows[left], rows[right]);
      const sharedTags = overlap(rows[left].tags, rows[right].tags);
      if (match.score < 0.36 || match.shared < 4) continue;
      const reasons = [`${Math.round(match.score * 100)}% structural token similarity`, `Same language: ${rows[left].language}`];
      if (sharedTags.length) reasons.push(`Shared tags: ${sharedTags.slice(0, 3).join(', ')}`);
      candidates.push({ source: rows[left].id, target: rows[right].id, type: 'similar', score: Number(match.score.toFixed(3)), reasons });
    }
  }
  const degree = new Map<string, number>();
  for (const edge of candidates.sort((a, b) => b.score - a.score)) {
    if ((degree.get(edge.source) || 0) >= 3 || (degree.get(edge.target) || 0) >= 3) continue;
    edges.push(edge);
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  }
  return { nodes: rows.map(lineageNode), edges };
}

function parseHash(value: unknown) {
  if (!value) return {} as Record<string, number>;
  if (!Array.isArray(value)) return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, count]) => [key, Number(count)]));
  const entries: [string, number][] = [];
  for (let index = 0; index < value.length; index += 2) entries.push([String(value[index]), Number(value[index + 1])]);
  return Object.fromEntries(entries);
}

function dateSeries(items: { date: string; value: number }[]) {
  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(-14).map((item) => ({ label: item.date, value: item.value }));
}

export function createKvApp(options: { rateLimit?: number } = {}) {
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

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'pastebin-api', uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), timestamp: new Date().toISOString() }));
  app.get('/ready', async (_req, res) => {
    try {
      await command<string>(['PING']);
      res.json({ status: 'ready', database: 'upstash-redis' });
    } catch {
      fail(res, 503, 'NOT_READY', 'Database is unavailable');
    }
  });
  app.get('/metrics', async (_req, res) => res.json({
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), requests: requestCount, errors: errorCount,
    pastes: await command<number>(['ZCARD', PASTES_KEY]),
  }));
  app.get('/openapi.json', (_req, res) => res.json(openapi));
  app.get('/api-docs', (_req, res) => res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>PasteBin API</title><style>body{font:16px system-ui;max-width:960px;margin:50px auto;padding:0 24px;background:#111220;color:#e5e7eb}a{color:#a78bfa}code{background:#232541;padding:3px 7px;border-radius:6px}.route{padding:18px;margin:14px 0;border:1px solid #393b5c;border-radius:12px}</style></head><body><h1>PasteBin REST API v2.1</h1><p>Machine-readable contract: <a href="/openapi.json">OpenAPI JSON</a></p>${Object.entries(openapi.paths).map(([path, methods]) => `<div class="route"><strong>${path}</strong><p>${Object.entries(methods).map(([method, value]) => `<code>${method.toUpperCase()}</code> ${(value as { summary: string }).summary}`).join('<br><br>')}</p></div>`).join('')}</body></html>`));

  app.get('/api/pastes', async (req, res) => {
    const scope = String(req.query.scope || 'mine');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    let rows = (await allPastes()).filter((paste) => paste.visibility !== 'secret' && !isExpired(paste));
    if (scope === 'public') rows = rows.filter((paste) => paste.visibility === 'public');
    if (scope === 'favorites' || req.query.favorite === 'true') rows = rows.filter((paste) => paste.favorite);
    if (search) rows = rows.filter((paste) => [paste.title, paste.description, paste.content, paste.language, paste.tags.join(' ')].some((value) => value.toLowerCase().includes(search)));
    if (typeof req.query.language === 'string' && req.query.language) rows = rows.filter((paste) => paste.language === req.query.language);
    if (typeof req.query.visibility === 'string' && req.query.visibility) rows = rows.filter((paste) => paste.visibility === req.query.visibility);
    if (typeof req.query.tag === 'string' && req.query.tag) rows = rows.filter((paste) => paste.tags.includes(String(req.query.tag)));
    const sort = String(req.query.sort || 'newest');
    rows.sort((left, right) => {
      if (sort === 'oldest') return left.created_at.localeCompare(right.created_at);
      if (sort === 'views') return right.views - left.views;
      if (sort === 'forks') return right.forks - left.forks;
      if (sort === 'title') return left.title.localeCompare(right.title);
      if (sort === 'size') return right.content.length - left.content.length;
      if (sort === 'trending') return (right.views * 3 + right.forks * 5 + Number(right.favorite) * 2) - (left.views * 3 + left.forks * 5 + Number(left.favorite) * 2) || right.updated_at.localeCompare(left.updated_at);
      return right.created_at.localeCompare(left.created_at);
    });
    const total = rows.length;
    const data = rows.slice((page - 1) * limit, page * limit);
    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  });

  app.post('/api/pastes', async (req, res) => {
    const parsed = pasteSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Paste validation failed', parsed.error.flatten().fieldErrors);
    if (parsed.data.expiresAt && new Date(parsed.data.expiresAt).getTime() <= Date.now()) return fail(res, 400, 'VALIDATION_ERROR', 'Expiration must be in the future');
    const now = new Date().toISOString();
    const paste: StoredPaste = {
      id: nanoid(10), title: parsed.data.title, description: parsed.data.description, content: parsed.data.content,
      language: parsed.data.language, visibility: parsed.data.visibility, tags: parsed.data.tags, favorite: false,
      views: 0, forks: 0, source_id: null, expires_at: parsed.data.expiresAt || null, version: 1,
      created_at: now, updated_at: now,
    };
    await transaction([
      ['SET', pasteKey(paste.id), JSON.stringify(paste)], ['ZADD', PASTES_KEY, Date.now(), paste.id],
      ...activityCommands('created', paste.id, paste.title, paste.title),
    ]);
    return res.status(201).location(`/api/pastes/${paste.id}`).json(paste);
  });

  app.get('/api/pastes/:id/meta', async (req, res) => {
    const paste = await getPaste(req.params.id);
    if (!paste) return fail(res, 404, 'NOT_FOUND', 'Paste not found.');
    if (isExpired(paste)) return fail(res, 410, 'EXPIRED', 'This paste has expired.');
    res.json({ id: paste.id, title: paste.title, visibility: paste.visibility, language: paste.language, expires_at: paste.expires_at });
  });

  const retrieve = (id: string, countView: boolean) => withLock(id, async () => {
    const paste = await getPaste(id);
    if (!paste) return { status: 404, code: 'NOT_FOUND' } as const;
    if (isExpired(paste)) return { status: 410, code: 'EXPIRED' } as const;
    if (!countView) return { paste } as const;
    const viewed = { ...paste, views: paste.views + 1 };
    const day = new Date().toISOString().slice(0, 10);
    if (paste.visibility === 'secret') {
      await transaction([
        ['DEL', pasteKey(id)], ['ZREM', PASTES_KEY, id], ['DEL', revisionKey(id)], ['HINCRBY', VIEW_DAYS_KEY, day, 1],
        ...activityCommands('burned', id, paste.title, paste.title),
      ]);
    } else {
      await transaction([['SET', pasteKey(id), JSON.stringify(viewed)], ['HINCRBY', VIEW_DAYS_KEY, day, 1]]);
    }
    return { paste: viewed } as const;
  });

  app.get('/api/pastes/:id', async (req, res) => {
    const result = await retrieve(req.params.id, true);
    if (!('paste' in result)) return fail(res, result.status, result.code, result.code === 'EXPIRED' ? 'This paste has expired.' : 'Paste not found.');
    res.json(result.paste);
  });

  app.put('/api/pastes/:id', async (req, res) => {
    const parsed = pasteSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Paste validation failed', parsed.error.flatten().fieldErrors);
    if (parsed.data.expiresAt && new Date(parsed.data.expiresAt).getTime() <= Date.now()) return fail(res, 400, 'VALIDATION_ERROR', 'Expiration must be in the future');
    const updated = await withLock(req.params.id, async () => {
      const current = await getPaste(req.params.id);
      if (!current) return null;
      if (isExpired(current)) return 'expired' as const;
      if (current.visibility === 'secret') return 'secret' as const;
      const next: StoredPaste = {
        ...current, title: parsed.data.title, description: parsed.data.description, content: parsed.data.content,
        language: parsed.data.language, visibility: parsed.data.visibility, tags: parsed.data.tags,
        expires_at: parsed.data.expiresAt || null, version: current.version + 1, updated_at: new Date().toISOString(),
      };
      await transaction([
        ['LPUSH', revisionKey(current.id), JSON.stringify(current)], ['SET', pasteKey(current.id), JSON.stringify(next)],
        ...activityCommands('updated', current.id, next.title, next.title),
      ]);
      return next;
    });
    if (!updated) return fail(res, 404, 'NOT_FOUND', 'Paste not found.');
    if (updated === 'expired') return fail(res, 410, 'EXPIRED', 'This paste has expired.');
    if (updated === 'secret') return fail(res, 409, 'SECRET_IMMUTABLE', 'Secret pastes cannot be edited.');
    res.json(updated);
  });

  app.patch('/api/pastes/:id/favorite', async (req, res) => {
    const parsed = z.object({ favorite: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'favorite must be a boolean');
    const updated = await withLock(req.params.id, async () => {
      const current = await getPaste(req.params.id);
      if (!current) return null;
      const next = { ...current, favorite: parsed.data.favorite, updated_at: new Date().toISOString() };
      await transaction([
        ['SET', pasteKey(current.id), JSON.stringify(next)],
        ...activityCommands(parsed.data.favorite ? 'favorited' : 'unfavorited', current.id, current.title, current.title),
      ]);
      return next;
    });
    if (!updated) return fail(res, 404, 'NOT_FOUND', 'Paste not found.');
    res.json(updated);
  });

  app.post('/api/pastes/:id/fork', async (req, res) => {
    const result = await withLock(req.params.id, async () => {
      const source = await getPaste(req.params.id);
      if (!source || source.visibility !== 'public' || isExpired(source)) return null;
      const now = new Date().toISOString();
      const fork: StoredPaste = {
        ...source, id: nanoid(10), title: `Remix of ${source.title}`.slice(0, 120), visibility: 'unlisted',
        favorite: false, views: 0, forks: 0, source_id: source.id, expires_at: null, version: 1,
        created_at: now, updated_at: now,
      };
      const nextSource = { ...source, forks: source.forks + 1 };
      await transaction([
        ['SET', pasteKey(source.id), JSON.stringify(nextSource)], ['SET', pasteKey(fork.id), JSON.stringify(fork)],
        ['ZADD', PASTES_KEY, Date.now(), fork.id], ...activityCommands('forked', fork.id, source.title, fork.title),
      ]);
      return fork;
    });
    if (!result) return fail(res, 404, 'NOT_FOUND', 'Public paste not found.');
    res.status(201).json(result);
  });

  app.get('/api/pastes/:id/raw', async (req, res) => {
    const result = await retrieve(req.params.id, true);
    if (!('paste' in result)) return fail(res, result.status, result.code, result.code === 'EXPIRED' ? 'This paste has expired.' : 'Paste not found.');
    if (req.query.download === '1') res.attachment(safeFilename(result.paste.title, result.paste.language));
    res.type('text/plain; charset=utf-8').send(result.paste.content);
  });

  app.get('/api/pastes/:id/revisions', async (req, res) => {
    const paste = await getPaste(req.params.id);
    if (!paste) return fail(res, 404, 'NOT_FOUND', 'Paste not found.');
    const raw = await command<string[]>(['LRANGE', revisionKey(paste.id), 0, -1]);
    const historical = (raw || []).map((value) => decode<Revision>(value)).filter((revision): revision is Revision => Boolean(revision));
    res.json({ data: [{ ...paste, current: true }, ...historical.map((revision) => ({ ...revision, current: false }))] });
  });

  app.post('/api/pastes/:id/revisions/:version/restore', async (req, res) => {
    const version = Number(req.params.version);
    const restored = await withLock(req.params.id, async () => {
      const current = await getPaste(req.params.id);
      if (!current) return null;
      const raw = await command<string[]>(['LRANGE', revisionKey(current.id), 0, -1]);
      const historical = (raw || []).map((value) => decode<Revision>(value)).filter((revision): revision is Revision => Boolean(revision));
      const revision = historical.find((item) => item.version === version);
      if (!revision) return null;
      const next: StoredPaste = {
        ...current, title: revision.title, description: revision.description, content: revision.content,
        language: revision.language, visibility: revision.visibility, tags: revision.tags,
        version: current.version + 1, updated_at: new Date().toISOString(),
      };
      await transaction([
        ['LPUSH', revisionKey(current.id), JSON.stringify(current)], ['SET', pasteKey(current.id), JSON.stringify(next)],
        ...activityCommands('restored', current.id, `Version ${revision.version}`, next.title),
      ]);
      return next;
    });
    if (!restored) return fail(res, 404, 'NOT_FOUND', 'Revision not found.');
    res.json(restored);
  });

  app.get('/api/activity', async (_req, res) => {
    const raw = await command<string[]>(['LRANGE', ACTIVITY_KEY, 0, 11]);
    const data = (raw || []).map((value) => decode<ActivityEvent>(value)).filter((event): event is ActivityEvent => Boolean(event));
    res.json({ data });
  });

  app.get('/api/analytics', async (_req, res) => {
    const rows = await allPastes();
    const activeRows = rows.filter((paste) => !isExpired(paste));
    const stats = {
      total: rows.length,
      public: rows.filter((paste) => paste.visibility === 'public').length,
      favorites: rows.filter((paste) => paste.favorite).length,
      views: rows.reduce((total, paste) => total + paste.views, 0),
      forks: rows.reduce((total, paste) => total + paste.forks, 0),
      bytes: rows.reduce((total, paste) => total + paste.content.length, 0),
      active: activeRows.length,
      expired: rows.length - activeRows.length,
    };
    const countBy = (values: string[]) => Object.entries(values.reduce<Record<string, number>>((counts, value) => ({ ...counts, [value]: (counts[value] || 0) + 1 }), {}))
      .map(([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value);
    const createdCounts = rows.reduce<Record<string, number>>((counts, paste) => {
      const day = paste.created_at.slice(0, 10);
      counts[day] = (counts[day] || 0) + 1;
      return counts;
    }, {});
    const viewDays = parseHash(await command<unknown>(['HGETALL', VIEW_DAYS_KEY]));
    const mostViewed = [...activeRows].sort((left, right) => right.views - left.views).slice(0, 5).map(({ id, title, views }) => ({ id, title, value: views }));
    const mostForked = [...activeRows].sort((left, right) => right.forks - left.forks).slice(0, 5).map(({ id, title, forks }) => ({ id, title, value: forks }));
    res.json({
      stats,
      languages: countBy(activeRows.map((paste) => paste.language)),
      visibility: countBy(activeRows.map((paste) => paste.visibility)),
      created: dateSeries(Object.entries(createdCounts).map(([date, value]) => ({ date, value }))),
      viewsOverTime: dateSeries(Object.entries(viewDays).map(([date, value]) => ({ date, value }))),
      mostViewed, mostForked, uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    });
  });

  app.get('/api/lineage', async (req, res) => {
    const limit = Math.min(40, Math.max(2, Number(req.query.limit) || 24));
    const rows = (await allPastes()).filter((paste) => paste.visibility !== 'secret' && !isExpired(paste))
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at)).slice(0, limit);
    const counts = await Promise.all(rows.map((paste) => command<number>(['LLEN', revisionKey(paste.id)])));
    const lineageRows = rows.map((paste, index) => ({ ...paste, revision_count: counts[index] || 0 }));
    const graph = lineageData(lineageRows);
    res.json({ ...graph, meta: { totalNodes: graph.nodes.length, totalEdges: graph.edges.length, languages: new Set(graph.nodes.map((node) => node.language)).size, similarityMethod: 'token-set-jaccard-v1' } });
  });

  app.get('/api/pastes/:id/related', async (req, res) => {
    const paste = await getPaste(req.params.id);
    if (!paste || paste.visibility === 'secret' || isExpired(paste)) return fail(res, 404, 'NOT_FOUND', 'Paste not found.');
    const revisionCount = await command<number>(['LLEN', revisionKey(paste.id)]);
    const current: LineagePaste = { ...paste, revision_count: revisionCount || 0 };
    const candidates = (await allPastes()).filter((item) => item.id !== current.id && item.visibility !== 'secret' && !isExpired(item))
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at)).slice(0, 80);
    const counts = await Promise.all(candidates.map((item) => command<number>(['LLEN', revisionKey(item.id)])));
    const related = candidates.map((item, index) => ({ ...item, revision_count: counts[index] || 0 })).map((row) => {
      const isParent = current.source_id === row.id;
      const isChild = row.source_id === current.id;
      const match = similarity(current, row);
      const sharedTags = overlap(current.tags, row.tags);
      const reasons = [
        ...(isParent ? ['Original source of this fork'] : []), ...(isChild ? ['Forked from this snippet'] : []),
        ...(match.score >= 0.2 ? [`${Math.round(match.score * 100)}% structural token similarity`] : []),
        ...(sharedTags.length ? [`Shared tags: ${sharedTags.slice(0, 3).join(', ')}`] : []),
      ];
      return { node: lineageNode(row), score: isParent || isChild ? 1 : Number(match.score.toFixed(3)), reasons };
    }).filter((item) => item.reasons.length && (item.score >= 0.2 || item.reasons.some((reason) => reason.includes('fork') || reason.includes('source'))))
      .sort((left, right) => right.score - left.score).slice(0, 8);
    res.json({ source: lineageNode(current), related });
  });

  app.post('/api/export', async (req, res) => {
    const parsed = z.object({ ids: z.array(z.string()).min(1).max(100) }).safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Provide 1–100 paste ids.');
    const rows = (await getPastes(parsed.data.ids)).filter((paste) => paste.visibility !== 'secret');
    res.json({ format: 'pastebin-export', version: 1, exportedAt: new Date().toISOString(), pastes: rows.map(({ id: _id, favorite: _favorite, views: _views, forks: _forks, source_id: _source, version: _version, created_at: _created, updated_at: _updated, expires_at, ...paste }) => ({ ...paste, expiresAt: expires_at })) });
  });

  app.post('/api/import', async (req, res) => {
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Import validation failed', parsed.error.flatten());
    const ids: string[] = [];
    for (const item of parsed.data.pastes) {
      const now = new Date().toISOString();
      const paste: StoredPaste = {
        id: nanoid(10), title: item.title, description: item.description, content: item.content, language: item.language,
        visibility: item.visibility, tags: item.tags, favorite: false, views: 0, forks: 0, source_id: null,
        expires_at: item.expiresAt || null, version: 1, created_at: now, updated_at: now,
      };
      await transaction([['SET', pasteKey(paste.id), JSON.stringify(paste)], ['ZADD', PASTES_KEY, Date.now(), paste.id], ...activityCommands('imported', paste.id, paste.title, paste.title)]);
      ids.push(paste.id);
    }
    res.status(201).json({ imported: ids.length, ids });
  });

  app.delete('/api/pastes/:id', async (req, res) => {
    const deleted = await withLock(req.params.id, async () => {
      const paste = await getPaste(req.params.id);
      if (!paste) return false;
      await transaction([
        ['DEL', pasteKey(paste.id)], ['ZREM', PASTES_KEY, paste.id], ['DEL', revisionKey(paste.id)],
        ...activityCommands('deleted', paste.id, paste.title, paste.title),
      ]);
      return true;
    });
    if (!deleted) return fail(res, 404, 'NOT_FOUND', 'Paste not found.');
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
