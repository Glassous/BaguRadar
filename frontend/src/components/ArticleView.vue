<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronLeft, ChevronRight, Clock } from '@lucide/vue'
import ArticleToc from './ArticleToc.vue'
import { useTheme } from '../composables/useTheme'
import { renderDiagrams } from '../utils/mermaid'

const props = defineProps({
  doc: { type: Object, required: true },
  html: { type: String, default: '' },
  toc: { type: Array, default: () => [] },
  prev: { type: Object, default: null },
  next: { type: Object, default: null },
})

const { resolved: themeMode } = useTheme()

const bodyRef = ref(null)
const copyTimers = new WeakMap()
let diagramToken = 0

const chapterLink = computed(() => ({
  path: '/',
  query: { focus: props.doc.chapter?.id || undefined },
}))

const tags = computed(() => (Array.isArray(props.doc.tags) ? props.doc.tags.filter(Boolean) : []))

// 正文字数（去掉标签与空白字符），阅读时长按每分钟 420 字估算
// 图表块的 mermaid 源码不算正文，先整段剔除
const charCount = computed(() =>
  String(props.html)
    .replace(/<pre[^>]*data-diagram-source[^>]*>[\s\S]*?<\/pre>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s/g, '').length,
)

const readingMinutes = computed(() => Math.max(1, Math.round(charCount.value / 420)))

// 代码块复制高亮后的源码，图表块复制 mermaid 源码（画成 SVG 后 <pre> 是隐藏的）
function blockSource(block) {
  if (!block) return ''
  const diagramSource = block.querySelector('[data-diagram-source]')
  if (diagramSource) return diagramSource.textContent || ''
  return block.querySelector('pre')?.innerText || ''
}

function handleClick(event) {
  const button = event.target.closest?.('[data-copy]')
  if (!button) return
  const code = blockSource(button.closest('.code-block, .diagram-block'))
  if (!code) return

  const label = button.dataset.label || button.textContent
  button.dataset.label = label

  navigator.clipboard
    .writeText(code)
    .then(() => {
      button.dataset.state = 'copied'
      button.textContent = '已复制'
      const existing = copyTimers.get(button)
      if (existing) window.clearTimeout(existing)
      copyTimers.set(
        button,
        window.setTimeout(() => {
          button.dataset.state = ''
          button.textContent = label
        }, 1600),
      )
    })
    .catch((error) => {
      console.error('[BaguRadar] 复制代码失败', error)
    })
}

// 图表渲染是异步的（首次还要下载 mermaid），token 用于丢弃切文章/切主题后过期的结果
async function renderDiagramsNow() {
  const token = ++diagramToken
  await nextTick()
  if (!bodyRef.value) return
  await renderDiagrams(bodyRef.value, {
    theme: themeMode.value,
    isCancelled: () => token !== diagramToken,
  })
}

onMounted(() => {
  bodyRef.value?.addEventListener('click', handleClick)
  void renderDiagramsNow()
})

// 深浅色主题下 mermaid 需要按新配色重绘
watch(themeMode, () => {
  void renderDiagramsNow()
})

watch(
  () => props.html,
  () => {
    void renderDiagramsNow()
  },
)

onBeforeUnmount(() => {
  diagramToken += 1
  bodyRef.value?.removeEventListener('click', handleClick)
})
</script>

<template>
  <article class="mx-auto w-full max-w-[1000px]">
    <div class="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
      <RouterLink :to="chapterLink" class="transition-colors hover:text-primary-ink">
        {{ doc.chapter?.title || '首页' }}
      </RouterLink>
      <template v-if="doc.section">
        <ChevronRight :size="11" />
        <span class="text-ink-soft">{{ doc.section.title }}</span>
      </template>
    </div>

    <header class="mt-4">
      <h1 class="text-[30px] font-semibold leading-[1.3] tracking-tight text-ink sm:text-[36px]">
        {{ doc.title }}
      </h1>
      <p v-if="doc.description" class="mt-3 max-w-[62ch] text-[13.5px] leading-relaxed text-ink-faint">
        {{ doc.description }}
      </p>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <span
          v-for="tag in tags"
          :key="tag"
          class="rounded-full border border-line bg-surface/60 px-2.5 py-1 text-[10.5px] font-medium text-ink-soft"
        >
          {{ tag }}
        </span>
        <span class="text-[10.5px] text-ink-faint">{{ charCount }} 字</span>
        <span class="inline-flex items-center gap-1 text-[10.5px] text-ink-faint">
          <Clock :size="11" />
          约 {{ readingMinutes }} 分钟
        </span>
      </div>
    </header>

    <div v-if="toc.length" class="article-toc-rail">
      <ArticleToc :toc="toc" variant="rail" />
    </div>

    <details
      v-if="toc.length"
      class="article-toc-inline mt-6 rounded-xl border border-line bg-surface/60 px-4 py-3"
    >
      <summary class="cursor-pointer list-none text-[11.5px] font-medium text-ink-soft">
        本文目录 · {{ toc.length }} 项
      </summary>
      <div class="mt-2 border-l-0">
        <ArticleToc :toc="toc" />
      </div>
    </details>

    <div ref="bodyRef" class="article-body mt-8" v-html="html" />

    <nav class="mt-14 grid gap-3 border-t border-line pt-6 sm:grid-cols-2" aria-label="文章翻页">
      <RouterLink
        v-if="prev"
        :to="`/doc/${prev.route}`"
        aria-keyshortcuts="p"
        class="group card-lift flex flex-col gap-1 rounded-xl border border-line bg-surface/50 px-4 py-3"
      >
        <span class="inline-flex items-center gap-1.5 text-[13px] text-ink-faint">
          <ChevronLeft :size="16" class="transition-transform group-hover:-translate-x-0.5" />
          上一篇
          <kbd class="kbd-chip kbd-chip--nav">p</kbd>
        </span>
        <span class="text-[13px] font-medium text-ink">{{ prev.title }}</span>
        <span class="text-[10.5px] text-ink-faint">{{ prev.section?.title || prev.chapter?.title }}</span>
      </RouterLink>
      <div v-else class="hidden sm:block" />

      <RouterLink
        v-if="next"
        :to="`/doc/${next.route}`"
        aria-keyshortcuts="n"
        class="group card-lift flex flex-col items-end gap-1 rounded-xl border border-line bg-surface/50 px-4 py-3 text-right"
      >
        <span class="inline-flex items-center gap-1.5 text-[13px] text-ink-faint">
          下一篇
          <kbd class="kbd-chip kbd-chip--nav">n</kbd>
          <ChevronRight :size="16" class="transition-transform group-hover:translate-x-0.5" />
        </span>
        <span class="text-[13px] font-medium text-ink">{{ next.title }}</span>
        <span class="text-[10.5px] text-ink-faint">{{ next.section?.title || next.chapter?.title }}</span>
      </RouterLink>
    </nav>
  </article>
</template>
