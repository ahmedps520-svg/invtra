// Load .env for tests (Node ≥ 20.12). TEST_DATABASE_URL, when set, isolates test data.
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env — rely on the environment */
}
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
