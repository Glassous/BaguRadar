import { ref } from 'vue'

const STORAGE_KEY = 'baguradar-easter-egg'

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    // 未存储过视为开启，只有显式存过 0 才是关闭
    return raw === null ? true : raw === '1'
  } catch (error) {
    console.error('[BaguRadar] 读取彩蛋设置失败', error)
    return true
  }
}

const enabled = ref(readStored())

function setEnabled(value) {
  enabled.value = value
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch (error) {
    console.error('[BaguRadar] 保存彩蛋设置失败', error)
  }
}

export function useEasterEgg() {
  return { enabled, setEnabled }
}
