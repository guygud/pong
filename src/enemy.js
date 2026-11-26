import {
  AssetManager,
  AtlasAttachmentLoader,
  SkeletonJson,
  Skeleton,
  AnimationState,
  AnimationStateData,
  SkeletonRenderer,
  Physics,
} from '../vendor/spine-canvas.mjs?v=58'

// Large enough that one step from the middle puts the body on the end
// of the far baseline. Soles sit on that line.
const SCALE = 0.1
const FOOT_SPINE_Y = 8
const FEET_BELOW_HIP = 56
const WALK_DISTANCE = 12

const ASSETS = 'chiken_enemy_exp_v1.0.2_test/'

let skeleton = null
let state = null
let renderer = null
let current = ''
let down = false
// Authored contact time, in seconds, from each clip's `hit` event.
const hits = new Map()

export function enemyReady() {
  return Boolean(skeleton)
}

export function loadEnemy(ctx) {
  const manager = new AssetManager(ASSETS)
  manager.loadTextureAtlasAsync('chiken_enemy.atlas').then((atlas) => {
    return manager.loadJsonAsync('chiken_enemy.json').then((json) => {
      const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(json)
      rememberHits(data)
      const sk = new Skeleton(data)
      sk.scaleX = 1
      sk.scaleY = 1
      const stateData = new AnimationStateData(data)
      // Idle and walk can ease. Anything into a swing is instant: a mix here
      // covers the whole short windup and the attack never reads.
      stateData.defaultMix = 0.04
      for (const from of data.animations) {
        for (const attack of ['attack', 'attack_2', 'tired/attack', 'tired/attack_2']) {
          stateData.setMix(from.name, attack, 0)
        }
      }
      state = new AnimationState(stateData)
      renderer = new SkeletonRenderer(ctx)
      renderer.triangleRendering = true
      play('idle', true)
      state.apply(sk)
      sk.updateWorldTransform(Physics.update)
      skeleton = sk
    })
  }).catch((error) => {
    console.warn('Enemy skeleton did not load', error)
  })
}

function swingName(actor) {
  const base = actor.side === 'R' ? 'attack' : 'attack_2'
  return actor.tired ? `tired/${base}` : base
}

function rememberHits(data) {
  hits.clear()
  for (const anim of data.animations) {
    let hit = 0
    for (const timeline of anim.timelines) {
      if (!timeline.events) continue
      for (const event of timeline.events) {
        if (event.data && event.data.name === 'hit') hit = event.time
      }
    }
    if (hit > 0) hits.set(anim.name, hit)
  }
}

// How long before the ball the swing has to start so `hit` lands on it.
// Null until the skeleton is loaded, so the caller keeps the old lead.
export function enemyHitLead(side, tired) {
  return hits.get(swingName({ side, tired })) || null
}

// Real seconds the swing clip lasts. Zero when the stickman is still drawing.
export function enemySwingSpan(actor) {
  if (!skeleton || actor.role !== 'opponent' || actor.clip !== 'swing') return 0
  const anim = skeleton.data.findAnimation(swingName(actor))
  return anim ? anim.duration : 0
}

function choose(actor) {
  if (actor.clip !== 'fall') down = false
  if (actor.clip === 'swing') return swingName(actor)
  if (actor.clip === 'cheer') return 'happy'
  if (actor.clip === 'fall') {
    const entry = state.getCurrent(0)
    if (down) return 'tired'
    if (entry && entry.animation.name === 'loose' && entry.trackTime >= entry.animation.duration) {
      down = true
      return 'tired'
    }
    return 'loose'
  }
  const goalX = actor.home[actor.side].x
  if (Math.abs(goalX - actor.x) > WALK_DISTANCE) return goalX > actor.x ? 'walk_r' : 'walk_l'
  return actor.tired ? 'tired' : 'idle'
}

function play(name, loop) {
  state.setAnimation(0, name, loop)
  current = name
}

export function syncEnemy(actor, dt) {
  if (!skeleton || actor.role !== 'opponent') return
  const name = choose(actor)
  const loop = name === 'idle' || name === 'tired' || name.startsWith('walk')
  if (name !== current) play(name, loop)
  const entry = state.getCurrent(0)
  // clipTime runs at clipRate, so dividing it back gives real seconds since
  // the swing started. The match starts that swing `hit` seconds early.
  if (actor.clip === 'swing' && entry) entry.trackTime = actor.clipTime / Math.max(0.0001, actor.clipRate)
  else state.update(dt)
  state.apply(skeleton)
  skeleton.scaleX = 1
  skeleton.scaleY = 1
  skeleton.x = 0
  skeleton.y = 0
  skeleton.updateWorldTransform(Physics.update)
}

export function drawEnemy(ctx, actor) {
  if (!skeleton || actor.role !== 'opponent') return false
  syncEnemy(actor, 0)
  const footY = actor.y + FEET_BELOW_HIP
  ctx.save()
  ctx.translate(actor.x, footY)
  ctx.scale(SCALE, -SCALE)
  ctx.translate(0, -FOOT_SPINE_Y)
  renderer.draw(skeleton)
  ctx.restore()
  return true
}
