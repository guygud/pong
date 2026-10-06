import { loadTuning, tuning, saveTuning } from './tuning.js'
import { createFx, updateFx } from './fx.js'
import { audio } from './audio.js'
import { createSession, createMatch } from './match.js'
import { bindInput } from './input.js'
import { render } from './render.js'
import { mountDebug } from './debug.js'
import { VIEW, project } from './ball.js'

loadTuning()

const canvas = document.getElementById('game')
const frame = document.getElementById('frame')
const controls = document.getElementById('controls')
const ctx = canvas.getContext('2d')
const dpr = Math.min(2, window.devicePixelRatio || 1)
canvas.width = VIEW.w * dpr
canvas.height = VIEW.h * dpr
ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
ctx.imageSmoothingEnabled = true

const fx = createFx()
const session = createSession()
const match = createMatch(session, fx, audio)
let paused = false
let held = false

const debug = mountDebug(session, match, {
  onRestart: () => {
    paused = false
    match.restart()
  },
  onTier: (index) => {
    tuning.tierIndex = index
    saveTuning()
    debug.sync()
    paused = false
    match.restart()
  },
})

bindInput({
  onHit: (side) => {
    audio.unlock()
    if (paused) return
    match.onHit(side)
  },
  onConfirm: () => {
    audio.unlock()
    if (match.phase === 'over') {
      paused = false
      match.restart()
    }
  },
  onPause: () => {
    if (match.phase === 'over') return
    paused = !paused
  },
  onDebug: () => debug.toggle(),
  onTier: (index) => {
    tuning.tierIndex = index
    saveTuning()
    debug.sync()
    paused = false
    match.restart()
  },
})

function fit() {
  const s = Math.min(window.innerWidth / VIEW.w, window.innerHeight / VIEW.h)
  frame.style.transform = `translate(-50%, -50%) scale(${s})`
}
window.addEventListener('resize', fit)
fit()

const STEP = 1 / 60
let acc = 0
let last = 0

function frameLoop(now) {
  if (!last) last = now
  let delta = (now - last) / 1000
  last = now
  if (delta > 0.05) delta = 0.05
  acc += delta
  while (acc >= STEP) {
    if (fx.hitStop > 0 && !held) fx.hitStop -= STEP
    else if (!paused && !held) {
      match.update(STEP)
      updateFx(fx, STEP)
    }
    acc -= STEP
  }
  render(ctx, match, fx)
  if (paused && !held) drawPaused(ctx)
  const showButtons = !paused && (match.phase === 'flight' || match.phase === 'ready')
  controls.classList.toggle('show', showButtons)
  frame.classList.toggle('lose', match.darken > 0.55)
  requestAnimationFrame(frameLoop)
}

function drawPaused(context) {
  context.save()
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.fillStyle = 'rgba(0,0,0,0.35)'
  context.fillRect(0, 0, VIEW.w, VIEW.h)
  context.fillStyle = '#fff'
  context.font = '800 42px "Arial Black", "Segoe UI", system-ui, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('ПАУЗА', VIEW.w / 2, VIEW.h / 2)
  context.restore()
}

window.__pong = {
  match,
  session,
  tuning,
  project,
  pause(value) {
    paused = !!value
    held = false
  },
  hold(value) {
    held = !!value
    if (held) paused = false
  },
  step(n = 1) {
    for (let i = 0; i < n; i++) {
      if (fx.hitStop > 0) fx.hitStop -= STEP
      else {
        match.update(STEP)
        updateFx(fx, STEP)
      }
    }
  },
}

requestAnimationFrame(frameLoop)
