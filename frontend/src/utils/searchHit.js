// 文章内搜索命中定位：滚动到命中段落，命中词高亮约 2 秒后自动消退。
// 优先使用 CSS Custom Highlight API（不改 DOM，不会破坏 Shiki 的 span 结构），
// 不支持时退化为整段背景淡出。

const HIGHLIGHT_NAME = 'baguradar-search'
const DURATION = 2000
const BLOCK_SELECTOR = 'p, li, h2, h3, h4, td, th, blockquote, pre'

let timer = 0
let flashed = null

function supportsHighlight() {
  return typeof CSS !== 'undefined' && CSS?.highlights && typeof Highlight === 'function'
}

function clearHighlight() {
  if (!supportsHighlight()) return
  try {
    CSS.highlights.delete(HIGHLIGHT_NAME)
  } catch {
    // 忽略浏览器实现差异
  }
}

/** 清除高亮与定时器（路由切换 / 组件卸载 / 重新定位前调用） */
export function clearSearchHit() {
  if (timer) {
    window.clearTimeout(timer)
    timer = 0
  }
  if (flashed) {
    flashed.classList.remove('search-target')
    flashed = null
  }
  clearHighlight()
}

export function splitTerms(query) {
  return String(query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function findBlock(root, terms, from = 0) {
  const blocks = Array.from(root.querySelectorAll(BLOCK_SELECTOR))
  let fallback = null

  for (let index = from; index < blocks.length; index += 1) {
    const text = blocks[index].textContent || ''
    if (!text) continue
    const lower = text.toLowerCase()
    if (terms.every((term) => lower.includes(term))) {
      return { el: blocks[index], index }
    }
    if (!fallback && terms.some((term) => lower.includes(term))) {
      fallback = { el: blocks[index], index }
    }
  }

  return fallback
}

function firstTextRange(element, terms) {
  if (typeof document.createTreeWalker !== 'function') return null

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let node = walker.nextNode()
  while (node) {
    const text = (node.nodeValue || '').toLowerCase()
    let bestIndex = -1
    let bestTerm = ''
    for (const term of terms) {
      const found = text.indexOf(term)
      if (found !== -1 && (bestIndex === -1 || found < bestIndex)) {
        bestIndex = found
        bestTerm = term
      }
    }

    if (bestIndex !== -1) {
      const range = document.createRange()
      range.setStart(node, bestIndex)
      range.setEnd(node, bestIndex + bestTerm.length)
      return range
    }

    node = walker.nextNode()
  }

  return null
}

/**
 * 定位并高亮。
 * @param {{ root: Element | null, query: string, anchor?: string }} options
 * @returns {boolean} 是否找到可滚动的位置
 */
export function locateSearchHit({ root, query, anchor = '' }) {
  clearSearchHit()
  if (!root) return false

  const terms = splitTerms(query)
  if (terms.length === 0) return false

  const blocks = Array.from(root.querySelectorAll(BLOCK_SELECTOR))
  let anchorIndex = -1
  let anchorEl = null

  if (anchor) {
    const candidate = document.getElementById(anchor)
    if (candidate && root.contains(candidate)) {
      anchorEl = candidate
      const direct = blocks.indexOf(candidate)
      anchorIndex = direct >= 0 ? direct : 0
    }
  }

  let found = findBlock(root, terms, anchorIndex >= 0 ? anchorIndex : 0)
  if (!found && anchorIndex > 0) found = findBlock(root, terms, 0)

  // 命中块优先，锚点只作为“从哪里开始找”的提示
  const target = found?.el || anchorEl
  const scrollTarget = target || anchorEl

  if (scrollTarget) {
    scrollTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  if (!target) return Boolean(scrollTarget)

  flashed = target
  target.classList.add('search-target')

  const range = firstTextRange(target, terms)
  if (range && supportsHighlight()) {
    try {
      CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range))
    } catch {
      // 忽略
    }
  }

  timer = window.setTimeout(clearSearchHit, DURATION)
  return true
}
