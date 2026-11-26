import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // `scripts/` is included deliberately: the scraper's parsers (dates, venue
    // resolution, price, description quality) decide what reaches the database
    // and are pure, so they are the highest-value things here to test.
    include: [
      'src/**/*.test.ts',
      'src/**/__tests__/**/*.test.ts',
      'scripts/**/*.test.ts',
      'scripts/**/__tests__/**/*.test.ts',
    ],
    // Placeholders so modules that build clients at import time can load.
    // Port 1 is closed, so nothing can reach a real database.
    env: {
      SUPABASE_URL:              'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      DATABASE_URL:              'postgresql://test:test@127.0.0.1:1/test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.ts', 'scripts/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/__tests__/**',
        // Entry points and I/O shells — nothing pure to assert on.
        'src/index.ts',
        'scripts/scrapeEvents.ts',
        'scripts/repairVenues.ts',
        'scripts/repairDescriptions.ts',
        'scripts/auditData.ts',
        'scripts/clearEvents.ts',
      ],
    },
  },
})
