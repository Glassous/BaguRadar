<script setup>
import { AlertTriangle, FileQuestion, RotateCcw } from '@lucide/vue'

defineProps({
  variant: { type: String, default: 'loading' },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  actionLabel: { type: String, default: '重试' },
  lines: { type: Number, default: 5 },
  compact: { type: Boolean, default: false },
})

defineEmits(['retry'])
</script>

<template>
  <div>
    <div
      v-if="variant === 'loading'"
      class="animate-pulse space-y-2.5"
      aria-busy="true"
      aria-live="polite"
    >
      <div class="h-3 w-1/3 rounded bg-surface-2" />
      <div
        v-for="line in lines"
        :key="line"
        class="h-2.5 rounded bg-surface-2"
        :style="{ width: `${100 - ((line * 13) % 38)}%` }"
      />
    </div>

    <div
      v-else
      class="flex flex-col items-center justify-center rounded-xl border border-line bg-surface/60 px-6 text-center"
      :class="compact ? 'py-6' : 'py-16'"
    >
      <span
        class="mb-3 inline-flex size-11 items-center justify-center rounded-full border border-line bg-canvas"
        :class="variant === 'error' ? 'text-accent' : 'text-ink-faint'"
      >
        <AlertTriangle v-if="variant === 'error'" :size="19" />
        <FileQuestion v-else :size="19" />
      </span>
      <p class="text-sm font-medium text-ink">
        {{ title || (variant === 'error' ? '加载失败' : '内容不存在') }}
      </p>
      <p v-if="message" class="mt-1.5 max-w-md text-xs leading-relaxed text-ink-faint">
        {{ message }}
      </p>
      <slot />
      <button
        v-if="variant === 'error'"
        type="button"
        class="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-primary/45 hover:text-primary-ink"
        @click="$emit('retry')"
      >
        <RotateCcw :size="13" />
        {{ actionLabel }}
      </button>
    </div>
  </div>
</template>
