<script setup>
defineProps({
  size: { type: Number, default: 26 },
  animated: { type: Boolean, default: false },
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    class="shrink-0"
  >
    <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-opacity="0.16" />
    <circle cx="16" cy="16" r="9.5" stroke="currentColor" stroke-opacity="0.28" />
    <circle cx="16" cy="16" r="4.5" stroke="currentColor" stroke-opacity="0.42" />
    <line x1="16" y1="1.5" x2="16" y2="30.5" stroke="currentColor" stroke-opacity="0.1" />
    <line x1="1.5" y1="16" x2="30.5" y2="16" stroke="currentColor" stroke-opacity="0.1" />
    <g :class="animated ? 'radar-sweep' : ''">
      <path d="M16 16 L16 2.5 A13.5 13.5 0 0 1 27.8 11.2 Z" fill="currentColor" opacity="0.24" />
      <line
        x1="16"
        y1="16"
        x2="16"
        y2="2.5"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linecap="round"
        opacity="0.65"
      />
    </g>
    <circle cx="16" cy="16" r="1.7" fill="currentColor" />
    <circle cx="22.4" cy="20.6" r="1.2" fill="currentColor" opacity="0.7" class="breathe" />
  </svg>
</template>
