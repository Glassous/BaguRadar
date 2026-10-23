import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// ---------------------------------------------------------------------------
// 体素构建辅助
// 以"体素格"为单位描述模型，最终按材质桶合并几何（每个桶一次 draw call），
// 同时把 MeshStandardMaterial 统一登记到 userData.materials，
// 供 targets.js 的锁定发光 / 隐形淡出 / 杂波脉冲动效复用。
// ---------------------------------------------------------------------------

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1)
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1)

function makeMaterial({ color, glow = 0, emissive = null, opacity = 1, metalness = 0.35, roughness = 0.72 }) {
  const emissiveColor = emissive ?? color
  return new THREE.MeshStandardMaterial({
    color,
    emissive: emissiveColor,
    emissiveIntensity: glow,
    roughness,
    metalness,
    flatShading: true,
    transparent: opacity < 1,
    opacity,
  })
}

export class VoxelBuilder {
  constructor(unit = 0.5) {
    this.unit = unit
    this.blocks = []
  }

  /**
   * 放置一个长方体体素块。
   * 坐标与尺寸都以体素格为单位，(x, y, z) 为块中心。
   */
  box(x, y, z, w, h, d, color, options = {}) {
    this.blocks.push({ x, y, z, w, h, d, color, ...options })
    return this
  }

  /** 1×1×1 单格体素 */
  voxel(x, y, z, color, options = {}) {
    return this.box(x, y, z, 1, 1, 1, color, options)
  }

  /** 以 (x, z) 为左下角、y 为底面的整数格长方体（更贴近体素思维） */
  cell(x0, y0, z0, w, h, d, color, options = {}) {
    return this.box(x0 + w / 2, y0 + h / 2, z0 + d / 2, w, h, d, color, options)
  }

  /** 沿轴线铺一串连续体素（用于灯带、管线） */
  line(x0, y0, z0, x1, y1, z1, color, { thickness = 1, options = {} } = {}) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))
    if (steps === 0) return this.voxel(x0, y0, z0, color, options)
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps
      this.box(
        x0 + (x1 - x0) * t,
        y0 + (y1 - y0) * t,
        z0 + (z1 - z0) * t,
        thickness,
        thickness,
        thickness,
        color,
        options,
      )
    }
    return this
  }

  /** 方形环（用体素拼出的"圆"），用于齿轮 / 数据库 / 雷达盘 */
  ring(centerX, y, centerZ, radius, color, { thickness = 1, steps = 24, options = {} } = {}) {
    for (let i = 0; i < steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2
      this.box(
        centerX + Math.cos(angle) * radius,
        y,
        centerZ + Math.sin(angle) * radius,
        thickness,
        thickness,
        thickness,
        color,
        options,
      )
    }
    return this
  }

  /** 阶梯圆锥 / 方尖（塔、机头、盾牌底座等） */
  stack(baseX, baseY, baseZ, layers, color, options = {}) {
    let y = baseY
    for (const layer of layers) {
      this.box(baseX + (layer.dx || 0), y + layer.h / 2, baseZ + (layer.dz || 0), layer.w, layer.h, layer.d, color, {
        ...options,
        ...(layer.options || {}),
      })
      y += layer.h
    }
    return this
  }

  /**
   * 生成 Group。blocks 按材质签名分桶后合并几何。
   */
  build() {
    const group = new THREE.Group()
    const buckets = new Map()

    for (const block of this.blocks) {
      const key = [
        block.color,
        block.glow ?? 0,
        block.emissive ?? block.color,
        block.opacity ?? 1,
        block.metalness ?? 0.35,
        block.roughness ?? 0.72,
      ].join('|')

      if (!buckets.has(key)) {
        buckets.set(key, {
          material: makeMaterial({
            color: block.color,
            glow: block.glow ?? 0,
            emissive: block.emissive,
            opacity: block.opacity ?? 1,
            metalness: block.metalness ?? 0.35,
            roughness: block.roughness ?? 0.72,
          }),
          geometries: [],
        })
      }

      const geometry = (block.shape === 'plane' ? UNIT_PLANE : UNIT_BOX).clone()
      const matrix = new THREE.Matrix4()
      const quaternion = new THREE.Quaternion()
      quaternion.setFromEuler(new THREE.Euler(block.rx || 0, block.ry || 0, block.rz || 0))
      matrix.compose(
        new THREE.Vector3(block.x * this.unit, block.y * this.unit, block.z * this.unit),
        quaternion,
        new THREE.Vector3(block.w * this.unit, block.h * this.unit, block.d * this.unit),
      )
      geometry.applyMatrix4(matrix)
      buckets.get(key).geometries.push(geometry)
    }

    const materials = []
    for (const { material, geometries } of buckets.values()) {
      const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false)
      if (merged) {
        const mesh = new THREE.Mesh(merged, material)
        mesh.matrixAutoUpdate = false
        group.add(mesh)
        materials.push(material)
      }
      if (geometries.length > 1) {
        for (const geometry of geometries) geometry.dispose()
      }
    }

    group.userData.materials = materials
    return group
  }
}

export function createVoxelBuilder(unit = 0.5) {
  return new VoxelBuilder(unit)
}

/** 把多段几何合并为单个 BufferGeometry，供 InstancedMesh 之外的自定义网格使用 */
export function mergeAll(geometries) {
  if (!geometries.length) return null
  if (geometries.length === 1) return geometries[0]
  const merged = mergeGeometries(geometries, false)
  for (const geometry of geometries) geometry.dispose()
  return merged
}

export { UNIT_BOX }
