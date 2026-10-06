import { VIEW, project, tableCorners } from './ball.js'
import { drawActor } from './stickman.js'
import { tuning, currentTier, orderedWindows } from './tuning.js'
import { arrivalTime } from './ball.js'

const FONT = '"Arial Black", "Segoe UI", system-ui, sans-serif'

export function render(ctx, match, fx) {
  const theme = makeTheme(match.darken)
  const amp = fx.hitStop > 0 ? 0 : fx.shake
  const ox = (Math.random() - 0.5) * 2 * amp
  const oy = (Math.random() - 0.5) * 2 * amp

  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, VIEW.w, VIEW.h)

  ctx.save()
  ctx.translate(ox, oy)
  ctx.fillStyle = theme.bg
  ctx.fillRect(-30, -30, VIEW.w + 60, VIEW.h + 60)

  drawTable(ctx, theme)
  if (match.ball) drawShadow(ctx, match.ball, theme)
  if (tuning.showBounceMarker && match.shot && !match.shot.bounced && match.phase === 'flight') {
    drawMarker(ctx, match, theme)
  }

  drawFootShadow(ctx, match.ai)
  drawActor(ctx, match.ai, theme.ink)
  drawFootShadow(ctx, match.player)
  drawActor(ctx, match.player, theme.ink)

  if (match.ball) drawBall(ctx, match, fx, theme)

  for (const p of fx.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max)
    ctx.strokeStyle = theme.ink
    ctx.lineWidth = p.w
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  for (const p of fx.popups) {
    const a = Math.max(0, p.life / p.max)
    ctx.globalAlpha = a
    ctx.font = `800 ${p.size}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 6
    ctx.strokeStyle = theme.ink
    ctx.strokeText(p.text, p.x, p.y)
    ctx.fillStyle = '#fff'
    ctx.fillText(p.text, p.x, p.y)
    ctx.globalAlpha = 1
  }

  drawScore(ctx, match, theme)
  drawBanner(ctx, match, theme)
  if (tuning.showTimingGuide) drawGuide(ctx, match, theme)

  if (match.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${match.flash * 0.45})`
    ctx.fillRect(-30, -30, VIEW.w + 60, VIEW.h + 60)
  }

  ctx.restore()

  if (match.phase === 'over') drawResult(ctx, match)
}

function makeTheme(darken) {
  const t = clamp(darken, 0, 1)
  return {
    bg: mix('#FFC400', '#141414', t),
    ink: mix('#171717', '#f5f5f5', t),
    paper: mix('#ffffff', '#2a2a2a', t),
    line: mix('#171717', '#f5f5f5', t),
  }
}

function drawTable(ctx, theme) {
  const c = tableCorners()
  ctx.save()
  ctx.translate(0, 10)
  ctx.fillStyle = 'rgba(0,0,0,0.14)'
  tablePath(ctx, c)
  ctx.fill()
  ctx.restore()

  tablePath(ctx, c)
  ctx.fillStyle = theme.paper
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = theme.ink
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(c.farC.x, c.farC.y)
  ctx.lineTo(c.nearC.x, c.nearC.y)
  ctx.stroke()

  const netH = 16
  ctx.beginPath()
  ctx.moveTo(c.midL.x, c.midL.y - netH)
  ctx.lineTo(c.midL.x, c.midL.y)
  ctx.lineTo(c.midR.x, c.midR.y)
  ctx.lineTo(c.midR.x, c.midR.y - netH)
  ctx.stroke()

  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(c.nearL.x + 28, c.nearL.y)
  ctx.lineTo(c.nearL.x + 28, c.nearL.y + 34)
  ctx.moveTo(c.nearR.x - 28, c.nearR.y)
  ctx.lineTo(c.nearR.x - 28, c.nearR.y + 34)
  ctx.stroke()
}

function tablePath(ctx, c) {
  ctx.beginPath()
  ctx.moveTo(c.nearL.x, c.nearL.y)
  ctx.lineTo(c.nearR.x, c.nearR.y)
  ctx.lineTo(c.farR.x, c.farR.y)
  ctx.lineTo(c.farL.x, c.farL.y)
  ctx.closePath()
}

function drawMarker(ctx, match, theme) {
  const b = match.shot.bounce
  const p = project(b.tx, b.ty, 0)
  const pulse = 0.55 + 0.45 * Math.sin(match.simTime * 9)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.globalAlpha = 0.35 + 0.45 * pulse
  ctx.strokeStyle = theme.ink
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(0, 0, 10 + pulse * 4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 0.9
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-7, -7)
  ctx.lineTo(7, 7)
  ctx.moveTo(7, -7)
  ctx.lineTo(-7, 7)
  ctx.stroke()
  ctx.restore()
}

