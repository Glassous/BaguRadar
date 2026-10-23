import { createVoxelBuilder } from './voxelBuilder'

// ---------------------------------------------------------------------------
// 章节目标的体素造型库：每个章节用一个"一眼可辨"的体素微缩模型。
// 坐标单位为体素格（0.5 世界单位），模型底面位于 y = 0，正面朝 +Z。
// ---------------------------------------------------------------------------

// 单个体素格的世界尺寸：让载体相对地形体素（1.8）保持可辨认的体积感
const MODEL_UNIT = 0.72

const SHELL = 0x27505c // 主体外壳
const SHELL_DARK = 0x16333a // 深色结构
const TRIM = 0x3d7f8c // 亮边 / 结构件
const LIGHT = 0x9fe8dc // 高光体素

function body(overrides = {}) {
  return { metalness: 0.5, roughness: 0.62, ...overrides }
}

// ---------------------------------------------------------------------------
// 中央主峰 6 章
// ---------------------------------------------------------------------------
const BUILDERS = {
  // 00 计算机基础：体素台式工作站（显示器 + 键盘 + 主机塔）
  antenna(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)

    // 机体平台
    v.box(0, 0.4, 0.4, 13, 0.8, 9, SHELL_DARK)
    v.box(0, 0.95, 0.4, 12, 0.3, 8, TRIM)

    // 显示器：外框 + 发光屏幕 + 屏幕内容
    v.box(0, 5.4, -2.6, 9.6, 7.2, 1.2, SHELL)
    v.box(0, 5.4, -1.85, 8.2, 6, 0.4, accent, { glow: 0.5, metalness: 0.1, roughness: 0.4 })
    v.box(-0.6, 7.2, -1.6, 6.4, 0.35, 0.2, 0x08181d)
    v.box(-1.6, 5.6, -1.6, 4.4, 0.3, 0.2, 0x08181d)
    v.box(1.8, 4.2, -1.6, 2.6, 0.3, 0.2, 0x08181d)
    v.box(-2.4, 3.4, -1.6, 3.6, 1.1, 0.16, LIGHT, { glow: 0.35 })

    // 立柱与底座
    v.box(0, 2.1, -2.6, 1.2, 2, 1.2, TRIM)
    v.box(0, 1.15, -2.6, 4.4, 0.4, 3.4, SHELL)

    // 键盘
    v.box(0.8, 1.25, 2.4, 8.6, 0.45, 3.2, SHELL)
    for (let i = 0; i < 5; i += 1) {
      v.box(0.8, 1.55, 1.3 + i * 0.55, 7.6, 0.2, 0.26, accent, { glow: 0.35 })
    }

    // 主机塔 + 指示灯
    v.box(-5.4, 3.2, -1.8, 2.4, 5.6, 4.2, SHELL)
    v.box(-5.4, 4.6, 0.4, 1.5, 0.42, 0.2, accent, { glow: 1.1 })
    v.box(-5.4, 3.4, 0.4, 1.5, 0.42, 0.2, accent, { glow: 0.4 })
    v.box(-5.4, 2.2, 0.4, 1.5, 0.42, 0.2, 0x7ef2d9, { glow: 0.25 })
    return v.build()
  },

  // 01 语言与运行时：体素书塔（多语言封面 + 发光书脊）
  pylon(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)
    const covers = [0x123f3c, 0x1d3a52, 0x2b3f22, 0x3a2a3f, 0x22404a, 0x2c3a1e]
    let y = 0.7
    for (let i = 0; i < 6; i += 1) {
      const w = 8.2 - i * 0.32
      const d = 5.6 - i * 0.2
      const dx = (i % 2 === 0 ? 1 : -1) * (0.45 + i * 0.1)
      const dz = (i % 3 === 0 ? 1 : -1) * 0.35
      v.box(dx, y, dz, w, 1.15, d, covers[i], { ...body(), ry: (i % 2 === 0 ? 1 : -1) * 0.08 })
      v.box(dx - w / 2 + 0.1, y, dz, 0.3, 1.0, d - 0.5, accent, { glow: 0.85 })
      v.box(dx, y + 0.62, dz, w - 1.4, 0.16, d - 0.9, LIGHT, { glow: 0.12 })
      y += 1.24
    }

    // 书塔底座
    v.box(0, 0.25, 0, 9.6, 0.5, 7, SHELL_DARK)
    v.box(0, 0.55, 0, 9.2, 0.14, 6.6, TRIM)

    // 顶部悬浮的"代码块"
    v.box(0, y + 1.3, 0, 2.2, 2.2, 2.2, accent, { glow: 0.6, metalness: 0.2 })
    v.box(0, y + 1.3, 0, 3.1, 0.2, 3.1, LIGHT, { glow: 0.5 })
    v.box(0, y + 2.9, 0, 1.2, 0.9, 1.2, LIGHT, { glow: 0.9 })
    return v.build()
  },

  // 02 后端与中间件：机柜阵列 + 指示灯带
  mainframe(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)
    v.box(0, 0.3, 0, 13, 0.6, 7, SHELL_DARK)
    v.box(0, 0.68, 0, 12.4, 0.16, 6.4, TRIM)

    for (let r = 0; r < 3; r += 1) {
      const cx = (r - 1) * 3.6
      v.box(cx, 4.6, 0, 3, 7.6, 3.6, SHELL)
      v.box(cx, 8.55, 0, 3.2, 0.35, 3.8, TRIM)
      // 前面板：5 组灯带 + 通风槽
      for (let i = 0; i < 5; i += 1) {
        const y = 1.9 + i * 1.35
        v.box(cx, y, 1.85, 2.3, 0.3, 0.18, accent, { glow: i % 2 === 0 ? 1.2 : 0.45 })
        v.box(cx, y - 0.5, 1.85, 2.3, 0.5, 0.14, 0x0a1c22)
      }
      // 顶部散热风扇
      v.ring(cx, 8.85, 0, 1.1, accent, { thickness: 0.3, steps: 12, options: { glow: 0.4 } })
    }

    // 走线槽
    v.box(0, 9.1, 0, 11.6, 0.4, 0.7, TRIM)
    v.box(0, 9.35, 0, 11.6, 0.16, 0.3, accent, { glow: 0.5 })
    return v.build()
  },

  // 08 面试实战：体素奖杯（指挥穹顶 → 冠军奖杯）
  dome(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)
    // 基座
    v.box(0, 0.5, 0, 8, 1, 8, SHELL_DARK)
    v.box(0, 1.15, 0, 6.4, 0.35, 6.4, TRIM)
    v.box(0, 1.7, 0, 4.6, 0.75, 4.6, SHELL)
    // 颈部
    v.box(0, 2.7, 0, 2, 1.3, 2, TRIM)
    v.box(0, 3.55, 0, 3.4, 0.5, 3.4, SHELL)
    // 杯体：逐层外扩
    v.box(0, 4.5, 0, 4.6, 1.4, 4.6, SHELL, { glow: 0.08 })
    v.box(0, 5.9, 0, 6, 1.4, 6, SHELL, { glow: 0.08 })
    v.box(0, 7.1, 0, 6.8, 0.9, 6.8, TRIM)
    // 杯口发光环
    v.ring(0, 7.7, 0, 3.2, accent, { thickness: 0.35, steps: 20, options: { glow: 1 } })
    // 把手
    for (const dir of [-1, 1]) {
      v.box(dir * 4.1, 5.6, 0, 0.8, 3.2, 0.8, TRIM)
      v.box(dir * 4.1, 7.2, 0, 0.8, 0.8, 3.2, TRIM)
      v.box(dir * 4.1, 4.2, 0, 0.8, 0.8, 3.2, TRIM)
    }
    // 杯内发光核心
    v.box(0, 7.2, 0, 4.4, 0.3, 4.4, accent, { glow: 0.6, metalness: 0.1 })
    v.box(0, 8.6, 0, 1.6, 1.6, 1.6, LIGHT, { glow: 0.9 })
    return v.build()
  },

  // 13 工程效能：体素龙门吊 + 集装箱
  crane(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)
    v.box(0, 0.3, 0, 15, 0.6, 8, SHELL_DARK)

    // 四条支腿
    for (const x of [-5.4, 5.4]) {
      for (const z of [-2.6, 2.6]) {
        v.box(x, 4.2, z, 0.9, 7.2, 0.9, TRIM)
        v.box(x, 1.1, z, 2.2, 0.6, 2.2, SHELL)
      }
      // 侧向斜撑
      v.box(x, 6.4, 0, 0.6, 0.6, 5.2, TRIM)
      v.box(x, 3.4, 0, 0.5, 0.5, 5.2, SHELL)
    }

    // 主梁
    v.box(0, 8.1, -2.6, 13.2, 0.9, 0.9, TRIM)
    v.box(0, 8.1, 2.6, 13.2, 0.9, 0.9, TRIM)
    v.box(0, 8.45, 0, 13.6, 0.5, 6.4, SHELL)
    v.box(0, 8.8, 0, 12.4, 0.2, 0.5, accent, { glow: 0.6 })

    // 吊钩
    v.box(2.6, 7.2, 0, 0.25, 2, 0.25, accent, { glow: 0.7 })
    v.box(2.6, 5.9, 0, 1.6, 0.7, 1.6, SHELL, { glow: 0.1 })
    v.box(2.6, 5.4, 0, 0.9, 0.35, 0.9, accent, { glow: 0.5 })

    // 地面集装箱
    const crates = [
      [-3.4, 1.45, 0.4, 4.6, 2.1, 3.2, 0x1d4a52],
      [1.2, 1.45, -1.6, 4.6, 2.1, 3.2, 0x264a3c],
      [1.2, 3.35, -1.6, 4.2, 1.7, 2.8, 0x2c3f52],
    ]
    for (const [x, y, z, w, h, d, c] of crates) {
      v.box(x, y, z, w, h, d, c, body())
      v.box(x, y + h * 0.28, z + d / 2 + 0.06, w - 0.7, 0.18, 0.12, accent, { glow: 0.45 })
    }
    return v.build()
  },

  // 15 笔试真题：体素答题板 + 试卷 + 铅笔
  obelisk(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)
    // 桌面与试卷堆
    v.box(0, 0.3, 0, 11, 0.6, 8, SHELL_DARK)
    for (let i = 0; i < 3; i += 1) {
      v.box(-0.4 + i * 0.2, 0.75 + i * 0.45, 0.2, 9.4, 0.4, 6, 0xbfe6dd, {
        glow: 0.06,
        metalness: 0.05,
        roughness: 0.9,
      })
    }

    // 立起来的答题板
    v.box(0, 5.4, -2, 9.6, 7.4, 0.7, SHELL, { rx: -0.12 })
    v.box(0, 5.4, -1.55, 8.6, 6.6, 0.3, 0xd8f3ec, {
      rx: -0.12,
      glow: 0.04,
      metalness: 0.02,
      roughness: 0.95,
    })
    // 标题栏 + 题目行
    v.box(0, 8.2, -1.35, 7.4, 0.6, 0.16, accent, { glow: 0.6 })
    for (let i = 0; i < 4; i += 1) {
      v.box(-0.8, 6.8 - i * 0.85, -1.35, 5.6 - (i % 2) * 1.6, 0.3, 0.14, 0x184247)
    }
    // 打勾
    v.box(-2.3, 2.6, -1.3, 1.2, 0.35, 0.2, accent, { glow: 1, rz: -0.7 })
    v.box(-1.5, 2.1, -1.3, 1.2, 0.35, 0.2, accent, { glow: 1, rz: 0.8 })
    v.box(-0.6, 3, -1.3, 2.4, 0.4, 0.2, accent, { glow: 1, rz: 0.6 })

    // 铅笔
    v.box(4.2, 1.3, 2.4, 0.8, 0.5, 6.4, 0x2c6f5e, { ry: 0.35 })
    v.box(4.2, 1.3, 5.6, 0.8, 0.5, 0.8, accent, { glow: 0.8, ry: 0.35 })
    return v.build()
  },

  // -------------------------------------------------------------------------
  // 边缘城市 2 章
  // -------------------------------------------------------------------------

  // 03 前端：体素浏览器窗口（双层窗口 + 发光页面骨架）
  browser(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)

    // 背后的次级窗口
    v.box(-2.6, 5.2, -3, 8, 6, 0.7, SHELL_DARK, { ry: 0.2 })
    v.box(-2.6, 7.6, -2.6, 7, 0.9, 0.2, 0x2a5a63, { ry: 0.2 })
    v.box(-2.6, 5, -2.55, 6.4, 3.6, 0.14, 0x14353d, { ry: 0.2 })

    // 主窗口外框
    v.box(0.8, 5.6, 0, 12, 8.4, 0.8, SHELL)
    v.box(0.8, 9.4, 0.55, 11.2, 1.2, 0.25, TRIM)
    for (let i = 0; i < 3; i += 1) {
      v.box(-4.2 + i * 0.85, 9.4, 0.75, 0.45, 0.45, 0.2, accent, { glow: 0.9 })
    }
    // 地址栏
    v.box(1.2, 9.4, 0.78, 0.4, 0.2, 0.18, LIGHT, { glow: 0.4 })

    // 页面内容：侧栏 + 内容块
    v.box(0.8, 5.8, 0.55, 11.2, 6.2, 0.12, 0x0d2a31)
    v.box(-3.6, 5.8, 0.72, 2.4, 6, 0.2, 0x16424b)
    for (let i = 0; i < 4; i += 1) {
      v.box(-3.6, 7.8 - i * 1.1, 0.85, 1.7, 0.3, 0.14, accent, { glow: 0.22 })
    }
    v.box(2.4, 8.3, 0.72, 6, 1.1, 0.2, accent, { glow: 0.45 })
    v.box(2.4, 6.8, 0.72, 6, 0.4, 0.18, LIGHT, { glow: 0.12 })
    v.box(2.4, 5.9, 0.72, 3.6, 0.4, 0.18, LIGHT, { glow: 0.12 })
    v.box(4.9, 3.6, 0.72, 3, 2.2, 0.2, TRIM)
    v.box(4.9, 3.6, 0.86, 2.2, 1.5, 0.14, accent, { glow: 0.3 })

    // 光标
    v.box(3.4, 2.6, 1.4, 0.7, 1.8, 0.3, LIGHT, { glow: 0.85, rz: -0.5 })
    v.box(3.9, 1.85, 1.4, 1.2, 0.5, 0.3, LIGHT, { glow: 0.85 })

    // 支撑底柱
    v.box(0.8, 0.6, 0, 3.2, 1.2, 3.2, SHELL)
    v.box(0.8, 1.35, 0, 2.2, 0.4, 2.2, TRIM)
    return v.build()
  },

  // 04 客户端：体素智能手机（App 图标网格 + 悬浮感底座）
  handheld(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)

    // 底座
    v.box(0, 0.35, 0, 6.2, 0.7, 5.6, SHELL_DARK)
    v.ring(0, 0.75, 0, 2.6, accent, { thickness: 0.3, steps: 18, options: { glow: 0.55 } })
    v.box(0, 1.1, 0, 1.6, 0.9, 1.6, TRIM)

    // 机身
    v.box(0, 6.4, 0, 5.4, 10.4, 1, SHELL)
    // 屏幕
    v.box(0, 6.5, 0.6, 4.4, 8.6, 0.24, 0x0c2830)
    v.box(0, 9.9, 0.62, 4.2, 1.4, 0.3, accent, { glow: 0.35, metalness: 0.1 })
    v.box(0, 10.3, 0.78, 1.6, 0.5, 0.16, SHELL_DARK)

    // App 图标网格
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        v.box(-1.35 + col * 1.35, 8.4 - row * 1.35, 0.74, 0.85, 0.85, 0.14, accent, {
          glow: (row + col) % 2 === 0 ? 0.75 : 0.25,
          metalness: 0.1,
        })
      }
    }
    // 底部 Dock + Home 指示条
    v.box(0, 3.6, 0.72, 3.9, 0.9, 0.16, 0x16424b)
    v.box(0, 3.6, 0.82, 3.2, 0.2, 0.1, accent, { glow: 0.35 })
    v.box(0, 2.35, 0.76, 1.8, 0.22, 0.1, LIGHT, { glow: 0.4 })

    // 侧键 / 摄像头
    v.box(-2.75, 8.6, 0, 0.28, 1.4, 0.5, TRIM)
    v.box(2.75, 7.4, 0, 0.28, 1.8, 0.5, TRIM)
    v.box(1.4, 10.7, 0.1, 0.4, 0.4, 0.4, LIGHT, { glow: 0.6 })
    return v.build()
  },

  // -------------------------------------------------------------------------
  // 海面 / 海底 3 章
  // -------------------------------------------------------------------------

  // 05 分布式：体素航空母舰（飞行甲板 + 舰岛 + 舰载机）
  carrier(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)
    const hull = 0x14333d
    const deck = 0x1d4450

    // 船体：中部主箱 + 两步收窄的舰艏
    v.box(0, 1.3, 0, 14, 2.6, 4.6, hull, body())
    v.box(6.9, 1.35, 0, 1.4, 1.9, 3.6, hull, body())
    v.box(8.1, 1.45, 0, 1.2, 1.2, 2.2, hull, body())
    v.box(8.9, 1.5, 0, 0.7, 0.7, 1.2, hull, body())
    // 舰尾
    v.box(-7.4, 1.4, 0, 1.2, 1.7, 4, hull, body())

    // 飞行甲板
    v.box(0, 2.85, 0, 16.6, 0.5, 5.4, deck)
    v.box(0, 3.15, 0, 16, 0.12, 4.8, TRIM)
    // 甲板中线虚线
    for (let i = 0; i < 6; i += 1) {
      v.box(-6 + i * 2.2, 3.2, 1.4, 1.1, 0.12, 0.5, accent, { glow: 0.8 })
    }
    // 着陆引导灯
    for (let i = 0; i < 4; i += 1) {
      v.box(-7.6 + i * 1.4, 3.2, -2, 0.5, 0.14, 0.5, LIGHT, { glow: 0.7 })
    }

    // 舰岛
    v.box(-2.6, 4.4, -1.6, 2.2, 3, 1.8, deck)
    v.box(-2.6, 5.1, -0.62, 2, 0.5, 0.24, LIGHT, { glow: 0.55 })
    v.box(-2.6, 5.6, -0.62, 1.6, 0.7, 0.4, accent, { glow: 0.45 })
    v.box(-2.6, 6.4, -1.6, 1.4, 0.9, 1.2, TRIM)
    v.box(-2.6, 7.4, -1.6, 0.3, 1.6, 0.3, TRIM)
    v.box(-2.6, 8.3, -1.6, 0.5, 0.5, 0.5, accent, { glow: 1 })
    // 相控阵板
    v.box(-2.6, 4.4, -0.68, 1.8, 1.8, 0.2, accent, { glow: 0.22 })

    // 舰载机 ×2
    for (const [x, z] of [
      [1.4, 1.2],
      [4.6, -1.2],
    ]) {
      v.box(x, 3.45, z, 2.4, 0.35, 0.7, 0x9ad9d0, { glow: 0.15 })
      v.box(x, 3.72, z, 0.9, 0.4, 0.9, TRIM)
      v.box(x + 1.3, 3.55, z, 0.6, 0.2, 0.6, LIGHT, { glow: 0.5 })
    }

    // 舰底发光龙骨
    v.box(0, 0.1, 0, 14, 0.3, 4.2, accent, { glow: 0.35, metalness: 0.2 })
    return v.build()
  },

  // 06 云原生：海上集装箱平台（K8s 容器堆 + 龙门架）
  platform(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)
    const steel = 0x1a3a44

    // 立柱与甲板
    for (const x of [-4, 4]) {
      for (const z of [-4, 4]) {
        v.box(x, 1.8, z, 1, 3.6, 1, steel)
        v.box(x, 0.35, z, 1.8, 0.7, 1.8, SHELL_DARK)
      }
    }
    v.box(0, 3.9, 0, 11, 0.8, 11, steel)
    v.box(0, 4.4, 0, 10.2, 0.2, 10.2, TRIM)
    // 甲板边框灯带
    v.ring(0, 4.55, 0, 4.7, accent, { thickness: 0.28, steps: 24, options: { glow: 0.55 } })

    // 集装箱两层堆叠
    const containerColors = [0x1d5c52, 0x2a4a6b, 0x3b4a24, 0x5a3a2f]
    const layout = [
      [-2.4, 1.2, 0],
      [0.6, 1.2, 0],
      [-2.4, 1.2, -2.2],
      [0.6, 1.2, -2.2],
      [-1, 0.1, 0],
    ]
    layout.forEach(([x, , z], index) => {
      const color = containerColors[index % containerColors.length]
      v.box(x, 5.7, z, 2.6, 1.9, 1.9, color, body())
      v.box(x, 5.7, z + 0.99, 2.1, 0.22, 0.12, accent, { glow: 0.4 })
    })
    v.box(-2.4, 7.5, 0.2, 2.4, 1.7, 1.8, containerColors[1], body())
    v.box(0.8, 7.5, 0.2, 2.4, 1.7, 1.8, containerColors[0], body())

    // 龙门架（起吊容器）
    v.box(4.2, 6.6, -2.6, 0.6, 4.4, 0.6, TRIM)
    v.box(4.2, 6.6, 2.6, 0.6, 4.4, 0.6, TRIM)
    v.box(4.2, 8.9, 0, 0.8, 0.5, 5.8, TRIM)
    v.box(2.6, 8.9, 0, 3.4, 0.35, 0.6, TRIM)
    v.box(1.1, 8.1, 0, 0.2, 1.4, 0.2, accent, { glow: 0.7 })
    v.box(1.1, 7.3, 0, 1.4, 0.5, 1.4, accent, { glow: 0.35 })

    // 通信桅杆
    v.box(-4.2, 6.6, -3.8, 0.4, 4.4, 0.4, TRIM)
    v.box(-4.2, 9, -3.8, 0.8, 0.5, 0.8, accent, { glow: 1 })
    return v.build()
  },

  // 11 大数据：体素数据库塔（堆叠盘片 + 数据管道）
  buoy(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)

    // 海底基座
    v.box(0, 0.3, 0, 9, 0.6, 9, SHELL_DARK)

    // 三层盘片（十字叠块近似圆柱）
    const tiers = [
      { y: 1.4, w: 8.4, d: 6.6 },
      { y: 3.9, w: 7.4, d: 5.8 },
      { y: 6.4, w: 6, d: 4.6 },
    ]
    tiers.forEach((tier, index) => {
      v.box(0, tier.y, 0, tier.w, 1.1, tier.d, SHELL)
      v.box(0, tier.y, 0, tier.d + 1.6, 1.1, tier.w - 1.2, SHELL)
      v.box(0, tier.y + 0.68, 0, tier.w - 0.8, 0.3, tier.d - 0.8, accent, { glow: 0.7 })
      v.box(0, tier.y + 0.68, 0, tier.d - 0.2, 0.3, tier.w - 1.2, accent, { glow: 0.35 })
      // 盘片间立柱
      if (index < tiers.length - 1) {
        for (const x of [-1.6, 1.6]) {
          v.box(x, tier.y + 1.5, -1.4, 0.5, 1.9, 0.5, TRIM)
          v.box(x, tier.y + 1.5, 1.4, 0.5, 1.9, 0.5, TRIM)
        }
      }
    })

    // 顶部数据管道 + 悬浮数据立方
    v.box(0, 8.2, 0, 2.4, 1.6, 2.4, TRIM)
    v.box(0, 9.4, 0, 1.2, 1.2, 1.2, LIGHT, { glow: 0.9 })
    v.box(0, 10.6, 0, 2.6, 0.4, 2.6, accent, { glow: 0.8 })

    // 侧向流出管道
    v.box(5.2, 5.2, 0, 3.6, 0.6, 0.6, TRIM, { rz: 0.18 })
    v.box(7.4, 5.6, 0, 1.2, 1.2, 1.2, accent, { glow: 0.7 })
    v.box(-4.6, 3.2, 0, 2.8, 0.5, 0.5, TRIM, { rz: -0.2 })
    return v.build()
  },

  // -------------------------------------------------------------------------
  // 峡谷低空 3 章
  // -------------------------------------------------------------------------

  // 09 测试与质量：体素放大镜（镜内一只 Bug）
  probe(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)

    // 探测底盘 + 脉冲环
    v.box(0, 0.3, 0, 12, 0.6, 10, SHELL_DARK)
    v.ring(0, 0.72, 0, 4.6, TRIM, { thickness: 0.5, steps: 20 })
    v.ring(0, 0.78, 0, 2.6, accent, { thickness: 0.28, steps: 16, options: { glow: 0.6 } })

    // 镜框
    v.ring(0, 6.4, 0, 4.1, TRIM, { thickness: 1.2, steps: 26 })
    v.box(0, 6.4, 0, 7.4, 0.12, 7.4, accent, { glow: 0.16, opacity: 0.22, metalness: 0.1 })
    v.box(0, 6.4, 0, 7.4, 7.4, 0.12, accent, { glow: 0.16, opacity: 0.22, metalness: 0.1 })

    // 手柄（体素阶梯）
    v.line(3.1, 4.1, 0, 6.6, 1.1, 0, TRIM, { thickness: 1.3 })
    v.box(6.8, 1.1, 0, 1.8, 1.2, 1.8, SHELL)

    // 镜内 Bug：身体 + 头 + 腿
    v.box(0, 6.2, 0.2, 2.4, 1.6, 1.6, 0xef4444, { glow: 0.55, metalness: 0.1 })
    v.box(0, 7.3, 0.2, 1.4, 1, 1.4, 0xb91c1c, { glow: 0.4, metalness: 0.1 })
    for (let i = 0; i < 3; i += 1) {
      v.box(-1.6 + i * 1.6, 5.6, 0.2, 0.9, 0.22, 0.3, 0x7f1d1d, { glow: 0.2 })
      v.box(-1.6 + i * 1.6, 7.2, 0.2, 0.9, 0.22, 0.3, 0x7f1d1d, { glow: 0.2 })
    }

    // 扫描刻度
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2
      v.box(Math.cos(angle) * 4.1, 8.7, Math.sin(angle) * 4.1, 0.4, 0.9, 0.4, LIGHT, { glow: 0.4 })
    }
    return v.build()
  },

  // 10 安全与密码学：体素盾牌 + 挂锁（默认隐形态）
  cloak(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)

    // 盾牌轮廓：上层宽、下层收成尖角
    const outline = [
      [9.4, 6.4],
      [8.4, 7.6],
      [7.4, 8.2],
      [6.4, 8.2],
      [5.4, 7.4],
      [4.4, 6],
      [3.4, 4.4],
      [2.4, 2.8],
      [1.4, 1.4],
    ]
    for (const [y, w] of outline) {
      v.box(0, y, -0.1, w, 1.05, 1.4, accent, { glow: 0.5, metalness: 0.35 })
      v.box(0, y, 0.62, Math.max(w - 1.4, 0.6), 0.78, 0.2, SHELL_DARK)
    }

    // 底部盾尖
    v.box(0, 0.8, -0.1, 1.6, 0.9, 1.2, accent, { glow: 0.5, metalness: 0.35 })

    // 挂锁：锁梁 + 锁体 + 钥匙孔
    v.box(-1.1, 7.4, 0.9, 0.5, 1.6, 0.5, LIGHT, { glow: 0.6 })
    v.box(1.1, 7.4, 0.9, 0.5, 1.6, 0.5, LIGHT, { glow: 0.6 })
    v.box(0, 8.3, 0.9, 2.7, 0.5, 0.5, LIGHT, { glow: 0.6 })
    v.box(0, 5.9, 1.1, 3.4, 2.6, 0.7, 0x123139, { glow: 0.1 })
    v.box(0, 6.2, 1.5, 0.7, 1.1, 0.3, accent, { glow: 1 })
    v.box(0, 5.3, 1.5, 0.35, 0.7, 0.25, accent, { glow: 0.8 })

    // 能量基座
    v.box(0, 0.3, 0, 7, 0.6, 5.6, SHELL_DARK)
    v.ring(0, 0.68, 0, 3.2, accent, { thickness: 0.24, steps: 16, options: { glow: 0.45 } })
    return v.build()
  },

  // 12 音视频与嵌入式：体素卫星天线 + 摄像机
  dish(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)

    // 三脚架（体素阶梯腿）
    for (let i = 0; i < 3; i += 1) {
      const angle = (i / 3) * Math.PI * 2 + 0.4
      const x = Math.cos(angle) * 3.6
      const z = Math.sin(angle) * 3.6
      v.line(x, 0.5, z, 0, 2.1, 0, TRIM, { thickness: 0.5 })
      v.box(x, 0.35, z, 1.6, 0.7, 1.6, SHELL_DARK)
    }

    // 云台 + 立柱
    v.box(0, 1.4, 0, 2.4, 0.8, 2.4, SHELL)
    v.box(0, 2.4, 0, 1.2, 2, 1.2, TRIM)

    // 抛物面：逐级收窄的体素环
    v.ring(0, 2.5, 0, 5, TRIM, { thickness: 1.1, steps: 28 })
    v.ring(0, 3.3, 0, 3.8, TRIM, { thickness: 1, steps: 22 })
    v.ring(0, 4, 0, 2.6, TRIM, { thickness: 0.9, steps: 16 })
    v.ring(0, 4.6, 0, 1.4, TRIM, { thickness: 0.8, steps: 10 })
    v.box(0, 5, 0, 1.2, 0.8, 1.2, SHELL)
    v.ring(0, 2.6, 0, 5.6, accent, { thickness: 0.2, steps: 30, options: { glow: 0.5 } })

    // 馈源支臂
    v.line(0, 4.9, 0, 0, 7.4, 2.2, TRIM, { thickness: 0.45 })
    v.box(0, 7.6, 2.4, 1.3, 1.3, 1.3, accent, { glow: 1 })
    // 信号弧
    v.ring(0, 7.6, 2.4, 2.6, accent, { thickness: 0.18, steps: 18, options: { glow: 0.5, opacity: 0.7 } })

    // 侧挂摄像机
    v.box(-4.4, 3.8, 0.6, 0.5, 2.4, 0.5, TRIM)
    v.box(-4.4, 5.2, 0.6, 2.4, 1.7, 2, SHELL)
    v.box(-4.4, 5.2, 1.7, 1.2, 1.2, 0.5, accent, { glow: 0.85 })
    v.box(-4.4, 6.3, 0.6, 0.6, 0.5, 1.4, TRIM)
    return v.build()
  },

  // -------------------------------------------------------------------------
  // 高空云层 2 章
  // -------------------------------------------------------------------------

  // 07 AI：体素机器人头部（发光双眼 + 天线 + 悬浮芯片）
  droneCore(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)

    // 悬浮基座
    v.box(0, 0.25, 0, 7, 0.5, 7, SHELL_DARK)
    v.ring(0, 0.62, 0, 3, accent, { thickness: 0.3, steps: 20, options: { glow: 0.6 } })
    v.box(0, 1.4, 0, 2.4, 1.4, 2.4, TRIM)

    // 头部主体（切角体素堆叠）
    v.box(0, 6.4, 0, 8, 5.2, 6.4, SHELL)
    v.box(0, 9.2, 0, 6.4, 1, 5.2, TRIM)
    v.box(0, 3.6, 0, 6.4, 0.9, 5.2, SHELL_DARK)
    for (const sx of [-1, 1]) {
      v.box(sx * 4.1, 7.6, 0, 0.6, 1.8, 5.2, TRIM)
      v.box(sx * 4.3, 6.3, 0, 0.5, 1.6, 1.6, accent, { glow: 0.7, metalness: 0.2 })
    }

    // 面部：黑屏 + 发光双眼 + 视镜
    v.box(0, 6.6, 3.15, 7, 4.4, 0.4, 0x08181d)
    v.box(-1.9, 7.2, 3.3, 1.8, 1.3, 0.3, accent, { glow: 1.4, metalness: 0.1 })
    v.box(1.9, 7.2, 3.3, 1.8, 1.3, 0.3, accent, { glow: 1.4, metalness: 0.1 })
    v.box(0, 5.6, 3.3, 3.2, 0.4, 0.24, accent, { glow: 0.4 })
    for (let i = 0; i < 4; i += 1) {
      v.box(-1.5 + i, 4.8, 3.3, 0.5, 0.6, 0.2, LIGHT, { glow: 0.35 })
    }
    // 顶部摄像头
    v.box(0, 9.9, 1.2, 1.2, 0.9, 1.2, SHELL_DARK)
    v.box(0, 9.9, 1.9, 0.6, 0.6, 0.4, accent, { glow: 1 })

    // 天线
    v.box(2.4, 10.4, -1.4, 0.3, 2.4, 0.3, TRIM)
    v.box(2.4, 11.7, -1.4, 0.6, 0.6, 0.6, accent, { glow: 1 })
    v.box(-2.8, 10.1, -1.6, 0.3, 1.8, 0.3, TRIM)
    v.box(-2.8, 11.1, -1.6, 0.5, 0.5, 0.5, LIGHT, { glow: 0.8 })

    // 悬浮芯片
    v.box(5.6, 8.8, 1.6, 1.6, 0.4, 1.6, accent, { glow: 0.8, ry: 0.5 })
    v.box(-5.6, 7.4, 1.4, 1.3, 0.35, 1.3, LIGHT, { glow: 0.5, ry: -0.4 })
    return v.build()
  },

  // 14 真实面经：体素麦克风 + 对话气泡
  holoArk(accent) {
    const v = createVoxelBuilder(MODEL_UNIT)

    // 底座
    v.box(0, 0.3, 0, 6.8, 0.6, 6.8, SHELL_DARK)
    v.ring(0, 0.66, 0, 2.8, accent, { thickness: 0.26, steps: 18, options: { glow: 0.5 } })
    v.box(0, 1.4, 0, 2.6, 1.6, 2.6, TRIM)

    // 支架
    v.box(0, 4.4, 0, 1.1, 4.8, 1.1, TRIM)
    v.box(0, 6.9, 0, 3.4, 0.6, 3.4, SHELL)
    for (const sx of [-2, 2]) {
      v.box(sx, 8.2, 0, 0.6, 2.6, 0.6, TRIM)
      v.box(sx, 9.5, 0, 0.6, 0.6, 1.4, TRIM)
    }

    // 话筒头
    v.box(0, 9.6, 0, 3.6, 3.4, 3.6, SHELL)
    v.box(0, 11.4, 0, 2.8, 0.7, 2.8, TRIM)
    for (let i = 0; i < 4; i += 1) {
      v.box(0, 8.6 + i * 0.8, 1.85, 3, 0.22, 0.2, accent, { glow: 0.55 })
    }
    v.box(0, 10.3, -1.85, 2.2, 1.6, 0.2, accent, { glow: 0.3 })

    // 对话气泡
    v.box(4.6, 10.4, 0, 6.4, 4, 0.7, SHELL)
    v.box(4.6, 10.4, 0.45, 5.6, 3.2, 0.3, 0x0d2a31)
    for (let i = 0; i < 3; i += 1) {
      v.box(2.8 + i * 1.8, 10.4, 0.6, 0.7, 0.7, 0.24, accent, { glow: 1 })
    }
    // 气泡尾巴
    v.box(2.6, 8.6, 0, 1.2, 0.9, 0.6, SHELL)
    v.box(2, 7.9, 0, 0.8, 0.8, 0.6, SHELL)
    return v.build()
  },
}

