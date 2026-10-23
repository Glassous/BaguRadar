<script setup>
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Moon, Sun } from '@lucide/vue'
import BrandMark from './BrandMark.vue'
import { useCatalog } from '../composables/useCatalog'
import { useTheme } from '../composables/useTheme'

const route = useRoute()
const { state, site } = useCatalog()
const { resolved, toggleMode } = useTheme()

const routePath = computed(() => {
  const value = route.params.pathMatch
  return (Array.isArray(value) ? value.join('/') : value || '').replace(/\.md$/i, '')
})

// 顶栏只承载"窗口级"信息：首页给副标题，文档页给章节 + 标题
const context = computed(() => {
  if (route.name === 'doc') {
    // 依赖 state.docs 保证目录加载完成后自动更新
    const doc = state.docs.find((item) => item.route === routePath.value)
    if (!doc) return site.value.subtitle || ''
    const chapter = doc.chapter?.title
    return chapter ? `${chapter} / ${doc.title}` : doc.title
  }
  if (route.name === 'home') return site.value.subtitle || ''
  return '页面不存在'
})

const isDark = computed(() => resolved.value === 'dark')
const themeLabel = computed(() => (isDark.value ? '切换到浅色模式' : '切换到深色模式'))
const themeTip = computed(() => ({ text: themeLabel.value, key: 't' }))
</script>

<template>
  <header class="app-titlebar" aria-label="窗口顶栏">
    <div class="app-titlebar__inner">
      <RouterLink to="/" class="app-titlebar__brand" aria-label="返回首页">
        <span class="text-primary">
          <BrandMark :size="17" />
        </span>
        <span class="text-[13px] font-semibold tracking-tight text-ink">BaguRadar</span>
      </RouterLink>

      <span class="h-3.5 w-px shrink-0 bg-line-strong/70" aria-hidden="true" />

      <p class="min-w-0 flex-1 truncate text-[12px] leading-none text-ink-faint" v-tooltip="context">
        {{ context }}
      </p>

      <div class="app-titlebar__actions">
        <button
          type="button"
          class="app-titlebar__button"
          aria-keyshortcuts="t"
          :aria-label="themeLabel"
          v-tooltip="themeTip"
          @click="toggleMode"
        >
          <Sun v-if="isDark" :size="14" />
          <Moon v-else :size="14" />
        </button>
      </div>
    </div>
  </header>
</template>
