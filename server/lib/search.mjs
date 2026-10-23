// 纯文本归一化与检索：中文不依赖分词词典，直接用多关键词 AND + 子串匹配。
// 归一化必须保持字符数不变，否则片段偏移会错位，因此按块尝试 NFKC + 小写，
// 长度发生变化时退化为逐字符归一。

const MAX_TERMS = 8
const MAX_QUERY_LENGTH = 64
const MAX_HITS_PER_TERM = 200
const CHUNK_SIZE = 4096

const WEIGHTS = {
  title: 12,
  tags: 8,
  description: 6,
  heading: 4,
  body: 1,
}

const SNIPPET = {
  before: 46,
  after: 82,
  max: 190,
}

const BOUNDARY = /[\s，。；、！？,.;:!?（）()【】「」《》〈〉"'“”‘’·…—]/u
const LEADING_BREAK = /[\s，。；、！？,.;:!?）)】」》"”’]/u

function normalizeCharwise(chunk) {
  let out = ''
  for (const ch of chunk) {
    let next = ch
    try {
      next = ch.normalize('NFKC')
    } catch {
      next = ch
    }
    if (next.length !== ch.length) {
      out += ch
      continue
    }
    const lower = next.toLowerCase()
    out += lower.length === next.length ? lower : next
  }
  return out
}

/**
 * NFKC + 小写，保证返回字符串与入参的 UTF-16 长度一致。
 */
export function normalizeText(input) {
  const value = String(input ?? '')
  if (!value) return ''

  let out = ''
  for (let index = 0; index < value.length; index += CHUNK_SIZE) {
    const chunk = value.slice(index, index + CHUNK_SIZE)
    let normalized
    try {
      normalized = chunk.normalize('NFKC').toLowerCase()
    } catch {
      normalized = chunk.toLowerCase()
    }
    out += normalized.length === chunk.length ? normalized : normalizeCharwise(chunk)
  }
  return out
}

export function normalizeQuery(value) {
  return normalizeText(String(value ?? '').replace(/\s+/g, ' ').trim())
    .split(' ')
    .filter(Boolean)
    .slice(0, MAX_TERMS)
}

function countOccurrences(haystack, needle, cap = MAX_HITS_PER_TERM) {
  if (!needle) return { count: 0, positions: [] }
  const positions = []
  let from = 0
  while (positions.length < cap) {
    const found = haystack.indexOf(needle, from)
    if (found === -1) break
    positions.push(found)
    from = found + needle.length
  }
  return { count: positions.length === cap ? cap : positions.length, positions }
}

function fieldHits(normalizedField, terms) {
  if (!normalizedField) return { count: 0, matched: 0 }
  let count = 0
  let matched = 0
  for (const term of terms) {
    const hits = countOccurrences(normalizedField, term, 8)
    if (hits.count > 0) {
      matched += 1
      count += hits.count
    }
  }
  return { count, matched }
}

function pickAnchor(headings, position) {
  if (!Array.isArray(headings) || headings.length === 0) return ''
  let anchor = ''
  for (const heading of headings) {
    if (heading.offset > position) break
    anchor = heading.id
  }
  return anchor
}

function sliceWindow(text, position) {
  const length = text.length
  let start = Math.max(0, position - SNIPPET.before)
  let end = Math.min(length, position + SNIPPET.after)

  if (start > 0) {
    const probe = text.slice(start, Math.min(length, start + 14))
    const breakIndex = probe.search(LEADING_BREAK)
    if (breakIndex > 0 && breakIndex < 12) start += breakIndex + 1
    else start += 1
  }

  if (end < length) {
    const tailStart = Math.max(start + 1, end - 14)
    const tail = text.slice(tailStart, end)
    let cut = -1
    for (let index = tail.length - 1; index >= 0; index -= 1) {
      if (BOUNDARY.test(tail[index])) {
        cut = index
        break
      }
    }
    if (cut >= 0) end = tailStart + cut + 1
  }

  // 去掉窗口首尾空白，避免片段以空格开头（不影响命中位置之后的偏移计算）
  while (start < end && /\s/.test(text[start])) start += 1
  while (end > start && /\s/.test(text[end - 1])) end -= 1

  return { start, end }
}

function buildSnippet(doc, terms, position) {
  if (!doc.plain) {
    return { snippet: [], more: { before: false, after: false } }
  }

  const { start, end } = sliceWindow(doc.plain, Math.min(position, doc.plain.length))
  const window = doc.plain.slice(start, end)
  if (!window) return { snippet: [], more: { before: false, after: false } }

  const ranges = []
  for (const term of terms) {
    let from = 0
    while (from < window.length) {
      const found = doc.norm.indexOf(term, start + from)
      if (found === -1 || found + term.length > end) break
      ranges.push({ start: found - start, end: found - start + term.length })
      from = found - start + term.length
    }
  }

  ranges.sort((left, right) => left.start - right.start)
  const merged = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end)
    else merged.push({ ...range })
  }

  const snippet = []
  let cursor = 0
  for (const range of merged) {
    if (range.start > cursor) {
      snippet.push({ text: window.slice(cursor, range.start), hit: false })
    }
    snippet.push({ text: window.slice(range.start, range.end), hit: true })
    cursor = range.end
  }
  if (cursor < window.length) snippet.push({ text: window.slice(cursor), hit: false })

  return {
    snippet: snippet.filter((segment) => segment.text.length > 0),
    more: { before: start > 0, after: end < doc.plain.length },
  }
}

