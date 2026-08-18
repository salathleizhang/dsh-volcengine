import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'lib',
  clean: true,
  dts: false,
  deps: {
    // @deepseek-ai/* is provided by the host installation; keep it a runtime
    // import instead of bundling a second copy.
    neverBundle: [/^@deepseek-ai\//],
  },
})
