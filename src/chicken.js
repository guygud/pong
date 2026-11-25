import {
  AssetManager,
  AtlasAttachmentLoader,
  SkeletonJson,
  Skeleton,
  AnimationState,
  AnimationStateData,
  SkeletonRenderer,
  Physics,
} from '../vendor/spine-canvas.mjs?v=54'

// Spine units. Feet sit near y=55, the paddle rests near y=1000.
const SCALE = 0.13
const FOOT_SPINE_Y = 55
const FEET_BELOW_HIP = 62
// The stick swing reaches its strike key at 0.09s. Each chicken clip is stretched
// so the frame below, where the paddle is at ball height, lands on that same moment.
const STICK_STRIKE = 0.09
const CONTACT = {
  attack: { time: 0.32, x: 74 },
  attack_2: { time: 0.24, x: -21 },
}
const WALK_DISTANCE = 12

const ASSETS = 'chiken_main_exp_v1.0/'
const CLIP_NAMES = new Set(['attack', 'attack_2', 'idle', 'idle_lose', 'lose', 'walk_left', 'walk_right', 'win'])
const askedClip = new URLSearchParams(location.search).get('clip')
const preview = CLIP_NAMES.has(askedClip) ? askedClip : ''
let previewStamp = 0

let skeleton = null
let state = null
let renderer = null
let current = ''

export function chickenReady() {
  return Boolean(skeleton)
}

export function swingClip(side) {
  return side === 'R' ? 'attack' : 'attack_2'
}

// Screen pixels from the body to the paddle at the contact frame.
export function paddleOffsetX(side) {
  return CONTACT[swingClip(side)].x
}

export function loadChicken(ctx) {
  const manager = new AssetManager(ASSETS)
  manager.loadTextureAtlasAsync('chiken_main.atlas').then((atlas) => {
    return manager.loadJsonAsync('chiken_main.json').then((json) => {
      const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(json)
      const sk = new Skeleton(data)
      sk.scaleX = 1
      sk.scaleY = 1
      const stateData = new AnimationStateData(data)
      stateData.defaultMix = 0
      state = new AnimationState(stateData)
      renderer = new SkeletonRenderer(ctx)
      renderer.triangleRendering = true
      play('idle', true)
      state.apply(sk)
      sk.updateWorldTransform(Physics.update)
      skeleton = sk
    })
  }).catch((error) => {
    console.warn('Chicken skeleton did not load', error)
  })
}

function strikeScale(side) {
  return CONTACT[swingClip(side)].time / STICK_STRIKE
}

function choose(actor) {
  if (actor.clip === 'swing') return swingClip(actor.side)
  if (actor.clip === 'cheer') return 'win'
  if (actor.clip === 'fall') {
    const entry = state.getCurrent(0)
    if (current === 'idle_lose') return 'idle_lose'
    if (entry && entry.animation.name === 'lose' && entry.trackTime >= entry.animation.duration) return 'idle_lose'
    return 'lose'
  }
  const goalX = actor.meetX != null ? actor.meetX : actor.home[actor.side].x
  if (Math.abs(goalX - actor.x) > WALK_DISTANCE) return goalX > actor.x ? 'walk_right' : 'walk_left'
  return 'idle'
}

function play(name, loop) {
  state.setAnimation(0, name, loop)
  current = name
}

// Advances from the match step, so hit-stop freezes the skeleton with everything else.
function previewDt() {
  const now = performance.now()
  const dt = previewStamp ? Math.min(0.05, (now - previewStamp) / 1000) : 0
  previewStamp = now
  return dt
}

export function syncChicken(actor, dt) {
  if (!skeleton || actor.role !== 'player') return
  if (preview) {
    if (preview !== current) play(preview, true)
    state.update(previewDt())
    state.apply(skeleton)
    place()
    skeleton.updateWorldTransform(Physics.update)
    return
  }
  const name = choose(actor)
  const loop = name === 'idle' || name === 'idle_lose' || name.startsWith('walk')
  if (name !== current) play(name, loop)
  const entry = state.getCurrent(0)
  if (actor.clip === 'swing' && entry) entry.trackTime = actor.clipTime * strikeScale(actor.side)
  else state.update(dt)
  state.apply(skeleton)
  place()
  skeleton.updateWorldTransform(Physics.update)
}

function place() {
  // Keep the pose in Spine units. The foot IK compares those units to the bone
  // length, so scaling the skeleton itself squashes the shoes sideways.
  skeleton.scaleX = 1
  skeleton.scaleY = 1
  skeleton.x = 0
  skeleton.y = 0
}

export function drawChicken(ctx, actor) {
  if (!skeleton || actor.role !== 'player') return false
  // A point reaction can change the clip after the actor step. Apply it before drawing.
  syncChicken(actor, 0)
  const footY = actor.y + FEET_BELOW_HIP
  ctx.save()
  ctx.translate(actor.x, footY)
  ctx.scale(SCALE, -SCALE)
  ctx.translate(0, -FOOT_SPINE_Y)
  renderer.draw(skeleton)
  ctx.restore()
  return true
}
