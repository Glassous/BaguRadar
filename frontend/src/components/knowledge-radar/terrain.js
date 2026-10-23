import * as THREE from 'three'

// ---------------------------------------------------------------------------
// 地形高度场：中央主峰 + 东西两侧平原 + 西南峡谷 + 东侧海域
// 该函数是体素渲染、目标落点、雷达扫描共用的唯一数据源。
// ---------------------------------------------------------------------------
export const SEA_LEVEL = 0

const CANYON_PATH = [
  [-20, 10],
  [-30, 20],
  [-42, 31],
  [-52, 41],
]

function gauss(x, z, cx, cz, amp, sx, sz) {
  const dx = (x - cx) / sx
  const dz = (z - cz) / sz
  return amp * Math.exp(-(dx * dx + dz * dz) * 0.5)
}

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0 || 1e-6)))
  return t * t * (3 - 2 * t)
}

function distanceToSegment(px, pz, ax, az, bx, bz) {
  const abx = bx - ax
  const abz = bz - az
  const t = Math.min(
    1,
    Math.max(0, ((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz || 1e-6)),
  )
  const dx = px - (ax + abx * t)
  const dz = pz - (az + abz * t)
  return Math.hypot(dx, dz)
}

function distanceToCanyon(x, z) {
  let min = Infinity
  for (let i = 0; i < CANYON_PATH.length - 1; i += 1) {
    const [ax, az] = CANYON_PATH[i]
    const [bx, bz] = CANYON_PATH[i + 1]
    min = Math.min(min, distanceToSegment(x, z, ax, az, bx, bz))
  }
  return min
}

export function terrainHeight(x, z) {
  const coast = 48 + 9 * Math.sin(z * 0.07) + 4 * Math.cos(z * 0.15)

  let h = 0.8
  h += gauss(x, z, -8, -8, 25, 20, 18) // 中央主峰
  h += gauss(x, z, 3, -19, 9, 13, 12) // 北侧次峰
  h += gauss(x, z, 36, 31, 3.4, 26, 24) // 东侧平原（边缘城市）
  h += gauss(x, z, -8, 47, 2.6, 34, 19) // 南侧平原
  h += gauss(x, z, -35, -17, 11, 19, 20) // 西侧丘陵
  h += gauss(x, z, 19, 6, 4.2, 28, 18) // 中部高地
  h += Math.sin(x * 0.07) * Math.cos(z * 0.06) * 1.3
  h += Math.sin(x * 0.16 + z * 0.11) * 0.5

  // 峡谷深切：谷底抬到海平面之上（岩台 0.8~2.4），这样连续海平面不会漫进峡谷
  const dist = distanceToCanyon(x, z)
  const carve = smoothstep(23, 0, dist)
  if (carve > 0.001) {
    const floor = 1.6 + Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.8
    h = Math.max(h - carve * 26, floor)
  }

  // 海洋
  const sea = smoothstep(coast, coast + 13, x)
  const seabed = -8.5 + Math.sin(x * 0.05 + z * 0.04) * 1.2
  h = h * (1 - sea) + seabed * sea

  // 离岛衰减：让地图成为被海面包围的孤岛，而不是一块方形切片
  const radius = Math.hypot(x * 0.94, z * 0.94)
  const edge = 1 - smoothstep(74, 102, radius)
  h = h * edge + (-9.5 + Math.sin(x * 0.04) * 0.8) * (1 - edge)

  return Math.max(h, -10)
}

export function isWater(x, z) {
  return terrainHeight(x, z) < -0.4
}

/**
 * 是否属于「开阔水域」（东侧外海 + 岛屿外围环海）。
 * 峡谷等内陆低洼虽然低于海平面，但被陆地包住，铺水会把谷底淹没，
 * 因此水面铺设统一走这个判定，而不是只看高度。
 */
export function isOpenWater(x, z) {
  const coast = 48 + 9 * Math.sin(z * 0.07) + 4 * Math.cos(z * 0.15)
  if (x > coast - 6) return true
  const radius = Math.hypot(x * 0.94, z * 0.94)
  return radius > 70
}

// ---------------------------------------------------------------------------
// 体素化常数
// ---------------------------------------------------------------------------
const VOXEL = 0.75 // 地形体素柱的 XZ 尺寸
const HEIGHT_STEP = 0.75 // 高度量化步长与体素边长一致 → 立方体素台阶
const WORLD_BOTTOM = -16
const GRID_MIN = -108
const GRID_COLS = 288 // 288 × 0.75 = 216，与 GRID_MIN..108 跨度一致
const ISLAND_RADIUS = 106
const SEA_TILE = 2.4 // 体素浪块：统一尺寸，避免细/粗两种方块拼接出错位断层
const SEA_DETAIL_RANGE = 190 // 浪块铺到的半径，再往外由连续海平面接管
const OCEAN_RADIUS = 900 // 海平面半径：铺到雾完全接管之处，避免在远景露出圆盘边缘
const SEA_PLANE_Y = -0.3 // 连续海平面的高度（低于所有陆地体素顶面）

/** 体素柱顶面高度（向上取整到量化步长），保证目标不会悬空 */
export function terrainSurfaceHeight(x, z) {
  return Math.ceil(terrainHeight(x, z) / HEIGHT_STEP) * HEIGHT_STEP
}

// ---------------------------------------------------------------------------
// 地形配色：按高度分层，深海 → 深青 → 松绿 → 峰顶青白
// ---------------------------------------------------------------------------
const PALETTE = [
  { h: -10, color: new THREE.Color('#03121a') },
  { h: -4, color: new THREE.Color('#06262f') },
  { h: -0.5, color: new THREE.Color('#0a4038') },
  { h: 2, color: new THREE.Color('#0e5c48') },
  { h: 6, color: new THREE.Color('#137a58') },
  { h: 12, color: new THREE.Color('#1fa374') },
  { h: 19, color: new THREE.Color('#3fd0a0') },
  { h: 26, color: new THREE.Color('#8af5d8') },
  { h: 32, color: new THREE.Color('#d6fff5') },
]

const tmpColor = new THREE.Color()

function sampleTerrainColor(height, jitter = 0) {
  let base = PALETTE[PALETTE.length - 1].color
  if (height <= PALETTE[0].h) {
    base = PALETTE[0].color
  } else {
    for (let i = 0; i < PALETTE.length - 1; i += 1) {
      const a = PALETTE[i]
      const b = PALETTE[i + 1]
      if (height <= b.h) {
        const t = (height - a.h) / (b.h - a.h)
        base = tmpColor.copy(a.color).lerp(b.color, t)
        break
      }
    }
  }
  return new THREE.Color(base).multiplyScalar(1 + jitter)
}

// 稳定伪随机：刷新页面时地形细节保持一致
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 构建体素地形、体素海面、体素城市与云团。
 * 返回 { group, ground, sea, update(elapsed), dispose() }
 */
export function createTerrain({ cols = GRID_COLS } = {}) {
  const group = new THREE.Group()
  group.name = 'terrain'
  const rand = mulberry32(20261023)

  const voxelSize = (cols * VOXEL) / GRID_COLS // 允许调用方调整分辨率

  // -------------------------------------------------------------------------
  // 1. 体素地形柱
  // -------------------------------------------------------------------------
  const columns = []
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      const x = GRID_MIN + (i + 0.5) * voxelSize
      const z = GRID_MIN + (j + 0.5) * voxelSize
      const radius = Math.hypot(x, z)
      if (radius > ISLAND_RADIUS + rand() * 3) continue

      const top = terrainSurfaceHeight(x, z)
      // 深海（海平面以下且远离海岸）不铺方块：连续海平面已完全遮住
      if (top < SEA_PLANE_Y - 0.7 && radius > 72) continue

      columns.push({ x, z, top })
    }
  }

  const columnGeo = new THREE.BoxGeometry(1, 1, 1)
  const columnMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.22,
    flatShading: true,
  })
  const terrainMesh = new THREE.InstancedMesh(columnGeo, columnMat, columns.length)
  terrainMesh.name = 'ground'

  const matrix = new THREE.Matrix4()
  const color = new THREE.Color()

  columns.forEach((column, index) => {
    const bottom = WORLD_BOTTOM
    const height = Math.max(column.top - bottom, 1.2)
    matrix.makeScale(voxelSize, height, voxelSize)
    matrix.setPosition(column.x, bottom + height / 2, column.z)
    terrainMesh.setMatrixAt(index, matrix)

    const jitter = (rand() - 0.5) * 0.16
    if (column.top < SEA_LEVEL) {
      color.copy(sampleTerrainColor(column.top, jitter * 0.5))
    } else {
      color.copy(sampleTerrainColor(column.top, jitter))

      // 断崖面压暗：相邻体素柱落差超过一级台阶时，强化立方体块的体积感
      const neighborMin = Math.min(
        terrainSurfaceHeight(column.x + voxelSize, column.z),
        terrainSurfaceHeight(column.x - voxelSize, column.z),
        terrainSurfaceHeight(column.x, column.z + voxelSize),
        terrainSurfaceHeight(column.x, column.z - voxelSize),
      )
      const drop = column.top - neighborMin
      if (drop > HEIGHT_STEP) color.multiplyScalar(0.74)
      else if (drop > 0.001) color.multiplyScalar(0.88)
    }
    terrainMesh.setColorAt(index, color)
    column.height = height
  })
  terrainMesh.instanceMatrix.needsUpdate = true
  if (terrainMesh.instanceColor) terrainMesh.instanceColor.needsUpdate = true
  group.add(terrainMesh)

  // -------------------------------------------------------------------------
  // 2. 表面细节：峰顶雪冠 + 发光数据点
  // -------------------------------------------------------------------------
  const caps = []
  const glints = []
  for (const column of columns) {
    if (column.top > 26 && rand() < 0.24) {
      caps.push(column)
    } else if (column.top > 1.5 && column.top < 22 && rand() < 0.008) {
      glints.push(column)
    }
  }

  const capGeo = new THREE.BoxGeometry(1, 1, 1)
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xd9fff5,
    emissive: 0x2dd4bf,
    emissiveIntensity: 0.35,
    roughness: 0.7,
    metalness: 0.1,
    flatShading: true,
  })
  const capMesh = new THREE.InstancedMesh(capGeo, capMat, Math.max(caps.length, 1))
  capMesh.count = caps.length
  caps.forEach((column, index) => {
    const size = voxelSize * (0.7 + rand() * 0.3)
    matrix.makeScale(size, 0.34, size)
    matrix.setPosition(column.x, column.top + 0.16, column.z)
    capMesh.setMatrixAt(index, matrix)
  })
  capMesh.instanceMatrix.needsUpdate = true
  group.add(capMesh)

  const glintGeo = new THREE.BoxGeometry(1, 1, 1)
  const glintMat = new THREE.MeshBasicMaterial({
    color: 0x8ff8e6,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const glintMesh = new THREE.InstancedMesh(glintGeo, glintMat, Math.max(glints.length, 1))
  glintMesh.count = glints.length
  glints.forEach((column, index) => {
    const size = voxelSize * 0.85
    matrix.makeScale(size, 0.22, size)
    matrix.setPosition(column.x, column.top + 0.12, column.z)
    glintMesh.setMatrixAt(index, matrix)
  })
  glintMesh.instanceMatrix.needsUpdate = true
  group.add(glintMesh)

  // -------------------------------------------------------------------------
  // 3. 海面：一张连续的海平面（铺到地平线）+ 水面之上的体素浪块
  //    关键是"平面打底、浪块点缀"：平面保证任何视角都不会出现拼接断层，
  //    浪块只负责体素质感，即使有空隙也会被同色平面接住。
  // -------------------------------------------------------------------------
  const oceanGeo = new THREE.CircleGeometry(OCEAN_RADIUS, 160)
  oceanGeo.rotateX(-Math.PI / 2)
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0a2e3a,
    emissive: 0x0a3b48,
    emissiveIntensity: 0.42,
    roughness: 0.42,
    metalness: 0.52,
    flatShading: true,
  })
  const ocean = new THREE.Mesh(oceanGeo, oceanMat)
  ocean.name = 'ocean'
  ocean.position.y = SEA_PLANE_Y
  ocean.renderOrder = -1
  group.add(ocean)

  const seaTiles = []
  const seaCols = Math.ceil((SEA_DETAIL_RANGE * 2) / SEA_TILE)
  for (let i = 0; i < seaCols; i += 1) {
    for (let j = 0; j < seaCols; j += 1) {
      const x = -SEA_DETAIL_RANGE + (i + 0.5) * SEA_TILE
      const z = -SEA_DETAIL_RANGE + (j + 0.5) * SEA_TILE
      if (Math.hypot(x, z) > SEA_DETAIL_RANGE) continue
      if (!isOpenWater(x, z)) continue // 内陆峡谷/低洼不铺水，否则会把谷底淹没
      if (terrainHeight(x, z) > SEA_PLANE_Y - 0.6) continue // 浅滩与海岸线交给海平面
      seaTiles.push({ x, z })
    }
  }

  const seaGeo = new THREE.BoxGeometry(1, 1, 1)
  const seaMat = new THREE.MeshStandardMaterial({
    color: 0x0a3346,
    emissive: 0x0b4d66,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.9,
    roughness: 0.32,
    metalness: 0.55,
    flatShading: true,
  })
  // 浪块只做轻微起伏（±0.05），永远贴着平面，不会翘起露缝
  const seaUniforms = { uTime: { value: 0 } }
  seaMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = seaUniforms.uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float seaPhase = instanceMatrix[3].x * 0.11 + instanceMatrix[3].z * 0.07;
        transformed.y += sin(uTime * 1.05 + seaPhase) * 0.05 + cos(uTime * 0.7 + seaPhase * 1.7) * 0.03;`,
      )
  }

  const seaMesh = new THREE.InstancedMesh(seaGeo, seaMat, Math.max(seaTiles.length, 1))
  seaMesh.name = 'sea'
  seaMesh.count = seaTiles.length
  seaTiles.forEach((tilePos, index) => {
    matrix.makeScale(SEA_TILE * 0.94, 0.36, SEA_TILE * 0.94)
    matrix.setPosition(tilePos.x, SEA_PLANE_Y + 0.24, tilePos.z)
    seaMesh.setMatrixAt(index, matrix)
  })
  seaMesh.instanceMatrix.needsUpdate = true
  seaMesh.frustumCulled = false
  group.add(seaMesh)

  // 海面网格线：强化"体素沙盘"的坐标感（网格与海平面同尺度，避免边缘突然断开）
  const seaGrid = new THREE.GridHelper(SEA_DETAIL_RANGE * 2, 96, 0x2aa8b8, 0x12626f)
  seaGrid.position.y = SEA_PLANE_Y + 0.14
  seaGrid.material.transparent = true
  seaGrid.material.opacity = 0.12
  seaGrid.material.depthWrite = false
  group.add(seaGrid)

  // 地下雷达用的等深线
  const depthRings = new THREE.Group()
  for (let i = 0; i < 4; i += 1) {
    const radius = 12 + i * 9
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 72 }, (_, k) => {
          const angle = (k / 72) * Math.PI * 2
          const x = -42 + Math.cos(angle) * radius
          const z = 31 + Math.sin(angle) * radius
          return new THREE.Vector3(x, terrainHeight(x, z) + 0.2, z)
        }),
      ),
      new THREE.LineBasicMaterial({
        color: 0xf87171,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    )
    depthRings.add(ring)
  }
  group.add(depthRings)

  // -------------------------------------------------------------------------
  // 4. 边缘城市：体素楼群（壳层方块）+ 发光窗点
  // -------------------------------------------------------------------------
  const cityBlock = 0.78 // 与地形体素同量级，楼群才会显得"由小方块堆出来"
  const buildingBodies = []
  const windows = []
  const citySpots = [
    [30, 22, 14, 5.4],
    [35, 30, 20, 4.6],
    [41, 36, 17, 4.2],
    [45, 43, 11, 3.6],
    [27, 34, 9, 3.2],
    [38, 45, 13, 4.8],
    [49, 30, 10, 3],
    [24, 27, 8, 2.8],
  ]

  for (const [cx, cz, count, spread] of citySpots) {
    for (let i = 0; i < count; i += 1) {
      const angle = rand() * Math.PI * 2
      const radius = Math.pow(rand(), 0.6) * spread
      const x = cx + Math.cos(angle) * radius
      const z = cz + Math.sin(angle) * radius
      if (terrainHeight(x, z) < 1.2) continue

      const base = terrainSurfaceHeight(x, z)
      const footprint = 2 + Math.floor(rand() * 3) // 2~4 格宽
      const levels = 5 + Math.floor(rand() * 8) // 5~12 层
      const originX = Math.round(x / cityBlock) * cityBlock - ((footprint - 1) * cityBlock) / 2
      const originZ = Math.round(z / cityBlock) * cityBlock - ((footprint - 1) * cityBlock) / 2
      const tone = 0.42 + rand() * 0.28

      for (let level = 0; level < levels; level += 1) {
        const y = base + level * cityBlock + cityBlock / 2
        for (let gx = 0; gx < footprint; gx += 1) {
          for (let gz = 0; gz < footprint; gz += 1) {
            const isShell = gx === 0 || gz === 0 || gx === footprint - 1 || gz === footprint - 1
            const isTop = level === levels - 1
            if (!isShell && !isTop) continue
            buildingBodies.push({
              x: originX + gx * cityBlock,
              y,
              z: originZ + gz * cityBlock,
              scale: cityBlock,
              tone: tone + (isTop ? 0.12 : 0),
            })
          }
        }

        // 发光窗点：每层在朝外的立面上点几盏灯，营造体素城市的夜景层次
        if (level > 0 && rand() < 0.85) {
          const span = (footprint - 1) * cityBlock
          const side = Math.floor(rand() * 4)
          const along = (rand() - 0.5) * span
          const inset = cityBlock * 0.54
          const isXFace = side < 2
          windows.push({
            x: isXFace ? originX + (side === 0 ? -inset : span + inset) : originX + along,
            y: y + cityBlock * 0.06,
            z: isXFace ? originZ + along : originZ + (side === 2 ? -inset : span + inset),
            scale: cityBlock * 0.6,
          })
        }
      }
    }
  }

  const bodyGeo = new THREE.BoxGeometry(1, 1, 1)
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.55,
    flatShading: true,
  })
  const cityMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, Math.max(buildingBodies.length, 1))
  cityMesh.name = 'edge-city'
  cityMesh.count = buildingBodies.length
  const cityBase = new THREE.Color('#0d2b38')
  const cityLight = new THREE.Color('#2f7f96')
  buildingBodies.forEach((block, index) => {
    matrix.makeScale(block.scale, block.scale, block.scale)
    matrix.setPosition(block.x, block.y, block.z)
    cityMesh.setMatrixAt(index, matrix)
    color.copy(cityBase).lerp(cityLight, Math.min(1, block.tone))
    cityMesh.setColorAt(index, color)
  })
  cityMesh.instanceMatrix.needsUpdate = true
  if (cityMesh.instanceColor) cityMesh.instanceColor.needsUpdate = true
  group.add(cityMesh)

  const windowGeo = new THREE.BoxGeometry(1, 1, 1)
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x8bf5ff, transparent: true, opacity: 0.62 })
  const windowMesh = new THREE.InstancedMesh(windowGeo, windowMat, Math.max(windows.length, 1))
  windowMesh.count = windows.length
  windows.forEach((win, index) => {
    matrix.makeScale(win.scale, win.scale * 0.8, win.scale)
    matrix.setPosition(win.x, win.y, win.z)
    windowMesh.setMatrixAt(index, matrix)
  })
  windowMesh.instanceMatrix.needsUpdate = true
  group.add(windowMesh)

  // -------------------------------------------------------------------------
  // 5. 体素云团
  // -------------------------------------------------------------------------
  const cloudVoxels = []
  const cloudSpots = [
    [8, 30, 33, 20],
    [24, 2, 30, 18],
    [16, 12, 36, 22],
    [-2, 4, 34, 18],
    [34, 18, 28, 16],
  ]
  for (const [cx, cz, cy, count] of cloudSpots) {
    for (let i = 0; i < count; i += 1) {
      const size = 1.2 + rand() * 2.4
      cloudVoxels.push({
        x: cx + (rand() - 0.5) * 20,
        y: cy + (rand() - 0.5) * 4,
        z: cz + (rand() - 0.5) * 20,
        sx: size,
        sy: 0.5 + rand() * 0.6,
        sz: size * (0.7 + rand() * 0.6),
      })
    }
  }
  const cloudGeo = new THREE.BoxGeometry(1, 1, 1)
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0x8fd8cf,
    emissive: 0x1e6e63,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.16,
    roughness: 1,
    depthWrite: false,
    flatShading: true,
  })
  const cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, Math.max(cloudVoxels.length, 1))
  cloudMesh.count = cloudVoxels.length
  cloudVoxels.forEach((voxel, index) => {
    matrix.makeScale(voxel.sx, voxel.sy, voxel.sz)
    matrix.setPosition(voxel.x, voxel.y, voxel.z)
    cloudMesh.setMatrixAt(index, matrix)
  })
  cloudMesh.instanceMatrix.needsUpdate = true
  group.add(cloudMesh)

  // -------------------------------------------------------------------------
  // 6. 星点背景
  // -------------------------------------------------------------------------
  const starCount = 700
  const starPositions = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i += 1) {
    const r = 150 + rand() * 110
    const theta = rand() * Math.PI * 2
    const phi = rand() * Math.PI * 0.42
    starPositions[i * 3] = Math.cos(theta) * Math.cos(phi) * r
    starPositions[i * 3 + 1] = 20 + Math.sin(phi) * r
    starPositions[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0x8ff0e0,
      size: 0.85,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  )
  group.add(stars)

  function update(elapsed) {
    seaUniforms.uTime.value = elapsed
    cloudMesh.position.x = Math.sin(elapsed * 0.05) * 2.2
    depthRings.rotation.y = elapsed * 0.04
    stars.rotation.y = elapsed * 0.004
    glintMat.opacity = 0.38 + Math.sin(elapsed * 1.6) * 0.2
    windowMat.opacity = 0.5 + Math.sin(elapsed * 0.9) * 0.14
  }

  function dispose() {
    group.traverse((object) => {
      if (object.geometry) object.geometry.dispose()
      if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose())
      else if (object.material) object.material.dispose()
    })
    group.clear()
  }

  return { group, ground: terrainMesh, sea: seaMesh, update, dispose }
}
