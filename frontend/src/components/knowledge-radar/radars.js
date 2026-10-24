import * as THREE from 'three'
import { terrainSurfaceHeight, SEA_LEVEL } from './terrain'

const GROUND_RANGE = 112
const SEA_RANGE = 43
const LOW_RANGE = 40
const AWACS_RANGE = 23

function sensorBase(color) {
  const group = new THREE.Group()
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.55, 0.5, 12),
    new THREE.MeshStandardMaterial({ color: 0x17343c, metalness: 0.55, roughness: 0.6 }),
  )
  base.position.y = 0.25
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.2, 2.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x547478, metalness: 0.7, roughness: 0.4 }),
  )
  mast.position.y = 1.75
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 10, 8),
    new THREE.MeshBasicMaterial({ color }),
  )
  lamp.position.y = 3.15
  group.add(base, mast, lamp)
  return group
}

function ring(radius, color, opacity = 0.22) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.11, radius + 0.11, 96),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }),
  )
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

function groundSweep(color) {
  const group = new THREE.Group()
  const fan = new THREE.Mesh(
    new THREE.CircleGeometry(GROUND_RANGE, 64, -0.12, 0.24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.055, side: THREE.DoubleSide, depthWrite: false }),
  )
  fan.rotation.x = -Math.PI / 2
  const edge = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_RANGE, 0.12),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }),
  )
  edge.rotation.x = -Math.PI / 2
  edge.position.x = GROUND_RANGE / 2
  group.add(fan, edge)
  return group
}

function pulseRing(color) {
  const mesh = ring(1, color, 0.45)
  mesh.scale.setScalar(0.1)
  return mesh
}

