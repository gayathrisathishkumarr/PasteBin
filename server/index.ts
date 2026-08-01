import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import { createDatabase } from './db.js';

const port = Number(process.env.PORT) || 3001;
const db = createDatabase();
const api = createApp(db);
const app = express();

const distDir = path.resolve(process.cwd(), 'dist');
const indexFile = path.join(distDir, 'index.html');

if (existsSync(indexFile)) {
  app.use(express.static(distDir));

  app.get(/^\/(?!api(?:\/|$)|health$|ready$|metrics$|openapi\.json$|api-docs$).*/, (_req, res) => {
    res.sendFile(indexFile);
  });
}

app.use(api);

const server = app.listen(port, () => {
  console.info(JSON.stringify({
    level: 'info',
    event: 'server_started',
    port
  }));
});

const cleanup = setInterval(() => {
  const result = db.prepare(
    `DELETE FROM pastes
     WHERE expires_at IS NOT NULL
     AND datetime(expires_at) < datetime('now', '-7 days')`
  ).run();

  if (result.changes) {
    console.info(JSON.stringify({
      level: 'info',
      event: 'expired_cleanup',
      removed: result.changes
    }));
  }
}, 60 * 60 * 1000);

cleanup.unref();

function shutdown(signal: string) {
  console.info(JSON.stringify({
    level: 'info',
    event: 'shutdown_started',
    signal
  }));

  clearInterval(cleanup);

  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();

  server.close(() => {
    db.close();
    clearTimeout(force);
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));