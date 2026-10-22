import * as THREE from 'three'

// 章节目标的低多边形造型库：每章一个专属剪影，便于在雷达上快速辨认。
const metalMat = (color, emissive = 0x000000, intensity = 0.5) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.45,
    metalness: 0.65,
    flatShading: true,
  })

const glowMat = (color, opacity = 0.75) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  })

const lineMat = (color, opacity = 0.5) =>
  new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })

function beam(color, height, radius = 0.06, opacity = 0.4) {
  const geo = new THREE.CylinderGeometry(radius * 0.4, radius, height, 6, 1, true)
  const mesh = new THREE.Mesh(geo, glowMat(color, opacity))
  mesh.position.y = height / 2
  return mesh
}

const BUILDERS = {
  // 00 计算机基础：主峰通信塔
  antenna(accent) {
    const group = new THREE.Group()
    const body = metalMat(0x16323a, 0x0e4b45, 0.35)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.62, 6.4, 6), body)
    mast.position.y = 3.2
    group.add(mast)

    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.9 - i * 0.16, 0.055, 4, 8),
        metalMat(0x2dd4bf, 0x2dd4bf, 0.8),
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = 1.6 + i * 1.7
      group.add(ring)
    }

    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.6),
      glowMat(accent, 0.5),
    )
    dish.position.set(0, 6.2, 0)
    dish.rotation.set(Math.PI / 2.4, 0, 0.4)
    group.add(dish)

    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), glowMat(accent, 0.95))
    tip.position.y = 7.4
    group.add(tip)

    const halo = beam(accent, 3.2, 0.14, 0.14)
    halo.position.y = 7.8
    group.add(halo)
    return group
  },

  // 01 语言与运行时：运行时尖塔
  pylon(accent) {
    const group = new THREE.Group()
    const shell = metalMat(0x142c38, 0x0c3f4a, 0.4)
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 1.5, 5.6, 4), shell)
    tower.position.y = 2.8
    tower.rotation.y = Math.PI / 4
    group.add(tower)

    for (let i = 0; i < 3; i += 1) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(2.3 - i * 0.5, 0.1, 2.3 - i * 0.5), glowMat(accent, 0.6))
      band.rotation.y = Math.PI / 4
      band.position.y = 1.1 + i * 1.5
      group.add(band)
    }

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), glowMat(accent, 0.85))
    core.position.y = 6.3
    group.add(core)
    return group
  },

  // 02 后端与中间件：主机机柜阵列
  mainframe(accent) {
    const group = new THREE.Group()
    const caseMat = metalMat(0x11242c, 0x0b3b3f, 0.4)
    for (let i = 0; i < 4; i += 1) {
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.2, 1.4), caseMat)
      cabinet.position.set((i - 1.5) * 1.3, 1.6, 0)
      group.add(cabinet)

      for (let k = 0; k < 3; k += 1) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.075, 0.06), glowMat(accent, 0.85))
        led.position.set((i - 1.5) * 1.3, 0.9 + k * 0.5, 0.72)
        group.add(led)
      }
    }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.1, 0.05, 3, 24),
      lineMat(accent, 0.6),
    )
    ring.position.y = 2.2
    ring.rotation.x = Math.PI / 2
    group.add(ring)
    return group
  },

  // 08 面试实战：指挥穹顶
  dome(accent) {
    const group = new THREE.Group()
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.4, 0.7, 8), metalMat(0x122b33, 0x0d4540, 0.4))
    base.position.y = 0.35
    group.add(base)

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1.9, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      metalMat(0x1b4a4c, 0x18685c, 0.55),
    )
    shell.position.y = 0.7
    group.add(shell)

    const crown = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.06, 3, 20), glowMat(accent, 0.8))
    crown.rotation.x = Math.PI / 2
    crown.position.y = 0.75
    group.add(crown)

    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 2.2, 5), glowMat(accent, 0.7))
    spike.position.y = 3.4
    group.add(spike)
    return group
  },

  // 13 工程效能：龙门吊
  crane(accent) {
    const group = new THREE.Group()
    const steel = metalMat(0x1c3138, 0x0f4741, 0.3)
    const legGeo = new THREE.BoxGeometry(0.24, 4.6, 0.24)
    const positions = [
      [-2, 0, -1],
      [-2, 0, 1],
      [2, 0, -1],
      [2, 0, 1],
    ]
    for (const [x, , z] of positions) {
      const leg = new THREE.Mesh(legGeo, steel)
      leg.position.set(x, 2.3, z)
      group.add(leg)
    }
    const beamGeo = new THREE.BoxGeometry(5.2, 0.26, 0.3)
    for (const z of [-1, 1]) {
      const beamMesh = new THREE.Mesh(beamGeo, steel)
      beamMesh.position.set(0, 4.6, z)
      group.add(beamMesh)
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.3, 2.2), steel)
    cross.position.y = 4.75
    group.add(cross)

    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 4), glowMat(accent, 0.6))
    cable.position.set(1.2, 3.6, 0)
    group.add(cable)
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), glowMat(accent, 0.55))
    hook.position.set(1.2, 2.3, 0)
    group.add(hook)
    return group
  },

  // 15 笔试真题：题碑
  obelisk(accent) {
    const group = new THREE.Group()
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.9, 6, 4), metalMat(0x1a2f38, 0x114a45, 0.35))
    stone.position.y = 3
    stone.rotation.y = Math.PI / 4
    group.add(stone)

    for (let i = 0; i < 4; i += 1) {
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 0.62), glowMat(accent, 0.55 - i * 0.06))
      rune.rotation.y = Math.PI / 4
      rune.position.y = 1.2 + i * 1.2
      group.add(rune)
    }

    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.72, 0), glowMat(accent, 0.85))
    shard.position.y = 7
    group.add(shard)
    return group
  },

  // 03 前端：浮空浏览器窗口
  browser(accent) {
    const group = new THREE.Group()
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3, 0.18), metalMat(0x122e3c, 0x0c4250, 0.4))
    frame.position.y = 2.4
    frame.rotation.y = -0.3
    group.add(frame)

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.1), glowMat(accent, 0.28))
    screen.position.set(0, 2.15, 0.12)
    screen.rotation.y = -0.3
    group.add(screen)

    for (let i = 0; i < 3; i += 1) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 4), glowMat(accent, 0.9))
      dot.position.set(-1.85 + i * 0.34, 3.55, 0.24)
      group.add(dot)
    }

    const cursor = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.7, 3), glowMat(accent, 0.85))
    cursor.position.set(1.1, 1.5, 0.6)
    cursor.rotation.z = -0.9
    group.add(cursor)

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.2, 1.2, 6), metalMat(0x11242c))
    pillar.position.y = 0.6
    group.add(pillar)
    return group
  },

  // 04 客户端：掌上终端
  handheld(accent) {
    const group = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.6, 0.34), metalMat(0x161f33, 0x1b2a55, 0.4))
    body.position.y = 2.2
    body.rotation.y = 0.4
    group.add(body)

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 2.5), glowMat(accent, 0.32))
    screen.position.set(0.14, 2.35, 0.19)
    screen.rotation.y = 0.4
    group.add(screen)

    const home = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 3, 12), glowMat(accent, 0.9))
    home.position.set(0, 0.9, 0.26)
    group.add(home)

    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.8, 1.4, 6), metalMat(0x11242c))
    stand.position.y = 0.7
    group.add(stand)
    return group
  },

  // 05 分布式：海上编队旗舰
  carrier(accent) {
    const group = new THREE.Group()
    const hull = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.1, 2.2), metalMat(0x142c36, 0x0d3a46, 0.4))
    hull.position.y = 0.6
    group.add(hull)

    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.8, 4), metalMat(0x142c36, 0x0d3a46, 0.4))
    bow.position.set(3.7, 0.6, 0)
    bow.rotation.z = -Math.PI / 2
    bow.rotation.y = Math.PI / 4
    group.add(bow)

    const deck = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.12, 2), glowMat(0x0f4a52, 0.4))
    deck.position.y = 1.2
    group.add(deck)

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 1.1), metalMat(0x1b3c46, 0x135a60, 0.5))
    bridge.position.set(-1.4, 1.9, 0)
    group.add(bridge)

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 4), glowMat(accent, 0.8))
    mast.position.set(-1.4, 3.4, 0)
    group.add(mast)

    for (let i = 0; i < 3; i += 1) {
      const plane = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.9, 3), metalMat(0x9ad9d0, 0x2dd4bf, 0.7))
      plane.rotation.z = -Math.PI / 2
      plane.position.set(0.8 + i * 0.9, 1.45, -0.5 + (i % 2) * 1)
      group.add(plane)
    }

    const ring = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.35, 32), glowMat(accent, 0.2))
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.12
    group.add(ring)
    return group
  },

  // 06 云原生：海上平台 / 容器集群
  platform(accent) {
    const group = new THREE.Group()
    const steel = metalMat(0x16303a, 0x0f4b4b, 0.4)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.3, 4.6), steel)
    deck.position.y = 2.4
    group.add(deck)

    for (const [x, z] of [
      [-1.9, -1.9],
      [-1.9, 1.9],
      [1.9, -1.9],
      [1.9, 1.9],
    ]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 2.6, 6), steel)
      leg.position.set(x, 1.2, z)
      group.add(leg)
    }

    for (let i = 0; i < 4; i += 1) {
      const container = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.8, 1.5),
        metalMat(0x123a44, accent, 0.3),
      )
      container.position.set((i % 2 === 0 ? -0.85 : 0.85), 2.95, (i < 2 ? -0.7 : 0.85))
      group.add(container)
    }

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 4), glowMat(accent, 0.8))
    antenna.position.set(1.6, 3.6, -1.6)
    group.add(antenna)
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 3, 24), glowMat(accent, 0.5))
    halo.rotation.x = Math.PI / 2
    halo.position.y = 4.4
    group.add(halo)
    return group
  },

  // 11 大数据：数据浮标
  buoy(accent) {
    const group = new THREE.Group()
    const float = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, 0.9, 8), metalMat(0x11303d, accent, 0.35))
    float.position.y = 0.45
    group.add(float)

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 2.4, 6), metalMat(0x163a44, 0x12545a, 0.4))
    body.position.y = 2
    group.add(body)

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), glowMat(accent, 0.95))
    lamp.position.y = 3.3
    group.add(lamp)

    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5 + i * 0.55, 0.035, 3, 26), glowMat(accent, 0.3 - i * 0.06))
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.2
      group.add(ring)
    }
    return group
  },

  // 09 测试与质量：探针三脚架
  probe(accent) {
    const group = new THREE.Group()
    const steel = metalMat(0x1c2c34, 0x0f4a44, 0.35)
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.2, 4), steel)
      leg.position.set(Math.cos(angle) * 0.9, 1.4, Math.sin(angle) * 0.9)
      leg.rotation.z = Math.cos(angle) * 0.28
      leg.rotation.x = -Math.sin(angle) * 0.28
      group.add(leg)
    }

    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), metalMat(0x1d3c44, accent, 0.45))
    head.position.y = 3.1
    group.add(head)

    const lens = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 8, 1, true), glowMat(accent, 0.35))
    lens.position.y = 2.5
    lens.rotation.x = Math.PI
    group.add(lens)

    const sweep = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.55, 24, 1, 0, Math.PI / 2), glowMat(accent, 0.35))
    sweep.rotation.x = -Math.PI / 2
    sweep.position.y = 0.16
    group.add(sweep)
    return group
  },

  // 10 安全与密码学：隐形干扰体（默认近乎不可见）
  cloak(accent) {
    const group = new THREE.Group()
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0x2a1414,
      emissive: accent,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.5,
      roughness: 0.6,
      metalness: 0.4,
      flatShading: true,
    })
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.9, 0), shellMat)
    core.position.y = 2.6
    group.add(core)

    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.OctahedronGeometry(2.05, 0)),
      lineMat(accent, 0.45),
    )
    wire.position.y = 2.6
    group.add(wire)

    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.04, 3, 32), glowMat(accent, 0.3))
    ring.rotation.x = Math.PI / 2
    ring.position.y = 2.6
    group.add(ring)

    group.userData.cloakMaterials = [shellMat]
    group.userData.cloakObjects = [core, wire, ring]
    return group
  },

  // 12 音视频与嵌入式：卫星天线
  dish(accent) {
    const group = new THREE.Group()
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 0.9, 6), metalMat(0x162c34, 0x10463f, 0.4))
    base.position.y = 0.45
    group.add(base)

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 2.4, 6), metalMat(0x1b343c))
    arm.position.y = 1.8
    group.add(arm)

    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3),
      metalMat(0x19323c, accent, 0.4),
    )
    dish.position.y = 3.3
    dish.rotation.set(-Math.PI / 2.6, 0, 0.3)
    group.add(dish)

    const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 4), glowMat(accent, 0.9))
    feed.position.set(0, 4.2, 0.9)
    feed.rotation.x = 0.9
    group.add(feed)

    for (let i = 0; i < 2; i += 1) {
      const wave = new THREE.Mesh(new THREE.TorusGeometry(1.2 + i * 0.7, 0.03, 3, 24, Math.PI), glowMat(accent, 0.4 - i * 0.12))
      wave.position.set(0, 4.3, 1)
      wave.rotation.set(-0.9, 0, 0)
      group.add(wave)
    }
    return group
  },

  // 07 AI：无人机集群核心
  droneCore(accent) {
    const group = new THREE.Group()
    const coreMat = metalMat(0x123238, accent, 0.6)
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 0), coreMat)
    group.add(core)

    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.05, 3, 32), glowMat(accent, 0.65))
    halo.rotation.x = Math.PI / 2.2
    group.add(halo)

    const drones = new THREE.Group()
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2
      const drone = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.55), metalMat(0x1d4048, accent, 0.5))
      drone.add(body)
      for (const [dx, dz] of [
        [-0.38, 0],
        [0.38, 0],
      ]) {
        const rotor = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 3, 10), glowMat(accent, 0.75))
        rotor.rotation.x = Math.PI / 2
        rotor.position.set(dx, 0.08, dz)
        drone.add(rotor)
      }
      drone.position.set(Math.cos(angle) * 3.1, Math.sin(angle * 2) * 0.6, Math.sin(angle) * 3.1)
      drones.add(drone)
    }
    drones.name = 'drone-swarm'
    group.add(drones)

    const beamDown = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4, 8, 1, true), glowMat(accent, 0.1))
    beamDown.position.y = -2.4
    group.add(beamDown)
    return group
  },

  // 14 真实面经：全息方舟
  holoArk(accent) {
    const group = new THREE.Group()
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.16, 5, 28), metalMat(0x1b2b3c, accent, 0.5))
    ringA.rotation.x = Math.PI / 2.2
    group.add(ringA)

    const ringB = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.06, 4, 24), glowMat(accent, 0.6))
    ringB.rotation.x = Math.PI / 2
    group.add(ringB)

    for (let i = 0; i < 5; i += 1) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), glowMat(accent, 0.16))
      const angle = (i / 5) * Math.PI * 2
      panel.position.set(Math.cos(angle) * 1.35, Math.sin(angle) * 0.4, Math.sin(angle) * 1.35)
      panel.rotation.y = -angle + Math.PI / 2
      group.add(panel)
    }

    const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.46, 0), glowMat(accent, 0.9))
    group.add(heart)

    const tether = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.4, 3), glowMat(accent, 0.3))
    tether.position.y = -2
    group.add(tether)
    return group
  },
}

export function buildChapterModel(model, accent) {
  const builder = BUILDERS[model] || BUILDERS.antenna
  const group = builder(accent)
  group.name = `chapter-${model}`

  // 统一登记会被高亮改写的材质
  const materials = []
  group.traverse((object) => {
    const list = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of list) {
      if (material && material.emissive && !materials.includes(material)) {
        material.userData.baseEmissive = material.emissive.getHex()
        material.userData.baseIntensity = material.emissiveIntensity
        materials.push(material)
      }
    }
  })
  group.userData.materials = materials
  return group
}

export function buildNoiseTarget(accent = 0xef4444) {
  const group = new THREE.Group()
  const shardMat = metalMat(0x3a1212, accent, 0.55)
  for (let i = 0; i < 5; i += 1) {
    const shard = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.4 + Math.random() * 0.55, 0),
      shardMat,
    )
    shard.position.set((Math.random() - 0.5) * 1.9, 0.5 + Math.random() * 1.8, (Math.random() - 0.5) * 1.9)
    shard.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
    group.add(shard)
  }
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.BoxGeometry(2.4, 2.4, 2.4)),
    lineMat(accent, 0.22),
  )
  wire.position.y = 1.2
  group.add(wire)
  group.userData.materials = [shardMat]
  return group
}
