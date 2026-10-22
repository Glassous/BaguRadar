<script setup>
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, Compass } from '@lucide/vue'

onMounted(() => {
  document.title = '页面不存在 · BaguRadar'
})
</script>

<template>
  <div class="mx-auto flex min-h-[70vh] w-full max-w-[720px] flex-col items-center justify-center px-6 text-center">
    <span class="inline-flex size-14 items-center justify-center rounded-2xl border border-line bg-surface/60 text-primary">
      <Compass :size="26" />
    </span>
    <p class="mt-6 font-mono text-[46px] font-semibold leading-none tracking-tight text-gradient">404</p>
    <h1 class="mt-4 text-[18px] font-semibold text-ink">这条雷达波没有回响</h1>
    <p class="mt-2 max-w-[38ch] text-[12.5px] leading-relaxed text-ink-faint">
      页面不存在，或者链接已经失效。
    </p>
    <RouterLink
      to="/"
      class="mt-6 inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-primary/45 hover:text-primary-ink"
    >
      <ArrowLeft :size="14" />
      返回首页
    </RouterLink>
  </div>
</template>
