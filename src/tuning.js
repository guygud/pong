// Every tunable number in the prototype lives here.
// The debug panel mutates this object live and mirrors it to localStorage.
// Timing windows stay in milliseconds and are shared by all five tiers:
// difficulty comes from flight speed and opponent decisions, not from tighter windows.

export const STORAGE_KEY = 'pongking-tuning-v1'

export const DEFAULTS = {
  version: 2,
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
  // How much a given quality shifts the opponent's receive chance.
  // Positive means the opponent is more likely to miss.
  receiveShift: { perfect: 0.22, good: 0.08, weak: -0.28 },
  returns: {
    perfect: { speed: 1.34, place: 0.9, apex: 0.62, hop: 0.36 },
    good: { speed: 1.0, place: 0.55, apex: 0.82, hop: 0.48 },
    weak: { speed: 0.78, place: 0.1, apex: 1.05, hop: 0.6 },
  },
  tiers: [
    { name: 'Новичок', flightTime: 1.1, receiveSkill: 0.45, cornerAccuracy: 0.25, smashRate: 0.05, serveSpread: 0.35 },
    { name: 'Клуб', flightTime: 0.96, receiveSkill: 0.6, cornerAccuracy: 0.45, smashRate: 0.12, serveSpread: 0.45 },
    { name: 'Лига', flightTime: 0.84, receiveSkill: 0.74, cornerAccuracy: 0.62, smashRate: 0.22, serveSpread: 0.55 },
    { name: 'Профи', flightTime: 0.72, receiveSkill: 0.86, cornerAccuracy: 0.78, smashRate: 0.35, serveSpread: 0.65 },
    { name: 'Король', flightTime: 0.62, receiveSkill: 0.94, cornerAccuracy: 0.9, smashRate: 0.5, serveSpread: 0.75 },
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
