import { tuning, currentTier } from './tuning.js?v=19'
import { createShot, RECEIVE_TY } from './ball.js?v=19'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function sideGap() {
  return Math.max(0, tuning.minSide ?? 0.25)
}

// Keep a landing off the center strip. A zero result keeps the intended side.
function clearOfCenter(tx, fallbackSign) {
  const min = sideGap()
  if (Math.abs(tx) >= min) return tx
  const sign = tx < 0 ? -1 : tx > 0 ? 1 : fallbackSign < 0 ? -1 : 1
  return sign * min
}

export function pickKind(tier = currentTier(), spinsUsed = 0) {
  const mix = { ...(tier.shotMix || { flat: 1, float: 0, spin: 0 }) }
  if (tier.spinCap > 0 && spinsUsed >= tier.spinCap) mix.spin = 0
  const order = ['flat', 'float', 'spin']
  const total = order.reduce((sum, key) => sum + Math.max(0, mix[key] || 0), 0)
  if (total <= 0) return 'flat'
  let roll = Math.random() * total
  for (const key of order) {
    roll -= Math.max(0, mix[key] || 0)
    if (roll <= 0) return key
  }
  return 'flat'
}

// A float hangs on the far side. A spin bounces opposite the landing, with time left to read it.
export function applyKind(spec, kind) {
  const shots = tuning.shots
  if (kind === 'float') {
    spec.bounceAt = shots.floatBounceAt
    spec.flightTime *= shots.floatTime
  } else if (kind === 'spin') {
    const sign = spec.to.tx < 0 ? 1 : -1
    spec.bounce.tx = sign * Math.max(sideGap(), shots.spinBounce)
    spec.bounceAt = shots.spinBounceAt
    const after = Math.max(0.05, 1 - spec.bounceAt)
    if (spec.flightTime * after < 0.3) spec.flightTime = 0.3 / after
  }
  spec.kind = kind || 'flat'
  return spec
}

export function planServe(tier = currentTier(), spinsUsed = 0) {
  const sign = Math.random() < 0.5 ? -1 : 1
  const tx = clamp(sign * (sideGap() + Math.random() * tier.serveSpread), -0.86, 0.86)
  const side = tx < 0 ? 'L' : 'R'
  const bounceTy = -0.26 - Math.random() * 0.38
  const shot = createShot(applyKind({
    from: { tx: side === 'L' ? -0.26 : 0.26, ty: 1.28 },
    fromH: 0.46,
    bounce: { tx, ty: bounceTy },
    to: { tx: clamp(tx * 1.08, -0.95, 0.95), ty: RECEIVE_TY.player },
    flightTime: tier.flightTime * 1.06,
    apex: 0.98,
    hop: 0.5,
    bounceAt: 0.5,
    delay: tuning.contactDelay,
  }, pickKind(tier, spinsUsed)))
  return { side, shot }
}

export function buildPlayerShot({ quality, from, fromH, aiSide, rallySpeed, tier }) {
  const ret = tuning.returns[quality]
  const corner = aiSide === 'L' ? 0.9 : -0.9
  const jitter = (Math.random() * 2 - 1) * 0.04
  const tx = clamp(corner * ret.place + jitter, -0.92, 0.92)
  return createShot({
    from,
    fromH: fromH ?? 0.3,
    bounce: { tx, ty: 0.2 + Math.random() * 0.4 },
    to: { tx: clamp(tx * 1.05, -0.95, 0.95), ty: RECEIVE_TY.ai },
    flightTime: tier.flightTime / (ret.speed * rallySpeed),
    apex: ret.apex,
    hop: ret.hop,
    bounceAt: 0.5,
  })
}

// Drain scales with rally speed. A negative cost restores and ignores tempo.
export function nextStamina(current, quality, rallySpeed, max) {
  const table = tuning.stamina
  const raw = table[quality] ?? 0
  const tempo = 1 + Math.max(0, rallySpeed - 1) * (table.speedScale ?? 1)
  const delta = raw > 0 ? raw * tempo : raw
  return clamp(current - delta, 0, max)
}

// 0 above the threshold. Below it, ramps to the tier's desperation as stamina empties.
export function desperationUrge(stamina, max, tier) {
  const lowAt = tuning.stamina.lowAt ?? 0.33
  const cap = tier.desperation ?? 0
  if (cap <= 0 || max <= 0 || lowAt <= 0) return 0
  const ratio = stamina / max
  if (ratio >= lowAt) return 0
  const depth = 1 - ratio / lowAt
  return cap * depth
}

// Decided when the player hits, so the opponent can start the swing on time.
// `hit` is certain while any stamina remains. Desperation only changes the return.
export function planReturn({ tier, quality, playerSide, rallySpeed, incomingTx, stamina, max, spinsUsed = 0 }) {
  const side = incomingTx < 0 ? 'L' : 'R'
  const hit = stamina > 0
  const urge = desperationUrge(stamina, max ?? tier.stamina, tier)
  // A weak return is a free ball: the opponent steps in and smashes it.
  const punish = quality === 'weak'
  let smashChance = punish ? Math.min(0.95, 0.55 + tier.smashRate) : tier.smashRate
  smashChance = Math.min(0.95, smashChance + urge * (0.95 - smashChance))
  const smash = hit && Math.random() < smashChance
  let accuracy = punish ? Math.max(tier.cornerAccuracy, 0.8) : tier.cornerAccuracy
  accuracy = clamp(accuracy + urge * (1 - accuracy), 0, 1)

  const away = playerSide === 'L' ? 0.9 : -0.9
  const corner = Math.random() < (tier.wrongFoot || 0) ? -away : away
  const noise = (Math.random() * 2 - 1) * (1 - accuracy) * 0.8
  let tx = corner * (0.4 + 0.6 * accuracy) + noise
  if (smash) tx *= 1.08
  tx = clearOfCenter(clamp(tx, -0.93, 0.93), corner)
  const bounceTx = clearOfCenter(clamp(tx * 0.92, -0.88, 0.88), corner)

  const speed = (smash ? 1.36 : 1) * (1 + urge * 0.28)
  const returnShot = createShot(applyKind({
    from: { tx: incomingTx, ty: RECEIVE_TY.ai },
    fromH: 0.3,
    bounce: { tx: bounceTx, ty: -0.2 - Math.random() * 0.42 },
    to: { tx, ty: RECEIVE_TY.player },
    flightTime: tier.flightTime / (Math.max(1, rallySpeed) * speed),
    apex: smash ? 0.52 : 0.86,
    hop: smash ? 0.32 : 0.48,
    bounceAt: 0.48,
  }, pickKind(tier, spinsUsed)))
  return { hit, side, smash, speed, returnShot }
}
