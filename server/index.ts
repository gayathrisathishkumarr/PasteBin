import { createApp } from './app.js';
import { createDatabase } from './db.js';

const port = Number(process.env.PORT) || 3001;
const db = createDatabase();
const server = createApp(db).listen(port, () => {
  console.info(JSON.stringify({ level: 'info', event: 'server_started', port }));
});

const cleanup = setInterval(() => {
  const result = db.prepare(`DELETE FROM pastes WHERE expires_at IS NOT NULL AND datetime(expires_at) < datetime('now', '-7 days')`).run();
  if (result.changes) console.info(JSON.stringify({ level: 'info', event: 'expired_cleanup', removed: result.changes }));
}, 60 * 60 * 1000);
cleanup.unref();

function shutdown(signal: string) {
  console.info(JSON.stringify({ level: 'info', event: 'shutdown_started', signal }));
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
