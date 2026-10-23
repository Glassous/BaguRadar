import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { searchArticles } from '@/services/search'

const DEBOUNCE = 160

/**
 * 随打即搜状态机：输入防抖 + 请求取消 + 结果/错误/加载状态 + 键盘选择索引。
 */
export function useSearch({ limit = 12 } = {}) {
  const query = ref('')
  const results = ref([])
  const total = ref(0)
  const took = ref(0)
  const pending = ref(false)
  const error = ref('')
  const activeIndex = ref(-1)
  const searched = ref(false)

  let timer = 0
  let controller = null
  let seq = 0

  const hasQuery = computed(() => query.value.trim().length > 0)
  const empty = computed(
    () => searched.value && !pending.value && !error.value && results.value.length === 0,
  )

  function clearTimer() {
    if (timer) window.clearTimeout(timer)
    timer = 0
  }

  function cancel() {
    controller?.abort()
    controller = null
  }

  async function run(term) {
    const value = String(term ?? '').trim()
    if (!value) return

    const token = (seq += 1)
    cancel()
    const current = new AbortController()
    controller = current

    pending.value = true
    error.value = ''

    try {
      const data = await searchArticles(value, { limit, signal: current.signal })
      if (token !== seq) return
      results.value = data.results
      total.value = data.total
      took.value = data.took
      activeIndex.value = data.results.length ? 0 : -1
      searched.value = true
    } catch (requestError) {
      if (token !== seq || requestError?.aborted) return
      results.value = []
      total.value = 0
      took.value = 0
      activeIndex.value = -1
      error.value = requestError?.message || '搜索服务暂不可用'
      searched.value = true
    } finally {
      if (token === seq) pending.value = false
    }
  }

  function reset() {
    clearTimer()
    cancel()
    seq += 1
    results.value = []
    total.value = 0
    took.value = 0
    pending.value = false
    error.value = ''
    activeIndex.value = -1
    searched.value = false
  }

  /** 跳过防抖立即检索（回车 / 打开面板时使用） */
  function searchNow() {
    clearTimer()
    return run(query.value)
  }

  function move(delta) {
    if (!results.value.length) return
    const next = activeIndex.value + delta
    if (next < 0) activeIndex.value = results.value.length - 1
    else if (next >= results.value.length) activeIndex.value = 0
    else activeIndex.value = next
  }

  function setActive(index) {
    activeIndex.value = index
  }

  function selectActive() {
    return results.value[activeIndex.value] || results.value[0] || null
  }

  watch(query, (value) => {
    clearTimer()
    const term = String(value ?? '').trim()
    if (!term) {
      reset()
      return
    }

    // 输入变化立即进入加载态，避免面板在 160ms 内闪回上一次结果
    pending.value = true
    searched.value = true
    timer = window.setTimeout(() => {
      timer = 0
      void run(term)
    }, DEBOUNCE)
  })

  onBeforeUnmount(() => {
    clearTimer()
    cancel()
  })

  return {
    query,
    results,
    total,
    took,
    pending,
    error,
    empty,
    searched,
    activeIndex,
    hasQuery,
    run,
    searchNow,
    reset,
    move,
    setActive,
    selectActive,
    cancel,
  }
}
