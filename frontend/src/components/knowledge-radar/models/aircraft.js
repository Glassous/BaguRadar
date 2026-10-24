import * as THREE from 'three'
import { createKit, addAircraftEngines } from './common'

function fuselage(kit, radius, length, color = kit.palette.body) {
  kit.cylinder(radius * 0.82, radius, length, [0, radius + 0.35, 0], color, [Math.PI / 2, 0, 0], 20)
  kit.cone(radius * 0.83, radius * 2.4, [0, radius + 0.35, -length / 2 - radius * 1.15], color, [-Math.PI / 2, 0, 0], 20)
}

export function buildFighter(accent) {
  const kit = createKit(accent, 0x9ca9aa)
  fuselage(kit, 0.72, 9.5)
  kit.prism([[0, -2.8], [5.5, 1.2], [5, 2.1], [0, 0.8], [-5, 2.1], [-5.5, 1.2]], 0.18, 0.95)
  kit.prism([[0, 3.2], [2.4, 5.1], [2.1, 5.6], [0, 4.7], [-2.1, 5.6], [-2.4, 5.1]], 0.16, 1.02)
  kit.box([0.16, 2.1, 2.3], [-0.52, 2.05, 4.1], kit.palette.body, [0.18, 0, -0.12])
  kit.box([0.16, 2.1, 2.3], [0.52, 2.05, 4.1], kit.palette.body, [0.18, 0, 0.12])
  kit.sphere(0.7, [0, 1.65, -2.7], kit.palette.glass, [0.72, 0.55, 1.65])
  addAircraftEngines(kit, [[-0.46, 0.9, 4.7], [0.46, 0.9, 4.7]], 0.39, 1.3)
  kit.rod([0, 1.05, -6.4], [0, 1.05, -7.2], 0.045, kit.palette.metal)
  kit.navLight([-5.25, 1.15, 1.45], 0xef6a6a)
  kit.navLight([5.25, 1.15, 1.45], 0x55d68b)
  return kit.group
}

export function buildAwacs(accent) {
  const kit = createKit(accent, 0xc2cbc3)
  fuselage(kit, 0.95, 13.5)
  kit.prism([[0, -2.8], [8.4, 0.4], [8, 1.6], [0, 0.6], [-8, 1.6], [-8.4, 0.4]], 0.22, 1.15)
  kit.prism([[0, 4.6], [3.5, 6.2], [3.2, 6.8], [0, 6], [-3.2, 6.8], [-3.5, 6.2]], 0.18, 1.3)
  kit.box([0.22, 3.1, 2.6], [0, 2.8, 5.7], kit.palette.body, [0.2, 0, 0])
  addAircraftEngines(kit, [[-4.8, 0.45, 0.4], [-2.4, 0.45, -0.3], [2.4, 0.45, -0.3], [4.8, 0.45, 0.4]], 0.45, 2.2)
  kit.cylinder(0.16, 0.16, 1.4, [0, 2.55, 0.8], kit.palette.metal)
  kit.cylinder(2.25, 2.25, 0.38, [0, 3.35, 0.8], 0xd9d6bd, [0, 0, 0], 32)
  kit.cylinder(2.28, 2.28, 0.08, [0, 3.35, 0.8], kit.palette.dark, [0, 0, 0], 32)
  kit.box([1.5, 0.22, 0.12], [0, 1.65, -5.5], kit.palette.glass)
  return kit.group
}

export function buildTransport(accent) {
  const kit = createKit(accent, 0x879c91)
  fuselage(kit, 1.2, 12)
  kit.prism([[0, -2.1], [8.8, -0.5], [8.6, 1], [0, 0.5], [-8.6, 1], [-8.8, -0.5]], 0.3, 2.25)
  kit.prism([[0, 4], [3.8, 5.8], [3.5, 6.5], [0, 5.7], [-3.5, 6.5], [-3.8, 5.8]], 0.2, 1.7)
  kit.box([0.3, 4.2, 3.2], [0, 3.55, 5], kit.palette.body, [0.12, 0, 0])
  addAircraftEngines(kit, [[-5.8, 1.6, -0.1], [-3.1, 1.6, -0.8], [3.1, 1.6, -0.8], [5.8, 1.6, -0.1]], 0.53, 2.3, true)
  kit.box([1.8, 0.35, 0.12], [0, 2.1, -5.15], kit.palette.glass)
  kit.box([2.1, 0.1, 2.8], [0, 0.65, 5.6], kit.palette.dark, [-0.25, 0, 0])
  return kit.group
}

export function buildDrone(accent) {
  const kit = createKit(accent, 0xb7c1b8)
  fuselage(kit, 0.56, 9.5)
  kit.prism([[0, -1.8], [10, -0.4], [10, 0.35], [0, 0.4], [-10, 0.35], [-10, -0.4]], 0.15, 1.25)
  kit.box([0.16, 2.3, 3.4], [-1.15, 2, 4], kit.palette.body, [0.48, 0, -0.38])
  kit.box([0.16, 2.3, 3.4], [1.15, 2, 4], kit.palette.body, [0.48, 0, 0.38])
  kit.sphere(0.52, [0, 0.55, -3.5], kit.palette.glass, [0.85, 0.85, 1])
  const rotor = new THREE.Group()
  rotor.position.set(0, 0.92, 5.25)
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 0.09), kit.material(kit.palette.dark))
  const cross = blade.clone()
  cross.rotation.z = Math.PI / 2
  rotor.add(blade, cross)
  kit.group.add(rotor)
  kit.spinner(rotor, 'z', 10)
  return kit.group
}

export function buildHelicopter(accent) {
  const kit = createKit(accent, 0x7e9484)
  kit.sphere(1.65, [0, 2.15, -0.7], kit.palette.body, [1, 0.82, 1.5])
  kit.sphere(1.5, [0, 2.35, -1.65], kit.palette.glass, [0.88, 0.63, 0.9])
  kit.cone(0.72, 6.5, [0, 2.25, 4], kit.palette.body, [Math.PI / 2, 0, 0], 12)
  kit.box([0.16, 1.7, 1.4], [0, 3.15, 6.4], kit.palette.body)
  kit.box([2.6, 0.13, 0.65], [0, 2.4, 6.1], kit.palette.body)
  kit.rod([-1.25, 0.25, -2], [-1.25, 0.25, 2.1], 0.1, kit.palette.dark)
  kit.rod([1.25, 0.25, -2], [1.25, 0.25, 2.1], 0.1, kit.palette.dark)
  for (const x of [-1.25, 1.25]) {
    kit.rod([x, 0.3, -1], [x * 0.65, 1.25, -0.5], 0.08)
    kit.rod([x, 0.3, 1.3], [x * 0.65, 1.25, 0.8], 0.08)
  }
  const rotor = new THREE.Group()
  rotor.position.set(0, 4.15, -0.25)
  const bladeA = new THREE.Mesh(new THREE.BoxGeometry(10, 0.09, 0.22), kit.material(kit.palette.dark))
  const bladeB = bladeA.clone()
  bladeB.rotation.y = Math.PI / 2
  rotor.add(bladeA, bladeB)
  kit.group.add(rotor)
  kit.spinner(rotor, 'y', 5)
  const tailRotor = new THREE.Group()
  tailRotor.position.set(0.18, 2.9, 6.55)
  const tailBlade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2, 0.1), kit.material(kit.palette.dark))
  tailRotor.add(tailBlade)
  kit.group.add(tailRotor)
  kit.spinner(tailRotor, 'z', 9)
  return kit.group
}
