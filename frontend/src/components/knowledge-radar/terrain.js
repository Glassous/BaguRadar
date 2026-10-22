import * as THREE from 'three'

// ---------------------------------------------------------------------------
// 地形高度场：中央主峰 + 东西两侧平原 + 西南峡谷 + 东侧海域
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

  // 峡谷深切
  const dist = distanceToCanyon(x, z)
  const carve = smoothstep(23, 0, dist)
  h -= carve * 24

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

// ---------------------------------------------------------------------------
// 地形配色：按高度分层，深青 → 松绿 → 峰顶青白
// ---------------------------------------------------------------------------
const PALETTE = [
  { h: -10, color: new THREE.Color('#051820') },
  { h: -1, color: new THREE.Color('#0a3c46') },
  { h: 1.2, color: new THREE.Color('#0b564b') },
  { h: 5, color: new THREE.Color('#12816a') },
  { h: 11, color: new THREE.Color('#1aa887') },
  { h: 18, color: new THREE.Color('#2ecfa8') },
  { h: 26, color: new THREE.Color('#75ecd0') },
]

const tmpColor = new THREE.Color()

function sampleTerrainColor(height) {
  if (height <= PALETTE[0].h) return PALETTE[0].color
  for (let i = 0; i < PALETTE.length - 1; i += 1) {
    const a = PALETTE[i]
    const b = PALETTE[i + 1]
    if (height <= b.h) {
      const t = (height - a.h) / (b.h - a.h)
      return tmpColor.copy(a.color).lerp(b.color, t)
    }
  }
  return PALETTE[PALETTE.length - 1].color
}

/**
 * 构建低多边形地形与海面。
 * 返回 { group, update(elapsed, delta), dispose() }
 */
