let ac = null

const samples = {
  player: { file: 'player_hit.mp3', offset: 0.197, gain: 0.85, tail: 0.105 },
  enemy: { file: 'enemy_hit.mp3', offset: 0.192, gain: 0.75, tail: 0.105 },
  table: { file: 'hits-table.mp3', offset: 0.15, gain: 0.65, tail: 0.075 },
  fail: {
    file: 'ball-fail.mp3',
    offset: 0.055,
    gain: 0.75,
    tail: 1.12,
    // Starts of the individual bounces in the original recording.
    impacts: [0.065, 0.16, 0.248, 0.332, 0.411, 0.481, 0.547, 0.61, 0.669, 0.724, 0.776, 0.825, 0.87, 1.011],
  },
  enemyFail: {
    file: 'enemy_fail.mp3',
    offset: 0.055,
    gain: 0.7,
    tail: 1.24,
    impacts: [0.065, 0.16, 0.248, 0.332, 0.411, 0.481, 0.547, 0.61, 0.669, 0.724, 0.776, 1.042, 1.188],
  },
  crowdLoss: { file: 'sfxmint-crowd-aww-02.mp3', offset: 0, gain: 0.45, tail: 0.95, fadeAfter: 0.65 },
  crowdWin: { file: 'sfxmint-crowd-applause-44.mp3?v=51', offset: 0, gain: 0.65, tail: 1.35, naturalTail: true },
}

function loadSamples(ctx) {
  for (const sample of Object.values(samples)) {
    if (sample.loading || sample.buffer) continue
    sample.loading = fetch(new URL(`../assets/audio/${sample.file}`, import.meta.url))
      .then((response) => {
        if (!response.ok) throw new Error(`Audio request failed: ${response.status}`)
        return response.arrayBuffer()
      })
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then((buffer) => { sample.buffer = buffer })
      .catch((error) => console.warn('Could not load sound', sample.file, error))
  }
}

// Skip the lead-in and fade the room reflections after the initial impact.
function playSample(sample, volume = 1) {
  if (!live() || !sample.buffer) return false
  const source = ac.createBufferSource()
  const gain = ac.createGain()
  source.buffer = sample.buffer
  const now = ac.currentTime
  const level = sample.gain * volume
  const end = now + sample.tail
  if (sample.impacts) {
    // Bring each bounce forward and turn down the reflections in the gaps.
    const quiet = level * 0.15
    gain.gain.setValueAtTime(quiet, now)
    for (const impact of sample.impacts) {
      const t = now + impact - sample.offset
      gain.gain.setValueAtTime(quiet, t - 0.005)
      gain.gain.linearRampToValueAtTime(level, t)
      gain.gain.setValueAtTime(level, t + 0.012)
      gain.gain.exponentialRampToValueAtTime(quiet, t + 0.03)
    }
  } else if (sample.naturalTail) {
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(level, now + 0.008)
    gain.gain.setValueAtTime(level, end - 0.02)
  } else {
    gain.gain.setValueAtTime(level, now)
    gain.gain.setValueAtTime(level, now + (sample.fadeAfter ?? 0.024))
    gain.gain.exponentialRampToValueAtTime(level * 0.01, end - 0.01)
  }
  gain.gain.linearRampToValueAtTime(0, end)
  source.connect(gain)
  gain.connect(ac.destination)
  source.start(now, sample.offset)
  source.stop(end)
  return true
}

function context() {
  if (!ac) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    ac = new Ctx()
  }
  if (ac.state !== 'running' && ac.state !== 'closed') ac.resume().catch(() => {})
  return ac
}

function live() {
  return ac && ac.state === 'running'
}

function tone(freq, dur, type, gain, slide) {
  if (!live()) return
  const c = ac
  const t = c.currentTime
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur)
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.connect(g)
  g.connect(c.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

const NOISE_DUR = 0.08
let noiseBuffer = null

function ensureNoise() {
  const c = ac
  if (!c) return null
  if (noiseBuffer && noiseBuffer.sampleRate === c.sampleRate) return noiseBuffer
  const n = Math.max(1, Math.floor(c.sampleRate * NOISE_DUR))
  noiseBuffer = c.createBuffer(1, n, c.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1
  return noiseBuffer
}

function noise(dur, gain, freq) {
  if (!live()) return
  const c = ac
  const buffer = ensureNoise()
  const src = c.createBufferSource()
  src.buffer = buffer
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = 0.7
  const g = c.createGain()
  const t = c.currentTime
  const d = Math.min(dur, NOISE_DUR)
  g.gain.setValueAtTime(gain, t)
  g.gain.linearRampToValueAtTime(0.001, t + d)
  src.connect(filter)
  filter.connect(g)
  g.connect(c.destination)
  src.start(t)
  src.stop(t + d)
}

export const audio = {
  unlock() {
    try {
      const ctx = context()
      if (ctx) loadSamples(ctx)
      ensureNoise()
    } catch {
      // Audio is optional.
    }
  },
  hit(quality, speed = 1) {
    const enemy = quality === 'smash' || quality === 'serve'
    const volume = quality === 'weak' ? 0.7 : quality === 'good' ? 0.85 : 1
    if (playSample(enemy ? samples.enemy : samples.player, volume)) return
    const pitch = 0.9 + speed * 0.18
    if (quality === 'perfect') {
      tone(760 * pitch, 0.09, 'square', 0.07, 1.4)
      noise(0.05, 0.18, 1800)
    } else if (quality === 'good') {
      tone(480 * pitch, 0.07, 'square', 0.06, 0.7)
      noise(0.04, 0.12, 900)
    } else if (quality === 'weak') {
      tone(240 * pitch, 0.1, 'triangle', 0.06, 0.6)
      noise(0.05, 0.08, 400)
    } else if (quality === 'smash') {
      tone(640 * pitch, 0.08, 'square', 0.06, 0.5)
      noise(0.05, 0.16, 1400)
    } else {
      tone(360 * pitch, 0.06, 'square', 0.05, 0.8)
      noise(0.04, 0.1, 800)
    }
  },
  bounce(speed = 1) {
    if (playSample(samples.table)) return
    tone(140 * (0.85 + speed * 0.2), 0.05, 'sine', 0.08, 0.4)
    noise(0.03, 0.1, 300)
  },
  whiff() {
    noise(0.08, 0.06, 220)
  },
  serve() {
    if (playSample(samples.enemy)) return
    tone(420, 0.06, 'square', 0.04, 1.2)
  },
  crowd(won) {
    playSample(won ? samples.crowdWin : samples.crowdLoss)
  },
  point(won) {
    if (won) {
      if (playSample(samples.enemyFail)) return
      tone(523, 0.1, 'triangle', 0.07)
      setTimeout(() => tone(784, 0.16, 'triangle', 0.07), 90)
    } else if (!playSample(samples.fail)) {
      tone(196, 0.14, 'sawtooth', 0.04, 0.6)
    }
  },
}
