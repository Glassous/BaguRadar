import { createKit } from './common'

function truckBase(kit, length = 8, color = kit.palette.body) {
  kit.box([3, 0.55, length], [0, 1.05, 0], kit.palette.dark)
  kit.box([2.8, 1.65, 2.1], [0, 2.05, -length / 2 + 1.2], color)
  kit.box([2.55, 0.65, 0.12], [0, 2.35, -length / 2 + 0.12], kit.palette.glass, [-0.12, 0, 0])
  kit.box([2.9, 0.35, 0.35], [0, 1.05, -length / 2 - 0.05], kit.palette.metal)
  const axles = length > 8 ? [-length / 2 + 1.2, 0.7, length / 2 - 1.2] : [-length / 2 + 1.2, length / 2 - 1.2]
  kit.wheels([-1.55, 1.55], axles, 0.72, 0.72, 0.5)
  kit.navLight([-0.9, 1.45, -length / 2 - 0.25], 0xf2c66d)
  kit.navLight([0.9, 1.45, -length / 2 - 0.25], 0xf2c66d)
}

function armoredBase(kit) {
  kit.box([3.2, 0.65, 6.8], [0, 1.05, 0], kit.palette.dark)
  kit.prism([[0, -4], [1.7, -2.9], [1.7, 3.3], [1.2, 3.8], [-1.2, 3.8], [-1.7, 3.3], [-1.7, -2.9]], 1.15, 2.45)
  kit.box([2.7, 0.45, 4.4], [0, 2.55, 0.25], kit.palette.body)
  kit.wheels([-1.75, 1.75], [-2.5, -0.85, 0.85, 2.5], 0.72, 0.72, 0.48)
  kit.box([1.8, 0.32, 0.12], [0, 2.05, -3.55], kit.palette.glass, [-0.3, 0, 0])
}

export function buildLauncher(accent) {
  const kit = createKit(accent, 0x7f9278)
  truckBase(kit, 10)
  kit.box([2.8, 0.35, 5.8], [0, 1.65, 1.7], kit.palette.metal)
  for (const x of [-0.88, 0, 0.88]) {
    for (const y of [2.3, 3.25]) {
      kit.cylinder(0.38, 0.38, 5.4, [x, y + 0.65, 1.5], 0x9aa58b, [0.85, 0, 0], 12)
      kit.cylinder(0.41, 0.41, 0.18, [x, y + 2.75, -0.42], kit.palette.dark, [0.85, 0, 0], 12)
    }
  }
  return kit.group
}

export function buildReconVehicle(accent) {
  const kit = createKit(accent, 0x819581)
  armoredBase(kit)
  kit.cylinder(0.85, 1.05, 0.65, [0, 3.05, -0.5], kit.palette.body, [0, 0, 0], 12)
  kit.box([1.25, 0.45, 1.4], [0, 3.55, -0.5], kit.palette.dark)
  kit.rod([0.45, 3.6, 0], [0.45, 7.5, 0], 0.075)
  kit.rod([0.45, 7.5, 0], [-1.3, 7.5, 0], 0.055)
  kit.rod([0.45, 7.5, 0], [2.2, 7.5, 0], 0.055)
  kit.rod([0.45, 6.4, 0], [-0.8, 6.4, 0], 0.045)
  kit.rod([0.45, 6.4, 0], [1.7, 6.4, 0], 0.045)
  kit.navLight([0.45, 7.65, 0], accent)
  return kit.group
}

export function buildTank(accent) {
  const kit = createKit(accent, 0x798c71)
  for (const x of [-1.55, 1.55]) {
    kit.box([1.05, 1.25, 7.3], [x, 0.85, 0], kit.palette.rubber)
    for (const z of [-2.6, -1.3, 0, 1.3, 2.6]) kit.wheel(x, 0.85, z, 0.58, 1.12)
    kit.box([1.12, 0.18, 7.4], [x, 1.5, 0], kit.palette.metal)
  }
  kit.box([3.4, 1.15, 6.2], [0, 1.65, 0], kit.palette.body)
  kit.box([3.1, 0.5, 4.8], [0, 2.4, 0.25], kit.palette.body)
  kit.cylinder(1.35, 1.65, 0.9, [0, 3, -0.5], kit.palette.body, [0, 0, 0], 10)
  kit.box([2.2, 0.65, 2.1], [0, 3.45, -0.65], kit.palette.body)
  kit.rod([0, 3.25, -1.25], [0, 3.35, -7.5], 0.15, kit.palette.dark)
  kit.cylinder(0.35, 0.35, 0.3, [0.65, 3.95, -0.2], kit.palette.dark)
  kit.rod([-1.1, 2.5, 2], [-1.1, 5.8, 2], 0.035, kit.palette.metal)
  return kit.group
}

export function buildCrane(accent) {
  const kit = createKit(accent, 0xd2a74f)
  truckBase(kit, 9, kit.palette.body)
  kit.cylinder(1.2, 1.2, 0.45, [0, 1.65, 1], kit.palette.dark)
  kit.box([2.1, 1.3, 2.2], [0, 2.45, 1], kit.palette.body)
  kit.rod([0, 3, 0.7], [0, 9.2, -6.5], 0.34, kit.palette.body)
  kit.rod([0.48, 3, 0.7], [0.48, 8.75, -6.1], 0.13, kit.palette.light)
  kit.rod([0, 9.2, -6.5], [0, 2.3, -6.5], 0.035, kit.palette.dark)
  kit.box([0.55, 0.65, 0.25], [0, 2.1, -6.5], kit.palette.dark)
  kit.rod([0, 2.1, -6.5], [0.45, 1.6, -6.5], 0.07, kit.palette.dark)
  for (const x of [-2.4, 2.4]) {
    kit.rod([0, 1.1, 1.7], [x, 0.35, 1.7], 0.11, kit.palette.metal)
    kit.box([0.7, 0.15, 0.7], [x, 0.15, 1.7], kit.palette.dark)
  }
  return kit.group
}

export function buildTruck(accent) {
  const kit = createKit(accent, 0x82967c)
  truckBase(kit, 8.5)
  kit.box([2.85, 2.6, 5.1], [0, 2.55, 1.45], 0x71866f)
  kit.box([2.95, 0.18, 5.2], [0, 3.92, 1.45], kit.palette.light)
  for (const z of [-0.4, 1.3, 3]) kit.box([3.02, 0.1, 0.12], [0, 2.7, z], kit.palette.dark)
  kit.box([1.9, 0.7, 0.08], [0, 2.45, 4.03], kit.palette.dark)
  return kit.group
}

export function buildArmoredVehicle(accent) {
  const kit = createKit(accent, 0x899980)
  armoredBase(kit)
  kit.cylinder(0.8, 1, 0.65, [0, 3.1, -0.4], kit.palette.body, [0, 0, 0], 10)
  kit.box([1.25, 0.45, 1.5], [0, 3.45, -0.4], kit.palette.body)
  kit.rod([0, 3.25, -1], [0, 3.35, -3.4], 0.09, kit.palette.dark)
  kit.cylinder(0.38, 0.38, 0.18, [0.75, 2.95, 1.6], kit.palette.dark)
  kit.rod([-1, 2.6, 2.2], [-1, 4.8, 2.2], 0.035)
  return kit.group
}
