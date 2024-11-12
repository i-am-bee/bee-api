import { resolve } from 'node:path';

import tsConfigPaths from 'vite-tsconfig-paths';
import { externalizeDeps } from 'vite-plugin-externalize-deps';
import dtsPlugin from 'vite-plugin-dts';
import { glob } from 'glob';

const rootDir = 'src';

/** @type {import('vite').UserConfig} */
export default {
  test: {
    globals: true,
    passWithNoTests: true,
    testTimeout: 15_000,
    setupFiles: ['./tests/setup.ts'],
    deps: {
      interopDefault: false
    }
  },
  build: {
    minify: false,
    target: 'node22.2.0',
    outDir: './dist',
    lib: {
      entry: [
        ...glob.sync(resolve(__dirname, 'src/**/*.ts')),
        ...glob.sync(resolve(__dirname, 'workers/node/**/*.ts')),
        ...glob.sync(resolve(__dirname, 'seeders/**/*.ts'))
      ],
      formats: ['es']
    },
    rollupOptions: {
      output: {
        preserveModules: true,
        preserveModulesRoot: rootDir
      }
    }
  },
  resolve: {
    alias: {
      '@/': resolve(resolve(__dirname), rootDir),
      '@tests/': resolve(resolve(__dirname), 'tests')
    }
  },
  plugins: [
    tsConfigPaths(),
    dtsPlugin({ entryRoot: rootDir, pathsToAliases: true }),
    externalizeDeps()
  ]
};