function scoreDoc(doc, terms) {
  const title = fieldHits(doc.normTitle, terms)
  const tags = fieldHits(doc.normTags, terms)
  const description = fieldHits(doc.normDescription, terms)
  const heading = fieldHits(doc.normHeadings, terms)

  let bodyCount = 0
  let bodyMatched = 0
  const positions = []
  for (const term of terms) {
    const hits = countOccurrences(doc.norm, term)
    if (hits.count > 0) {
      bodyMatched += 1
      bodyCount += hits.count
      positions.push(...hits.positions)
    }
  }

  // 每个关键词都必须至少命中一个字段，避免多词查询返回只匹配其中一个词的噪声
  for (const term of terms) {
    const inTitle = doc.normTitle.includes(term)
    const inTags = doc.normTags.includes(term)
    const inDescription = doc.normDescription.includes(term)
    const inHeading = doc.normHeadings.includes(term)
    const inBody = doc.norm.includes(term)
    if (!inTitle && !inTags && !inDescription && !inHeading && !inBody) return null
  }

  const score =
    title.count * WEIGHTS.title +
    tags.count * WEIGHTS.tags +
    description.count * WEIGHTS.description +
    heading.count * WEIGHTS.heading +
    bodyCount * WEIGHTS.body

  positions.sort((left, right) => left - right)
  const position = positions.length ? positions[0] : doc.headings[0]?.offset ?? 0

  return {
    doc,
    score,
    count: bodyCount,
    position,
    matched: bodyMatched,
  }
}

/**
 * @param {{ docs: Array }} snapshot
 * @param {string} rawQuery
 * @param {{ limit?: number }} options
 */
export function searchSnapshot(snapshot, rawQuery, { limit = 12 } = {}) {
  const started = performance.now()
  const raw = String(rawQuery ?? '').slice(0, MAX_QUERY_LENGTH)
  const terms = normalizeQuery(raw)

  if (!raw.trim() || terms.length === 0) {
    return { q: raw.trim(), total: 0, took: 0, results: [] }
  }

  const scored = []
  for (const doc of snapshot.docs) {
    const hit = scoreDoc(doc, terms)
    if (hit) scored.push(hit)
  }

  scored.sort(
    (left, right) =>
      right.score - left.score ||
      right.count - left.count ||
      left.doc.route.localeCompare(right.doc.route),
  )

  const max = Math.max(1, Math.min(30, Number(limit) || 12))
  const results = scored.slice(0, max).map((hit) => {
    const { doc, position } = hit
    const { snippet, more } = buildSnippet(doc, terms, position)
    return {
      route: doc.route,
      title: doc.title,
      chapter: doc.chapter,
      section: doc.section,
      tags: doc.tags,
      anchor: pickAnchor(doc.headings, position),
      score: hit.score,
      hits: hit.count,
      snippet,
      more,
    }
  })

  return {
    q: raw.trim(),
    total: scored.length,
    took: Math.round((performance.now() - started) * 10) / 10,
    results,
  }
}
