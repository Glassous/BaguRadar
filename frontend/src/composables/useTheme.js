import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'baguradar-theme'
const MODES = ['light', 'dark', 'system']

function readStoredMode() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return MODES.includes(stored) ? stored : 'system'
  } catch (error) {
    console.error('[BaguRadar] 读取主题设置失败', error)
    return 'system'
  }
}

const media = window.matchMedia('(prefers-color-scheme: dark)')
const mode = ref(readStoredMode())
const systemDark = ref(media.matches)

media.addEventListener('change', (event) => {
  systemDark.value = event.matches
})

const resolved = computed(() => {
  if (mode.value === 'system') return systemDark.value ? 'dark' : 'light'
  return mode.value
})

function applyTheme(value) {
  const root = document.documentElement
  root.classList.toggle('dark', value === 'dark')
  root.style.colorScheme = value

  // 已安装 PWA 的窗口控件区域由浏览器按主题色绘制，运行时改了深浅色也要同步，
  // 否则右上角的最小化/最大化/关闭会浮在一条异色底上。
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', value === 'dark' ? '#0b0f14' : '#fbfbf9')
}

function setMode(next) {
  if (!MODES.includes(next)) return
  mode.value = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch (error) {
    console.error('[BaguRadar] 保存主题设置失败', error)
  }
}

// 顶栏按钮与 T 快捷键共用：跟随系统时按当前实际主题切到相反的一档
function toggleMode() {
  setMode(resolved.value === 'dark' ? 'light' : 'dark')
}

watch(resolved, applyTheme, { immediate: true })

export function useTheme() {
  return { mode, resolved, setMode, toggleMode }
}
