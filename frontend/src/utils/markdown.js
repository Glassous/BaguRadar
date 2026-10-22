import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import katexModule from '@vscode/markdown-it-katex'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import githubLight from 'shiki/themes/github-light.mjs'
import githubDark from 'shiki/themes/github-dark.mjs'

const LIGHT_THEME = 'github-light'
const DARK_THEME = 'github-dark'

const LANG_LOADERS = [
  () => import('shiki/langs/javascript.mjs'),
  () => import('shiki/langs/typescript.mjs'),
  () => import('shiki/langs/java.mjs'),
  () => import('shiki/langs/go.mjs'),
  () => import('shiki/langs/python.mjs'),
  () => import('shiki/langs/rust.mjs'),
  () => import('shiki/langs/cpp.mjs'),
  () => import('shiki/langs/sql.mjs'),
  () => import('shiki/langs/bash.mjs'),
  () => import('shiki/langs/json.mjs'),
  () => import('shiki/langs/yaml.mjs'),
  () => import('shiki/langs/vue.mjs'),
  () => import('shiki/langs/html.mjs'),
  () => import('shiki/langs/css.mjs'),
  () => import('shiki/langs/xml.mjs'),
  () => import('shiki/langs/dockerfile.mjs'),
  () => import('shiki/langs/diff.mjs'),
  () => import('shiki/langs/markdown.mjs'),
]

const LANG_ALIASES = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  golang: 'go',
  'c++': 'cpp',
  cs: 'csharp',
  rs: 'rust',
  htm: 'html',
  md: 'markdown',
  docker: 'dockerfile',
  plaintext: 'text',
  plain: 'text',
}

let highlighter = null
let highlighterPromise = null
let highlighterUnavailable = false

export function prewarmHighlighter() {
  return ensureHighlighter()
}

export async function ensureHighlighter() {
  if (highlighter) return highlighter
  if (highlighterUnavailable) return null

  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [githubLight, githubDark],
      langs: LANG_LOADERS.map((load) => load()),
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    })
      .then((instance) => {
        highlighter = instance
        return instance
      })
      .catch((error) => {
        highlighterUnavailable = true
        console.error('[BaguRadar] 代码高亮初始化失败，已降级为纯文本代码块', error)
        return null
      })
      .finally(() => {
        highlighterPromise = null
      })
  }

  return highlighterPromise
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripHtml(value) {
  return String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function slugify(text) {
  const slug = String(text)
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'section'
}

function highlight(code, lang) {
  if (!highlighter) return null
  const loaded = highlighter.getLoadedLanguages()
  if (!loaded.includes(lang)) return null

  try {
    return highlighter.codeToHtml(code, {
      lang,
      themes: { light: LIGHT_THEME, dark: DARK_THEME },
      defaultColor: false,
    })
  } catch (error) {
    console.error(`[BaguRadar] 代码高亮失败（${lang}）`, error)
    return null
  }
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
})

const katexPlugin = typeof katexModule === 'function' ? katexModule : katexModule?.default

md.use(anchor, {
  level: [2, 3],
  slugify,
  uniqueSlugStartIndex: 2,
  tabIndex: false,
})

if (katexPlugin) {
  md.use(katexPlugin, { throwOnError: false, enableBareBlocks: false })
} else {
  console.error('[BaguRadar] KaTeX 插件未正确加载，数学公式将被当作普通文本渲染')
}

const defaultFence = md.renderer.rules.fence

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const rawLang = (token.info || '').trim().split(/\s+/)[0] || 'text'
  const normalized = rawLang.toLowerCase()
  const lang = LANG_ALIASES[normalized] || normalized

  const highlighted = highlight(token.content, lang)
  const codeHtml =
    highlighted ||
    `<pre class="shiki"><code>${escapeHtml(token.content.replace(/\n$/, ''))}</code></pre>`

  return `<div class="code-block">
  <div class="code-block__bar">
    <span class="code-block__lang">${escapeHtml(rawLang)}</span>
    <button type="button" class="code-copy" data-copy>复制</button>
  </div>
  ${codeHtml}
</div>
`
}

md.renderer.rules.table_open = () => '<div class="table-scroll"><table>\n'
md.renderer.rules.table_close = () => '</table></div>\n'

const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const href = token.attrGet('href') || ''
  if (/^https?:\/\//i.test(href)) {
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noopener noreferrer')
  }
  return defaultLinkOpen(tokens, idx, options, env, self)
}

export function renderMarkdown(source) {
  const env = {}
  const tokens = md.parse(source, env)
  const toc = []

  // 文章标题由 manifest / frontmatter 提供，正文首个 H1 仅作为文件标记，不重复渲染。
  if (tokens[0]?.type === 'heading_open' && tokens[0].tag === 'h1') {
    tokens.splice(0, 3)
  }

  tokens.forEach((token, index) => {
    if (token.type !== 'heading_open') return
    if (token.tag !== 'h2' && token.tag !== 'h3') return
    const id = token.attrGet('id')
    if (!id) return
    const inline = tokens[index + 1]
    const text = inline?.children
      ? stripHtml(md.renderer.renderInline(inline.children, md.options, env))
      : ''
    if (!text) return
    toc.push({ id, level: token.tag === 'h2' ? 2 : 3, text })
  })

  return {
    html: md.renderer.render(tokens, md.options, env),
    toc,
  }
}
