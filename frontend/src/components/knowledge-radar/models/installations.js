import * as THREE from 'three'
import { createKit } from './common'

export function buildSearchRadar(accent) {
  const kit = createKit(accent, 0x899d98)
  kit.box([7.5, 0.45, 6], [0, 0.22, 0], 0x40575a)
  kit.box([3.2, 2.3, 3.5], [-1.8, 1.55, 0.5], kit.palette.body)
  kit.box([2.8, 0.55, 0.1], [-1.8, 1.8, -1.28], kit.palette.glass)
  kit.cylinder(1.2, 1.5, 0.65, [1.5, 0.85, 0], kit.palette.dark)
  kit.cylinder(0.35, 0.55, 3.2, [1.5, 2.65, 0], kit.palette.metal)
  const head = new THREE.Group()
  head.position.set(1.5, 4.5, 0)
  head.rotation.x = -0.16
  const frameMaterial = kit.material(0xa7b8ac)
  const meshMaterial = kit.material(0x496b69)
  for (const y of [-1.65, 1.65]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.18, 0.2), frameMaterial)
    rail.position.y = y
    head.add(rail)
  }
  for (let x = -3.2; x <= 3.2; x += 0.8) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.11, 3.4, 0.12), frameMaterial)
    rib.position.x = x
    head.add(rib)
  }
  for (let y = -1.2; y <= 1.2; y += 0.6) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.07, 0.08), meshMaterial)
    rib.position.y = y
    head.add(rib)
  }
  kit.group.add(head)
  kit.spinner(head, 'y', 0.35)
  kit.navLight([-2.8, 3, -1], accent, 0.18)
  return kit.group
}

export function buildControlTower(accent) {
  const kit = createKit(accent, 0x9ba9a4)
  kit.box([15, 0.22, 9], [0, 0.1, 0], 0x37494e)
  kit.box([0.16, 0.04, 8], [4.5, 0.25, 0], 0xe3dca9)
  for (let z = -3; z <= 3; z += 1.5) kit.box([1.3, 0.04, 0.12], [4.5, 0.26, z], 0xe3dca9)
  kit.box([4.8, 0.55, 4.8], [-2.3, 0.5, 0], kit.palette.dark)
  kit.cylinder(1.6, 2.05, 7.5, [-2.3, 4.4, 0], kit.palette.body, [0, 0, 0], 8)
  kit.cylinder(2.7, 2.25, 1.8, [-2.3, 8.8, 0], kit.palette.glass, [0, 0, 0], 8)
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2
    kit.rod([-2.3 + Math.cos(angle) * 2.3, 8, Math.sin(angle) * 2.3], [-2.3 + Math.cos(angle) * 2.65, 9.65, Math.sin(angle) * 2.65], 0.07, kit.palette.light)
  }
  kit.cylinder(3, 2.75, 0.45, [-2.3, 9.95, 0], kit.palette.light, [0, 0, 0], 8)
  kit.rod([-2.3, 10.15, 0], [-2.3, 12, 0], 0.07)
  kit.navLight([-2.3, 12.15, 0], 0xef6a6a, 0.18)
  return kit.group
}

export function buildSatelliteStation(accent) {
  const kit = createKit(accent, 0xa4b1aa)
  kit.box([8.5, 0.4, 7], [0, 0.2, 0], 0x40565a)
  kit.box([2.8, 2.2, 3], [2.2, 1.5, 1.2], kit.palette.body)
  kit.box([2.2, 0.55, 0.08], [2.2, 1.65, -0.32], kit.palette.glass)
  kit.cylinder(1.25, 1.65, 0.65, [-1.3, 0.75, -0.3], kit.palette.dark)
  kit.cylinder(0.35, 0.6, 2.7, [-1.3, 2.25, -0.3], kit.palette.metal)
  const dishRig = new THREE.Group()
  dishRig.position.set(-1.3, 5.2, -0.7)
  dishRig.rotation.set(-1.08, 0, -0.16)
  const dish = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 2.3, 32, 1, true),
    kit.material(kit.palette.light, { side: THREE.DoubleSide, roughness: 0.72 }),
  )
  dishRig.add(dish)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.17, 0.09, 6, 40), kit.material(0xdce8e1))
  rim.rotation.x = Math.PI / 2
  rim.position.y = -1.1
  dishRig.add(rim)
  const feed = new THREE.Group()
  feed.position.y = -2.3
  feed.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), kit.material(kit.palette.dark)))
  for (const x of [-2.1, 0, 2.1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.4, 0.07), kit.material(kit.palette.metal))
    strut.position.x = x * 0.48
    strut.position.y = 1.2
    strut.rotation.z = x * 0.09
    feed.add(strut)
  }
  dishRig.add(feed)
  kit.group.add(dishRig)
  kit.rod([-1.3, 3.4, -0.3], [-1.3, 4.4, -1.1], 0.12)
  kit.navLight([3.2, 2.9, 0], accent, 0.16)
  return kit.group
}

export function buildNoiseTarget(color = 0xef6a6a) {
  const kit = createKit(color, 0x5b3135)
  kit.box([0.5, 2.8, 0.5], [0, 1.4, 0], color, [0.2, 0.4, 0.35], { glow: 0.35 })
  kit.box([2.2, 0.35, 0.35], [0, 1.5, 0], color, [0.5, 0.2, -0.4], { glow: 0.35 })
  kit.box([0.35, 0.35, 2], [0, 1.2, 0], color, [-0.3, 0.5, 0.2], { glow: 0.35 })
  return kit.group
}
