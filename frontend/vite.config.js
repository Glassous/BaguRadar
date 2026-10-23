import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import bucketStatic from './plugins/bucket-static.js'

const bucketRoot = fileURLToPath(new URL('../../BaguRadarFiles', import.meta.url))

// 本地调试搜索服务：先 `cd server && npm start`，前端 /api 会转发到 127.0.0.1:8787
const searchProxy = {
  '/api': {
    target: process.env.SEARCH_PROXY_TARGET || 'http://127.0.0.1:8787',
    changeOrigin: false,
  },
}

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // <install> 是浏览器内建的安装按钮元素，交给原生渲染，不做组件解析
          isCustomElement: (tag) => tag === 'install',
        },
      },
    }),
    tailwindcss(),
    bucketStatic({ root: bucketRoot, prefix: '/bucket' }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    port: 5173,
    proxy: searchProxy,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
    port: 4173,
    proxy: searchProxy,
  },
  build: {
    chunkSizeWarningLimit: 1400,
  },
})
