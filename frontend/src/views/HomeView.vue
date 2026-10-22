<script setup>
import { computed, nextTick, onMounted, reactive, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowRight, Radar, Sparkles } from '@lucide/vue'
import BrandMark from '../components/BrandMark.vue'
import StatePanel from '../components/StatePanel.vue'
import { useCatalog } from '../composables/useCatalog'

const route = useRoute()
const { state, site, stats, chapters, ensureCatalog } = useCatalog()

const shown = reactive({ chapters: 0, sections: 0, docs: 0 })

function countUp(key, target) {
  const duration = 720
  const start = performance.now()
  const step = (now) => {
    const progress = Math.min(1, (now - start) / duration)
    shown[key] = Math.round(target * (1 - (1 - progress) ** 3))
    if (progress < 1) window.requestAnimationFrame(step)
  }
  window.requestAnimationFrame(step)
}

watch(
  () => stats.value,
  (value) => {
    countUp('chapters', value.chapters)
    countUp('sections', value.sections)
    countUp('docs', value.docs)
  },
  { immediate: true },
)

const highlightChips = computed(() => [
  { label: '基础', detail: 'OS / 网络 / 算法' },
  { label: '框架', detail: 'Spring / Vue / Kafka' },
  { label: '进阶', detail: '分布式 / K8s / LLM' },
  { label: '面试', detail: '场景题 / 项目复盘' },
])

function scrollToFocus() {
  const focus = route.query.focus
  if (!focus) return
  // focus=map 供桌面快捷方式直接落到知识地图
  const isMap = focus === 'map'
  const element = document.getElementById(isMap ? 'knowledge-map' : `chapter-${focus}`)
  if (!element) return
  window.setTimeout(
    () => element.scrollIntoView({ behavior: 'smooth', block: isMap ? 'start' : 'center' }),
    120,
  )
}

function scrollToMap() {
  document.getElementById('knowledge-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(async () => {
  document.title = `${site.value.title} · ${site.value.subtitle}`
  await ensureCatalog()
  await nextTick()
  scrollToFocus()
})
</script>