export function buildChapterModel(model, accent) {
  const builder = BUILDERS[model] || BUILDERS.antenna
  const group = builder(accent)
  group.name = `chapter-${model}`

  // 统一登记会被高亮改写的材质（锁定发光 / 盲区显形）
  const materials = []
  group.traverse((object) => {
    const list = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of list) {
      if (material && material.emissive && !materials.includes(material)) {
        material.userData.baseEmissive = material.emissive.getHex()
        material.userData.baseIntensity = material.emissiveIntensity
        if (material.transparent) material.userData.baseOpacity = material.opacity
        materials.push(material)
      }
    }
  })
  group.userData.materials = materials
  return group
}

// 杂波 / 错题假目标：一团乱序红色体素碎片
export function buildNoiseTarget(accent = 0xef4444) {
  const v = createVoxelBuilder()
  const seedBlocks = [
    [0, 1.4, 0, 1.4],
    [-1.1, 0.8, 0.6, 1.1],
    [1.2, 2.1, -0.4, 0.9],
    [0.4, 2.9, 0.8, 0.8],
    [-0.8, 2.4, -1.1, 1],
    [1.4, 0.6, 1.2, 0.7],
    [-1.5, 1.9, 0.2, 0.6],
  ]
  seedBlocks.forEach(([x, y, z, s], index) => {
    v.box(x, y, z, s * 1.6, s * 1.6, s * 1.6, index % 3 === 0 ? accent : 0x3a1212, {
      glow: index % 3 === 0 ? 0.7 : 0.15,
      ry: index * 0.7,
      rz: index * 0.35,
    })
  })
  // 外部线框感：细长的暗红骨架
  for (const axis of ['x', 'y', 'z']) {
    const options = axis === 'x' ? { ry: 0 } : axis === 'y' ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 }
    v.box(0, 1.8, 0, 3.6, 0.12, 0.12, 0x7f1d1d, { ...options, glow: 0.2 })
  }
  const group = v.build()
  group.name = 'noise-target'
  return group
}
