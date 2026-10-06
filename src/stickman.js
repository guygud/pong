import { tuning } from './tuning.js?v=11'

// Hip positions. Legs hang ~60px below the hip; the head sits ~80px above it.
const STANCE = {
  player: { L: { x: 148, y: 748 }, R: { x: 392, y: 748 } },
  opponent: { L: { x: 156, y: 268 }, R: { x: 392, y: 268 } },
}

const STRIKE_AT = 0.09

function pose(partial) {
  return {
    lean: 0,
    lunge: 0,
    hop: 0,
    drop: 0,
    legL: 16,
    kneeL: 12,
    legR: -14,
    kneeR: 10,
    armL: 120,
    elbowL: 14,
    armR: 46,
    elbowR: 20,
    paddle: -10,
    ...partial,
  }
}

const CLIPS = {
  player: {
    idle: {
      dur: 1.1,
      loop: true,
      keys: [
        { t: 0, pose: pose({ lean: 7, armR: 40, armL: 78 }) },
        { t: 0.55, pose: pose({ lean: 3, hop: -3, armR: 52, armL: 92, legL: 20, legR: -10 }) },
        { t: 1.1, pose: pose({ lean: 7, armR: 40, armL: 78 }) },
      ],
    },
    swing: {
      dur: 0.32,
      loop: false,
      keys: [
        { t: 0, pose: pose({ lean: -16, armR: -24, elbowR: 48, paddle: -40, armL: 150 }) },
        {
          t: 0.09,
          pose: pose({
            lean: 20,
            lunge: 18,
            armR: 168,
            elbowR: -6,
            paddle: 28,
            armL: 64,
            elbowL: 22,
            legL: 26,
            kneeL: 22,
          }),
        },
        {
          t: 0.2,
          pose: pose({ lean: 8, lunge: 8, armR: 204, elbowR: 24, paddle: 55, armL: 80 }),
        },
        { t: 0.32, pose: pose({ lean: 6, armR: 44, armL: 124 }) },
      ],
    },
    cheer: {
      dur: 0.45,
      loop: false,
      keys: [
        { t: 0, pose: pose({ hop: -16, armL: 206, elbowL: -16, armR: 214, elbowR: -8, paddle: 20, legL: 8, legR: -8 }) },
        { t: 0.2, pose: pose({ hop: 0, armL: 196, elbowL: -8, armR: 206, elbowR: 4, paddle: 10 }) },
        { t: 0.45, pose: pose({ hop: -8, armL: 200, armR: 210, elbowL: -12, elbowR: -4 }) },
      ],
    },
    fall: {
      dur: 0.35,
      loop: false,
      keys: [
        { t: 0, pose: pose({ lean: 16, armR: 70, armL: 100 }) },
        {
          t: 0.35,
          pose: pose({
            lean: 78,
            drop: 18,
            armL: 30,
            elbowL: 20,
            armR: 12,
            elbowR: 16,
            paddle: 40,
            legL: 48,
            kneeL: 16,
            legR: -36,
            kneeR: 20,
          }),
        },
      ],
    },
  },
  opponent: {
    idle: {
      dur: 1.15,
      loop: true,
      keys: [
        { t: 0, pose: pose({ lean: -4, armR: 34, elbowR: 18, armL: 72, paddle: 16 }) },
        { t: 0.57, pose: pose({ lean: 2, hop: -2, armR: 48, armL: 88, legL: 12, legR: -18 }) },
        { t: 1.15, pose: pose({ lean: -4, armR: 34, elbowR: 18, armL: 72, paddle: 16 }) },
      ],
    },
    swing: {
      dur: 0.32,
      loop: false,
      keys: [
        { t: 0, pose: pose({ lean: 14, armR: 150, elbowR: -36, paddle: -20, armL: 70 }) },
        {
          t: 0.09,
          pose: pose({
            lean: -12,
            lunge: 16,
            armR: 14,
            elbowR: 4,
            paddle: 24,
            armL: 150,
            elbowL: 10,
            legL: 8,
            legR: -22,
          }),
        },
        { t: 0.2, pose: pose({ lean: -4, lunge: 6, armR: -10, elbowR: 18, paddle: 40, armL: 130 }) },
        { t: 0.32, pose: pose({ lean: -4, armR: 36, armL: 114, paddle: 12 }) },
      ],
    },
    cheer: {
      dur: 0.45,
      loop: false,
      keys: [
        { t: 0, pose: pose({ hop: -14, armL: 200, elbowL: -18, armR: 208, elbowR: -10, paddle: 16 }) },
        { t: 0.45, pose: pose({ hop: -6, armL: 194, armR: 202, elbowL: -8, elbowR: 0 }) },
      ],
    },
    fall: {
      dur: 0.35,
      loop: false,
      keys: [
        { t: 0, pose: pose({ lean: -8, armR: 40, armL: 110 }) },
        {
          t: 0.35,
          pose: pose({
            lean: -72,
            drop: 16,
            armL: 40,
            armR: 20,
            elbowR: 24,
            paddle: -20,
            legL: 40,
            legR: -28,
            kneeL: 14,
            kneeR: 18,
          }),
        },
      ],
    },
  },
}

