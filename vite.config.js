import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 部署到 GitHub Pages 时是子路径（https://<user>.github.io/<repo>/），
// 通过环境变量 DEPLOY_BASE 指定 base，例如 DEPLOY_BASE=/emotion-music/ npm run build
const base = process.env.DEPLOY_BASE || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [vue()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      // 本地 NetEase API 服务（server/api.cjs）经代理同源访问，避免跨域
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 4173,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
  }
})
