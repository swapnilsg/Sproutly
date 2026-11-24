import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Workspace packages (e.g. @sproutly/catalogue) are imported from source in tests.
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'], externalConditions: ['source'] } },
  test: {
    globalSetup: './src/test/globalSetup.ts',
    // Test files share one database and Redis db.
    fileParallelism: false,
  },
});
