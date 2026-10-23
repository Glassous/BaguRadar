<script setup>
import { useEasterEgg } from '../composables/useEasterEgg'

defineProps({
  collapsed: { type: Boolean, default: false },
})

const { enabled } = useEasterEgg()
</script>

<template>
  <!-- 彩蛋：Taffy 周期性从侧栏边缘探出半个身子；折叠后改为从屏幕左缘探出，移动端响应式下不展示 -->
  <div
    v-if="enabled"
    aria-hidden="true"
    class="taffy-peek-host pointer-events-none fixed bottom-[max(96px,14vh)] z-30 hidden h-[186px] w-[130px] overflow-hidden transition-[left] duration-300 ease-out lg:block"
    :class="collapsed ? 'left-0' : 'lg:left-[312px]'"
  >
    <img
      src="https://superboxfiles.fiacloud.top/Iframe/taffy%E6%8E%A2%E5%A4%B4.png"
      alt=""
      decoding="async"
      draggable="false"
      class="taffy-peek-card block h-full w-full select-none object-contain"
    />
  </div>
</template>
