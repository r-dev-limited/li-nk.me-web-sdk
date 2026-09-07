import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: false,
        include: ['src/__tests__/**/*.test.ts'],
        coverage: {
            enabled: false,
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
            thresholds: {
                lines: 80,
                statements: 80,
                functions: 75,
                branches: 75,
            },
        },
    },
});
