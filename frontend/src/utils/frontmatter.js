function stripQuotes(value) {
  return value.replace(/^["']/, '').replace(/["']$/, '')
}

/**
 * 轻量 frontmatter 解析：仅支持 key: value、行内数组 [a, b] 与布尔值。
 */
export function parseFrontmatter(raw) {
  const source = String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')

  if (!source.startsWith('---\n')) {
    return { meta: {}, content: source }
  }

  const end = source.indexOf('\n---', 4)
  if (end === -1) {
    return { meta: {}, content: source }
  }

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
        .map((item) => stripQuotes(item.trim()))
        .filter(Boolean)
      continue
    }

    if (rawValue === 'true' || rawValue === 'false') {
      meta[key] = rawValue === 'true'
      continue
    }

    meta[key] = stripQuotes(rawValue)
  }

  return { meta, content }
}
