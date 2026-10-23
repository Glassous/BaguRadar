// Markdown → 可检索纯文本。
// 纯文本必须与原文保持可回溯的字符偏移，供搜索片段精确高亮，因此这里逐行拼接、
// 只用单个空格分隔，不做整体重排（不做 trim / 折叠空白等会改变偏移的操作）。

const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/
const FENCE = /^[ \t]*(`{3,}|~{3,})/
const TABLE_DIVIDER = /^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/
const LIST_MARKER = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/
const QUOTE_MARKER = /^[ \t]*(?:>[ \t]?)+/

const HTML_ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

/**
 * 与 frontend/src/utils/markdown.js 的 slugify 完全一致：
 * 前端 markdown-it-anchor 用它生成标题 id，服务端必须复刻才能保证跳转锚点对得上。
 */
export function slugify(text) {
  const slug = String(text)
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'section'
}

function decodeEntities(text) {
  return text.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (match) => HTML_ENTITIES[match] || match)
}

function stripInline(text) {
  return decodeEntities(
    String(text)
      // 图片保留 alt 文本，链接保留锚文本
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // 行内代码去掉反引号，内容本身参与检索
      .replace(/`+([^`]*)`+/g, '$1')
      // 原始 HTML 标签不进入索引
      .replace(/<[^>]+>/g, '')
      // 强调/删除线标记（下划线可能是标识符，保留）
      .replace(/(\*\*|__|~~|\*)/g, '')
      // 表格竖线转为分隔
      .replace(/\|/g, ' ')
      .replace(/[\s\u3000]+/g, ' '),
  ).trim()
}

/**
 * 解析 frontmatter，规则与 frontend/src/utils/frontmatter.js 保持一致。
 */
export function parseFrontmatter(raw) {
  const source = String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')

  if (!source.startsWith('---\n')) return { meta: {}, content: source }

  const end = source.indexOf('\n---', 4)
  if (end === -1) return { meta: {}, content: source }

  const block = source.slice(4, end)
  const content = source.slice(end + 4).replace(/^\n/, '')
  const meta = {}

  for (const line of block.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf(':')
    if (separator <= 0) continue

    const key = trimmed.slice(0, separator).trim()
    const rawValue = trimmed.slice(separator + 1).trim()

    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      meta[key] = rawValue
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^["']/, '').replace(/["']$/, ''))
        .filter(Boolean)
      continue
    }

    if (rawValue === 'true' || rawValue === 'false') {
      meta[key] = rawValue === 'true'
      continue
    }

    meta[key] = rawValue.replace(/^["']/, '').replace(/["']$/, '')
  }

  return { meta, content }
}

/**
 * 把正文转成纯文本，同时记录 h2/h3 的锚点与字符偏移。
 * @param {string} markdown
 * @returns {{ text: string, headings: Array<{ id: string, text: string, offset: number, level: number }> }}
 */
export function extractPlainText(markdown) {
  const lines = String(markdown ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')

  const headings = []
  const slugCounts = new Map()
  const parts = []
  let length = 0
  let fence = ''
  let seenH1 = false

  const append = (value) => {
    if (!value) return
    const needsSpace = length > 0 && !parts[parts.length - 1].endsWith(' ')
    if (needsSpace && !value.startsWith(' ')) {
      parts.push(' ')
      length += 1
    }
    parts.push(value)
    length += value.length
  }

  for (const line of lines) {
    const fenceMatch = line.match(FENCE)
    if (fence) {
      // 代码块内容照常参与检索（函数名、命令、关键字都是高频查询目标）
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) {
        fence = ''
        continue
      }
      append(line.replace(/\s+$/, ''))
      continue
    }

    if (fenceMatch) {
      fence = fenceMatch[1]
      continue
    }

    const trimmed = line.trim()
    if (!trimmed) continue

    const headingMatch = trimmed.match(HEADING)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = stripInline(headingMatch[2])
      // 正文首个 H1 与文章标题重复，前端渲染时也会剔除，索引同步剔除
      if (level === 1 && !seenH1) {
        seenH1 = true
        continue
      }
      if (text) {
        if (level === 2 || level === 3) {
          const base = slugify(text)
          const seen = (slugCounts.get(base) || 0) + 1
          slugCounts.set(base, seen)
          headings.push({
            id: seen > 1 ? `${base}-${seen}` : base,
            text,
            offset: length,
            level,
          })
        }
        append(text)
      }
      continue
    }

    if (TABLE_DIVIDER.test(trimmed)) continue

    const body = trimmed.replace(QUOTE_MARKER, '').replace(LIST_MARKER, '')
    const text = stripInline(body)
    if (text) append(text)
  }

  // 末尾空格没有检索价值，去掉也不影响任何已有偏移
  let text = parts.join('')
  while (text.endsWith(' ')) text = text.slice(0, -1)

  return { text, headings }
}
