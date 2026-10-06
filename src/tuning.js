// Every tunable number in the prototype lives here.
// The debug panel mutates this object live and mirrors it to localStorage.
// Timing windows stay in milliseconds and are shared by all five tiers:
// difficulty comes from flight speed and opponent decisions, not from tighter windows.

export const STORAGE_KEY = 'pongking-tuning-v1'

export const DEFAULTS = {
  version: 5,
  tierIndex: 0,
  pointsToWin: 5,
  contactDelay: 0.09,
  swingDuration: 0.32,
  windows: { perfect: 70, good: 160, weak: 260, late: 90 },
  hitStop: { perfect: 70, good: 30, weak: 0 },
  shake: { perfect: 8, good: 3.5, weak: 1 },
  rallySpeedStep: 0.07,
  rallySpeedMax: 1.55,
  showBounceMarker: true,
  showTimingGuide: false,
  // Balls aimed at the player stay at least this far from the center line,
  // so one button is always the right one.
  minSide: 0.25,
  // Hidden in play. The debug panel can show the bar.
  showStamina: false,
  // Cost of one player hit. Negative restores. Drain scales with rally speed; recovery does not.
  stamina: { perfect: 0.34, good: 0.22, weak: -0.08, speedScale: 1, lowAt: 0.33 },
  // float hangs on the far side, then rushes. spin bounces one way and arrives the other.
  shots: { floatBounceAt: 0.72, floatTime: 1.15, spinBounceAt: 0.46, spinBounce: 0.55 },
  returns: {
    perfect: { speed: 1.34, place: 0.9, apex: 0.62, hop: 0.36 },
    good: { speed: 1.0, place: 0.55, apex: 0.82, hop: 0.48 },
    weak: { speed: 0.78, place: 0.1, apex: 1.05, hop: 0.6 },
  },
  tiers: [
    { name: 'Новичок', flightTime: 1.1, stamina: 1.0, desperation: 0, cornerAccuracy: 0.25, smashRate: 0.05, serveSpread: 0.35, wrongFoot: 0, floatLate: 150, spinCap: 0, shotMix: { flat: 1, float: 0, spin: 0 } },
    { name: 'Клуб', flightTime: 0.96, stamina: 1.3, desperation: 0.15, cornerAccuracy: 0.45, smashRate: 0.12, serveSpread: 0.45, wrongFoot: 0.1, floatLate: 190, spinCap: 0, shotMix: { flat: 0.7, float: 0.3, spin: 0 } },
    { name: 'Лига', flightTime: 0.84, stamina: 1.7, desperation: 0.4, cornerAccuracy: 0.62, smashRate: 0.22, serveSpread: 0.55, wrongFoot: 0.22, floatLate: 240, spinCap: 0, shotMix: { flat: 0.5, float: 0.3, spin: 0.2 } },
    { name: 'Профи', flightTime: 0.72, stamina: 1.5, desperation: 0.7, cornerAccuracy: 0.78, smashRate: 0.35, serveSpread: 0.65, wrongFoot: 0.32, floatLate: 300, spinCap: 3, shotMix: { flat: 0.4, float: 0.3, spin: 0.3 } },
    { name: 'Король', flightTime: 0.66, stamina: 2.2, desperation: 1, cornerAccuracy: 0.9, smashRate: 0.42, serveSpread: 0.75, wrongFoot: 0.4, floatLate: 360, spinCap: 4, shotMix: { flat: 0.34, float: 0.33, spin: 0.33 } },
  ],
  // Placeholder economy for the run wrapper. Not spent in this prototype.
  economy: {
    energyCost: 1,
    energyMax: 5,
    currencyPerWin: [10, 25, 50, 80, 120],
  },
}

export const tuning = structuredClone(DEFAULTS)

export function currentTier() {
  const i = clamp(tuning.tierIndex | 0, 0, tuning.tiers.length - 1)
  tuning.tierIndex = i
  return tuning.tiers[i]
}

export function orderedWindows() {
  const perfect = tuning.windows.perfect
  const good = Math.max(tuning.windows.good, perfect)
  const weak = Math.max(tuning.windows.weak, good)
  const late = Math.max(40, tuning.windows.late ?? 90)
  return { perfect, good, weak, late }
}

export function loadTuning() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw)
    if (!saved || saved.version !== DEFAULTS.version) return
    merge(tuning, saved)
  } catch {
    // Ignore corrupt saves; defaults stay in place.
  }
}

export function saveTuning() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tuning))
  } catch {
    // Private mode can reject storage; tuning still works for the session.
  }
}

export function resetTuning() {
  const fresh = structuredClone(DEFAULTS)
  for (const key of Object.keys(tuning)) delete tuning[key]
  Object.assign(tuning, fresh)
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

function merge(target, saved) {
  for (const key of Object.keys(target)) {
    if (!(key in saved)) continue
    const next = saved[key]
    const cur = target[key]
    if (Array.isArray(cur) && Array.isArray(next)) {
      if (cur.length && typeof cur[0] === 'object') {
        cur.forEach((item, i) => {
          if (next[i] && typeof next[i] === 'object') merge(item, next[i])
        })
      } else {
        for (let i = 0; i < cur.length; i++) {
          if (typeof next[i] === typeof cur[i]) cur[i] = next[i]
        }
      }
    } else if (cur && typeof cur === 'object') {
      if (next && typeof next === 'object') merge(cur, next)
    } else if (typeof next === typeof cur) {
      target[key] = next
    }
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}
