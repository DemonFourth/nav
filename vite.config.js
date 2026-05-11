import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

function resourcePriorityPlugin() {
  return {
    name: 'nav-resource-priority',
    enforce: 'post',
    transformIndexHtml(html) {
      if (!html.includes('/assets/index-')) return html

      const scriptMatch = html.match(/^\s*<script type="module" crossorigin src="\/assets\/index-[^"]+\.js"><\/script>\s*$/m)
      const stylesheetMatch = html.match(/^\s*<link rel="stylesheet" crossorigin href="\/assets\/index-[^"]+\.css">\s*$/m)

      if (!scriptMatch || !stylesheetMatch) return html

      const prioritizedTags = [
        stylesheetMatch[0].replace('rel="stylesheet"', 'rel="stylesheet" fetchpriority="high"'),
        scriptMatch[0].replace('type="module"', 'type="module" fetchpriority="high"'),
      ].join('\n')

      return html
        .replace(scriptMatch[0], '')
        .replace(stylesheetMatch[0], prioritizedTags)
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: 'User-agent: *\nDisallow: /',
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), resourcePriorityPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'esnext',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      treeshake: {
        preset: 'smallest',
        moduleSideEffects: false,
      },
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/')

          if (normalized.includes('/node_modules/vue') || normalized.includes('/node_modules/@vue')) {
            return 'vue-vendor'
          }
          if (normalized.includes('/node_modules/@cloudflare')) {
            return 'cf-vendor'
          }
          if (normalized.includes('/src/composables/')) {
            return 'composables'
          }
          if (normalized.includes('/src/components/')) {
            return 'components'
          }
          return undefined
        },
      },
    },
  },
})