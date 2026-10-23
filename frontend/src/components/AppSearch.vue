<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Command, Search, X } from '@lucide/vue'
import { dismissOverlay, useBackClose } from '../composables/useBackClose'
import { useSearch } from '../composables/useSearch'

const props = defineProps({
  collapsed: { type: Boolean, default: false },
})

const desktopQuery = '(min-width: 1024px)'

const route = useRoute()
const router = useRouter()
const rootRef = ref(null)
const inputRef = ref(null)
// 首帧就按真实断点渲染，避免挂载后从移动端样式切到桌面端而产生“飞入”动画
const isDesktop = ref(window.matchMedia(desktopQuery).matches)
const focused = ref(false)
const panelOpen = ref(false)
const ready = ref(false)

const expanded = defineModel('expanded', { type: Boolean, default: false })

const {
  query,
  results,
  total,
  pending,
  error,
  empty,
  activeIndex,
  hasQuery,
  searchNow,
  move,
  setActive,
} = useSearch({ limit: 12 })

const placeholder = computed(() =>
  isDesktop.value ? '搜索文章 / 关键词' : '搜索文章或关键词',
)

const panelVisible = computed(() => {
  if (isDesktop.value) return panelOpen.value && (hasQuery.value || pending.value)
  // 移动端展开后先只露出输入框，等真正有查询或结果再铺开面板
  return expanded.value && (hasQuery.value || pending.value || results.value.length > 0)
})

const rootClass = computed(() => ({
  'app-search--desktop': isDesktop.value,
  'app-search--expanded': expanded.value,
  'app-search--collapsed': !isDesktop.value && !expanded.value,
  'app-search--panel': panelVisible.value,
  'app-search--ready': ready.value,
}))

// 侧栏展开时搜索条跟随浮动按钮右移（桌面端）
const rootStyle = computed(() => ({
  '--search-left': props.collapsed ? '3.75rem' : '23.25rem',
}))

useBackClose('search', expanded)

function pathLabel(item) {
  const trail = [item.chapter, item.section].filter(Boolean).join(' / ')
  return trail || '未归类'
}

function focusInput() {
  const el = inputRef.value
  if (!el) return
  el.focus({ preventScroll: true })
  const end = el.value.length
  try {
    el.setSelectionRange(end, end)
  } catch {
    // 部分浏览器对 search 类型不支持，忽略
  }
}

function expand() {
  expanded.value = true
  nextTick(focusInput)
}

function collapse() {
  if (!expanded.value) return
  expanded.value = false
  focused.value = false
  inputRef.value?.blur()
}

function closePanel() {
  // 移动端的面板依附于展开态，关闭按钮直接收起整条搜索
  if (!isDesktop.value && expanded.value) {
    collapse()
    return
  }
  panelOpen.value = false
  focused.value = false
  inputRef.value?.blur()
}

function onContainerClick(event) {
  if (event.target?.closest?.('button')) return
  if (!isDesktop.value && !expanded.value) {
    expand()
    return
  }
  panelOpen.value = true
  focusInput()
}

function onFocus() {
  focused.value = true
  if (isDesktop.value) panelOpen.value = true
}

function onBlur() {
  focused.value = false
}

function scrollActiveIntoView() {
  rootRef.value
    ?.querySelector('.app-search__item.is-active')
    ?.scrollIntoView({ block: 'nearest' })
}

function onInputKeydown(event) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (!panelVisible.value) {
      panelOpen.value = true
      return
    }
    move(1)
    scrollActiveIntoView()
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
    scrollActiveIntoView()
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    if (!results.value.length) {
      if (hasQuery.value && !pending.value) void searchNow()
      return
    }
    openResult(results.value[activeIndex.value] || results.value[0])
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    if (expanded.value) collapse()
    else closePanel()
  }
}

function openResult(item) {
  if (!item) return
  const term = query.value.trim().slice(0, 64)
  if (expanded.value) {
    dismissOverlay('search')
    expanded.value = false
  }
  closePanel()

  router.push({
    name: 'doc',
    params: { pathMatch: item.route.split('/') },
    query: { q: term, ...(item.anchor ? { a: item.anchor } : {}) },
  })
}

function clearQuery() {
  query.value = ''
  focusInput()
}

function onDocumentPointerDown(event) {
  if (!isDesktop.value || !panelOpen.value) return
  if (rootRef.value?.contains(event.target)) return
  panelOpen.value = false
}

function onGlobalKeydown(event) {
  if (event.key?.toLowerCase() !== 'k' || event.altKey) return
  if (!(event.metaKey || event.ctrlKey)) return
  event.preventDefault()
  if (isDesktop.value) {
    panelOpen.value = true
    focusInput()
  } else {
    expand()
  }
}

let desktopMedia = null

function handleDesktopChange(event) {
  isDesktop.value = event.matches
  if (event.matches) {
    // 进入桌面断点后不再需要移动端的展开态
    if (expanded.value) {
      dismissOverlay('search')
      expanded.value = false
    }
  } else {
    panelOpen.value = false
  }
}

