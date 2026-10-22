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

watch(resolved, applyTheme, { immediate: true })

export function useTheme() {
  return { mode, setMode }
}
