import { initDb } from '../init_db.js';
import { app } from './app.js';
import { db } from './config/db.js';
import { env } from './config/env.js';

try {
  await initDb();
  const server = app.listen(env.PORT, () => console.log(`Backend listening on port ${env.PORT}.`));
  const shutdown = () => server.close(() => db.end().finally(() => process.exit(0)));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error(`Backend startup failed (${error.code || 'INITIALIZATION_ERROR'}). Check MySQL configuration and database permissions.`);
  if (error.code === undefined) console.error(error.message);
  await db.end();
  process.exitCode = 1;
}
