import { startAnalyticsFlusher } from './analytics/analytics.js';
import { createApp } from './app.js';
import { closeDeps, createDeps } from './deps.js';
import { loadEnv } from './env.js';

try {
  process.loadEnvFile();
} catch {
  // no .env file — rely on the real environment
}

const env = loadEnv();
const deps = createDeps(env);

if (!deps.verifyGoogle) console.warn('GOOGLE_CLIENT_ID not set — Google sign-in is disabled');
if (!env.EMAIL_API_KEY) console.warn('EMAIL_API_KEY not set — sign-in codes are printed here');

const server = createApp(deps).listen(env.PORT, () => {
  console.log(`Sproutly API listening on http://localhost:${env.PORT}`);
});

const stopFlusher = startAnalyticsFlusher(deps);

async function shutdown() {
  stopFlusher();
  server.close();
  await closeDeps(deps);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