<template>
  <div class="mx-auto w-full max-w-[1280px] px-4 pb-6 pt-10 sm:px-6 lg:pt-16">
    <section class="grid items-center gap-10 lg:grid-cols-[1.12fr_0.88fr]">
      <div class="rise-in">
        <span
          class="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary-soft/70 px-2.5 py-1 text-[10.5px] font-medium tracking-wide text-primary-ink"
        >
          <Sparkles :size="11" />
          系统梳理 · 面试速查
        </span>

        <h1 class="mt-5 text-[30px] font-semibold leading-[1.24] tracking-tight text-ink sm:text-[42px] sm:leading-[1.15] lg:text-[50px]">
          把散落的
          <span class="text-gradient">计算机八股文</span>
          <br />
          收进一张知识雷达
        </h1>

        <p class="mt-5 max-w-[54ch] text-[14px] leading-[1.9] text-ink-soft">
          把计算机八股文按章节整理成一张随时可查的知识雷达。
        </p>

        <div class="mt-7 flex flex-wrap items-center gap-3">
          <RouterLink
            v-if="chapters.length"
            :to="`/doc/${chapters[0].firstRoute}`"
            class="group inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-white shadow-soft transition-all duration-200 hover:bg-primary-ink hover:shadow-lg"
          >
            开始阅读
            <ArrowRight :size="15" class="transition-transform duration-200 group-hover:translate-x-0.5" />
          </RouterLink>
          <button
            type="button"
            class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface/60 px-4 py-2.5 text-[13px] font-medium text-ink-soft transition-colors duration-200 hover:border-primary/40 hover:text-primary-ink"
            @click="scrollToMap"
          >
            <Radar :size="15" />
            浏览知识地图
          </button>
        </div>

        <dl class="mt-10 flex items-end gap-7 border-t border-line pt-6">
          <div>
            <dt class="text-[10.5px] tracking-wide text-ink-faint">章节</dt>
            <dd class="font-mono text-[26px] font-semibold tabular-nums text-ink">
              {{ String(shown.chapters).padStart(2, '0') }}
            </dd>
          </div>
          <div>
            <dt class="text-[10.5px] tracking-wide text-ink-faint">小节</dt>
            <dd class="font-mono text-[26px] font-semibold tabular-nums text-ink">
              {{ String(shown.sections).padStart(2, '0') }}
            </dd>
          </div>
          <div>
            <dt class="text-[10.5px] tracking-wide text-ink-faint">文章</dt>
            <dd class="font-mono text-[26px] font-semibold tabular-nums text-primary-ink">
              {{ String(shown.docs).padStart(2, '0') }}
            </dd>
          </div>
          <div class="ml-auto hidden pb-1 text-right text-[10.5px] leading-relaxed text-ink-faint sm:block">
            {{ totalLabel }}
          </div>
        </dl>
      </div>

      <div class="relative mx-auto hidden aspect-square w-full max-w-[360px] lg:block">
        <div class="absolute inset-0 rounded-full border border-line bg-surface/40 backdrop-blur-[1px]" />
        <div class="absolute inset-[13%] rounded-full border border-line/80" />
        <div class="absolute inset-[28%] rounded-full border border-line/70" />
        <div class="absolute inset-[43%] rounded-full border border-primary/25 bg-primary-soft/30" />
        <div class="absolute inset-6 text-primary/50">
          <BrandMark :size="312" animated />
        </div>
        <div class="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_18px_var(--c-primary)]" />

        <div
          v-for="(chip, index) in highlightChips"
          :key="chip.label"
          class="absolute rounded-lg border border-line bg-surface/90 px-2.5 py-1.5 shadow-soft backdrop-blur"
          :class="[
            index === 0 ? 'left-0 top-[12%]' : '',
            index === 1 ? 'right-0 top-[30%]' : '',
            index === 2 ? 'bottom-[22%] left-[4%]' : '',
            index === 3 ? 'bottom-[8%] right-[6%]' : '',
          ]"
        >
          <p class="text-[10.5px] font-semibold text-ink">{{ chip.label }}</p>
          <p class="mt-0.5 text-[9.5px] text-ink-faint">{{ chip.detail }}</p>
        </div>
      </div>
    </section>

    <section id="knowledge-map" class="mt-16 scroll-mt-8 lg:mt-24">
      <div>
        <p class="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-faint">Knowledge Map</p>
        <h2 class="mt-2 text-[22px] font-semibold tracking-tight text-ink">知识地图</h2>
      </div>

      <div v-if="state.loading && !chapters.length" class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="item in 6"
          :key="item"
          class="h-[172px] animate-pulse rounded-2xl border border-line bg-surface-2/60"
        />
      </div>

      <StatePanel
        v-else-if="state.error"
        variant="error"
        class="mt-6"
        title="目录加载失败"
        :message="state.error"
        action-label="重新加载"
        @retry="ensureCatalog(true)"
      />

      <div v-else class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <RouterLink
          v-for="(chapter, index) in chapters"
          :id="`chapter-${chapter.id}`"
          :key="chapter.id"
          :to="`/doc/${chapter.firstRoute}`"
          class="card-lift group relative flex scroll-mt-8 flex-col overflow-hidden rounded-2xl border border-line bg-surface/65 p-5"
        >
          <div
            class="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-primary/5 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
          />
          <div class="flex items-center justify-between">
            <span class="font-mono text-[10.5px] tracking-[0.16em] text-ink-faint">
              CH.{{ String(index + 1).padStart(2, '0') }}
            </span>
            <span class="font-mono text-[10px] text-ink-faint/80">{{ chapter.docCount }} 篇</span>
          </div>

          <h3 class="mt-2.5 text-[16.5px] font-semibold tracking-tight text-ink">
            {{ chapter.title }}
          </h3>
          <p class="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-faint">
            {{ chapter.description }}
          </p>

          <div class="mt-3.5 flex flex-wrap gap-1.5">
            <span
              v-for="section in chapter.sections.slice(0, 3)"
              :key="section.id"
              class="rounded border border-line bg-canvas/60 px-1.5 py-0.5 text-[10px] text-ink-soft"
            >
              {{ section.title }}
            </span>
            <span v-if="chapter.sections.length > 3" class="px-1 py-0.5 text-[10px] text-ink-faint">
              +{{ chapter.sections.length - 3 }}
            </span>
          </div>

          <div class="mt-auto flex items-center justify-between pt-5 text-[10.5px] text-ink-faint">
            <span>{{ chapter.sections.length }} 个小节</span>
            <span class="inline-flex items-center gap-1 text-primary-ink">
              进入
              <ArrowRight :size="12" class="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </div>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
