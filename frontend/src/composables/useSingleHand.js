import { computed, ref, watchEffect } from 'vue'

const STORAGE_KEY = 'baguradar-single-hand'
const MOBILE_QUERY = '(max-width: 1023.98px)'
const HANDS = ['right', 'left']

/**
 * 单手模式只在窄屏生效：宽屏（≥1024px）连设置入口一起隐藏，
 * 所以状态里不做"桌面禁用"的标记，交给 singleHandActive 派生。
 */
function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { enabled: false, hand: 'right' }
    const data = JSON.parse(raw)
    return {
      enabled: data?.enabled === true,
      hand: HANDS.includes(data?.hand) ? data.hand : 'right',
    }
  } catch (error) {
    console.error('[BaguRadar] 读取单手模式设置失败', error)
    return { enabled: false, hand: 'right' }
  }
}

const stored = readStored()

const enabled = ref(stored.enabled)
const hand = ref(stored.hand)
// 当前页面是否渲染了章节悬浮按钮：没有它时底部按钮组直接贴底
const tocFabVisible = ref(false)

const narrowMedia = window.matchMedia(MOBILE_QUERY)
const isNarrow = ref(narrowMedia.matches)

narrowMedia.addEventListener('change', (event) => {
  isNarrow.value = event.matches
})

const singleHandActive = computed(() => enabled.value && isNarrow.value)

function persist() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ enabled: enabled.value, hand: hand.value }),
    )
  } catch (error) {
    console.error('[BaguRadar] 保存单手模式设置失败', error)
  }
}

function setEnabled(value) {
  enabled.value = Boolean(value)
  persist()
}

function setHand(value) {
  if (!HANDS.includes(value) || value === hand.value) return
  hand.value = value
  persist()
}

function setTocFabVisible(value) {
  tocFabVisible.value = Boolean(value)
}

/**
 * 状态统一落到 <html>：设置弹窗 Teleport 到 body、按钮与搜索条都是 fixed 定位，
 * 逐层透传 props 会横穿 App / AppSearch / AppSidebar / ArticleToc，
 * 直接写根节点属性可以让 style.css 用同一组选择器命中全部元素。
 * --sh-fab-offset 是底部按钮组给章节悬浮按钮让出的高度（48px 按钮 + 8px 间隙）。
 */
watchEffect(() => {
  const root = document.documentElement
  root.dataset.singleHand = singleHandActive.value ? 'on' : 'off'
  root.dataset.hand = hand.value
  root.style.setProperty('--sh-fab-offset', tocFabVisible.value ? '56px' : '0px')
})

export function useSingleHand() {
  return { enabled, hand, singleHandActive, tocFabVisible, setEnabled, setHand, setTocFabVisible }
}
