import { ref } from 'vue'

const STORAGE_KEY = 'baguradar-map-view'
const VIEWS = ['3d', 'list']
const DESKTOP_QUERY = '(min-width: 1024px)'

/** WebGL 能力探测：只建一个临时 context 再归还，不涉及任何 3D 资源。 */
function hasWebgl() {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    const ok = Boolean(gl)
    // 探测用的上下文立刻归还，避免和真正的渲染器抢 GPU 上下文名额
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return ok
  } catch (error) {
    console.error('[BaguRadar] WebGL 能力探测失败', error)
    return false
  }
}

/** 低性能设备（少核心 / 小内存）：默认不进 3D，避免首屏就卡住。 */
function isLowPowerDevice() {
  if (typeof navigator === 'undefined') return false
  const cores = navigator.hardwareConcurrency || 8
  const memory = navigator.deviceMemory || 8
  return cores <= 4 || memory <= 4
}

function isWideScreen() {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia(DESKTOP_QUERY).matches
  } catch (error) {
    console.error('[BaguRadar] 视口判定失败', error)
    return false
  }
}

/**
 * 设备检测：桌面 + 有 WebGL + 非低性能才给雷达视图。
 * 只在没有任何本地记录（或用户主动重新检测）时执行，结果随视图一起落盘。
 */
function detectDevice() {
  const webgl = hasWebgl()
  return { view: webgl && isWideScreen() && !isLowPowerDevice() ? '3d' : 'list', webgl }
}

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const data = JSON.parse(raw)
    if (!data || !VIEWS.includes(data.view)) return null

    return { view: data.view, webgl: data.webgl !== false }
  } catch (error) {
    console.error('[BaguRadar] 读取知识地图视图设置失败', error)
    return null
  }
}

const stored = readStored()
// 有记录就直接沿用，不再每次刷新都重跑探测，也不会覆盖用户在设置里的选择
const initial = stored || detectDevice()

const viewMode = ref(initial.view)
const supports3d = ref(initial.webgl)

function persist() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ view: viewMode.value, webgl: supports3d.value }),
    )
  } catch (error) {
    console.error('[BaguRadar] 保存知识地图视图设置失败', error)
  }
}

// 首次访问：把检测结果当作初始值持久化下来
if (!stored) persist()

/** 切换默认视图并持久保存：设置面板与首页的切换器共用同一份状态。 */
function setView(next) {
  if (!VIEWS.includes(next) || next === viewMode.value) return
  viewMode.value = next
  persist()
}

/** 3D 启动失败：记下能力缺失并回落列表，下次启动不再重试。 */
function markUnsupported() {
  supports3d.value = false
  if (viewMode.value !== 'list') viewMode.value = 'list'
  persist()
}

/** 手动重新检测设备：覆盖已保存的偏好，回到按设备能力决定的初始值。 */
function redetect() {
  const detected = detectDevice()
  supports3d.value = detected.webgl
  viewMode.value = detected.view
  persist()
  return detected
}

export function useMapView() {
  return { viewMode, supports3d, setView, markUnsupported, redetect }
}
