<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, ChevronLeft, ChevronRight, Clock } from '@lucide/vue'
import ArticleToc from './ArticleToc.vue'

const props = defineProps({
  doc: { type: Object, required: true },
  html: { type: String, default: '' },
  toc: { type: Array, default: () => [] },
  prev: { type: Object, default: null },
  next: { type: Object, default: null },
})

const bodyRef = ref(null)
const copyTimers = new WeakMap()

const chapterLink = computed(() => ({
  path: '/',
  query: { focus: props.doc.chapter?.id || undefined },
}))

const tags = computed(() => (Array.isArray(props.doc.tags) ? props.doc.tags.filter(Boolean) : []))

// 正文字数（去掉标签与空白字符），阅读时长按每分钟 420 字估算
const charCount = computed(() =>
  String(props.html)
    .replace(/<[^>]+>/g, '')
    .replace(/\s/g, '').length,
)

const readingMinutes = computed(() => Math.max(1, Math.round(charCount.value / 420)))

function handleClick(event) {
  const button = event.target.closest?.('[data-copy]')
  if (!button) return
  const block = button.closest('.code-block')
  const code = block?.querySelector('pre')?.innerText || ''
  if (!code) return

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
          button.textContent = '复制'
        }, 1600),
      )
    })
    .catch((error) => {
      console.error('[BaguRadar] 复制代码失败', error)
    })
}

onMounted(() => {
  bodyRef.value?.addEventListener('click', handleClick)
})

onBeforeUnmount(() => {
  bodyRef.value?.removeEventListener('click', handleClick)
})
</script>

<template>
  <article class="mx-auto w-full max-w-[860px]">
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

    <details
      v-if="toc.length"
      class="mt-6 rounded-xl border border-line bg-surface/60 px-4 py-3 xl:hidden"
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
        v-tooltip="{ text: '上一篇', key: 'p' }"
        class="group card-lift flex flex-col gap-1 rounded-xl border border-line bg-surface/50 px-4 py-3"
      >
        <span class="inline-flex items-center gap-1 text-[10.5px] text-ink-faint">
          <ChevronLeft :size="12" class="transition-transform group-hover:-translate-x-0.5" />
          上一篇
        </span>
        <span class="text-[13px] font-medium text-ink">{{ prev.title }}</span>
        <span class="text-[10.5px] text-ink-faint">{{ prev.section?.title || prev.chapter?.title }}</span>
      </RouterLink>
      <div v-else class="hidden sm:block" />

      <RouterLink
        v-if="next"
        :to="`/doc/${next.route}`"
        aria-keyshortcuts="n"
        v-tooltip="{ text: '下一篇', key: 'n' }"
        class="group card-lift flex flex-col items-end gap-1 rounded-xl border border-line bg-surface/50 px-4 py-3 text-right"
      >
        <span class="inline-flex items-center gap-1 text-[10.5px] text-ink-faint">
          下一篇
          <ArrowRight :size="12" class="transition-transform group-hover:translate-x-0.5" />
        </span>
        <span class="text-[13px] font-medium text-ink">{{ next.title }}</span>
        <span class="text-[10.5px] text-ink-faint">{{ next.section?.title || next.chapter?.title }}</span>
      </RouterLink>
    </nav>
  </article>
</template>
