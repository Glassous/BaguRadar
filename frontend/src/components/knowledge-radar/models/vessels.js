import { createKit } from './common'

function deckJet(kit, x, z, rotation = 0) {
  const jet = kit.prism([[0, -1], [0.85, 0.45], [0.75, 0.75], [0, 0.4], [-0.75, 0.75], [-0.85, 0.45]], 0.12, 1.75, 0x9aa9aa)
  jet.position.x = x
  jet.position.z = z
  jet.rotation.y = rotation
}

export function buildCarrier(accent) {
  const kit = createKit(accent, 0x657b80)
  kit.prism([[0, -11], [2.7, -8.5], [3.1, 8.5], [2.2, 10.5], [-2.2, 10.5], [-3.1, 8.5], [-2.7, -8.5]], 0.85, 1.05, 0x536a70)
  kit.prism([[0, -11.4], [3.8, -8.5], [3.9, 9.5], [2.7, 10.5], [-3.2, 10.2], [-4, 8.8], [-3.5, -8.7]], 0.25, 1.55, 0x3e5056)
  kit.box([0.1, 0.035, 16.5], [-0.55, 1.7, 0.4], 0xd6d2ad, [0, -0.04, 0])
  for (let z = -7; z < 8; z += 2.2) kit.box([0.18, 0.04, 1.1], [-0.55, 1.73, z], 0xe8e6cf)
  kit.box([1.5, 1.8, 3.3], [2.35, 2.55, 2.4], 0x354b51)
  kit.box([1.7, 0.5, 2.1], [2.35, 3.65, 2.1], 0x4c6267)
  kit.box([1.74, 0.35, 1.75], [2.35, 3.7, 2], kit.palette.glass)
  kit.rod([2.35, 3.9, 2.3], [2.35, 6.2, 2.3], 0.1, 0xc7d4ce)
  kit.box([2.2, 0.12, 0.18], [2.35, 5.65, 2.3], kit.palette.metal, [0, 0.4, 0])
  kit.cylinder(0.65, 0.65, 0.16, [2.35, 6.25, 2.3], 0xd6e0d9)
  deckJet(kit, -1.8, 4.8, -0.08)
  deckJet(kit, -1.6, -3.2, 0.06)
  deckJet(kit, 1.2, 7.5, 0)
  kit.navLight([2.35, 6.65, 2.3], 0xef6a6a)
  return kit.group
}

export function buildDestroyer(accent) {
  const kit = createKit(accent, 0x829295)
  kit.prism([[0, -9], [1.8, -6.5], [2.2, 6.8], [1.5, 8.5], [-1.5, 8.5], [-2.2, 6.8], [-1.8, -6.5]], 0.75, 0.95, 0x65797e)
  kit.prism([[0, -9.2], [1.9, -6.5], [2.3, 7], [1.6, 8.6], [-1.6, 8.6], [-2.3, 7], [-1.9, -6.5]], 0.18, 1.18, 0x9aa6a3)
  kit.box([3.1, 1.3, 4.5], [0, 1.85, -0.2], kit.palette.body)
  kit.box([2.5, 1.2, 2.7], [0, 3, 0.5], kit.palette.light)
  kit.box([2.58, 0.42, 2.1], [0, 3.25, 0.1], kit.palette.glass)
  kit.box([2.1, 0.7, 2.5], [0, 1.65, 3.7], kit.palette.dark)
  kit.rod([0, 3.5, 0.7], [0, 7.1, 0.7], 0.11)
  kit.rod([-1.25, 5.5, 0.7], [1.25, 5.5, 0.7], 0.07)
  kit.box([2.4, 0.14, 0.65], [0, 6.3, 0.7], kit.palette.light, [0, 0.3, 0])
  kit.cylinder(0.65, 0.8, 0.45, [0, 1.55, -5.6], kit.palette.dark)
  kit.rod([0, 1.8, -5.6], [0, 2, -8], 0.12, kit.palette.metal)
  kit.cylinder(1.25, 1.25, 0.05, [0, 1.31, 5.9], 0x465b5e, [0, 0, 0], 32)
  kit.cylinder(0.82, 0.82, 0.06, [0, 1.34, 5.9], 0xd7d9c9, [0, 0, 0], 32)
  kit.cylinder(0.68, 0.68, 0.07, [0, 1.38, 5.9], 0x465b5e, [0, 0, 0], 32)
  kit.navLight([0, 7.35, 0.7], 0xef6a6a)
  return kit.group
}
