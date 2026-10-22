import * as THREE from 'three'
import { gsap } from 'gsap'
import { buildChapterModel, buildNoiseTarget } from './models'
import { NOISE_TARGETS } from './chapterConfig'
import { terrainHeight, SEA_LEVEL } from './terrain'

const LOCK_COLOR = 0x5eead4

function createLockRing(color) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 1.72, 32),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.14
  return ring
}

function createMarker(color) {
  const marker = new THREE.Group()

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 1.6, 4),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false }),
  )
  stem.position.y = 0.8
  marker.add(stem)

  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.24, 0),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }),
  )
  diamond.position.y = 1.7
  marker.add(diamond)
  return marker
}

function collectMaterials(group) {
  const materials = []
  group.traverse((object) => {
    const list = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of list) {
      if (material && !materials.includes(material)) {
        if (material.emissive) {
          material.userData.baseEmissive = material.emissive.getHex()
          material.userData.baseIntensity = material.emissiveIntensity
        }
        if (material.transparent) material.userData.baseOpacity = material.opacity
        materials.push(material)
      }
    }
  })
  return materials
}

/**
 * 构建 16 个章节目标 + 杂波假目标。
 * 返回 { group, targets, noise, update(elapsed), dispose() }
 */
export function createTargets(resolved) {
  const group = new THREE.Group()
  group.name = 'targets'

  const targets = []

  for (const [index, config] of resolved.entries()) {
    const baseY =
      config.zone === 'sky'
        ? SEA_LEVEL + config.lift
        : Math.max(terrainHeight(config.x, config.z), SEA_LEVEL) + config.lift

    const holder = new THREE.Group()
    holder.position.set(config.x, baseY, config.z)
    holder.rotation.y = Math.random() * Math.PI * 2

    const model = buildChapterModel(config.model, config.accent)
    model.scale.setScalar(config.scale)
    holder.add(model)

    const lockRing = createLockRing(config.accent)
    lockRing.scale.setScalar(1.6 * config.scale)
    holder.add(lockRing)

    const marker = createMarker(config.accent)
    marker.position.y = 5.4 * config.scale
    marker.visible = false
    holder.add(marker)

    const labelAnchor = new THREE.Object3D()
    // 错开标签高度，减少主峰区多个标签在屏幕上互相压叠
    labelAnchor.position.y = 7.2 * config.scale + (index % 4) * 3.2
    holder.add(labelAnchor)

    const materials = collectMaterials(model)
    const stealth = Boolean(config.stealth)

    const target = {
      id: config.id,
      config,
      title: config.title,
      docCount: config.docCount,
      holder,
      model,
      materials,
      marker,
      lockRing,
      labelAnchor,
      locked: false,
      revealed: !stealth,
      stealth,
      pulseTween: null,
      get worldPosition() {
        return holder.position
      },
    }

    if (stealth) {
      // 隐形：只剩极淡的轮廓，等待预警机临空或前置章节完成
      for (const material of materials) {
        material.transparent = true
        material.depthWrite = false
      }
      gsap.set(materials, { opacity: 0.08 })
    }

    holder.userData.targetId = config.id
    group.add(holder)
    targets.push(target)
  }

  // -------------------------------------------------------------------------
  // 杂波假目标
  // -------------------------------------------------------------------------
  const noise = []
  for (const [noiseIndex, config] of NOISE_TARGETS.entries()) {
    const holder = new THREE.Group()
    holder.position.set(
      config.x,
      Math.max(terrainHeight(config.x, config.z), SEA_LEVEL) + 0.4,
      config.z,
    )
    const mesh = buildNoiseTarget(0xef4444)
    mesh.scale.setScalar(config.scale)
    mesh.userData.noiseIndex = noiseIndex
    holder.add(mesh)
    group.add(holder)

    noise.push({
      holder,
      mesh,
      materials: collectMaterials(mesh),
      triggeredAt: 0,
      pulseTween: null,
    })
  }

  function lock(target, { silent = false } = {}) {
    if (target.locked) return false
    target.locked = true
    target.marker.visible = true

    if (!silent) {
      gsap.fromTo(
        target.lockRing.material,
        { opacity: 0 },
        { opacity: 0.85, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' },
      )
      gsap.fromTo(
        target.lockRing.scale,
        { x: 2.6, y: 2.6, z: 2.6 },
        { x: 1, y: 1, z: 1, duration: 0.6, ease: 'power3.out' },
      )
      target.pulseTween?.kill()
      target.pulseTween = gsap
        .timeline()
        .to(target.model.scale, { x: 0.86, y: 0.86, z: 0.86, duration: 0.12, ease: 'power2.in' })
        .to(target.model.scale, {
          x: target.config.scale,
          y: target.config.scale,
          z: target.config.scale,
          duration: 0.5,
          ease: 'elastic.out(1, 0.4)',
        })

      for (const material of target.materials) {
        if (!material.emissive) continue
        gsap.fromTo(
          material,
          { emissiveIntensity: (material.userData.baseIntensity || 0.4) + 1.6 },
          {
            emissiveIntensity: material.userData.baseIntensity || 0.4,
            duration: 1.1,
            ease: 'power2.out',
          },
        )
        gsap.fromTo(
          material,
          { emissive: LOCK_COLOR },
          {
            emissive: material.userData.baseEmissive ?? 0x000000,
            duration: 1.1,
            ease: 'power2.out',
          },
        )
      }
    }
    return true
  }

  function revealStealth(target, { silent = false } = {}) {
    if (!target.stealth || target.revealed) return false
    target.revealed = true
    for (const material of target.materials) {
      gsap.to(material, {
        opacity: material.userData.baseOpacity ?? 0.9,
        duration: silent ? 0 : 0.9,
        ease: 'power2.out',
        onComplete: () => {
          material.depthWrite = true
        },
      })
    }
    gsap.fromTo(
      target.lockRing.material,
      { opacity: 0.9 },
      { opacity: 0.35, duration: 1.4, repeat: 2, yoyo: true },
    )
    lock(target, { silent })
    return true
  }

  function pulseNoise(item) {
    const now = performance.now()
    if (now - item.triggeredAt < 9000) return false
    item.triggeredAt = now
    item.pulseTween?.kill()
    item.pulseTween = gsap
      .timeline()
      .to(item.mesh.scale, { x: 1.4, y: 1.4, z: 1.4, duration: 0.14, ease: 'power2.out' })
      .to(item.mesh.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power2.inOut' })
    for (const material of item.materials) {
      if (!material.emissive) continue
      gsap.fromTo(
        material,
        { emissiveIntensity: 1.8 },
        { emissiveIntensity: material.userData.baseIntensity ?? 0.5, duration: 0.7 },
      )
    }
    return true
  }

  function update(elapsed) {
    for (const target of targets) {
      if (target.marker.visible) {
        target.marker.rotation.y = elapsed * 1.4
        target.marker.position.y = 5.4 * target.config.scale + Math.sin(elapsed * 2 + target.config.x) * 0.16
      }
    }
    for (const target of targets) {
      if (target.locked) {
        target.lockRing.material.opacity = 0.22 + Math.sin(elapsed * 2.6) * 0.08
      }
    }
    for (const item of noise) {
      item.mesh.rotation.y = elapsed * 0.6
      item.mesh.position.y = Math.sin(elapsed * 1.4 + item.holder.position.x) * 0.18
    }
  }

  function dispose() {
    for (const target of targets) target.pulseTween?.kill()
    for (const item of noise) item.pulseTween?.kill()
    gsap.killTweensOf(group.children)
    group.traverse((object) => {
      if (object.geometry) object.geometry.dispose()
      if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose())
      else if (object.material) object.material.dispose()
    })
    group.clear()
  }

  return { group, targets, noise, lock, revealStealth, pulseNoise, update, dispose }
}
