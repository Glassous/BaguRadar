import * as THREE from 'three'
import { gsap } from 'gsap'
import { terrainHeight, SEA_LEVEL } from './terrain'

const GROUND_RANGE = 96
const GROUND_HALF_ANGLE = 0.42
const SEA_RANGE = 34
const LOW_RANGE = 30
const AWACS_RANGE = 17

// 网格状圆环贴图：同心圆 + 放射线，供相控阵与脉冲雷达复用
function createRingTexture({ color = '#38bdf8', rings = 5, spokes = 16 } = {}) {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  ctx.translate(size / 2, size / 2)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.85

  for (let i = 1; i <= rings; i += 1) {
    ctx.beginPath()
    ctx.arc(0, 0, (size / 2 - 6) * (i / rings), 0, Math.PI * 2)
    ctx.globalAlpha = 0.9 - i * 0.1
    ctx.stroke()
  }

  ctx.globalAlpha = 0.5
  for (let i = 0; i < spokes; i += 1) {
    const angle = (i / spokes) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8)
    ctx.lineTo(Math.cos(angle) * (size / 2 - 6), Math.sin(angle) * (size / 2 - 6))
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function createRadarRing(texture, color, opacity) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({
      map: texture,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

function createBase(color) {
  const group = new THREE.Group()
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 3, 0.9, 8),
    new THREE.MeshStandardMaterial({
      color: 0x10262e,
      emissive: color,
      emissiveIntensity: 0.18,
      roughness: 0.5,
      metalness: 0.7,
      flatShading: true,
    }),
  )
  pad.position.y = 0.45
  group.add(pad)

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.5, 0.06, 4, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }),
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.92
  group.add(ring)
  return group
}

