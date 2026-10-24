export const CHAPTER_TARGETS = [
  { id: '00-foundation', zone: 'peak', domain: 'ground', x: -35, z: -26, lift: 0, rotation: 0.35, model: 'searchRadar', typeName: '对空搜索雷达站', accent: 0x42d6c5, scale: 1.05, tagline: 'OS / 组成 / 网络 / 算法' },
  { id: '01-language', zone: 'peak', domain: 'ground', x: -14, z: -37, lift: 0, rotation: 0.15, model: 'controlTower', typeName: '机场塔台', accent: 0x55d68b, scale: 0.9, tagline: '9 门语言 · 运行时' },
  { id: '02-backend', zone: 'peak', domain: 'ground', x: 9, z: -28, lift: 0, rotation: -0.45, model: 'launcher', typeName: '导弹发射车', accent: 0xf0b75b, scale: 1, tagline: 'Spring / MySQL / Redis' },
  { id: '03-frontend', zone: 'sky', domain: 'air', x: 31, z: -35, lift: 31, rotation: -0.55, model: 'fighter', typeName: '战斗机', accent: 0x70b7ff, scale: 1, tagline: '渲染原理 · 工程化' },
  { id: '04-client', zone: 'canyon', domain: 'air', x: -43, z: 8, lift: 21, rotation: -0.4, model: 'helicopter', typeName: '直升机', accent: 0xf2c66d, scale: 1, tagline: 'Android / iOS / Qt' },
  { id: '05-distributed', zone: 'sky', domain: 'air', x: 27, z: -4, lift: 37, rotation: -0.65, model: 'awacs', typeName: '预警机', accent: 0xf2c66d, scale: 0.95, tagline: '一致性 · 高并发' },
  { id: '06-cloud-native', zone: 'sea', domain: 'sea', x: 67, z: -24, lift: 0.2, rotation: -0.2, model: 'carrier', typeName: '航空母舰', accent: 0x5aa9e6, scale: 1.05, tagline: 'K8s · 可观测性' },
  { id: '07-ai', zone: 'canyon', domain: 'air', x: -27, z: 16, lift: 26, rotation: -0.7, model: 'drone', typeName: '大型无人机', accent: 0x42d6c5, scale: 0.95, tagline: 'RAG · Agent · 微调' },
  { id: '08-interview', zone: 'sky', domain: 'air', x: 17, z: 30, lift: 32, rotation: -0.8, model: 'transport', typeName: '军用运输机', accent: 0xf0b75b, scale: 0.95, tagline: '算法模板 · 系统设计' },
  { id: '09-testing', zone: 'city', domain: 'ground', x: -43, z: 37, lift: 0, rotation: 0.2, model: 'reconVehicle', typeName: '雷达侦察车', accent: 0x55d68b, scale: 1, tagline: '压测 · 混沌工程' },
  { id: '10-security', zone: 'city', domain: 'ground', x: -24, z: 39, lift: 0, rotation: -0.25, model: 'tank', typeName: '主战坦克', accent: 0xef6a6a, scale: 1, stealth: true, tagline: '认证授权 · 密码学' },
  { id: '11-data', zone: 'sea', domain: 'sea', x: 68, z: 24, lift: 0.2, rotation: 0.15, model: 'destroyer', typeName: '驱逐舰', accent: 0x70b7ff, scale: 1.05, tagline: '数仓 · Spark / Flink' },
  { id: '12-media-embedded', zone: 'peak', domain: 'ground', x: -46, z: -6, lift: 0, rotation: 0.1, model: 'satelliteStation', typeName: '卫星地面站', accent: 0x42d6c5, scale: 0.95, tagline: '编解码 · WebRTC' },
  { id: '13-engineering', zone: 'peak', domain: 'ground', x: -3, z: -7, lift: 0, rotation: -0.45, model: 'mobileCrane', typeName: '移动式起重机', accent: 0xf2c66d, scale: 1, tagline: '协作流程 · 交付效率' },
  { id: '14-real-interview', zone: 'city', domain: 'ground', x: -4, z: 43, lift: 0, rotation: -0.35, model: 'truck', typeName: '军用运输卡车', accent: 0x55d68b, scale: 1.05, tagline: '大厂面经 · 校招时间线' },
  { id: '15-written-exam', zone: 'city', domain: 'ground', x: 19, z: 46, lift: 0, rotation: -0.5, model: 'armoredVehicle', typeName: '轮式装甲车', accent: 0xf0b75b, scale: 1.05, tagline: '30+ 企业笔试真题' },
]

export const ZONES = {
  peak: { key: 'peak', label: '地面设施', en: 'GROUND ARRAY', color: '#42d6c5' },
  city: { key: 'city', label: '地面车队', en: 'VEHICLE COLUMN', color: '#55d68b' },
  sea: { key: 'sea', label: '海面舰队', en: 'NAVAL SECTOR', color: '#5aa9e6' },
  canyon: { key: 'canyon', label: '低空目标', en: 'LOW ALTITUDE', color: '#f0b75b' },
  sky: { key: 'sky', label: '高空目标', en: 'AIR SECTOR', color: '#f2c66d' },
}

export const NOISE_TARGETS = [
  { x: -18, z: 12, scale: 0.75 },
  { x: 19, z: 11, scale: 0.65 },
  { x: 36, z: 43, scale: 0.7 },
  { x: -56, z: 20, scale: 0.7 },
  { x: 16, z: -44, scale: 0.75 },
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
