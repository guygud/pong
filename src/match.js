import { tuning, currentTier, orderedWindows, saveTuning } from './tuning.js?v=19'
import { createShot, sampleShot, shotProgress, arrivalTime, project } from './ball.js?v=19'
import { planServe, buildPlayerShot, planReturn, nextStamina } from './ai.js?v=19'
import { createActor, triggerAnim, updateActor } from './stickman.js?v=19'
import { spawnHit, spawnWhiff, spawnBounce } from './fx.js?v=19'

export function createSession() {
  return {
    qualities: { perfect: 0, good: 0, weak: 0, miss: 0, wrong: 0 },
    timingErrors: [],
    rallyLengths: [],
    byTier: tuning.tiers.map(() => ({ wins: 0, losses: 0 })),
    byKind: { flat: { seen: 0, lost: 0 }, float: { seen: 0, lost: 0 }, spin: { seen: 0, lost: 0 } },
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
    aiStamina: 1,
    aiStaminaMax: 1,
    aiStaminaShown: 1,
    message: '3',
    messageT: 1,
    readyTick: 1,
    count: 3,
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
    match.spinsUsed = 0
    refillStamina()
    match.playerSide = 'L'
    match.aiSide = 'R'
    match.tierAtStart = tuning.tierIndex
    match.player = createActor('player')
    match.ai = createActor('opponent')
    beginReady(1)
  }

  function beginReady(tick = 0.5) {
    match.phase = 'ready'
    match.count = 3
    match.message = '3'
    match.readyTick = tick
    match.messageT = tick
    match.shot = null
    match.pending = null
    match.trail = []
    match.rallyHits = 0
    match.rallySpeed = 1
    refillStamina()
    match.ball = { tx: 0.46, ty: 1.5, h: 0.62 }
    triggerAnim(match.player, 'idle', 'L', match.simTime)
    triggerAnim(match.ai, 'idle', 'R', match.simTime)
  }

  function startServe() {
    match.rallyHits = 0
    match.rallySpeed = 1
    refillStamina()
    const plan = planServe(currentTier(), match.spinsUsed)
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
    if (target === 'player') {
      tallyKind('seen')
      if (shot.kind === 'spin') match.spinsUsed += 1
    }
  }

  function update(dt) {
    match.simTime += dt
    updateActor(match.player, dt)
    updateActor(match.ai, dt)
    match.flash = Math.max(0, match.flash - dt * 3.2)
    match.aiStaminaShown += (match.aiStamina - match.aiStaminaShown) * Math.min(1, dt * 8)
    const darkTarget = match.phase === 'point' && match.lastPoint === 'ai' ? 1 : 0
    match.darken += (darkTarget - match.darken) * Math.min(1, dt * 9)

    if (match.phase === 'ready') {
      match.messageT -= dt
      if (match.messageT <= 0) {
        match.count -= 1
        if (match.count <= 0) startServe()
        else {
          match.message = String(match.count)
          match.messageT = match.readyTick
        }
      }
      return
    }
    if (match.phase === 'point') {
      match.messageT -= dt
      if (match.messageT <= 0) {
        const done = match.score.player >= tuning.pointsToWin || match.score.ai >= tuning.pointsToWin
        if (done) finish(match.score.player >= tuning.pointsToWin)
        else beginReady()
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
      const late = lateLimit(shot) / 1000
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
      // Captured at the press. A swing started before the bounce can still be early.
      afterBounce: Boolean(match.shot.bounced),
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
    const late = lateLimit(shot)
    const abs = Math.abs(errorMs)
    const outer = errorMs > 0 ? late : windows.weak
    const perfect = Math.min(windows.perfect, outer)
    // Late contact is the coyote save: it still returns the ball, but only as a weak hit.
    const good = errorMs > 0 ? perfect : windows.good
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
      // Early wrong side, typical of a spin read off the bounce: the ball has not
      // arrived, so the other button can still save it.
      if (errorMs < 0) {
        shot.attempted = false
        match.player.busyUntil = match.simTime
        return
      }
      if (quality) losePoint()
      return
    }
    // Once the ball has bounced, the press is the cue. An early swing on the
    // right side still returns it, graded weak, instead of whiffing into the gap
    // between the bounce and the timing window.
    if (!quality && swing.afterBounce && errorMs < 0) quality = 'weak'

    if (!quality) {
      note('miss')
      audio.whiff()
      spawnWhiff(fx, errorMs > 0 ? 'ПОЗДНО' : 'РАНО', screen.x, screen.y)
      if (errorMs > late) losePoint()
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
    match.aiStamina = nextStamina(match.aiStamina, quality, match.rallySpeed, match.aiStaminaMax)
    shot.aiDecision = planReturn({
      tier,
      quality,
      playerSide: match.playerSide,
      rallySpeed: match.rallySpeed,
      incomingTx: shot.to.tx,
      stamina: match.aiStamina,
      max: match.aiStaminaMax,
      spinsUsed: match.spinsUsed,
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
      spawnWhiff(fx, 'ВЫДОХСЯ', match.ai.x, match.ai.y - 96)
      winPoint()
      return
    }
    const at = sampleShot(match.shot, 1)
    decision.returnShot.from = { tx: at.tx, ty: at.ty }
    decision.returnShot.fromH = Math.max(0.12, at.h)
    bumpRally()
    const pace = decision.speed ?? (decision.smash ? 1.36 : 1)
    const shots = tuning.shots
    let flight = currentTier().flightTime / (match.rallySpeed * pace)
    if (decision.returnShot.kind === 'float') flight *= shots.floatTime
    if (decision.returnShot.kind === 'spin') {
      const after = Math.max(0.05, 1 - decision.returnShot.bounceAt)
      flight = Math.max(flight, 0.3 / after)
    }
    decision.returnShot.flightTime = Math.max(0.32, flight)
    const screen = project(at.tx, at.ty, at.h)
    spawnHit(fx, decision.smash ? 'perfect' : 'good', screen.x, screen.y)
    fx.hitStop = decision.smash ? tuning.hitStop.good / 1000 : 0
    fx.shake = Math.max(fx.shake, decision.smash ? tuning.shake.good : tuning.shake.weak)
    audio.hit(decision.smash ? 'smash' : 'serve', match.rallySpeed)
    launch(decision.returnShot, 'player')
  }

  function refillStamina() {
    const max = Math.max(0.05, currentTier().stamina)
    match.aiStaminaMax = max
    match.aiStamina = max
    match.aiStaminaShown = max
  }

  function bumpRally() {
    match.rallyHits += 1
    match.rallySpeed = Math.min(tuning.rallySpeedMax, 1 + match.rallyHits * tuning.rallySpeedStep)
  }

  function lateLimit(shot) {
    const base = orderedWindows().late
    if (!shot || shot.kind !== 'float') return base
    return Math.max(base, currentTier().floatLate || base)
  }

  function note(kind) {
    if (session.qualities[kind] != null) session.qualities[kind] += 1
  }

  function tallyKind(which) {
    const bucket = session.byKind?.[match.shot?.kind]
    if (bucket) bucket[which] += 1
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
    tallyKind('lost')
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
    if (playerWon && match.tierAtStart < tuning.tiers.length - 1) {
      tuning.tierIndex = match.tierAtStart + 1
      saveTuning()
      restart()
      match.promoted = true
    }
  }

  restart()
  return match
}
