import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'

const version = process.env.RENDER_GIT_COMMIT || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'build-version',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'app-version', content: version }, injectTo: 'head' }],
  }],
})
