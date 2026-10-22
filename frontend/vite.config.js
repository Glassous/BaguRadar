import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import bucketStatic from './plugins/bucket-static.js'

const bucketRoot = fileURLToPath(new URL('../../BaguRadarFiles', import.meta.url))

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
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
    port: 4173,
  },
  build: {
    chunkSizeWarningLimit: 1400,
  },
})
