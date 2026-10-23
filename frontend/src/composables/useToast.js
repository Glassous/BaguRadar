import { readonly, ref } from 'vue'

// 轻量提示条：模块级单例，分享链接与快捷键复制共用同一处文案，避免各组件各写一份定时器。

const DURATION = 2000

const message = ref('')
let timer = 0

export function showToast(text, duration = DURATION) {
  if (!text) return
  message.value = text
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    message.value = ''
    timer = 0
  }, duration)
}

export function useToast() {
  return { toast: readonly(message), showToast }
}
