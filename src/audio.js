let ac = null

function context() {
  if (!ac) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    ac = new Ctx()
  }
  if (ac.state === 'suspended') ac.resume()
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
      context()
      ensureNoise()
    } catch {
      // Audio is optional.
    }
  },
  hit(quality, speed = 1) {
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
    tone(140 * (0.85 + speed * 0.2), 0.05, 'sine', 0.08, 0.4)
    noise(0.03, 0.1, 300)
  },
  whiff() {
    noise(0.08, 0.06, 220)
  },
  serve() {
    tone(420, 0.06, 'square', 0.04, 1.2)
  },
  point(won) {
    if (won) {
      tone(523, 0.1, 'triangle', 0.07)
      setTimeout(() => tone(784, 0.16, 'triangle', 0.07), 90)
    } else {
      tone(196, 0.14, 'sawtooth', 0.04, 0.6)
    }
  },
}
