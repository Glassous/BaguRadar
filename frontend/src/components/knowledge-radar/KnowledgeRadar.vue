<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { Crosshair, Lock, RotateCcw, ShieldAlert, Unlock } from '@lucide/vue'
import { RadarStage } from './RadarStage'
import { resolveTargets, ZONES } from './chapterConfig'
import './knowledge-radar.css'

const props = defineProps({
  chapters: { type: Array, default: () => [] },
})

const emit = defineEmits(['select', 'noise', 'lock', 'unsupported'])

const shellRef = ref(null)
const canvasRef = ref(null)
const labelRef = ref(null)

const stage = shallowRef(null)
const snapshot = ref(null)
const booting = ref(true)
const failure = ref('')
const securityUnlocked = ref(false)
const alertText = ref('')
const logs = ref([])

let alertTimer = 0
let bootTimer = 0
const bootTimers = []
let visibilityHandler = null
let intersectionObserver = null
let elapsed = 0

const targets = computed(() => resolveTargets(props.chapters))
const lockedCount = computed(() => snapshot.value?.lockedCount || 0)
const totalCount = computed(() => targets.value.length)

const scopeTargets = computed(() => (snapshot.value?.targets || []).filter((t) => !t.stealth || t.revealed))

const zoneList = computed(() => {
  if (snapshot.value?.zones?.length) return snapshot.value.zones
  return Object.values(ZONES).map((zone) => ({ ...zone, total: 0, locked: 0 }))
})

const scopeSweep = computed(() => ((snapshot.value?.sweep || 0) * 180) / Math.PI)
const seaRingR = computed(() => Math.min(72, ((snapshot.value?.seaRadius || 0) / 96) * 72))
const lowRingR = computed(() => Math.min(72, ((snapshot.value?.lowRadius || 0) / 30) * 72))

const bootLog = [
  '地面搜索阵列 · 上线',
  '海面扫描阵列 · 同步完成',
  '低空监视网络 · 待命',
  '空中扫描节点 · 已进入航线',
]

function pushLog(text, kind = 'info') {
  elapsed += 1
  const stamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  logs.value = [{ id: `${Date.now()}-${elapsed}`, text, kind, stamp }, ...logs.value].slice(0, 4)
}

function showAlert(message, kind = 'noise') {
  alertText.value = { message, kind, id: Date.now() }
  window.clearTimeout(alertTimer)
  alertTimer = window.setTimeout(() => {
    alertText.value = ''
  }, 1600)
}

function targetTitle(id) {
  return targets.value.find((item) => item.id === id)?.title || id
}

function handleSelect(target) {
  pushLog(`目标锁定 · ${target.title}`, 'lock')
  emit('select', target.id)
}

function handleLock(target, count) {
  pushLog(`扫描命中 CH.${String(target.config.index).padStart(2, '0')} · ${target.title}`, 'lock')
  emit('lock', { id: target.id, count })
}

function handleNoise(payload) {
  if (payload?.revealed) {
    securityUnlocked.value = true
    pushLog(`盲区解除 · ${payload.title}`, 'alert')
    showAlert('盲区目标已显形 · SIGNAL ACQUIRED', 'alert')
    emit('noise', payload)
    return
  }

  if (payload?.stealthHint) {
    pushLog('盲区回波丢失 · 中央雷达无法识别', 'noise')
    showAlert('盲区内目标 · 等待预警机临空或前置授权', 'alert')
    emit('noise', payload)
    return
  }

  pushLog('杂波 / 错题警告 · 非知识目标', 'noise')
  showAlert('杂波干扰 · 错题警告 / NOISE', 'noise')
  emit('noise', payload)
}

function focusTarget(id) {
  const target = snapshot.value?.targets.find((item) => item.id === id)
  if (!target || !target.locked) return
  stage.value?.focusChapter(id)
  pushLog(`光点联动 · 运镜至 ${targetTitle(id)}`, 'info')
}

function resetView() {
  stage.value?.resetView()
}

function focusZone(key) {
  if (!stage.value?.focusZone(key)) return
  pushLog(`区域运镜 · ${ZONES[key]?.label || key}`, 'info')
}

function unlockSecurity() {
  if (securityUnlocked.value) return
  securityUnlocked.value = true
  stage.value?.revealChapter('10-security')
  pushLog('前置章节校验通过 · 盲区授权', 'alert')
}