export function createRadars({ onLock, onNoise, onRevealStealth, reduceMotion = false }) {
  const group = new THREE.Group()
  group.name = 'radars'
  const groundPos = new THREE.Vector3(-4, terrainSurfaceHeight(-4, -4) + 0.15, -4)
  const seaPos = new THREE.Vector3(55, SEA_LEVEL + 0.12, 0)
  const lowPos = new THREE.Vector3(-35, terrainSurfaceHeight(-35, 25) + 0.15, 25)

  const ground = sensorBase(0x42d6c5)
  ground.position.copy(groundPos)
  const sweep = groundSweep(0x42d6c5)
  sweep.position.y = 0.08
  ground.add(sweep)
  group.add(ground)

  const sea = sensorBase(0x5aa9e6)
  sea.scale.setScalar(0.7)
  sea.position.copy(seaPos)
  const seaPulse = pulseRing(0x5aa9e6)
  seaPulse.position.y = 0.04
  sea.add(seaPulse)
  group.add(sea)

  const low = sensorBase(0xf0b75b)
  low.scale.setScalar(0.65)
  low.position.copy(lowPos)
  const lowPulse = pulseRing(0xf0b75b)
  lowPulse.position.y = 0.04
  low.add(lowPulse)
  group.add(low)

  const airPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-48, 36, -28),
    new THREE.Vector3(-12, 40, -42),
    new THREE.Vector3(34, 38, -18),
    new THREE.Vector3(32, 36, 32),
    new THREE.Vector3(-30, 38, 42),
  ], true, 'catmullrom', 0.45)
  const route = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(airPath.getPoints(180)),
    new THREE.LineDashedMaterial({ color: 0xf2c66d, transparent: true, opacity: 0.1, dashSize: 1, gapSize: 2.4 }),
  )
  route.computeLineDistances()
  group.add(route)
  const airNode = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.4),
    new THREE.MeshBasicMaterial({ color: 0xf2c66d, transparent: true, opacity: 0.65 }),
  )
  group.add(airNode)
  const airFootprint = ring(AWACS_RANGE, 0xf2c66d, 0.14)
  group.add(airFootprint)

  let groundAngle = 0
  let seaRadius = 0
  let lowRadius = 0
  let airT = 0
  let airCooldown = 0
  let targetRefs = []
  let noiseRefs = []
  const airPos = new THREE.Vector3()
  const airTangent = new THREE.Vector3()

  function bind({ targets, noise }) {
    targetRefs = targets
    noiseRefs = noise
  }

  function lock(target) {
    if (!target.locked && !(target.stealth && !target.revealed)) onLock?.(target)
  }

  function update(elapsed, delta) {
    groundAngle = (groundAngle + delta * (reduceMotion ? 0.18 : 0.48)) % (Math.PI * 2)
    sweep.rotation.y = -groundAngle
    for (const target of targetRefs) {
      if (!['peak', 'city'].includes(target.config.zone)) continue
      const dx = target.worldPosition.x - groundPos.x
      const dz = target.worldPosition.z - groundPos.z
      if (Math.hypot(dx, dz) > GROUND_RANGE) continue
      const difference = Math.atan2(Math.sin(Math.atan2(dz, dx) - groundAngle), Math.cos(Math.atan2(dz, dx) - groundAngle))
      if (Math.abs(difference) < 0.11) lock(target)
    }
    for (const item of noiseRefs) {
      const dx = item.holder.position.x - groundPos.x
      const dz = item.holder.position.z - groundPos.z
      const difference = Math.atan2(Math.sin(Math.atan2(dz, dx) - groundAngle), Math.cos(Math.atan2(dz, dx) - groundAngle))
      if (Math.hypot(dx, dz) < GROUND_RANGE && Math.abs(difference) < 0.08) onNoise?.(item)
    }

    const previousSea = seaRadius
    seaRadius = ((elapsed % 5) / 5) * SEA_RANGE
    seaPulse.scale.setScalar(Math.max(0.1, seaRadius))
    seaPulse.material.opacity = (1 - seaRadius / SEA_RANGE) * 0.38
    for (const target of targetRefs) {
      if (target.config.zone !== 'sea') continue
      const distance = Math.hypot(target.worldPosition.x - seaPos.x, target.worldPosition.z - seaPos.z)
      if (previousSea <= distance && seaRadius >= distance) lock(target)
    }

    const previousLow = lowRadius
    lowRadius = ((elapsed % 3.8) / 3.8) * LOW_RANGE
    lowPulse.scale.setScalar(Math.max(0.1, lowRadius))
    lowPulse.material.opacity = (1 - lowRadius / LOW_RANGE) * 0.32
    for (const target of targetRefs) {
      if (target.config.zone !== 'canyon') continue
      const distance = Math.hypot(target.worldPosition.x - lowPos.x, target.worldPosition.z - lowPos.z)
      if (previousLow <= distance && lowRadius >= distance) lock(target)
    }

    airT = (airT + delta * (reduceMotion ? 0.004 : 0.012)) % 1
    airPath.getPointAt(airT, airPos)
    airPath.getTangentAt(airT, airTangent)
    airNode.position.copy(airPos)
    airNode.rotation.y = elapsed
    airFootprint.position.set(airPos.x, terrainSurfaceHeight(airPos.x, airPos.z) + 0.25, airPos.z)
    airCooldown -= delta
    if (airCooldown <= 0) {
      for (const target of targetRefs) {
        if (!['sky', 'canyon'].includes(target.config.zone) && !target.stealth) continue
        if (Math.hypot(target.worldPosition.x - airPos.x, target.worldPosition.z - airPos.z) > AWACS_RANGE) continue
        if (target.stealth && !target.revealed) onRevealStealth?.(target)
        else lock(target)
      }
      airCooldown = 0.35
    }
  }

  function getState() {
    return { groundAngle, seaRadius, lowRadius, awacs: airPos, awacsT: airT }
  }

  function dispose() {
    group.traverse((object) => {
      object.geometry?.dispose()
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
      else object.material?.dispose()
    })
    group.clear()
  }

  return { group, bind, update, getState, dispose, positions: { groundPos, seaPos, lowPos } }
}
