<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight } from '@lucide/vue'

const props = defineProps({
  node: { type: Object, required: true },
  index: { type: Number, default: 0 },
  showNumber: { type: Boolean, default: false },
  activeId: { type: String, default: '' },
  activeTrail: { type: Array, default: () => [] },
})

const emit = defineEmits(['enter'])

const isDoc = computed(() => props.node.type === 'doc')
const isActive = computed(() => isDoc.value && props.node.id === props.activeId)
const onTrail = computed(() => props.activeTrail.includes(props.node.id))

const chapterNo = computed(() => {
  const match = String(props.node.id || '').match(/^(\d{2})/)
  if (match) return match[1]
  return String(props.index + 1).padStart(2, '0')
})
</script>

<template>
  <RouterLink
    v-if="isDoc"
    :to="`/doc/${node.id}`"
    class="tree-row relative flex items-start gap-2.5 rounded-lg px-3 py-[9px] hover:bg-surface-2"
    :class="{ 'tree-active': isActive }"
    :data-active-doc="isActive ? 'true' : undefined"
  >
    <span
      class="mt-[8px] size-1.5 shrink-0 rounded-full transition-colors"
      :class="isActive ? 'bg-primary' : 'bg-line-strong'"
    />
    <span
      class="min-w-0 text-[14px] leading-relaxed"
      :class="isActive ? 'font-semibold text-primary-ink' : 'text-ink-soft'"
    >
      {{ node.title }}
    </span>
  </RouterLink>

  <button
    v-else
    type="button"
    class="tree-row group relative flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-[9px] text-left hover:bg-surface-2"
    @click="emit('enter', node)"
  >
    <span
      v-if="showNumber"
      class="shrink-0 font-mono text-[11px] tabular-nums text-primary/75"
    >{{ chapterNo }}</span>
    <span class="min-w-0 flex-1 truncate text-[14.5px] font-semibold tracking-tight text-ink">
      {{ node.title }}
    </span>
    <ChevronRight
      :size="14"
      class="shrink-0 transition-[transform,color] duration-200 group-hover:translate-x-0.5"
      :class="onTrail ? 'text-primary' : 'text-ink-faint/80 group-hover:text-primary'"
    />
  </button>
</template>