function projectChapter(id) {
  return stage.value?.projectChapter(id) || null
}

function revealStealth(id = '10-security') {
  stage.value?.revealChapter(id)
}

onMounted(async () => {
  await nextTick()
  bootTimer = window.setTimeout(() => {
    try {
      stage.value = new RadarStage({
        canvas: canvasRef.value,
        labelLayer: labelRef.value,
        targets: targets.value,
        onSelect: handleSelect,
        onLock: handleLock,
        onNoise: handleNoise,
        onTick: (snap) => {
          snapshot.value = snap
        },
      })
      booting.value = false
      bootLog.forEach((text, index) => {
        bootTimers.push(window.setTimeout(() => pushLog(text, 'info'), index * 220))
      })

      visibilityHandler = () => {
        if (document.hidden) stage.value?.stop()
        else stage.value?.start()
      }
      document.addEventListener('visibilitychange', visibilityHandler)

      intersectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) stage.value?.start()
            else stage.value?.stop()
          }
        },
        { threshold: 0.05 },
      )
      if (shellRef.value) intersectionObserver.observe(shellRef.value)
    } catch (error) {
      console.error('[BaguRadar] 3D 雷达初始化失败', error)
      failure.value = error?.message || 'WebGL 初始化失败'
      booting.value = false
      emit('unsupported', failure.value)
    }
  }, 40)
})

onBeforeUnmount(() => {
  window.clearTimeout(alertTimer)
  window.clearTimeout(bootTimer)
  bootTimers.forEach((timer) => window.clearTimeout(timer))
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
  intersectionObserver?.disconnect()
  stage.value?.dispose()
  stage.value = null
})

defineExpose({
  projectChapter,
  revealStealth,
  reset: resetView,
  clearRadarSelection: () => stage.value?.clearSelection(),
})
</script>

