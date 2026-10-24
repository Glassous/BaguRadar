import * as THREE from 'three'

export const SEA_LEVEL = 0
const GRID_MIN = -96
const GRID_COLS = 128
const VOXEL = 1.5
const HEIGHT_STEP = 0.5
const WORLD_BOTTOM = -12
const SEA_PLANE_Y = -0.35

function smoothstep(a, b, value) {
  const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function coastAt(z) {
  return 43 + Math.sin(z * 0.065) * 8 + Math.cos(z * 0.13) * 3
}

// 设施平台：在山脊之间保留可用平地，避免章节目标落在陡坡上。
const FACILITY_PADS = [
  [-35, -26, 7, 10.5],
  [-14, -37, 8, 8.5],
  [9, -28, 7, 6],
  [-46, -6, 7, 12],
  [-3, -7, 7, 5.5],
  [-43, 37, 6, 5.5],
  [-24, 39, 6, 5],
  [-4, 43, 6, 5],
  [19, 46, 6, 5],
]

function facilityLevel(x, z, height) {
  let result = height
  for (const [cx, cz, radius, level] of FACILITY_PADS) {
    const distance = Math.hypot(x - cx, z - cz)
    if (distance > radius + 7) continue
    const blend = 1 - smoothstep(radius, radius + 7, distance)
    result = THREE.MathUtils.lerp(result, level, blend * blend)
  }
  return result
}

export function terrainHeight(x, z) {
  const radius = Math.hypot(x * 0.92, z)
  const island = 1 - smoothstep(66, 92, radius)
  const sea = smoothstep(coastAt(z) - 3, coastAt(z) + 12, x)
  const plain = 2.8 + Math.sin(x * 0.055) * Math.cos(z * 0.06) * 1.25
  const westMassif = 24 * Math.exp(-((x + 53) ** 2 / 280 + (z + 4) ** 2 / 820))
  const northwestPeak = 17 * Math.exp(-((x + 50) ** 2 / 190 + (z + 31) ** 2 / 260))
  const northRidge = 15 * Math.exp(-((x + 18) ** 2 / 920 + (z + 37) ** 2 / 150))
  const centralSpur = 7 * Math.exp(-((x - 9) ** 2 / 850 + (z + 8) ** 2 / 330))
  const southwestRidge = 10 * Math.exp(-((x + 37) ** 2 / 540 + (z - 27) ** 2 / 330))
  const southMesa = 6 * Math.exp(-((x - 10) ** 2 / 950 + (z - 42) ** 2 / 300))
  const corrugation = (
    Math.abs(Math.sin(x * 0.085 + z * 0.04)) +
    Math.abs(Math.cos(x * 0.045 - z * 0.095))
  ) * 1.15 * island
  const land = (plain + westMassif + northwestPeak + northRidge + centralSpur + southwestRidge + southMesa + corrugation) * island
  const shaped = facilityLevel(x, z, land)
  const seabed = -7 + Math.sin(x * 0.04 + z * 0.05) * 0.7
  return THREE.MathUtils.lerp(Math.max(-9, shaped - (1 - island) * 10), seabed, sea)
}

export function isOpenWater(x, z) {
  return x > coastAt(z) - 5 || Math.hypot(x * 0.92, z) > 72
}

export function terrainSurfaceHeight(x, z) {
  return Math.ceil(terrainHeight(x, z) / HEIGHT_STEP) * HEIGHT_STEP
}

function random(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function terrainColor(height, jitter) {
  const color = new THREE.Color()
  if (height < -1) color.set('#0a2631')
  else if (height < 1) color.set('#24454a')
  else if (height < 4) color.set('#274a48')
  else if (height < 8) color.set('#31534f')
  else if (height < 13) color.set('#405e57')
  else if (height < 19) color.set('#5d7568')
  else color.set('#84988a')
  return color.multiplyScalar(1 + jitter)
}

function createGrid(size, divisions, color, opacity) {
  const grid = new THREE.GridHelper(size, divisions, color, color)
  grid.material.transparent = true
  grid.material.opacity = opacity
  grid.material.depthWrite = false
  return grid
}

function createBoundary() {
  const group = new THREE.Group()
  for (const radius of [28, 54, 80]) {
    const points = Array.from({ length: 129 }, (_, index) => {
      const angle = (index / 128) * Math.PI * 2
      return new THREE.Vector3(Math.cos(angle) * radius, 0.15, Math.sin(angle) * radius)
    })
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineDashedMaterial({ color: 0x5aa9e6, transparent: true, opacity: 0.1, dashSize: 1.4, gapSize: 2.2 }),
    )
    ring.computeLineDistances()
    group.add(ring)
  }
  return group
}

export function createTerrain() {
  const group = new THREE.Group()
  group.name = 'terrain'
  const rand = random(20261024)
  const columns = []
  for (let i = 0; i < GRID_COLS; i += 1) {
    for (let j = 0; j < GRID_COLS; j += 1) {
      const x = GRID_MIN + (i + 0.5) * VOXEL
      const z = GRID_MIN + (j + 0.5) * VOXEL
      if (Math.hypot(x, z) > 96 || terrainHeight(x, z) < -2) continue
      columns.push({ x, z, top: terrainSurfaceHeight(x, z) })
    }
  }

  const matrix = new THREE.Matrix4()
  const ground = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.91, metalness: 0.08, flatShading: true }),
    columns.length,
  )
  ground.name = 'ground'
  columns.forEach((column, index) => {
    const height = Math.max(0.5, column.top - WORLD_BOTTOM)
    matrix.makeScale(VOXEL * 0.985, height, VOXEL * 0.985)
    matrix.setPosition(column.x, WORLD_BOTTOM + height / 2, column.z)
    ground.setMatrixAt(index, matrix)
    const lowestNeighbor = Math.min(
      terrainSurfaceHeight(column.x + VOXEL, column.z),
      terrainSurfaceHeight(column.x - VOXEL, column.z),
      terrainSurfaceHeight(column.x, column.z + VOXEL),
      terrainSurfaceHeight(column.x, column.z - VOXEL),
    )
    const drop = column.top - lowestNeighbor
    const color = terrainColor(column.top, (rand() - 0.5) * 0.13)
    if (drop > 3) color.multiplyScalar(0.68)
    else if (drop > 1.5) color.multiplyScalar(0.82)
    else if (drop < 0.01) color.multiplyScalar(1.05)
    ground.setColorAt(index, color)
  })
  ground.instanceMatrix.needsUpdate = true
  ground.instanceColor.needsUpdate = true
  group.add(ground)

  const ocean = new THREE.Mesh(
    new THREE.CircleGeometry(850, 128).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x071d29, roughness: 0.38, metalness: 0.5 }),
  )
  ocean.position.y = SEA_PLANE_Y
  ocean.name = 'ocean'
  group.add(ocean)

  const wavePositions = []
  for (let i = 0; i < 850; i += 1) {
    const x = (rand() - 0.5) * 290
    const z = (rand() - 0.5) * 250
    if (!isOpenWater(x, z)) continue
    const length = 0.6 + rand() * 1.7
    wavePositions.push(x, -0.16, z, x + length, -0.16, z)
  }
  const wavesGeometry = new THREE.BufferGeometry()
  wavesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wavePositions, 3))
  const waves = new THREE.LineSegments(
    wavesGeometry,
    new THREE.LineBasicMaterial({ color: 0x4d9eaf, transparent: true, opacity: 0.22, depthWrite: false }),
  )
  group.add(waves)

  const grid = createGrid(190, 38, 0x42d6c5, 0.075)
  grid.position.y = -0.12
  group.add(grid)
  const boundary = createBoundary()
  group.add(boundary)

  const beacons = new THREE.Group()
  for (const [x, z] of [[-57, -34], [-54, 42], [30, 55], [39, -51]]) {
    const y = terrainSurfaceHeight(x, z)
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.75, 0.45, 8),
      new THREE.MeshStandardMaterial({ color: 0x183a42, roughness: 0.7 }),
    )
    base.position.set(x, y + 0.22, z)
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x42d6c5 }),
    )
    lamp.position.set(x, y + 1.3, z)
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.08, 1, 6),
      new THREE.MeshStandardMaterial({ color: 0x72908c, metalness: 0.65 }),
    )
    mast.position.set(x, y + 0.85, z)
    beacons.add(base, mast, lamp)
  }
  group.add(beacons)

  function update(elapsed) {
    waves.material.opacity = 0.18 + Math.sin(elapsed * 0.45) * 0.035
    boundary.rotation.y = elapsed * 0.002
  }

  function dispose() {
    group.traverse((object) => {
      object.geometry?.dispose()
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
      else object.material?.dispose()
    })
    group.clear()
  }

  return { group, ground, sea: ocean, update, dispose }
}