function drawShadow(ctx, ball, theme) {
  const p = project(ball.tx, ball.ty, 0)
  const lift = project(ball.tx, ball.ty, ball.h).y
  const air = clamp((p.y - lift) / 160, 0, 1)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(1, 0.45)
  ctx.globalAlpha = 0.28 * (1 - air * 0.55)
  ctx.fillStyle = theme.ink
  ctx.beginPath()
  ctx.arc(0, 0, 12 * p.scale, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawBall(ctx, match, fx, theme) {
  const ball = match.ball
  const p = project(ball.tx, ball.ty, ball.h)
  const r = 12 * p.scale * fx.punch
  const squash = fx.squash
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(1 + squash * 0.45, 1 - squash * 0.4)
  if (match.trail.length > 1 && match.rallySpeed > 1.05) {
    match.trail.forEach((sample, i) => {
      const tp = project(sample.tx, sample.ty, sample.h)
      ctx.globalAlpha = ((i + 1) / match.trail.length) * 0.18
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(tp.x - p.x, tp.y - p.y, r * 0.8, 0, Math.PI * 2)
      ctx.fill()
    })
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = theme.ink
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawFootShadow(ctx, actor) {
  ctx.save()
  ctx.translate(actor.x, actor.y + 58)
  ctx.scale(1, 0.28)
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.beginPath()
  ctx.arc(0, 0, 28, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawScore(ctx, match, theme) {
  const y = 28
  drawFlip(ctx, VIEW.cx - 86, y, match.score.player, theme)
  drawFlip(ctx, VIEW.cx + 22, y, match.score.ai, theme)
  ctx.fillStyle = theme.ink
  ctx.font = `800 28px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(':', VIEW.cx, y + 32)

  ctx.font = `800 16px ${FONT}`
  ctx.fillText(currentTier().name.toUpperCase(), VIEW.cx, y + 84)
  if (match.rallyHits >= 2 && match.phase === 'flight') {
    ctx.font = `800 13px ${FONT}`
    ctx.globalAlpha = 0.75
    ctx.fillText(`СЕРИЯ ${match.rallyHits}`, VIEW.cx, y + 106)
    ctx.globalAlpha = 1
  }
}

function drawFlip(ctx, x, y, value, theme) {
  roundRect(ctx, x, y, 64, 64, 8)
  ctx.fillStyle = theme.paper
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = theme.ink
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y + 32)
  ctx.lineTo(x + 64, y + 32)
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = theme.ink
  ctx.font = `800 36px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(value), x + 32, y + 34)
}

function drawBanner(ctx, match, theme) {
  if (match.phase === 'ready') {
    drawBubble(ctx, VIEW.cx - 36, 158, 'ГОТОВ', theme)
    return
  }
  if (match.phase === 'point' && match.message) {
    // Keep the line off the opponent who is celebrating on a lost point.
    const x = match.lastPoint === 'ai' ? (match.aiSide === 'L' ? 355 : 185) : VIEW.cx
    ctx.font = `800 30px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 8
    ctx.strokeStyle = theme.bg
    ctx.strokeText(match.message, x, 150)
    ctx.fillStyle = theme.ink
    ctx.fillText(match.message, x, 150)
  }
}

function drawBubble(ctx, x, y, text, theme) {
  ctx.font = `800 22px ${FONT}`
  const w = 148
  const h = 48
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 16)
  ctx.fillStyle = theme.paper
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = theme.ink
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + 18, y + h / 2)
  ctx.lineTo(x + 34, y + h / 2 + 12)
  ctx.lineTo(x + 40, y + h / 2)
  ctx.fill()
  ctx.fillStyle = theme.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y + 1)
}

function drawGuide(ctx, match, theme) {
  if (match.phase !== 'flight' || match.target !== 'player' || !match.shot) return
  const windows = orderedWindows()
  const err = (match.simTime + tuning.contactDelay - arrivalTime(match.shot)) * 1000
  const x0 = 90
  const x1 = 450
  const y = 800
  ctx.save()
  ctx.globalAlpha = 0.85
  ctx.strokeStyle = theme.ink
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x1, y)
  ctx.stroke()
  const zone = (ms) => x0 + ((ms + windows.weak) / (windows.weak + windows.late)) * (x1 - x0)
  ctx.globalAlpha = 0.18
  ctx.fillStyle = theme.ink
  ctx.fillRect(zone(-windows.weak), y - 8, zone(windows.late) - zone(-windows.weak), 16)
  ctx.globalAlpha = 0.35
  ctx.fillRect(zone(-windows.perfect), y - 10, zone(Math.min(windows.perfect, windows.late)) - zone(-windows.perfect), 20)
  ctx.globalAlpha = 1
  ctx.fillStyle = theme.ink
  ctx.beginPath()
  ctx.arc(zone(err), y, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawResult(ctx, match) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.fillRect(0, 0, VIEW.w, VIEW.h)
  roundRect(ctx, 60, 340, 420, 300, 28)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = '#171717'
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#171717'
  ctx.font = `800 52px ${FONT}`
  ctx.fillText(match.result === 'win' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ', VIEW.cx, 430)
  ctx.font = `800 36px ${FONT}`
  ctx.fillText(`${match.score.player}  :  ${match.score.ai}`, VIEW.cx, 500)
  ctx.font = `800 16px ${FONT}`
  const tier = tuning.tiers[match.tierAtStart]
  ctx.fillText((tier ? tier.name : '').toUpperCase(), VIEW.cx, 548)
  ctx.globalAlpha = 0.7
  ctx.font = `800 15px ${FONT}`
  ctx.fillText('НАЖМИ, ЧТОБЫ СЫГРАТЬ ЕЩЁ', VIEW.cx, 590)
  ctx.globalAlpha = 1
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

function mix(a, b, t) {
  const pa = hex(a)
  const pb = hex(b)
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

function hex(s) {
  return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16))
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}
