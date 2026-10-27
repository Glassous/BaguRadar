<script setup>
import { ChevronRight, Megaphone } from '@lucide/vue'

// 第一行：真实投放，点击跳转官网
const LIVE_AD = {
  href: 'https://ys.mihoyo.com/',
  image: 'https://publicfiles.glassous.top/yuanshen7.2.png',
  label: '原神 7.2 版本',
}

// 第二行：暂无其他投放，先挂一张招租卡片：点进去走 GitHub 联系作者
const CONTACT_URL = 'https://github.com/Glassous/BaguRadar/issues'
</script>

<template>
  <div class="ad-stack">
    <a
      :href="LIVE_AD.href"
      target="_blank"
      rel="noreferrer"
      :aria-label="LIVE_AD.label"
      class="ad-live"
    >
      <img
        :src="LIVE_AD.image"
        :alt="LIVE_AD.label"
        class="ad-live-img"
        loading="lazy"
        decoding="async"
      />
      <span class="ad-live-tag">广告</span>
    </a>

    <div class="ad-slot">
      <p class="flex items-center gap-1 text-[9px] font-medium tracking-[0.2em] text-ink-faint/80">
        <Megaphone :size="10" />
        广告
      </p>
      <p class="mt-1.5 text-[12.5px] font-semibold text-ink">广告位招租</p>
      <p class="mt-1 text-[10.5px] leading-relaxed text-ink-faint">
        面向计算机学习与求职的读者，支持单月投放。
      </p>
      <a
        :href="CONTACT_URL"
        target="_blank"
        rel="noreferrer"
        class="mt-2.5 inline-flex items-center gap-1 text-[10.5px] font-medium text-primary-ink transition-opacity hover:opacity-80"
      >
        联系投放
        <ChevronRight :size="11" />
      </a>
    </div>
  </div>
</template>
