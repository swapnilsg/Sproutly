import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: './src/test/globalSetup.ts',
    // Test files share one database and Redis db.
    fileParallelism: false,
  },
});
