import { ref } from 'vue'

// 浏览器是否已提供可用的安装提示（Chromium 系：beforeinstallprompt）
const canInstall = ref(false)
// 是否已经以独立应用窗口运行
const installed = ref(false)

let deferredPrompt = null
let bound = false

function isStandalone() {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true
    if (window.matchMedia?.('(display-mode: window-controls-overlay)').matches) return true
  } catch (error) {
    console.error('[BaguRadar] 检测显示模式失败', error)
  }
  return window.navigator.standalone === true
}

function bindInstallEvents() {
  if (bound || typeof window === 'undefined') return
  bound = true
  installed.value = isStandalone()

  window.addEventListener('beforeinstallprompt', (event) => {
    // 拦截浏览器默认提示，改由页面上的安装按钮触发
    event.preventDefault()
    deferredPrompt = event
    canInstall.value = true
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    canInstall.value = false
    installed.value = true
  })
}

// 在脚本求值阶段就挂载监听，避免错过页面加载早期触发的安装提示
bindInstallEvents()

export function useInstallApp() {
  bindInstallEvents()

  /**
   * 触发浏览器安装提示。
   * @returns {Promise<'accepted' | 'dismissed' | 'unavailable'>}
   */
  async function promptInstall() {
    const event = deferredPrompt
    if (!event) return 'unavailable'

    deferredPrompt = null
    canInstall.value = false
    event.prompt()

    try {
      const choice = await event.userChoice
      return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed'
    } catch (error) {
      console.error('[BaguRadar] 读取安装结果失败', error)
      return 'dismissed'
    }
  }

  return { canInstall, installed, promptInstall }
}