export function createTerrain({ segments = 96, size = 210 } = {}) {
  const group = new THREE.Group()
  group.name = 'terrain'

  const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
  geometry.rotateX(-Math.PI / 2)

  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const z = position.getZ(i)
    const h = terrainHeight(x, z)
    position.setY(i, h)
    const c = sampleTerrainColor(h)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  position.needsUpdate = true
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.92,
    metalness: 0.18,
  })

  const ground = new THREE.Mesh(geometry, material)
  ground.receiveShadow = false
  ground.name = 'ground'
  group.add(ground)

  // 低分辨线框叠加：强化 low-poly 指挥屏质感
  const wireGeo = new THREE.PlaneGeometry(size, size, 48, 48)
  wireGeo.rotateX(-Math.PI / 2)
  const wirePos = wireGeo.attributes.position
  for (let i = 0; i < wirePos.count; i += 1) {
    const x = wirePos.getX(i)
    const z = wirePos.getZ(i)
    wirePos.setY(i, terrainHeight(x, z) + 0.12)
  }
  wirePos.needsUpdate = true
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(wireGeo),
    new THREE.LineBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.19,
      depthWrite: false,
    }),
  )
  group.add(wire)
  wireGeo.dispose()

  // -------------------------------------------------------------------------
  // 海面：整体铺一层，陆地高于海平面自然遮挡出海岸线
  // -------------------------------------------------------------------------
  const seaGeo = new THREE.PlaneGeometry(280, 280, 56, 56)
  seaGeo.rotateX(-Math.PI / 2)
  const seaBase = Float32Array.from(seaGeo.attributes.position.array)
  const seaMat = new THREE.MeshStandardMaterial({
    color: 0x041d2b,
    emissive: 0x08334a,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.92,
    roughness: 0.28,
    metalness: 0.6,
    flatShading: true,
  })
  const sea = new THREE.Mesh(seaGeo, seaMat)
  sea.position.y = SEA_LEVEL
  sea.name = 'sea'
  group.add(sea)

  // 海面网格线
  const seaGrid = new THREE.GridHelper(240, 48, 0x2aa8b8, 0x12626f)
  seaGrid.position.y = SEA_LEVEL + 0.06
  seaGrid.material.transparent = true
  seaGrid.material.opacity = 0.22
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
  // 边缘城市：东侧平原的低模楼群
  // -------------------------------------------------------------------------
  const cityGroup = new THREE.Group()
  cityGroup.name = 'edge-city'
  const citySpots = [
    [30, 22, 12, 5.4],
    [35, 30, 18, 4.6],
    [41, 36, 15, 4.2],
    [45, 43, 9, 3.6],
    [27, 34, 7, 3.2],
    [38, 45, 11, 4.8],
    [49, 30, 8, 3],
    [24, 27, 6, 2.8],
  ]
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0x0d2836,
    emissive: 0x0b3a4a,
    emissiveIntensity: 0.65,
    roughness: 0.55,
    metalness: 0.7,
    flatShading: true,
  })
  const windowMat = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.5,
  })
  for (const [cx, cz, count, spread] of citySpots) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.pow(Math.random(), 0.6) * spread
      const x = cx + Math.cos(angle) * radius
      const z = cz + Math.sin(angle) * radius
      const base = terrainHeight(x, z)
      const height = 2 + Math.random() * 9
      const width = 1.2 + Math.random() * 2.2
      const box = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), towerMat)
      box.position.set(x, base + height / 2, z)
      box.rotation.y = Math.random() * Math.PI
      cityGroup.add(box)

      const band = new THREE.Mesh(new THREE.BoxGeometry(width * 1.02, 0.16, width * 1.02), windowMat)
      band.position.set(x, base + height * (0.55 + Math.random() * 0.3), z)
      band.rotation.y = box.rotation.y
      cityGroup.add(band)
    }
  }
  group.add(cityGroup)

  // -------------------------------------------------------------------------
  // 云层：高空目标周边的低模云团
  // -------------------------------------------------------------------------
  const cloudGroup = new THREE.Group()
  cloudGroup.name = 'clouds'
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0x8fd8cf,
    emissive: 0x1e6e63,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.16,
    roughness: 1,
    depthWrite: false,
    flatShading: true,
  })
  const cloudSpots = [
    [8, 30, 33, 7],
    [24, 2, 30, 6],
    [16, 12, 36, 8],
    [-2, 4, 34, 6],
    [34, 18, 28, 5],
  ]
  for (const [cx, cz, cy, count] of cloudSpots) {
    for (let i = 0; i < count; i += 1) {
      const geo = new THREE.IcosahedronGeometry(1, 0)
      const cloud = new THREE.Mesh(geo, cloudMat)
      cloud.position.set(
        cx + (Math.random() - 0.5) * 18,
        cy + (Math.random() - 0.5) * 4,
        cz + (Math.random() - 0.5) * 18,
      )
      cloud.scale.set(2.4 + Math.random() * 3, 0.7 + Math.random() * 0.6, 2 + Math.random() * 2.6)
      cloud.rotation.y = Math.random() * Math.PI
      cloudGroup.add(cloud)
    }
  }
  group.add(cloudGroup)

  // -------------------------------------------------------------------------
  // 星点背景
  // -------------------------------------------------------------------------
  const starCount = 700
  const starPositions = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i += 1) {
    const r = 150 + Math.random() * 110
    const theta = Math.random() * Math.PI * 2
    const phi = Math.random() * Math.PI * 0.42
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

  const seaPos = seaGeo.attributes.position
  function update(elapsed) {
    // 海面波动：低频正弦叠加，避免每帧重建几何
    for (let i = 0; i < seaPos.count; i += 1) {
      const x = seaBase[i * 3]
      const z = seaBase[i * 3 + 2]
      seaPos.setY(i, Math.sin(x * 0.09 + elapsed * 0.8) * 0.34 + Math.cos(z * 0.11 + elapsed * 0.6) * 0.28)
    }
    seaPos.needsUpdate = true
    cloudGroup.position.x = Math.sin(elapsed * 0.05) * 2.2
    depthRings.rotation.y = elapsed * 0.04
    stars.rotation.y = elapsed * 0.004
  }

  function dispose() {
    group.traverse((object) => {
      if (object.geometry) object.geometry.dispose()
      if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose())
      else if (object.material) object.material.dispose()
    })
    group.clear()
  }

  return { group, ground, sea, update, dispose }
}
