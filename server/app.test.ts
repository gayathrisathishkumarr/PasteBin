import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createDatabase } from './db.js';

let db: ReturnType<typeof createDatabase>;
beforeEach(() => { db = createDatabase(':memory:'); });
afterEach(() => db.close());

const sample = (overrides = {}) => ({
  title: 'Hello API', description: 'A useful example', content: 'console.log("hello")',
  language: 'JavaScript', visibility: 'public', tags: ['demo'], ...overrides,
});

describe('PasteBin API', () => {
  it('creates, retrieves, lists, searches, and deletes a paste', async () => {
    const app = createApp(db);
    const created = await request(app).post('/api/pastes').send(sample()).expect(201);
    expect(created.body.id).toHaveLength(10);
    expect((await request(app).get('/api/pastes?search=useful').expect(200)).body.data).toHaveLength(1);
    expect((await request(app).get(`/api/pastes/${created.body.id}`).expect(200)).body.views).toBe(1);
    await request(app).delete(`/api/pastes/${created.body.id}`).expect(204);
    expect((await request(app).get(`/api/pastes/${created.body.id}`).expect(404)).body.error.code).toBe('NOT_FOUND');
  });

  it('filters, sorts, and paginates results', async () => {
    const app = createApp(db);
    await request(app).post('/api/pastes').send(sample({ title: 'Zulu', language: 'Python', tags: ['data'] })).expect(201);
    await request(app).post('/api/pastes').send(sample({ title: 'Alpha', visibility: 'unlisted', tags: ['web'] })).expect(201);
    const filtered = await request(app).get('/api/pastes?language=Python&tag=data').expect(200);
    expect(filtered.body.data[0].title).toBe('Zulu');
    const sorted = await request(app).get('/api/pastes?sort=title&limit=1&page=2').expect(200);
    expect(sorted.body.pagination).toMatchObject({ page: 2, total: 2, pages: 2 });
    expect(sorted.body.data[0].title).toBe('Zulu');
  });

  it('edits with version history and restores a revision', async () => {
    const app = createApp(db);
    const id = (await request(app).post('/api/pastes').send(sample()).expect(201)).body.id;
    const updated = await request(app).put(`/api/pastes/${id}`).send(sample({ title: 'Version two', content: 'v2' })).expect(200);
    expect(updated.body.version).toBe(2);
    const revisions = await request(app).get(`/api/pastes/${id}/revisions`).expect(200);
    expect(revisions.body.data.map((item: { version: number }) => item.version)).toEqual([2, 1]);
    const restored = await request(app).post(`/api/pastes/${id}/revisions/1/restore`).expect(200);
    expect(restored.body).toMatchObject({ title: 'Hello API', version: 3 });
  });

  it('favorites and forks without modifying the source', async () => {
    const app = createApp(db);
    const source = (await request(app).post('/api/pastes').send(sample()).expect(201)).body;
    expect((await request(app).patch(`/api/pastes/${source.id}/favorite`).send({ favorite: true }).expect(200)).body.favorite).toBe(true);
    const fork = (await request(app).post(`/api/pastes/${source.id}/fork`).expect(201)).body;
    expect(fork).toMatchObject({ source_id: source.id, visibility: 'unlisted', content: source.content });
    expect((await request(app).get(`/api/pastes/${source.id}`).expect(200)).body.forks).toBe(1);
  });

  it('maps code lineage, explains similarity, and excludes secrets', async () => {
    const app = createApp(db);
    const content = 'function total(items) { return items.reduce((sum, item) => sum + item.price, 0); }';
    const source = (await request(app).post('/api/pastes').send(sample({ title: 'Cart total', content, tags: ['commerce'] })).expect(201)).body;
    const similar = (await request(app).post('/api/pastes').send(sample({ title: 'Invoice total', content: 'function total(lines) { return lines.reduce((sum, item) => sum + item.price, 0); }', tags: ['commerce'] })).expect(201)).body;
    const fork = (await request(app).post(`/api/pastes/${source.id}/fork`).expect(201)).body;
    await request(app).post('/api/pastes').send(sample({ title: 'Hidden secret', content, visibility: 'secret' })).expect(201);

    const lineage = await request(app).get('/api/lineage').expect(200);
    expect(lineage.body.nodes.map((node: { title: string }) => node.title).sort()).toEqual(['Cart total', 'Invoice total', 'Remix of Cart total'].sort());
    expect(lineage.body.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: source.id, target: fork.id, type: 'fork' }),
      expect.objectContaining({ source: source.id, target: similar.id, type: 'similar' }),
    ]));
    expect(lineage.body.meta).toMatchObject({ totalNodes: 3, languages: 1, similarityMethod: 'token-set-jaccard-v1' });

    const related = await request(app).get(`/api/pastes/${source.id}/related`).expect(200);
    expect(related.body.related.map((item: { node: { id: string } }) => item.node.id)).toEqual(expect.arrayContaining([similar.id, fork.id]));
    expect(related.body.related[0]).toHaveProperty('reasons');
  });

  it('never exposes unlisted, secret, or expired pastes in public lists', async () => {
    const app = createApp(db);
    await request(app).post('/api/pastes').send(sample({ title: 'Public' })).expect(201);
    await request(app).post('/api/pastes').send(sample({ title: 'Unlisted', visibility: 'unlisted' })).expect(201);
    await request(app).post('/api/pastes').send(sample({ title: 'Secret', visibility: 'secret' })).expect(201);
    await request(app).post('/api/pastes').send(sample({ title: 'Expired', expiresAt: new Date(Date.now() + 20).toISOString() })).expect(201);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const list = await request(app).get('/api/pastes?scope=public').expect(200);
    expect(list.body.data.map((item: { title: string }) => item.title)).toEqual(['Public']);
  });

  it('returns 410 for expired pastes', async () => {
    const app = createApp(db);
    const id = (await request(app).post('/api/pastes').send(sample({ expiresAt: new Date(Date.now() + 20).toISOString() })).expect(201)).body.id;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect((await request(app).get(`/api/pastes/${id}`).expect(410)).body.error.code).toBe('EXPIRED');
  });

  it('atomically burns a secret after its first retrieval', async () => {
    const app = createApp(db);
    const id = (await request(app).post('/api/pastes').send(sample({ visibility: 'secret' })).expect(201)).body.id;
    const [first, second] = await Promise.all([request(app).get(`/api/pastes/${id}`), request(app).get(`/api/pastes/${id}`)]);
    expect([first.status, second.status].sort()).toEqual([200, 404]);
    await request(app).get(`/api/pastes/${id}`).expect(404);
  });

  it('serves raw text with a safe download filename', async () => {
    const app = createApp(db);
    const id = (await request(app).post('/api/pastes').send(sample({ title: '../../unsafe name' })).expect(201)).body.id;
    const raw = await request(app).get(`/api/pastes/${id}/raw?download=1`).expect(200);
    expect(raw.headers['content-type']).toContain('text/plain');
    expect(raw.headers['content-disposition']).not.toContain('../');
    expect(raw.text).toBe('console.log("hello")');
  });

  it('imports and exports validated data', async () => {
    const app = createApp(db);
    const imported = await request(app).post('/api/import').send({ pastes: [sample({ title: 'Imported' })] }).expect(201);
    const exported = await request(app).post('/api/export').send({ ids: imported.body.ids }).expect(200);
    expect(exported.body).toMatchObject({ format: 'pastebin-export', version: 1 });
    expect(exported.body.pastes[0].title).toBe('Imported');
    await request(app).post('/api/import').send({ pastes: [{ title: '' }] }).expect(400);
  });

  it('validates input, rate limits, and reports health, readiness, and metrics', async () => {
    const app = createApp(db, { rateLimit: 2 });
    await request(app).post('/api/pastes').send({ title: '', content: '' }).expect(400);
    expect((await request(app).get('/health').expect(200)).body.status).toBe('ok');
    expect((await request(app).get('/ready').expect(200)).body.database).toBe('connected');
    expect((await request(app).get('/metrics').expect(200)).body).toHaveProperty('uptimeSeconds');
    await request(app).get('/api/pastes').expect(200);
    expect((await request(app).get('/api/pastes').expect(429)).body.error.code).toBe('RATE_LIMITED');
  });
});
