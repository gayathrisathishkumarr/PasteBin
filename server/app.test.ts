import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createDatabase } from './db.js';

let db: ReturnType<typeof createDatabase>;
beforeEach(() => { db = createDatabase(':memory:'); });
afterEach(() => db.close());

describe('PasteBin API', () => {
  it('creates, lists, retrieves, and deletes a paste', async () => {
    const app = createApp(db);
    const created = await request(app).post('/api/pastes').send({
      title: 'Hello API', content: 'console.log("hello")', language: 'JavaScript', visibility: 'public',
    }).expect(201);
    expect(created.body.id).toHaveLength(10);
    const id = created.body.id;
    expect((await request(app).get('/api/pastes').expect(200)).body.data).toHaveLength(1);
    expect((await request(app).get(`/api/pastes/${id}`).expect(200)).body.views).toBe(1);
    await request(app).delete(`/api/pastes/${id}`).expect(204);
    await request(app).get(`/api/pastes/${id}`).expect(404);
  });

  it('validates input and exposes health status', async () => {
    const app = createApp(db);
    await request(app).post('/api/pastes').send({ title: '', content: '' }).expect(400);
    expect((await request(app).get('/health').expect(200)).body.status).toBe('ok');
  });
});