onMounted(() => {
  desktopMedia = window.matchMedia(desktopQuery)
  isDesktop.value = desktopMedia.matches
  desktopMedia.addEventListener('change', handleDesktopChange)
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  window.addEventListener('keydown', onGlobalKeydown)
  // 首帧完成定位后再启用位移动画，刷新时搜索框不会从别处滑入
  nextTick(() => {
    ready.value = true
  })
})

onBeforeUnmount(() => {
  desktopMedia?.removeEventListener('change', handleDesktopChange)
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  window.removeEventListener('keydown', onGlobalKeydown)
})

// 跳转后清空结果与展开态，避免返回时残留上一次搜索
watch(
  () => route.fullPath,
  () => {
    panelOpen.value = false
    focused.value = false
    if (expanded.value) {
      dismissOverlay('search')
      expanded.value = false
    }
  },
)
</script>

<template>
  <div ref="rootRef" class="app-search" :class="rootClass" :style="rootStyle" @click="onContainerClick">
    <div
      v-if="!isDesktop && panelVisible"
      class="app-search__scrim"
      aria-hidden="true"
      @click.stop="collapse"
    />

    <div class="app-search__bar" :class="{ 'is-focused': focused }">
      <button
        v-if="!isDesktop && expanded"
        type="button"
        class="app-search__icon-button"
        aria-label="收起搜索"
        @click.stop="collapse"
      >
        <ArrowLeft :size="17" />
      </button>

      <Search :size="15" class="app-search__icon" aria-hidden="true" />

      <input
        ref="inputRef"
        v-model="query"
        class="app-search__input"
        type="search"
        :placeholder="placeholder"
        :disabled="!isDesktop && !expanded"
        :tabindex="isDesktop || expanded ? 0 : -1"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        aria-label="搜索文章"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onInputKeydown"
      />

      <span
        v-if="pending && (isDesktop || expanded)"
        class="app-search__spinner"
        aria-hidden="true"
      />
      <kbd v-else-if="isDesktop" class="app-search__kbd">
        <Command :size="11" class="app-search__kbd-icon" />K
      </kbd>

      <button
        v-if="hasQuery && (isDesktop || expanded)"
        type="button"
        class="app-search__icon-button app-search__clear"
        aria-label="清空搜索"
        @click.stop="clearQuery"
      >
        <X :size="14" />
      </button>
    </div>

    <Transition name="search-panel">
      <div v-if="panelVisible" class="app-search__panel" role="dialog" aria-label="搜索结果">
        <div class="app-search__meta">
          <span v-if="pending" class="app-search__meta-text">搜索中…</span>
          <span v-else-if="error" class="app-search__meta-text app-search__meta-text--error">
            搜索服务暂不可用
          </span>
          <span v-else-if="empty" class="app-search__meta-text">
            没有找到「{{ query.trim() }}」相关文章
          </span>
          <span v-else class="app-search__meta-text">
            找到 <strong>{{ total }}</strong> 篇
          </span>
          <div v-if="isDesktop && results.length" class="app-search__meta-keys">
            <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
            <span><kbd>Enter</kbd> 打开</span>
            <span><kbd>Esc</kbd> 关闭</span>
          </div>
          <button type="button" class="app-search__meta-close" aria-label="关闭搜索" @click.stop="closePanel">
            <X :size="13" />
          </button>
        </div>

        <div v-if="error" class="app-search__state">
          <p class="app-search__state-title">搜索服务连接失败</p>
          <p class="app-search__state-text">{{ error }}，可先用侧栏目录浏览，稍后再试。</p>
        </div>

        <div v-else-if="empty" class="app-search__state">
          <p class="app-search__state-title">没有匹配结果</p>
          <p class="app-search__state-text">换个关键词，或减少关键词个数再试。</p>
        </div>

        <div v-else-if="pending && !results.length" class="app-search__skeletons" aria-hidden="true">
          <span v-for="index in 4" :key="index" class="app-search__skeleton" />
        </div>

        <ul v-else v-scrollbar class="app-search__list" role="listbox" aria-label="匹配文章">
          <li v-for="(item, index) in results" :key="item.route">
            <button
              type="button"
              class="app-search__item"
              :class="{ 'is-active': index === activeIndex }"
              role="option"
              :aria-selected="index === activeIndex"
              @mouseenter="setActive(index)"
              @click.stop="openResult(item)"
            >
              <span class="app-search__item-head">
                <span class="app-search__item-title">{{ item.title }}</span>
                <span class="app-search__item-path">{{ pathLabel(item) }}</span>
              </span>
              <span class="app-search__item-snippet">
                <span v-if="item.more.before" class="app-search__ellipsis">…</span>
                <template v-for="(segment, segIndex) in item.snippet" :key="segIndex">
                  <mark v-if="segment.hit" class="app-search__hit">{{ segment.text }}</mark>
                  <span v-else>{{ segment.text }}</span>
                </template>
                <span v-if="item.more.after" class="app-search__ellipsis">…</span>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>