function lerpPose(a, b, u) {
  const out = {}
  for (const key of Object.keys(a)) out[key] = a[key] + (b[key] - a[key]) * u
  return out
}

function smooth(u) {
  return u * u * (3 - 2 * u)
}

export function createActor(role) {
  const home = STANCE[role]
  const side = role === 'player' ? 'L' : 'R'
  return {
    role,
    side,
    home,
    lungeDir: role === 'player' ? -1 : 1,
    x: home[side].x,
    y: home[side].y,
    clip: 'idle',
    clipTime: Math.random() * 0.4,
    clipRate: 1,
    hold: false,
    bob: Math.random() * 6,
    busyUntil: 0,
  }
}

export function triggerAnim(actor, name, side, simTime) {
  if (side) actor.side = side
  actor.clip = CLIPS[actor.role][name] ? name : 'idle'
  actor.clipTime = 0
  actor.hold = name === 'cheer' || name === 'fall'
  actor.clipRate = 1
  if (name === 'swing') {
    actor.clipRate = STRIKE_AT / Math.max(0.04, tuning.contactDelay)
    const real = CLIPS[actor.role].swing.dur / actor.clipRate
    if (simTime != null) actor.busyUntil = simTime + real
  }
}

export function updateActor(actor, dt) {
  const clip = CLIPS[actor.role][actor.clip]
  actor.clipTime += dt * actor.clipRate
  if (clip.loop) {
    actor.clipTime %= clip.dur
  } else if (actor.clipTime >= clip.dur) {
    actor.clipTime = clip.dur
    if (!actor.hold) triggerAnim(actor, 'idle')
  }
  const poseNow = samplePose(actor)
  const home = actor.home[actor.side]
  const goalX = home.x
  const goalY = home.y + actor.lungeDir * poseNow.lunge + poseNow.hop + poseNow.drop
  const k = Math.min(1, dt * 18)
  actor.x += (goalX - actor.x) * k
  actor.y += (goalY - actor.y) * k
  actor.bob += dt
}

function samplePose(actor) {
  const clip = CLIPS[actor.role][actor.clip] || CLIPS[actor.role].idle
  let time = actor.clipTime
  if (clip.loop) time = ((time % clip.dur) + clip.dur) % clip.dur
  const keys = clip.keys
  if (time <= keys[0].t) return keys[0].pose
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (time <= b.t) {
      const u = (time - a.t) / Math.max(0.0001, b.t - a.t)
      return lerpPose(a.pose, b.pose, smooth(u))
    }
  }
  return keys[keys.length - 1].pose
}

function limb(ctx, ox, oy, deg, len1, bendDeg, len2) {
  const a = (deg * Math.PI) / 180
  const b = (bendDeg * Math.PI) / 180
  const jx = ox + Math.sin(a) * len1
  const jy = oy + Math.cos(a) * len1
  const ex = jx + Math.sin(a + b) * len2
  const ey = jy + Math.cos(a + b) * len2
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.lineTo(jx, jy)
  ctx.lineTo(ex, ey)
  ctx.stroke()
  return { x: ex, y: ey }
}

export function drawActor(ctx, actor, ink) {
  const p = samplePose(actor)
  const bob = actor.clip === 'idle' ? Math.sin(actor.bob * 3.2) * 2.2 : 0
  ctx.save()
  ctx.translate(actor.x, actor.y + bob)
  ctx.scale(actor.side === 'R' ? -1 : 1, 1)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = ink
  ctx.fillStyle = '#fff'
  ctx.lineWidth = 8

  limb(ctx, 4, 0, p.legL, 32, p.kneeL, 30)
  limb(ctx, -2, 0, p.legR, 32, p.kneeR, 30)

  const lean = (p.lean * Math.PI) / 180
  const torso = 52
  const shoulder = { x: Math.sin(lean) * torso, y: -Math.cos(lean) * torso }
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(shoulder.x, shoulder.y)
  ctx.stroke()

  const head = {
    x: shoulder.x + Math.sin(lean) * 16,
    y: shoulder.y - Math.cos(lean) * 16,
  }
  ctx.beginPath()
  ctx.arc(head.x, head.y, 15, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  if (actor.clip === 'swing' && actor.clipTime > 0.02 && actor.clipTime < 0.16) {
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 4
    ctx.beginPath()
    const sweep = actor.role === 'player' ? [-2.4, -0.3] : [0.4, 2.2]
    ctx.arc(shoulder.x, shoulder.y + 8, 48, sweep[0], sweep[1])
    ctx.stroke()
    ctx.restore()
  }

  limb(ctx, shoulder.x, shoulder.y, p.armL, 28, p.elbowL, 24)
  const hand = limb(ctx, shoulder.x, shoulder.y, p.armR, 30, p.elbowR, 26)

  ctx.save()
  ctx.translate(hand.x, hand.y)
  ctx.rotate((p.paddle * Math.PI) / 180)
  roundRect(ctx, -8, -12, 16, 26, 5)
  ctx.fillStyle = ink
  ctx.fill()
  ctx.restore()

  ctx.restore()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
