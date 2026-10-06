import { tuning, currentTier, orderedWindows } from './tuning.js'
import { createShot, sampleShot, shotProgress, arrivalTime, project } from './ball.js'
import { planServe, buildPlayerShot, planReturn } from './ai.js'
import { createActor, triggerAnim, updateActor } from './stickman.js'
import { spawnHit, spawnWhiff, spawnBounce } from './fx.js'

export function createSession() {
  return {
    qualities: { perfect: 0, good: 0, weak: 0, miss: 0, wrong: 0 },
    timingErrors: [],
    rallyLengths: [],
    byTier: tuning.tiers.map(() => ({ wins: 0, losses: 0 })),
  }
}

export function createMatch(session, fx, audio) {
  const match = {
    phase: 'ready',
    simTime: 0,
    score: { player: 0, ai: 0 },
    shot: null,
    ball: null,
    target: 'player',
    rallyHits: 0,
    rallySpeed: 1,
    message: 'ГОТОВ',
    messageT: 0.9,
    darken: 0,
    flash: 0,
    lastPoint: null,
    playerSide: 'L',
    aiSide: 'R',
    player: createActor('player'),
    ai: createActor('opponent'),
    pending: null,
    result: null,
    tierAtStart: 0,
    trail: [],
    restart,
    update,
    onHit,
  }

  function restart() {
    match.simTime = 0
    match.score.player = 0
    match.score.ai = 0
    match.shot = null
    match.pending = null
    match.result = null
    match.lastPoint = null
    match.flash = 0
    match.darken = 0
    match.trail = []
    match.rallyHits = 0
    match.rallySpeed = 1
    match.playerSide = 'L'
    match.aiSide = 'R'
    match.tierAtStart = tuning.tierIndex
    match.player = createActor('player')
    match.ai = createActor('opponent')
    beginReady()
  }

  function beginReady() {
    match.phase = 'ready'
    match.message = 'ГОТОВ'
    match.messageT = 0.85
    match.shot = null
    match.pending = null
    match.trail = []
    match.rallyHits = 0
    match.rallySpeed = 1
    match.ball = { tx: 0.46, ty: 1.5, h: 0.62 }
    triggerAnim(match.player, 'idle', 'L', match.simTime)
    triggerAnim(match.ai, 'idle', 'R', match.simTime)
  }

  function startServe() {
    match.rallyHits = 0
    match.rallySpeed = 1
    const plan = planServe(currentTier())
    match.aiSide = plan.side
    triggerAnim(match.ai, 'swing', plan.side, match.simTime)
    triggerAnim(match.player, 'idle', match.playerSide, match.simTime)
    launch(plan.shot, 'player')
    audio.serve()
  }

  function launch(shot, target) {
    shot.startTime = match.simTime
    shot.bounced = false
    shot.aiSwung = false
    shot.aiResolved = false
    shot.attempted = false
    shot.progress = 0
    match.shot = shot
    match.target = target
    match.phase = 'flight'
    match.message = ''
    match.pending = null
    match.trail = []
    match.ball = sampleShot(shot, 0)
  }

  function update(dt) {
    match.simTime += dt
    updateActor(match.player, dt)
    updateActor(match.ai, dt)
    match.flash = Math.max(0, match.flash - dt * 3.2)
    const darkTarget = match.phase === 'point' && match.lastPoint === 'ai' ? 1 : 0
    match.darken += (darkTarget - match.darken) * Math.min(1, dt * 9)

    if (match.phase === 'ready') {
      match.messageT -= dt
      if (match.messageT <= 0) startServe()
      return
    }
    if (match.phase === 'point') {
      match.messageT -= dt
      if (match.messageT <= 0) {
        const done = match.score.player >= tuning.pointsToWin || match.score.ai >= tuning.pointsToWin
        if (done) finish(match.score.player >= tuning.pointsToWin)
        else startServe()
      }
      return
    }
    if (match.phase !== 'flight' || !match.shot) return

    const shot = match.shot
    const progress = shotProgress(shot, match.simTime)
    shot.progress = progress
    const sample = sampleShot(shot, progress)
    match.ball = sample
    if (progress > 0) {
      match.trail.push(sample)
      if (match.trail.length > 5) match.trail.shift()
    }

    if (!shot.bounced && progress >= shot.bounceAt) {
      shot.bounced = true
      const at = sampleShot(shot, shot.bounceAt)
      const p = project(at.tx, at.ty, 0)
      spawnBounce(fx, p.x, p.y)
      audio.bounce(match.rallySpeed)
    }

    if (match.pending && !match.pending.resolved && match.simTime >= match.pending.contactAt) {
      resolveSwing(match.pending)
    }

    if (match.phase !== 'flight') return

    if (match.target === 'ai' && shot.aiDecision) {
      const lead = tuning.contactDelay
      const swingAt = 1 - lead / shot.flightTime
      if (!shot.aiSwung && progress >= swingAt) {
        shot.aiSwung = true
        const decision = shot.aiDecision
        match.aiSide = decision.side
        triggerAnim(match.ai, decision.hit ? 'swing' : 'fall', decision.side, match.simTime)
      }
      if (!shot.aiResolved && progress >= 1) {
        shot.aiResolved = true
        resolveAI()
      }
    }

    if (match.phase === 'flight' && match.target === 'player') {
      const late = orderedWindows().late / 1000
      if (match.simTime > arrivalTime(shot) + late) {
        if (!shot.attempted) note('miss', null)
        losePoint()
      }
    }
  }

  function onHit(side) {
    if (match.phase !== 'flight') return
    if (match.player.busyUntil > match.simTime) return
    match.playerSide = side
    triggerAnim(match.player, 'swing', side, match.simTime)
    if (match.target !== 'player' || !match.shot) return
    match.pending = {
      side,
      contactAt: match.simTime + tuning.contactDelay,
      resolved: false,
    }
  }

  function resolveSwing(swing) {
    swing.resolved = true
    if (match.phase !== 'flight' || match.target !== 'player' || !match.shot) return
    const shot = match.shot
    shot.attempted = true
    const errorMs = (swing.contactAt - arrivalTime(shot)) * 1000
    if (Math.abs(errorMs) <= 420) {
      session.timingErrors.push(errorMs)
      if (session.timingErrors.length > 300) session.timingErrors.shift()
    }

    const windows = orderedWindows()
    const abs = Math.abs(errorMs)
    const outer = errorMs > 0 ? windows.late : windows.weak
    const good = errorMs > 0 ? Math.min(windows.good, windows.late) : windows.good
    const perfect = Math.min(windows.perfect, outer)
    let quality = null
    if (abs <= perfect) quality = 'perfect'
    else if (abs <= good) quality = 'good'
    else if (abs <= outer) quality = 'weak'

    const sideOk = shot.expectedSide === 'any' || swing.side === shot.expectedSide
    const at = sampleShot(shot, Math.max(shot.progress, 0))
    const screen = project(at.tx, at.ty, at.h)

    if (!sideOk) {
      note('wrong')
      audio.whiff()
      spawnWhiff(fx, 'НЕ ТУДА', screen.x, screen.y)
      if (quality) losePoint()
      return
    }
    if (!quality) {
      note('miss')
      audio.whiff()
      spawnWhiff(fx, errorMs > 0 ? 'ПОЗДНО' : 'РАНО', screen.x, screen.y)
      if (errorMs > windows.late) losePoint()
      return
    }

    note(quality)
    playerReturn(quality, at)
  }

  function playerReturn(quality, at) {
    const tier = currentTier()
    bumpRally()
    const shot = buildPlayerShot({
      quality,
      from: { tx: at.tx, ty: at.ty },
      fromH: at.h,
      aiSide: match.aiSide,
      rallySpeed: match.rallySpeed,
      tier,
    })
    shot.aiDecision = planReturn({
      tier,
      quality,
      playerSide: match.playerSide,
      rallySpeed: match.rallySpeed,
      incomingTx: shot.to.tx,
    })
    const screen = project(at.tx, at.ty, at.h)
    spawnHit(fx, quality, screen.x, screen.y)
    fx.hitStop = (tuning.hitStop[quality] || 0) / 1000
    fx.shake = Math.max(fx.shake, tuning.shake[quality] || 0)
    audio.hit(quality, match.rallySpeed)
    launch(shot, 'ai')
  }

  function resolveAI() {
    const decision = match.shot.aiDecision
    if (!decision || !decision.hit) {
      triggerAnim(match.ai, 'fall', decision ? decision.side : match.aiSide, match.simTime)
      winPoint()
      return
    }
    const at = sampleShot(match.shot, 1)
    decision.returnShot.from = { tx: at.tx, ty: at.ty }
    decision.returnShot.fromH = Math.max(0.12, at.h)
    bumpRally()
    decision.returnShot.flightTime = Math.max(
      0.32,
      currentTier().flightTime / (match.rallySpeed * (decision.smash ? 1.36 : 1)),
    )
    const screen = project(at.tx, at.ty, at.h)
    spawnHit(fx, decision.smash ? 'perfect' : 'good', screen.x, screen.y)
    fx.hitStop = decision.smash ? tuning.hitStop.good / 1000 : 0
    fx.shake = Math.max(fx.shake, decision.smash ? tuning.shake.good : tuning.shake.weak)
    audio.hit(decision.smash ? 'smash' : 'serve', match.rallySpeed)
    launch(decision.returnShot, 'player')
  }

  function bumpRally() {
    match.rallyHits += 1
    match.rallySpeed = Math.min(tuning.rallySpeedMax, 1 + match.rallyHits * tuning.rallySpeedStep)
  }

  function note(kind) {
    if (session.qualities[kind] != null) session.qualities[kind] += 1
  }

  function endRally() {
    session.rallyLengths.push(match.rallyHits)
    if (session.rallyLengths.length > 200) session.rallyLengths.shift()
  }

  function winPoint() {
    if (match.phase !== 'flight') return
    match.score.player += 1
    match.lastPoint = 'player'
    match.phase = 'point'
    match.message = 'ОЧКО ТВОЁ'
    match.messageT = 1.12
    match.flash = 1
    match.pending = null
    endRally()
    triggerAnim(match.player, 'cheer', match.playerSide, match.simTime)
    triggerAnim(match.ai, 'fall', match.aiSide, match.simTime)
    audio.point(true)
  }

  function losePoint() {
    if (match.phase !== 'flight') return
    match.score.ai += 1
    match.lastPoint = 'ai'
    match.phase = 'point'
    match.message = 'МЯЧ ПОТЕРЯН'
    match.messageT = 1.12
    match.pending = null
    endRally()
    triggerAnim(match.player, 'fall', match.playerSide, match.simTime)
    triggerAnim(match.ai, 'cheer', match.aiSide, match.simTime)
    audio.point(false)
  }

  function finish(playerWon) {
    match.phase = 'over'
    match.result = playerWon ? 'win' : 'loss'
    match.message = playerWon ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'
    const bucket = session.byTier[match.tierAtStart] || session.byTier[0]
    if (playerWon) bucket.wins += 1
    else bucket.losses += 1
    triggerAnim(match.player, playerWon ? 'cheer' : 'fall', match.playerSide, match.simTime)
    triggerAnim(match.ai, playerWon ? 'fall' : 'cheer', match.aiSide, match.simTime)
  }

  restart()
  return match
}