<template>
  <div ref="shellRef" class="kr-shell h-[600px] w-full sm:h-[650px] xl:h-[720px]">
    <div class="kr-canvas-wrap">
      <canvas ref="canvasRef" class="kr-canvas" aria-label="3D 知识雷达地形" />
      <div ref="labelRef" class="kr-labels" />
    </div>

    <div class="kr-overlay" aria-hidden="true" />
    <div class="kr-scanbar" aria-hidden="true" />
    <div class="kr-corners" aria-hidden="true">
      <span /><span /><span /><span />
    </div>

    <div class="kr-hud kr-hud--tl">
      <p class="kr-title">全域目标态势沙盘</p>
      <p class="kr-subtitle">BAGURADAR · AIR / LAND / SEA · LIVE SCAN</p>
      <p class="kr-stats">
        <strong>{{ String(lockedCount).padStart(2, '0') }}</strong>
        <span>/ {{ String(totalCount).padStart(2, '0') }} 目标已锁定</span>
      </p>
    </div>

    <div class="kr-hud kr-hud--tr">
      <div class="kr-zones" role="group" aria-label="区域运镜">
        <button
          v-for="zone in zoneList"
          :key="zone.key"
          type="button"
          class="kr-zone"
          :style="{ '--zone-color': zone.color }"
          :data-active="snapshot?.activeZone === zone.key"
          :aria-pressed="snapshot?.activeZone === zone.key"
          @click="focusZone(zone.key)"
        >
          <span class="kr-zone__en">{{ zone.en }}</span>
          <span class="kr-zone__cn">
            {{ zone.label }}
            <em>{{ zone.locked }}/{{ zone.total }}</em>
          </span>
        </button>
      </div>
      <div class="kr-tools">
        <button type="button" class="kr-btn" @click="resetView">
          <RotateCcw :size="10" />
          重置视角
        </button>
        <button
          type="button"
          class="kr-btn"
          :data-state="securityUnlocked ? 'done' : 'idle'"
          @click="unlockSecurity"
        >
          <component :is="securityUnlocked ? Unlock : ShieldAlert" :size="10" />
          {{ securityUnlocked ? '盲区已授权' : '模拟前置完成' }}
        </button>
      </div>
    </div>

    <div class="kr-hud kr-hud--bl">
      <div class="kr-log">
        <p v-for="entry in logs" :key="entry.id" class="kr-log__entry" :class="`is-${entry.kind}`">
          <time>{{ entry.stamp }}</time>
          <span>{{ entry.text }}</span>
        </p>
      </div>
    </div>

    <div class="kr-hud kr-hud--bc">
      <p class="flex items-center gap-1.5 text-[9px] text-[rgba(126,242,217,0.5)]">
        <Crosshair :size="10" />
        左键拖拽旋转 · 滚轮缩放 · 右键平移 · 点击标签查看章节
      </p>
    </div>

    <div class="kr-hud kr-hud--br">
      <div class="kr-scope">
        <p class="kr-scope__caption">
          <span>2D SCOPE</span>
          <span>{{ String(lockedCount).padStart(2, '0') }}/16</span>
        </p>
        <svg viewBox="0 0 160 160" role="img" aria-label="二维雷达显示屏">
          <defs>
            <radialGradient id="kr-scope-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="rgba(45,212,191,0.18)" />
              <stop offset="100%" stop-color="rgba(3,16,18,0)" />
            </radialGradient>
            <clipPath id="kr-scope-clip">
              <circle cx="80" cy="80" r="71" />
            </clipPath>
          </defs>

          <circle cx="80" cy="80" r="71" fill="url(#kr-scope-bg)" stroke="rgba(94,234,212,0.35)" />
          <circle cx="80" cy="80" r="52" fill="none" stroke="rgba(94,234,212,0.16)" />
          <circle cx="80" cy="80" r="34" fill="none" stroke="rgba(94,234,212,0.12)" />
          <circle cx="80" cy="80" r="16" fill="none" stroke="rgba(94,234,212,0.12)" />
          <line x1="9" y1="80" x2="151" y2="80" stroke="rgba(94,234,212,0.13)" />
          <line x1="80" y1="9" x2="80" y2="151" stroke="rgba(94,234,212,0.13)" />

          <g clip-path="url(#kr-scope-clip)">
            <circle
              v-if="seaRingR > 1"
              cx="80"
              cy="80"
              :r="seaRingR"
              fill="none"
              stroke="rgba(56,189,248,0.45)"
              stroke-width="1"
            />
            <circle
              v-if="lowRingR > 1"
              cx="80"
              cy="80"
              :r="lowRingR"
              fill="none"
              stroke="rgba(248,113,113,0.4)"
              stroke-width="1"
            />
            <line
              x1="80"
              y1="80"
              x2="151"
              y2="80"
              stroke="rgba(94,234,212,0.85)"
              stroke-width="1.2"
              :transform="`rotate(${scopeSweep} 80 80)`"
            />
            <circle
              v-if="snapshot"
              :cx="snapshot.awacs.nx * 160"
              :cy="snapshot.awacs.nz * 160"
              r="2.6"
              fill="#fbbf24"
            />

            <g
              v-for="target in scopeTargets"
              :key="target.id"
              class="kr-scope__blip"
              :data-locked="target.locked"
              @click="focusTarget(target.id)"
            >
              <circle
                :cx="target.nx * 160"
                :cy="target.nz * 160"
                :r="target.locked ? 2.6 : 1.4"
                :fill="target.locked ? ZONES[target.zone].color : 'rgba(148,233,218,0.35)'"
              />
              <circle
                v-if="target.locked"
                :cx="target.nx * 160"
                :cy="target.nz * 160"
                r="5.4"
                fill="none"
                :stroke="ZONES[target.zone].color"
                stroke-width="0.7"
                opacity="0.55"
              />
            </g>
          </g>
          <circle cx="80" cy="80" r="2" fill="rgba(94,234,212,0.8)" />
        </svg>
        <p class="kr-scope__hint">点击已锁定光点 · 运镜</p>
      </div>
    </div>

    <Transition name="kr-alert-fade">
      <p
        v-if="alertText"
        :key="alertText.id"
        class="kr-alert"
        :class="alertText.kind === 'alert' ? 'is-alert' : ''"
      >
        {{ alertText.message }}
      </p>
    </Transition>

    <div v-if="booting" class="kr-boot">
      <span>INITIALIZING RADAR NETWORK</span>
      <span class="kr-boot__bar" />
    </div>

    <div v-else-if="failure" class="kr-boot">
      <Lock :size="12" />
      <span>3D 初始化失败：{{ failure }}</span>
    </div>
  </div>
</template>
