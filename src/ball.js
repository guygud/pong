// Table-space simulation.
// tx: -1 left .. 1 right. ty: negative toward the player, positive toward the opponent.
// h: height above the table. Screen position is a perspective projection plus a lift.

export const VIEW = {
  w: 540,
  h: 960,
  cx: 270,
  farY: 356,
  nearY: 590,
  farHalf: 116,
  nearHalf: 196,
}

// Where a shot is struck, just off each baseline, so the paddle and the ball meet.
export const RECEIVE_TY = { player: -1.84, ai: 1.44 }

const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export function createShot(spec) {
  const shot = {
    from: spec.from,
    fromH: spec.fromH ?? 0.28,
    bounce: spec.bounce,
    to: spec.to,
    flightTime: Math.max(0.32, spec.flightTime),
    apex: spec.apex ?? 0.85,
    hop: spec.hop ?? 0.48,
    bounceAt: spec.bounceAt ?? 0.5,
    delay: spec.delay ?? 0,
    kind: spec.kind || 'flat',
    startTime: 0,
    progress: 0,
    bounced: false,
    aiSwung: false,
    aiResolved: false,
    attempted: false,
    aiDecision: null,
  }
  shot.expectedSide = Math.abs(spec.to.tx) < 0.14 ? 'any' : spec.to.tx < 0 ? 'L' : 'R'
  return shot
}

export function shotProgress(shot, simTime) {
  const elapsed = simTime - shot.startTime - shot.delay
  if (elapsed <= 0) return 0
  return elapsed / shot.flightTime
}

export function arrivalTime(shot) {
  return shot.startTime + shot.delay + shot.flightTime
}

export function sampleShot(shot, progress) {
  const p = Math.max(0, progress)
  const b = shot.bounceAt
  let tx
  let ty
  let h
  if (p <= b) {
    const u = b <= 0 ? 1 : p / b
    tx = lerp(shot.from.tx, shot.bounce.tx, u)
    ty = lerp(shot.from.ty, shot.bounce.ty, u)
    const arc = Math.sin(u * Math.PI)
    h = shot.fromH * (1 - u) + arc * shot.apex
  } else {
    const span = Math.max(0.0001, 1 - b)
    const u = (p - b) / span
    if (u <= 1) {
      tx = lerp(shot.bounce.tx, shot.to.tx, u)
      ty = lerp(shot.bounce.ty, shot.to.ty, u)
      // Leaves the table, arcs, and arrives low enough for the paddle to meet it.
      const arc = Math.sin(u * Math.PI)
      h = shot.hop * (0.16 + arc * 0.84)
    } else {
      // Past the hit: keep traveling and drop onto the floor instead of freezing.
      const over = u - 1
      tx = lerp(shot.bounce.tx, shot.to.tx, 1 + over)
      ty = lerp(shot.bounce.ty, shot.to.ty, 1 + over)
      h = Math.max(0, shot.hop * 0.16 * (1 - over * 3.5))
    }
  }
  return { tx, ty, h }
}

export function project(tx, ty, h = 0) {
  const t = (ty + 1) / 2
  const y = lerp(VIEW.nearY, VIEW.farY, t)
  const half = lerp(VIEW.nearHalf, VIEW.farHalf, t)
  const x = VIEW.cx + tx * half
  const depth = clamp(t, 0, 1)
  const lift = h * lerp(158, 96, depth)
  const scale = lerp(1, 0.66, depth)
  return { x, y: y - lift, shadowX: x, shadowY: y, scale, depth }
}

export function tableCorners() {
  return {
    nearL: project(-1, -1, 0),
    nearR: project(1, -1, 0),
    farL: project(-1, 1, 0),
    farR: project(1, 1, 0),
    midL: project(-1, 0, 0),
    midR: project(1, 0, 0),
    farC: project(0, 1, 0),
    nearC: project(0, -1, 0),
  }
}
