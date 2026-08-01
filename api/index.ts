import { createApp } from '../server/app.js';
import { createDatabase } from '../server/db.js';
import { createKvApp, hasKvEnvironment } from '../server/kvApp.js';

// Vercel uses Upstash Redis for durable serverless storage. Docker and local
// development keep the original SQLite implementation and API contract.
export default hasKvEnvironment()
  ? createKvApp()
  : createApp(createDatabase(process.env.DATABASE_PATH || '/tmp/pastebin.db'));
