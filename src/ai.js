import { tuning, currentTier } from './tuning.js'
import { createShot, RECEIVE_TY } from './ball.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export function planServe(tier = currentTier()) {
  const tx = clamp((Math.random() * 2 - 1) * tier.serveSpread, -0.86, 0.86)
  const side = tx < 0 ? 'L' : 'R'
  const bounceTy = -0.26 - Math.random() * 0.38
  const shot = createShot({
    from: { tx: side === 'L' ? -0.26 : 0.26, ty: 1.28 },
    fromH: 0.46,
    bounce: { tx, ty: bounceTy },
    to: { tx: clamp(tx * 1.08, -0.95, 0.95), ty: RECEIVE_TY.player },
    flightTime: tier.flightTime * 1.06,
    apex: 0.98,
    hop: 0.5,
    bounceAt: 0.5,
    delay: tuning.contactDelay,
  })
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

// Decided when the player hits, so the opponent can start the swing on time.
// `hit` is rolled now; geometry is where the return will go if they make it.
export function planReturn({ tier, quality, playerSide, rallySpeed, incomingTx }) {
  const side = incomingTx < 0 ? 'L' : 'R'
  const shift = tuning.receiveShift[quality] ?? 0
  let chance = tier.receiveSkill - shift - Math.max(0, rallySpeed - 1) * 0.2
  chance = clamp(chance, 0.05, 0.97)
  const hit = Math.random() < chance
  // A weak return is a free ball: the opponent steps in and smashes it.
  const punish = quality === 'weak'
  const smashChance = punish ? Math.min(0.95, 0.55 + tier.smashRate) : tier.smashRate
  const smash = hit && Math.random() < smashChance
  const accuracy = punish ? Math.max(tier.cornerAccuracy, 0.8) : tier.cornerAccuracy

  const corner = playerSide === 'L' ? 0.9 : -0.9
  const noise = (Math.random() * 2 - 1) * (1 - accuracy) * 0.8
  let tx = corner * (0.4 + 0.6 * accuracy) + noise
  if (smash) tx *= 1.08
  tx = clamp(tx, -0.93, 0.93)

  const speed = smash ? 1.36 : 1
  const returnShot = createShot({
    from: { tx: incomingTx, ty: RECEIVE_TY.ai },
    fromH: 0.3,
    bounce: { tx: clamp(tx * 0.92, -0.88, 0.88), ty: -0.2 - Math.random() * 0.42 },
    to: { tx, ty: RECEIVE_TY.player },
    flightTime: tier.flightTime / (Math.max(1, rallySpeed) * speed),
    apex: smash ? 0.52 : 0.86,
    hop: smash ? 0.32 : 0.48,
    bounceAt: 0.48,
  })
  return { hit, side, smash, returnShot }
}
