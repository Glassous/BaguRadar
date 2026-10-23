// Mermaid 图表渲染：```mermaid 代码块在 Markdown 阶段只输出占位 DOM，
// 真正的 SVG 由这里按当前主题懒加载 mermaid 绘制，避免把图表库打进首屏包。
const SOURCE_SELECTOR = '[data-diagram-source]'
const CANVAS_SELECTOR = '[data-diagram-canvas]'
const BLOCK_SELECTOR = '[data-diagram]'

const HINT_PENDING = '<span class="diagram-block__hint">图表渲染中…</span>'
const HINT_ERROR = '<span class="diagram-block__hint diagram-block__hint--error">图表渲染失败，已显示源码</span>'

let mermaidInstance = null
let mermaidPromise = null
let mermaidUnavailable = false
let appliedTheme = ''
let sequence = 0

function readVar(style, name, fallback) {
  return style.getPropertyValue(name).trim() || fallback
}

// mermaid 的配色全部走主题变量，直接读站点的 CSS 变量，深浅色切换时不用再维护一套色板
function themeVariables(dark) {
  const style = getComputedStyle(document.documentElement)
  const surface = readVar(style, '--c-surface', dark ? '#111820' : '#ffffff')
  const ink = readVar(style, '--c-ink', dark ? '#e6e9ee' : '#111827')
  const inkSoft = readVar(style, '--c-ink-soft', dark ? '#b3bcc7' : '#4b5563')
  const lineStrong = readVar(style, '--c-line-strong', dark ? 'rgba(255,255,255,0.16)' : '#d5d9d2')
  const primary = readVar(style, '--c-primary', dark ? '#2dd4bf' : '#0d9488')
  const primarySoft = readVar(style, '--c-primary-soft', dark ? 'rgba(45,212,191,0.14)' : '#cdfbf3')
  const accent = readVar(style, '--c-accent', dark ? '#fbbf24' : '#d97706')

  return {
    darkMode: dark,
    background: surface,
    fontFamily: getComputedStyle(document.body).fontFamily,
    fontSize: '13.5px',
    textColor: ink,
    primaryColor: primarySoft,
    primaryTextColor: ink,
    primaryBorderColor: primary,
    secondaryColor: dark ? '#161e27' : '#f6f7f4',
    secondaryTextColor: inkSoft,
    secondaryBorderColor: lineStrong,
    tertiaryColor: surface,
    tertiaryTextColor: inkSoft,
    tertiaryBorderColor: lineStrong,
    mainBkg: primarySoft,
    nodeBorder: primary,
    nodeTextColor: ink,
    clusterBkg: dark ? 'rgba(255,255,255,0.03)' : '#f9faf8',
    clusterBorder: lineStrong,
    titleColor: ink,
    lineColor: lineStrong,
    defaultLinkColor: lineStrong,
    edgeLabelBackground: surface,
    labelBackground: surface,
    labelTextColor: inkSoft,
    // 时序图
    actorBkg: primarySoft,
    actorBorder: primary,
    actorTextColor: ink,
    actorLineColor: lineStrong,
    signalColor: inkSoft,
    signalTextColor: ink,
    noteBkgColor: dark ? '#1d2a36' : '#fdf6e3',
    noteBorderColor: accent,
    noteTextColor: ink,
    activationBkgColor: primarySoft,
    activationBorderColor: primary,
    // 状态图 / 类图 / 饼图共用的强调色
    pie1: primary,
    pie2: accent,
    pie3: dark ? '#3b82f6' : '#2563eb',
    pie4: dark ? '#a78bfa' : '#7c3aed',
    pieTitleTextSize: '15px',
  }
}

function configure(instance, theme) {
  if (appliedTheme === theme) return
  const dark = theme === 'dark'

  instance.initialize({
    startOnLoad: false,
    // 文章内容来自外部 Markdown，按 strict 处理标签，避免内联 HTML 被当成脚本执行
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: 'base',
    themeVariables: themeVariables(dark),
    fontFamily: getComputedStyle(document.body).fontFamily,
    // 保持图表的自然尺寸，过宽时由 CSS 等比缩小，比强行拉满容器更易读
    flowchart: { useMaxWidth: false, curve: 'basis', wrappingWidth: 320 },
    sequence: { useMaxWidth: false },
    gantt: { useMaxWidth: false },
    journey: { useMaxWidth: false },
    timeline: { useMaxWidth: false },
  })
  appliedTheme = theme
}

export async function ensureMermaid() {
  if (mermaidInstance) return mermaidInstance
  if (mermaidUnavailable) return null

  if (!mermaidPromise) {
    mermaidPromise = import('mermaid')
      .then((mod) => {
        const instance = typeof mod?.default?.render === 'function' ? mod.default : mod
        mermaidInstance = instance
        return instance
      })
      .catch((error) => {
        mermaidUnavailable = true
        console.error('[BaguRadar] Mermaid 加载失败，图表已降级为源码展示', error)
        return null
      })
      .finally(() => {
        mermaidPromise = null
      })
  }

  return mermaidPromise
}

function markError(block, canvas) {
  block.dataset.diagramState = 'error'
  block.classList.add('is-error')
  canvas.innerHTML = HINT_ERROR
}

// 把 root 下所有未绘制（或主题已变）的图表画成 SVG
// theme 变化后需要重绘，isCancelled 用于文章切换/组件卸载时丢弃过期结果
async function renderAll(root, options = {}) {
  const { theme = 'light', isCancelled = () => false } = options
  const blocks = root?.querySelectorAll ? Array.from(root.querySelectorAll(BLOCK_SELECTOR)) : []
  if (!blocks.length) return

  const instance = await ensureMermaid()
  if (isCancelled()) return

  if (!instance) {
    blocks.forEach((block) => {
      const canvas = block.querySelector(CANVAS_SELECTOR)
      if (canvas) markError(block, canvas)
    })
    return
  }

  configure(instance, theme)

  for (const block of blocks) {
    if (isCancelled()) return

    const canvas = block.querySelector(CANVAS_SELECTOR)
    const source = block.querySelector(SOURCE_SELECTOR)?.textContent || ''
    if (!canvas) continue
    // 主题没变且已画好的直接跳过，切回同一篇文章时不用重排
    if (block.dataset.diagramState === 'ready' && block.dataset.diagramTheme === theme) continue

    const code = source.trim()
    if (!code) {
      block.dataset.diagramState = 'empty'
      canvas.innerHTML = '<span class="diagram-block__hint">图表内容为空</span>'
      continue
    }

    const id = `mermaid-diagram-${++sequence}`
    block.dataset.diagramState = 'pending'
    block.classList.remove('is-error')
    canvas.innerHTML = HINT_PENDING

    try {
      const { svg, bindFunctions } = await instance.render(id, code, canvas)
      if (isCancelled()) return
      canvas.innerHTML = svg
      bindFunctions?.(canvas)
      block.dataset.diagramState = 'ready'
      block.dataset.diagramTheme = theme
    } catch (error) {
      if (isCancelled()) return
      console.error('[BaguRadar] Mermaid 渲染失败', error)
      markError(block, canvas)
      document.getElementById(`d${id}`)?.remove()
    }
  }
}

// mermaid 的 render 共用一份全局配置，多次调用必须排队，否则并发渲染会互相踩
let renderQueue = Promise.resolve()

export function renderDiagrams(root, options = {}) {
  const run = () => renderAll(root, options)
  const pending = renderQueue.then(run, run)
  renderQueue = pending.catch(() => {})
  return pending
}
