import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { scrollbar } from './directives/scrollbar'
import { prewarmHighlighter } from './utils/markdown'
import 'katex/dist/katex.min.css'
import './style.css'

createApp(App).directive('scrollbar', scrollbar).use(router).mount('#app')

const runPrewarm = () => {
  prewarmHighlighter().catch((error) => {
    console.error('[BaguRadar] 预加载代码高亮失败', error)
  })
}

if (typeof window.requestIdleCallback === 'function') {
  window.requestIdleCallback(runPrewarm, { timeout: 2500 })
} else {
  window.setTimeout(runPrewarm, 900)
}
