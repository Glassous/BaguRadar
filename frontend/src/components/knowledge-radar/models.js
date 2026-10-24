import { buildFighter, buildAwacs, buildTransport, buildDrone, buildHelicopter } from './models/aircraft'
import { buildCarrier, buildDestroyer } from './models/vessels'
import { buildLauncher, buildReconVehicle, buildTank, buildCrane, buildTruck, buildArmoredVehicle } from './models/vehicles'
import { buildSearchRadar, buildControlTower, buildSatelliteStation, buildNoiseTarget as buildNoise } from './models/installations'

const BUILDERS = {
  searchRadar: buildSearchRadar,
  controlTower: buildControlTower,
  launcher: buildLauncher,
  fighter: buildFighter,
  helicopter: buildHelicopter,
  awacs: buildAwacs,
  carrier: buildCarrier,
  drone: buildDrone,
  transport: buildTransport,
  reconVehicle: buildReconVehicle,
  tank: buildTank,
  destroyer: buildDestroyer,
  satelliteStation: buildSatelliteStation,
  mobileCrane: buildCrane,
  truck: buildTruck,
  armoredVehicle: buildArmoredVehicle,
}

export function buildChapterModel(model, accent) {
  const builder = BUILDERS[model] || BUILDERS.searchRadar
  const group = builder(accent)
  group.name = `chapter-${model}`
  const materials = []
  group.traverse((object) => {
    const list = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of list) {
      if (material && !materials.includes(material)) {
        material.userData.baseOpacity = material.opacity
        if (material.emissive) {
          material.userData.baseEmissive = material.emissive.getHex()
          material.userData.baseIntensity = material.emissiveIntensity
        }
        materials.push(material)
      }
    }
  })
  group.userData.materials = materials
  return group
}

export function buildNoiseTarget(accent = 0xef6a6a) {
  const group = buildNoise(accent)
  group.name = 'noise-target'
  return group
}
