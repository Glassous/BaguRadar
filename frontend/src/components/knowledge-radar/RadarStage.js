import * as THREE from 'three'
import { gsap } from 'gsap'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { createTerrain, terrainHeight, SEA_LEVEL } from './terrain'
import { createTargets } from './targets'
import { createRadars } from './radars'
import { ZONES } from './chapterConfig'

const SCOPE_MIN = -78
const SCOPE_MAX = 78

// 整体放大比例：地形/目标/雷达统一挂到 this.world 下缩放，
// 相机位置保持在同一量级即可获得“地图更大 + 初始更近”的观感。
const WORLD_SCALE = 1.25

const HOME_POSITION = new THREE.Vector3(92, 145, 112)
const HOME_TARGET = new THREE.Vector3(0, 6, 0)

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function toScope(value) {
  return clamp01((value - SCOPE_MIN) / (SCOPE_MAX - SCOPE_MIN))
}

export class RadarStage {
  constructor({ canvas, labelLayer, targets, onLock, onNoise, onSelect, onHover, onTick }) {
    this.canvas = canvas
    this.labelLayer = labelLayer
    this.callbacks = { onLock, onNoise, onSelect, onHover, onTick }

    this.elapsed = 0
    this.running = false
    this.frameId = 0
    this.lastTickEmit = 0
    this.lastLabelRefresh = 0
    this.pointer = new THREE.Vector2(-2, -2)
    this.pointerInside = false
    this.hoverId = null
    this.selectedId = null
    this.focusZoneKey = null
    this.lockedCount = 0
    this.disposed = false
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.setupRenderer()
    this.setupScene()
    this.setupCamera()

    this.terrain = createTerrain()
    this.world.add(this.terrain.group)

    this.targetSystem = createTargets(targets)
    this.world.add(this.targetSystem.group)

    this.radarSystem = createRadars({
      onLock: (target) => this.handleLock(target),
      onNoise: (item) => this.handleNoise(item),
      onRevealStealth: (target) => this.handleReveal(target),
    })
    this.radarSystem.bind({
      targets: this.targetSystem.targets,
      noise: this.targetSystem.noise,
    })
    this.terrain.group.add(this.radarSystem.group)

    this.buildLabels()
    this.bindInteraction()
    this.observeResize()

    this.clock = new THREE.Clock()
    this.renderFrame = this.renderFrame.bind(this)
    this.start()
  }

