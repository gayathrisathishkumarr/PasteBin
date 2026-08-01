import { createApp } from '../server/app.js';
import { createDatabase } from '../server/db.js';

// Vercel Functions can write only to /tmp. The regular Docker and local
// deployments continue to use DATABASE_PATH (or ./data/pastebin.db).
const db = createDatabase(process.env.DATABASE_PATH || '/tmp/pastebin.db');

export default createApp(db);