// 地面雷达的扇形扫描面
function createGroundFan(color) {
  const group = new THREE.Group()

  const fan = new THREE.Mesh(
    new THREE.CircleGeometry(GROUND_RANGE, 72, -GROUND_HALF_ANGLE, GROUND_HALF_ANGLE * 2),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  fan.rotation.x = -Math.PI / 2
  group.add(fan)

  const edge = new THREE.Mesh(
    new THREE.RingGeometry(GROUND_RANGE - 0.5, GROUND_RANGE, 72, 1, -GROUND_HALF_ANGLE, GROUND_HALF_ANGLE * 2),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  edge.rotation.x = -Math.PI / 2
  edge.position.y = 0.05
  group.add(edge)

  // 中轴线，强化“扫描中”的方向感
  const axis = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_RANGE, 0.35),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  axis.rotation.x = -Math.PI / 2
  axis.position.set(GROUND_RANGE / 2, 0.06, 0)
  group.add(axis)

  return { group, fan, edge, axis }
}

/**
 * 四类雷达：中央主控 / 海上相控阵 / 峡谷低空 / 高空预警机
 */
export function createRadars({ onLock, onNoise, onRevealStealth }) {
  const group = new THREE.Group()
  group.name = 'radars'

  const groundPos = new THREE.Vector3(-8, terrainHeight(-8, -8) + 0.6, -8)
  const seaPos = new THREE.Vector3(62, SEA_LEVEL + 0.9, -2)
  const lowPos = new THREE.Vector3(-40, terrainHeight(-40, 31) + 0.4, 31)

  // -------------------------------------------------------------------------
  // 1. 中央主控雷达
  // -------------------------------------------------------------------------
  const ground = new THREE.Group()
  ground.position.copy(groundPos)
  ground.add(createBase(0x5eead4))

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.36, 3.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x16333a, emissive: 0x2dd4bf, emissiveIntensity: 0.3 }),
  )
  mast.position.y = 2.6
  ground.add(mast)

  const head = new THREE.Group()
  head.position.y = 4.2
  const horn = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.7, 0.5),
    new THREE.MeshStandardMaterial({
      color: 0x1b4b47,
      emissive: 0x2dd4bf,
      emissiveIntensity: 0.75,
      flatShading: true,
    }),
  )
  horn.position.x = 0.8
  horn.rotation.z = -0.18
  head.add(horn)
  ground.add(head)

  const fanParts = createGroundFan(0x5eead4)
  fanParts.group.position.y = 1.1
  ground.add(fanParts.group)
  group.add(ground)

  // -------------------------------------------------------------------------
  // 2. 海上相控阵雷达
  // -------------------------------------------------------------------------
  const sea = new THREE.Group()
  sea.position.copy(seaPos)
  sea.add(createBase(0x38bdf8))

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x123a4a,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.55,
      roughness: 0.4,
      metalness: 0.6,
      flatShading: true,
    }),
  )
  dome.position.y = 0.9
  sea.add(dome)

  const seaRingTexture = createRingTexture({ color: '#38bdf8', rings: 6, spokes: 24 })
  const seaRings = []
  for (let i = 0; i < 3; i += 1) {
    const ring = createRadarRing(seaRingTexture, 0x38bdf8, 0.45)
    ring.position.y = 0.12
    sea.add(ring)
    seaRings.push(ring)
  }
  group.add(sea)

  // -------------------------------------------------------------------------
  // 3. 峡谷低空雷达
  // -------------------------------------------------------------------------
  const low = new THREE.Group()
  low.position.copy(lowPos)
  low.add(createBase(0xf87171))

  const lowMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.26, 2.6, 5),
    new THREE.MeshStandardMaterial({ color: 0x301a1a, emissive: 0xef4444, emissiveIntensity: 0.5 }),
  )
  lowMast.position.y = 1.7
  low.add(lowMast)

  const lowEmitter = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 1.4, 6, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xf87171,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  lowEmitter.position.y = 3.4
  lowEmitter.rotation.x = Math.PI
  low.add(lowEmitter)

  const lowRingTexture = createRingTexture({ color: '#f87171', rings: 4, spokes: 12 })
  const lowRings = []
  for (let i = 0; i < 2; i += 1) {
    const ring = createRadarRing(lowRingTexture, 0xf87171, 0.5)
    ring.position.y = 0.16
    low.add(ring)
    lowRings.push(ring)
  }
  group.add(low)

  // -------------------------------------------------------------------------
  // 4. 高空预警机
  // -------------------------------------------------------------------------
  const awacs = new THREE.Group()
  const planeMat = new THREE.MeshStandardMaterial({
    color: 0x1c2e33,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.7,
    flatShading: true,
  })
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 6.4, 6), planeMat)
  fuselage.rotation.z = Math.PI / 2
  awacs.add(fuselage)

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 6), planeMat)
  nose.rotation.z = -Math.PI / 2
  nose.position.x = 4
  awacs.add(nose)

  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 11), planeMat)
  wing.position.x = -0.4
  awacs.add(wing)

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2, 3.4), planeMat)
  tail.position.set(-2.8, 1, 0)
  awacs.add(tail)

  const rotodome = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 0.34, 16),
    new THREE.MeshStandardMaterial({
      color: 0x243b40,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.6,
      flatShading: true,
    }),
  )
  rotodome.position.y = 1.1
  awacs.add(rotodome)

  const blinker = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
  )
  blinker.position.set(-2.8, 2.2, 0)
  awacs.add(blinker)

  const awacsLight = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, AWACS_RANGE, 46, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  awacsLight.position.y = -23
  awacs.add(awacsLight)

  const awacsFootprint = new THREE.Mesh(
    new THREE.RingGeometry(AWACS_RANGE - 0.6, AWACS_RANGE, 48),
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  awacsFootprint.rotation.x = -Math.PI / 2
  awacs.add(awacsFootprint)
  group.add(awacs)

  // 巡航航线：覆盖峡谷与高空目标区
  const pathPoints = [
    [-46, 34],
    [-16, 42],
    [16, 32],
    [31, 6],
    [8, -16],
    [-22, -8],
    [-52, 12],
  ].map(([x, z]) => new THREE.Vector3(x, 46, z))
  const awacsCurve = new THREE.CatmullRomCurve3(pathPoints, true, 'catmullrom', 0.4)

  const routeGeometry = new THREE.BufferGeometry().setFromPoints(awacsCurve.getPoints(240))
  const routeLine = new THREE.Line(
    routeGeometry,
    new THREE.LineDashedMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.18,
      dashSize: 1.6,
      gapSize: 1.6,
    }),
  )
  routeLine.computeLineDistances()
  group.add(routeLine)

  // -------------------------------------------------------------------------
  // 扫描状态
  // -------------------------------------------------------------------------
  let groundAngle = -Math.PI / 2
  let seaRadius = 0
  let lowRadius = 0
  let awacsT = 0
  let awacsCooldown = 0
  const awacsPos = new THREE.Vector3()

  const ringTimeline = gsap.timeline({ repeat: -1 })
  seaRings.forEach((ring, index) => {
    gsap.set(ring.scale, { x: 0.1, y: 0.1, z: 0.1 })
    ringTimeline.to(
      ring.scale,
      {
        x: SEA_RANGE,
        y: SEA_RANGE,
        z: SEA_RANGE,
        duration: 4.2,
        ease: 'power1.out',
      },
      index * 1.4,
    )
    ringTimeline.fromTo(
      ring.material,
      { opacity: 0.55 },
      { opacity: 0, duration: 4.2, ease: 'power1.in' },
      index * 1.4,
    )
  })

  const lowTimeline = gsap.timeline({ repeat: -1 })
  lowRings.forEach((ring, index) => {
    gsap.set(ring.scale, { x: 0.1, y: 0.1, z: 0.1 })
    lowTimeline.to(
      ring.scale,
      { x: LOW_RANGE, y: LOW_RANGE, z: LOW_RANGE, duration: 2.6, ease: 'power2.out' },
      index * 1.3,
    )
    lowTimeline.fromTo(
      ring.material,
      { opacity: 0.65 },
      { opacity: 0, duration: 2.6, ease: 'power1.in' },
      index * 1.3,
    )
  })

  function lockIfNeeded(target) {
    if (!target || target.locked) return
    if (target.stealth && !target.revealed) return
    onLock?.(target)
  }

  function update(elapsed, delta) {
    // ---- 中央雷达：绕 Y 轴 360° 扫描 ----
    groundAngle += delta * 0.62
    head.rotation.y = -groundAngle
    fanParts.group.rotation.y = -groundAngle

    for (const target of targetRefs) {
      const dx = target.worldPosition.x - groundPos.x
      const dz = target.worldPosition.z - groundPos.z
      const distance = Math.hypot(dx, dz)
      if (distance > GROUND_RANGE) continue
      if (target.config.zone !== 'peak' && target.config.zone !== 'city') continue

      let diff = Math.atan2(dz, dx) - groundAngle
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      if (Math.abs(diff) < GROUND_HALF_ANGLE && elapsed - (target.lastSeen || 0) > 1.2) {
        target.lastSeen = elapsed
        lockIfNeeded(target)
      }
    }

    for (const item of noiseRefs) {
      const dx = item.holder.position.x - groundPos.x
      const dz = item.holder.position.z - groundPos.z
      if (Math.hypot(dx, dz) > GROUND_RANGE) continue
      let diff = Math.atan2(dz, dx) - groundAngle
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      if (Math.abs(diff) < GROUND_HALF_ANGLE) onNoise?.(item)
    }

    // ---- 海上相控阵：圆环半径推进即扫描半径 ----
    const seaCycle = (elapsed % 4.2) / 4.2
    const prevSea = seaRadius
    seaRadius = seaCycle * SEA_RANGE
    for (const target of targetRefs) {
      if (target.config.zone !== 'sea' || target.locked) continue
      const distance = Math.hypot(
        target.worldPosition.x - seaPos.x,
        target.worldPosition.z - seaPos.z,
      )
      if (prevSea <= distance && seaRadius >= distance) lockIfNeeded(target)
    }

    // ---- 峡谷低空雷达：红色脉冲环贴地扩散 ----
    const lowCycle = (elapsed % 2.6) / 2.6
    const prevLow = lowRadius
    lowRadius = lowCycle * LOW_RANGE
    for (const target of targetRefs) {
      if (target.config.zone !== 'canyon' || target.locked) continue
      const distance = Math.hypot(
        target.worldPosition.x - lowPos.x,
        target.worldPosition.z - lowPos.z,
      )
      if (prevLow <= distance && lowRadius >= distance) lockIfNeeded(target)
    }

    // ---- 预警机巡航 ----
    awacsT = (awacsT + delta * 0.012) % 1
    const point = awacsCurve.getPointAt(awacsT)
    awacs.position.copy(point)
    const tangent = awacsCurve.getTangentAt(awacsT)
    awacs.rotation.y = Math.atan2(-tangent.z, tangent.x)
    awacs.rotation.z = Math.sin(elapsed * 1.6) * 0.03
    awacsPos.copy(point)

    rotodome.rotation.y = elapsed * 2.4
    awacsFootprint.position.set(0, -46 + terrainHeight(point.x, point.z) + 0.5 - 0, 0)
    awacsLight.material.opacity = 0.05 + Math.sin(elapsed * 2.2) * 0.02

    awacsCooldown -= delta
    if (awacsCooldown <= 0) {
      for (const target of targetRefs) {
        if (target.locked) continue
        const distance = Math.hypot(
          target.worldPosition.x - point.x,
          target.worldPosition.z - point.z,
        )
        if (distance > AWACS_RANGE) continue
        if (target.config.zone !== 'canyon' && target.config.zone !== 'sky') continue

        if (target.stealth && !target.revealed) {
          onRevealStealth?.(target)
          continue
        }
        lockIfNeeded(target)
      }
      awacsCooldown = 0.4
    }

    // 海面雷达底座自转
    sea.rotation.y = elapsed * 0.2
    lowEmitter.rotation.y = elapsed * 1.2
  }

  let targetRefs = []
  let noiseRefs = []

  function bind({ targets, noise }) {
    targetRefs = targets
    noiseRefs = noise
  }

  function getState() {
    return {
      groundAngle,
      seaRadius,
      lowRadius,
      awacs: awacsPos,
      awacsT,
    }
  }

  function dispose() {
    ringTimeline.kill()
    lowTimeline.kill()
    seaRingTexture.dispose()
    lowRingTexture.dispose()
    group.traverse((object) => {
      if (object.geometry) object.geometry.dispose()
      if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose())
      else if (object.material) object.material.dispose()
    })
    group.clear()
  }

  return { group, bind, update, getState, dispose, positions: { groundPos, seaPos, lowPos } }
}