  // -------------------------------------------------------------------------
  // 基础三件套
  // -------------------------------------------------------------------------
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.9))
    this.renderer.setClearColor(0x030b0e, 1)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.24

    this.labelRenderer = new CSS2DRenderer({ element: this.labelLayer })
    this.labelRenderer.domElement.style.position = 'absolute'
    this.labelRenderer.domElement.style.inset = '0'
    this.labelRenderer.domElement.style.pointerEvents = 'none'
  }

  setupScene() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x030b0e)
    this.scene.fog = new THREE.FogExp2(0x061f1c, 0.0033)

    // 所有世界内容统一缩放，便于整体“把地图做大”而不改动任何坐标公式
    this.world = new THREE.Group()
    this.world.scale.setScalar(WORLD_SCALE)
    this.scene.add(this.world)

    const hemi = new THREE.HemisphereLight(0x53f2d5, 0x04120f, 0.62)
    this.scene.add(hemi)

    const key = new THREE.DirectionalLight(0x9af8e4, 1.65)
    key.position.set(64, 92, 46)
    this.scene.add(key)

    const rim = new THREE.DirectionalLight(0x2b6bff, 0.5)
    rim.position.set(-70, 48, -60)
    this.scene.add(rim)

    // 面向默认机位的补光，避免目标在雾中变成纯黑剪影
    const fill = new THREE.DirectionalLight(0x9fe8ff, 0.65)
    fill.position.set(70, 45, 110)
    this.scene.add(fill)

    const peakLight = new THREE.PointLight(0x2dd4bf, 320, 120, 2)
    peakLight.position.set(-8, terrainHeight(-8, -8) + 10, -8)
    this.world.add(peakLight)

    const seaLight = new THREE.PointLight(0x38bdf8, 220, 95, 2)
    seaLight.position.set(62, SEA_LEVEL + 9, -2)
    this.world.add(seaLight)
  }

  setupCamera() {
    const width = this.canvas.clientWidth || 900
    const height = this.canvas.clientHeight || 600

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 620)
    this.camera.position.copy(HOME_POSITION)

    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.target.copy(HOME_TARGET)
    // 移除所有手动操作，只保留程序化运镜（区域切换 / 光点联动 / 重置）
    this.controls.enableRotate = false
    this.controls.enableZoom = false
    this.controls.enablePan = false
    this.controls.enableDamping = false
    this.controls.autoRotate = false
    this.controls.update()

    this.raycaster = new THREE.Raycaster()
    this.raycaster.params.Points.threshold = 2
  }

  // -------------------------------------------------------------------------
  // 标签（CSS2D）
  // -------------------------------------------------------------------------
  buildLabels() {
    this.labels = new Map()
    for (const target of this.targetSystem.targets) {
      const el = document.createElement('div')
      el.className = 'radar-label'
      el.dataset.targetId = target.id
      el.dataset.state = 'idle'
      el.style.setProperty('--zone-color', ZONES[target.config.zone]?.color || '#5eead4')
      el.innerHTML = `
        <span class="radar-label__zone">${ZONES[target.config.zone]?.en || ''}</span>
        <span class="radar-label__title">${target.title}</span>
        <span class="radar-label__meta">${this.labelMeta(target)}</span>
      `
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        // 点击标签卡片：不改变雷达视角，直接打开章节弹窗
        this.select(target.id, { moveCamera: false })
      })

      const object = new CSS2DObject(el)
      target.labelAnchor.add(object)
      this.labels.set(target.id, {
        object,
        el,
        target,
        titleEl: el.querySelector('.radar-label__title'),
        metaEl: el.querySelector('.radar-label__meta'),
      })
    }
    this.refreshAllLabels()
  }

  labelMeta(target) {
    if (target.stealth && !target.revealed) return 'CH.10 · 盲区'
    return `CH.${String(target.config.index).padStart(2, '0')} · ${target.docCount} 篇`
  }

  refreshLabel(target) {
    void target
    this.refreshAllLabels()
  }

  /**
   * 标签常驻显示：未扫描为暗态，被锁定后点亮为区域色。
   * 盲区目标只显示“未知信号”占位，显形后才换成真实章节名。
   * 屏幕空间重叠时向上错位，而不隐藏任何一张卡片。
   */
  refreshAllLabels() {
    const width = this.canvas.clientWidth || 1
    const height = this.canvas.clientHeight || 1
    const world = new THREE.Vector3()
    const placed = []
    const entries = []

    for (const target of this.targetSystem.targets) {
      const item = this.labels.get(target.id)
      if (!item) continue

      const masked = target.stealth && !target.revealed
      item.el.dataset.state = masked ? 'masked' : target.locked ? 'locked' : 'idle'
      item.el.classList.toggle('is-active', this.selectedId === target.id)
      item.el.classList.toggle('is-hover', this.hoverId === target.id)
      // 区域运镜时，非当前区域的标签降低存在感（仍常驻可见）
      item.el.classList.toggle(
        'is-dim',
        Boolean(this.focusZoneKey) && target.config.zone !== this.focusZoneKey,
      )

      const title = masked ? '未知信号' : target.title
      if (item.titleEl.textContent !== title) item.titleEl.textContent = title
      const meta = this.labelMeta(target)
      if (item.metaEl.textContent !== meta) item.metaEl.textContent = meta

      target.labelAnchor.getWorldPosition(world)
      world.project(this.camera)
      if (world.z > 1) {
        item.el.style.visibility = 'hidden'
        continue
      }
      item.el.style.visibility = 'visible'
      entries.push({
        item,
        x: ((world.x + 1) / 2) * width,
        y: ((1 - world.y) / 2) * height,
        priority: this.selectedId === target.id ? 3 : this.hoverId === target.id ? 2 : 1,
      })
    }

    entries.sort((a, b) => b.priority - a.priority || a.y - b.y)

    for (const entry of entries) {
      // 用真实渲染尺寸做屏幕空间避让，避免不同标题长度造成的估算误差。
      // 依次尝试原位、上移、下移、再上移/下移，优先保持标签贴近锚点。
      const labelWidth = entry.item.el.offsetWidth || 118
      const labelHeight = entry.item.el.offsetHeight || 34
      const step = labelHeight + 5
      const candidates =
        entry.priority > 1
          ? [0]
          : [0, -step, step, -step * 2, step * 2, -step * 3, step * 3]

      let chosen = null
      let fallback = null
      const buildRect = (shift) => {
        const top = entry.y - labelHeight / 2 + shift
        return {
          left: entry.x - labelWidth / 2,
          right: entry.x + labelWidth / 2,
          top,
          bottom: top + labelHeight,
        }
      }

      for (const shift of candidates) {
        const rect = buildRect(shift)
        if (rect.top < 10 || rect.bottom > height - 10) continue
        const collided = placed.some(
          (other) =>
            !(
              rect.right < other.left ||
              rect.left > other.right ||
              rect.bottom < other.top ||
              rect.top > other.bottom
            ),
        )
        if (!collided) {
          chosen = { shift, rect }
          break
        }
        if (!fallback) fallback = { shift, rect }
      }

      const result = chosen || fallback
      if (!result) {
        entry.item.el.style.marginTop = '0px'
        entry.item.el.style.setProperty('--leader', '0px')
        entry.item.el.classList.remove('is-below')
        continue
      }
      entry.item.el.style.marginTop = `${result.shift}px`
      entry.item.el.style.setProperty('--leader', `${Math.abs(result.shift)}px`)
      entry.item.el.classList.toggle('is-below', result.shift > 0)
      placed.push(result.rect)
    }
  }

  // -------------------------------------------------------------------------
  // 交互
  // -------------------------------------------------------------------------
  bindInteraction() {
    this.onPointerMove = (event) => {
      const rect = this.canvas.getBoundingClientRect()
      this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      this.pointerInside = true
    }

    this.onPointerLeave = () => {
      this.pointerInside = false
      this.pointer.set(-2, -2)
      if (this.hoverId) {
        const prev = this.hoverId
        this.hoverId = null
        this.refreshLabelById(prev)
        this.canvas.style.cursor = 'default'
        this.callbacks.onHover?.(null)
      }
    }

    // 无拖拽 / 无缩放，只有点击目标
    this.onClick = (event) => {
      const hit = this.pick(event)
      if (hit?.target) this.select(hit.target.id)
      else if (hit?.noise) this.handleNoise(hit.noise)
      else this.clearSelection()
    }

    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerleave', this.onPointerLeave)
    this.canvas.addEventListener('click', this.onClick)
  }

  refreshLabelById(id) {
    const target = this.targetSystem.targets.find((item) => item.id === id)
    if (target) this.refreshLabel(target)
  }

  pick(event) {
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)

    const roots = this.targetSystem.targets.map((target) => target.model)
    const hits = this.raycaster.intersectObjects(roots, true)
    if (hits.length) {
      let node = hits[0].object
      while (node && !node.userData.targetId) node = node.parent
      const id = node?.userData.targetId
      const target = this.targetSystem.targets.find((item) => item.id === id)
      if (target) return { target }
    }

    const noiseHits = this.raycaster.intersectObjects(
      this.targetSystem.noise.map((item) => item.mesh),
      true,
    )
    if (noiseHits.length) {
      let node = noiseHits[0].object
      while (node && !node.userData.noiseIndex && node.userData.noiseIndex !== 0) node = node.parent
      const index = node?.userData.noiseIndex
      if (typeof index === 'number') return { noise: this.targetSystem.noise[index] }
    }
    return null
  }

  updateHover() {
    if (!this.pointerInside || this.disposed) return
    this.raycaster.setFromCamera(this.pointer, this.camera)

    const roots = this.targetSystem.targets.map((target) => target.model)
    const hits = this.raycaster.intersectObjects(roots, true)
    let nextId = null
    if (hits.length) {
      let node = hits[0].object
      while (node && !node.userData.targetId) node = node.parent
      nextId = node?.userData.targetId || null
    }

    if (nextId !== this.hoverId) {
      const prev = this.hoverId
      this.hoverId = nextId
      if (prev) this.refreshLabelById(prev)
      if (nextId) this.refreshLabelById(nextId)
      this.canvas.style.cursor = nextId ? 'pointer' : 'default'
      const target = this.targetSystem.targets.find((item) => item.id === nextId)
      this.callbacks.onHover?.(target || null)
    }
  }

  clearSelection() {
    if (!this.selectedId) return
    const prev = this.selectedId
    this.selectedId = null
    this.refreshLabelById(prev)
    this.callbacks.onHover?.(null)
  }

  select(id, { moveCamera = true } = {}) {
    const target = this.targetSystem.targets.find((item) => item.id === id)
    if (!target) return
    if (target.stealth && !target.revealed) {
      if (moveCamera) this.focusOn(target)
      this.callbacks.onNoise?.({
        stealthHint: true,
        id: target.id,
        title: '未知信号',
        position: this.worldPositionOf(target),
      })
      return
    }
    this.selectedId = id
    this.focusZoneKey = null
    this.refreshAllLabels()
    if (moveCamera) this.focusOn(target)
    this.callbacks.onSelect?.(target)
  }

  worldPositionOf(target) {
    return target.holder.getWorldPosition(new THREE.Vector3())
  }

  // -------------------------------------------------------------------------
  // 运镜
  // -------------------------------------------------------------------------
  focusOn(target) {
    const position = this.worldPositionOf(target)
    const isSky = target.config.zone === 'sky'
    const distance = (isSky ? 42 : 34) * WORLD_SCALE
    const direction = new THREE.Vector3(0.72, isSky ? 0.32 : 0.56, 0.72).normalize()
    const dest = position
      .clone()
      .add(direction.multiplyScalar(distance))
      .add(new THREE.Vector3(0, (isSky ? 12 : 9) * WORLD_SCALE, 0))

    this.moveCamera(
      dest,
      new THREE.Vector3(position.x, position.y + (isSky ? 0 : 3) * WORLD_SCALE, position.z),
    )
  }

  moveCamera(dest, lookAt, duration = this.reduceMotion ? 0.2 : 1.15) {
    this.stopAutoRotate()
    gsap.killTweensOf(this.camera.position)
    gsap.killTweensOf(this.controls.target)

    gsap.to(this.camera.position, {
      x: dest.x,
      y: dest.y,
      z: dest.z,
      duration,
      ease: 'power3.inOut',
    })
    gsap.to(this.controls.target, {
      x: lookAt.x,
      y: lookAt.y,
      z: lookAt.z,
      duration,
      ease: 'power3.inOut',
      onUpdate: () => this.controls.update(),
    })
  }

  /** 区域聚焦：把相机推到该区域所有目标的包围中心 */
  focusZone(zoneKey) {
    const members = this.targetSystem.targets.filter((item) => item.config.zone === zoneKey)
    if (!members.length) return false

    this.scene.updateMatrixWorld(true)
    const points = members.map((target) => this.worldPositionOf(target))
    const center = new THREE.Vector3()
    for (const point of points) center.add(point)
    center.divideScalar(points.length)

    let radius = 0
    for (const point of points) radius = Math.max(radius, point.distanceTo(center))

    // 依据包围球 + 相机视场角计算“刚好装下并留白”的距离，
    // 避免小区域被推得过近、只剩一片地形特写。
    const isSky = zoneKey === 'sky'
    const fovV = (this.camera.fov * Math.PI) / 180
    const aspect = this.camera.aspect || 1.6
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect)
    const halfFov = Math.min(fovV, fovH) / 2
    const fitDistance = (radius + 16) / Math.max(0.12, Math.sin(halfFov))
    const distance = Math.min(242, Math.max(isSky ? 150 : 132, fitDistance * 1.18))

    // 高空区为了同时看到地面投影，视角更平一些；其余区域偏俯视
    const direction = new THREE.Vector3(0.46, isSky ? 0.62 : 1.0, 0.46).normalize()
    const dest = center.clone().add(direction.multiplyScalar(distance))
    const lookAt = center.clone()
    lookAt.y += isSky ? 0 : 3 * WORLD_SCALE

    this.focusZoneKey = zoneKey
    this.refreshAllLabels()
    this.moveCamera(dest, lookAt, this.reduceMotion ? 0.2 : 1.35)
    return true
  }

  focusChapter(id) {
    const target = this.targetSystem.targets.find((item) => item.id === id)
    if (target) this.select(id)
  }

  focusByScope(id) {
    this.focusChapter(id)
  }

  resetView() {
    this.clearSelection()
    this.focusZoneKey = null
    this.refreshAllLabels()
    this.moveCamera(HOME_POSITION, HOME_TARGET, this.reduceMotion ? 0.2 : 1.3)
  }

  stopAutoRotate() {
    if (this.controls.autoRotate) this.controls.autoRotate = false
  }

  // -------------------------------------------------------------------------
  // 解锁 / 反馈
  // -------------------------------------------------------------------------
  handleLock(target) {
    if (this.targetSystem.lock(target)) {
      this.lockedCount += 1
      target.lockedAt = this.elapsed
      this.refreshLabel(target)
      this.callbacks.onLock?.(target, this.lockedCount)
    }
  }

  handleNoise(item) {
    if (item?.stealthHint) {
      this.callbacks.onNoise?.(item)
      return
    }
    if (this.targetSystem.pulseNoise(item)) {
      this.callbacks.onNoise?.({
        id: `noise-${this.targetSystem.noise.indexOf(item)}`,
        title: '未知信号',
        position: item.holder.position.clone(),
      })
    }
  }

  handleReveal(target) {
    if (this.targetSystem.revealStealth(target)) {
      this.lockedCount += 1
      this.refreshLabel(target)
      this.callbacks.onLock?.(target, this.lockedCount)
      this.callbacks.onNoise?.({
        id: target.id,
        title: target.title,
        revealed: true,
        position: this.worldPositionOf(target),
      })
    }
  }

  revealChapter(id) {
    const target = this.targetSystem.targets.find((item) => item.id === id)
    if (target) this.handleReveal(target)
  }

  // -------------------------------------------------------------------------
  // 快照与投影
  // -------------------------------------------------------------------------
  getSnapshot() {
    const state = this.radarSystem.getState()
    return {
      elapsed: this.elapsed,
      lockedCount: this.lockedCount,
      activeZone: this.focusZoneKey,
      sweep: ((state.groundAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
      seaRadius: state.seaRadius,
      lowRadius: state.lowRadius,
      awacs: { nx: toScope(state.awacs.x), nz: toScope(state.awacs.z) },
      zones: Object.values(ZONES).map((zone) => {
        const members = this.targetSystem.targets.filter((item) => item.config.zone === zone.key)
        return {
          key: zone.key,
          label: zone.label,
          en: zone.en,
          color: zone.color,
          total: members.length,
          locked: members.filter((item) => item.locked).length,
        }
      }),
      targets: this.targetSystem.targets.map((target) => ({
        id: target.id,
        title: target.title,
        zone: target.config.zone,
        zoneLabel: ZONES[target.config.zone]?.label || '',
        index: target.config.index,
        locked: target.locked,
        stealth: target.stealth,
        revealed: target.revealed,
        nx: toScope(target.worldPosition.x),
        nz: toScope(target.worldPosition.z),
        ny: target.worldPosition.y,
      })),
    }
  }

  projectChapter(id) {
    const target = this.targetSystem.targets.find((item) => item.id === id)
    if (!target) return null
    const vector = new THREE.Vector3()
    target.labelAnchor.getWorldPosition(vector).project(this.camera)
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: rect.left + ((vector.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - vector.y) / 2) * rect.height,
      visible: vector.z < 1,
    }
  }

  // -------------------------------------------------------------------------
  // 生命周期
  // -------------------------------------------------------------------------
  observeResize() {
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.canvas.parentElement || this.canvas)
    this.resize()
  }

  resize() {
    if (this.disposed) return
    const parent = this.canvas.parentElement
    const width = Math.max(1, parent?.clientWidth || this.canvas.clientWidth)
    const height = Math.max(1, parent?.clientHeight || this.canvas.clientHeight)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
    this.labelRenderer.setSize(width, height)
  }

  start() {
    if (this.running) return
    this.running = true
    this.clock.start()
    this.frameId = requestAnimationFrame(this.renderFrame)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.frameId)
  }

  renderFrame() {
    if (this.disposed || !this.running) return
    this.frameId = requestAnimationFrame(this.renderFrame)

    const delta = Math.min(this.clock.getDelta(), 0.05)
    this.elapsed += delta

    this.updateHover()
    this.controls.update()
    this.terrain.update(this.elapsed)
    this.targetSystem.update(this.elapsed)
    this.radarSystem.update(this.elapsed, delta)

    this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)

    if (this.elapsed - this.lastTickEmit > 0.12) {
      this.lastTickEmit = this.elapsed
      this.callbacks.onTick?.(this.getSnapshot())
    }

    if (this.elapsed - this.lastLabelRefresh > 0.2) {
      this.lastLabelRefresh = this.elapsed
      this.refreshAllLabels()
    }
  }

  dispose() {
    this.disposed = true
    this.stop()
    this.resizeObserver?.disconnect()

    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave)
    this.canvas.removeEventListener('click', this.onClick)

    gsap.killTweensOf(this.camera.position)
    gsap.killTweensOf(this.controls.target)
    this.controls.dispose()

    this.radarSystem.dispose()
    this.targetSystem.dispose()
    this.terrain.dispose()

    this.labelLayer.replaceChildren()
    this.scene.clear()
    this.renderer.dispose()
  }
}
