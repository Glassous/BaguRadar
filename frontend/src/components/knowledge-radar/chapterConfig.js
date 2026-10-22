// 16 个章节在 3D 地形上的布防配置。
// 坐标使用世界单位：x 向东、z 向南，海平面 y = 0。
// 目标最终的 y 由 terrain.js 的 terrainHeight() 决定，这里只保存平面坐标与抬升量。

export const CHAPTER_TARGETS = [
  // ---------- 中央主峰 ----------
  {
    id: '00-foundation',
    zone: 'peak',
    x: -8,
    z: -32,
    lift: 0,
    model: 'antenna',
    accent: 0x5eead4,
    scale: 1.15,
    tagline: 'OS / 组成 / 网络 / 算法',
  },
  {
    id: '01-language',
    zone: 'peak',
    x: 9,
    z: -27,
    lift: 0,
    model: 'pylon',
    accent: 0x34d399,
    scale: 1,
    tagline: '9 门语言 · 运行时',
  },
  {
    id: '02-backend',
    zone: 'peak',
    x: 17,
    z: -8,
    lift: 0,
    model: 'mainframe',
    accent: 0x2dd4bf,
    scale: 1.1,
    tagline: 'Spring / MySQL / Redis',
  },
  {
    id: '08-interview',
    zone: 'peak',
    x: 9,
    z: 12,
    lift: 0,
    model: 'dome',
    accent: 0x5eead4,
    scale: 1,
    tagline: '算法模板 · 系统设计',
  },
  {
    id: '13-engineering',
    zone: 'peak',
    x: -33,
    z: -8,
    lift: 0,
    model: 'crane',
    accent: 0x99f6e4,
    scale: 0.95,
    tagline: '协作流程 · 交付效率',
  },
  {
    id: '15-written-exam',
    zone: 'peak',
    x: -26,
    z: -27,
    lift: 0,
    model: 'obelisk',
    accent: 0x2dd4bf,
    scale: 1,
    tagline: '30+ 企业笔试真题',
  },

  // ---------- 边缘城市 ----------
  {
    id: '03-frontend',
    zone: 'city',
    x: 31,
    z: 25,
    lift: 0,
    model: 'browser',
    accent: 0x38bdf8,
    scale: 1.1,
    tagline: '渲染原理 · 工程化',
  },
  {
    id: '04-client',
    zone: 'city',
    x: 46,
    z: 40,
    lift: 0,
    model: 'handheld',
    accent: 0x818cf8,
    scale: 1,
    tagline: 'Android / iOS / Qt',
  },

  // ---------- 海面 / 海底 ----------
  {
    id: '05-distributed',
    zone: 'sea',
    x: 58,
    z: -26,
    lift: 1.4,
    model: 'carrier',
    accent: 0x38bdf8,
    scale: 1.15,
    tagline: '一致性 · 高并发',
  },
  {
    id: '06-cloud-native',
    zone: 'sea',
    x: 72,
    z: 2,
    lift: 2.6,
    model: 'platform',
    accent: 0x22d3ee,
    scale: 1,
    tagline: 'K8s · 可观测性',
  },
  {
    id: '11-data',
    zone: 'sea',
    x: 70,
    z: 24,
    lift: 0.8,
    model: 'buoy',
    accent: 0x60a5fa,
    scale: 1,
    tagline: '数仓 · Spark / Flink',
  },

  // ---------- 峡谷 / 低空 ----------
  {
    id: '09-testing',
    zone: 'canyon',
    x: -36,
    z: 27,
    lift: 0,
    model: 'probe',
    accent: 0xfca5a5,
    scale: 1,
    tagline: '压测 · 混沌工程',
  },
  {
    id: '10-security',
    zone: 'canyon',
    x: -46,
    z: 36,
    lift: 0,
    model: 'cloak',
    accent: 0xf87171,
    scale: 1.05,
    // 隐形目标：中央雷达扫不到，只能靠预警机临空或前置章节完成解锁
    stealth: true,
    tagline: '认证授权 · 密码学',
  },
  {
    id: '12-media-embedded',
    zone: 'canyon',
    x: -26,
    z: 17,
    lift: 0,
    model: 'dish',
    accent: 0xfbbf24,
    scale: 1,
    tagline: '编解码 · WebRTC',
  },

  // ---------- 高空 / 云层 ----------
  {
    id: '07-ai',
    zone: 'sky',
    x: 4,
    z: 28,
    lift: 38,
    model: 'droneCore',
    accent: 0x5eead4,
    scale: 1.2,
    tagline: 'RAG · Agent · 微调',
  },
  {
    id: '14-real-interview',
    zone: 'sky',
    x: 30,
    z: 2,
    lift: 33,
    model: 'holoArk',
    accent: 0xf0abfc,
    scale: 1.1,
    tagline: '大厂面经 · 校招时间线',
  },
]

export const ZONES = {
  peak: { key: 'peak', label: '中央主峰', en: 'CENTRAL RIDGE', color: '#5eead4' },
  city: { key: 'city', label: '边缘城市', en: 'EDGE MEGACITY', color: '#38bdf8' },
  sea: { key: 'sea', label: '海面 / 海底', en: 'OCEAN SECTOR', color: '#22d3ee' },
  canyon: { key: 'canyon', label: '峡谷低空', en: 'CANYON DEPTH', color: '#f87171' },
  sky: { key: 'sky', label: '高空云层', en: 'HIGH ALTITUDE', color: '#fbbf24' },
}

// 假目标（杂波）：被雷达扫到时只提示"错题警告"，不可进入
export const NOISE_TARGETS = [
  { x: -26, z: 12, scale: 0.85 },
  { x: 20, z: 14, scale: 0.7 },
  { x: 46, z: 44, scale: 0.8 },
  { x: -52, z: 14, scale: 0.75 },
  { x: 18, z: -30, scale: 0.9 },
]

export function resolveTargets(chapters) {
  const byId = new Map((chapters || []).map((chapter) => [chapter.id, chapter]))
  return CHAPTER_TARGETS.map((config, index) => {
    const chapter = byId.get(config.id) || null
    return {
      ...config,
      index,
      chapter,
      title: chapter?.title || config.id,
      description: chapter?.description || '',
      docCount: chapter?.docCount || 0,
      firstRoute: chapter?.firstRoute || '',
    }
  })
}
