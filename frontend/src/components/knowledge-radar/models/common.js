import * as THREE from 'three'

export function createKit(accent = 0x42d6c5, body = 0x91a29f) {
  const group = new THREE.Group()
  const materials = new Map()
  const spinners = []
  const palette = {
    body,
    dark: 0x26383d,
    metal: 0x60767a,
    glass: 0x173f51,
    light: 0xd8e4dc,
    accent,
    rubber: 0x121a1d,
  }

  function material(color, options = {}) {
    const key = `${color}|${options.glow || 0}|${options.opacity ?? 1}`
    if (!materials.has(key)) {
      const tint = new THREE.Color(color)
      if (tint.r + tint.g + tint.b < 1.55) tint.multiplyScalar(1.28)
      materials.set(key, new THREE.MeshStandardMaterial({
        color: tint,
        emissive: options.glow ? color : 0x000000,
        emissiveIntensity: options.glow || 0,
        metalness: options.metalness ?? 0.42,
        roughness: options.roughness ?? 0.58,
        flatShading: true,
        transparent: (options.opacity ?? 1) < 1,
        opacity: options.opacity ?? 1,
        side: options.side || THREE.FrontSide,
      }))
    }
    return materials.get(key)
  }

  function mesh(geometry, color, position = [0, 0, 0], rotation = [0, 0, 0], options = {}) {
    const object = new THREE.Mesh(geometry, material(color, options))
    object.position.set(...position)
    object.rotation.set(...rotation)
    group.add(object)
    return object
  }

  function box(size, position, color = palette.body, rotation = [0, 0, 0], options = {}) {
    return mesh(new THREE.BoxGeometry(...size), color, position, rotation, options)
  }

  function cylinder(radiusTop, radiusBottom, height, position, color = palette.body, rotation = [0, 0, 0], segments = 16) {
    return mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), color, position, rotation)
  }

  function sphere(radius, position, color = palette.body, scale = [1, 1, 1]) {
    const object = mesh(new THREE.SphereGeometry(radius, 16, 10), color, position)
    object.scale.set(...scale)
    return object
  }

  function cone(radius, height, position, color = palette.body, rotation = [0, 0, 0], segments = 16) {
    return mesh(new THREE.ConeGeometry(radius, height, segments), color, position, rotation)
  }

  function rod(start, end, radius = 0.06, color = palette.metal) {
    const a = new THREE.Vector3(...start)
    const b = new THREE.Vector3(...end)
    const object = cylinder(radius, radius, a.distanceTo(b), a.clone().add(b).multiplyScalar(0.5).toArray(), color)
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize())
    return object
  }

  function prism(points, thickness, y, color = palette.body) {
    const shape = new THREE.Shape()
    points.forEach(([x, z], index) => index ? shape.lineTo(x, z) : shape.moveTo(x, z))
    shape.closePath()
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
    geometry.rotateX(Math.PI / 2)
    return mesh(geometry, color, [0, y, 0])
  }

  function wheel(x, y, z, radius = 0.72, width = 0.48) {
    cylinder(radius, radius, width, [x, y, z], palette.rubber, [0, 0, Math.PI / 2], 16)
    cylinder(radius * 0.42, radius * 0.42, width + 0.05, [x, y, z], palette.metal, [0, 0, Math.PI / 2], 12)
  }

  function wheels(xs, zs, y, radius = 0.72, width = 0.48) {
    for (const x of xs) for (const z of zs) wheel(x, y, z, radius, width)
  }

  function navLight(position, color = accent, radius = 0.13) {
    return sphere(radius, position, color)
  }

  function spinner(object, axis = 'y', speed = 1) {
    spinners.push({ object, axis, speed })
    return object
  }

  group.userData.materials = [...materials.values()]
  group.userData.spinners = spinners
  return { group, palette, material, mesh, box, cylinder, sphere, cone, rod, prism, wheel, wheels, navLight, spinner, spinners }
}

export function addAircraftEngines(kit, positions, radius = 0.45, length = 2.1, propeller = false) {
  const { group, cylinder, cone, box, spinner } = kit
  for (const [x, y, z] of positions) {
    cylinder(radius, radius * 0.86, length, [x, y, z], kit.palette.metal, [Math.PI / 2, 0, 0], 16)
    cone(radius * 0.83, 0.55, [x, y, z - length / 2 - 0.25], kit.palette.body, [-Math.PI / 2, 0, 0])
    if (propeller) {
      const rotor = new THREE.Group()
      rotor.position.set(x, y, z - length / 2 - 0.58)
      const bladeA = new THREE.Mesh(new THREE.BoxGeometry(radius * 3.2, 0.09, 0.08), kit.material(kit.palette.dark))
      const bladeB = bladeA.clone()
      bladeB.rotation.z = Math.PI / 2
      rotor.add(bladeA, bladeB)
      group.add(rotor)
      spinner(rotor, 'z', 12)
    } else {
      cylinder(radius * 0.67, radius * 0.67, 0.06, [x, y, z + length / 2 + 0.02], 0x101b20, [Math.PI / 2, 0, 0])
    }
  }
}
