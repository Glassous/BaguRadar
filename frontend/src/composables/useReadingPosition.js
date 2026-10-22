import { ref } from 'vue'

const STORAGE_KEY = 'baguradar-reading-position'

function toNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : NaN
}

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const data = JSON.parse(raw)
    if (!data || typeof data.route !== 'string' || !data.route) return null

    const progress = toNumber(data.progress)
    const scrollTop = toNumber(data.scrollTop)
    const maxScroll = toNumber(data.maxScroll)

    return {
      route: data.route,
      title: typeof data.title === 'string' ? data.title : '',
      // 位置比例兜底：窗口尺寸变化后按比例回到相近位置
      progress: Number.isNaN(progress) ? 0 : Math.min(1, Math.max(0, progress)),
      scrollTop: Number.isNaN(scrollTop) || scrollTop <= 0 ? 0 : scrollTop,
      maxScroll: Number.isNaN(maxScroll) || maxScroll <= 0 ? 0 : maxScroll,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    }
  } catch (error) {
    console.error('[BaguRadar] 读取阅读位置失败', error)
    return null
  }
}

const lastPosition = ref(readStored())

export function clearReadingPosition() {
  lastPosition.value = null
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('[BaguRadar] 清除阅读位置失败', error)
  }
}

export function saveReadingPosition({ route, title = '', scrollTop, progress, maxScroll }) {
  if (!route) return

  const record = {
    route,
    title,
    scrollTop: Math.max(0, Math.round(scrollTop || 0)),
    progress: Math.min(1, Math.max(0, progress || 0)),
    maxScroll: Math.max(0, Math.round(maxScroll || 0)),
    updatedAt: new Date().toISOString(),
  }

  lastPosition.value = record
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch (error) {
    console.error('[BaguRadar] 保存阅读位置失败', error)
  }
}

export function useReadingPosition() {
  return { lastPosition, saveReadingPosition, clearReadingPosition }
}
