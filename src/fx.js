export function createFx() {
  return {
    hitStop: 0,
    shake: 0,
    squash: 0,
    punch: 1,
    particles: [],
    popups: [],
  }
}

export function spawnHit(fx, quality, x, y) {
  const text = { perfect: 'ИДЕАЛЬНО', good: 'ХОРОШО', weak: 'СЛАБО' }[quality] || quality
  fx.popups.push({ text, x, y: y - 24, life: 0.72, max: 0.72, size: quality === 'perfect' ? 32 : 26 })
  fx.squash = quality === 'weak' ? 0.2 : 0.5
  fx.punch = quality === 'perfect' ? 1.4 : quality === 'good' ? 1.18 : 1.05
  const n = quality === 'perfect' ? 14 : quality === 'good' ? 9 : 5
  burst(fx, x, y, n, quality === 'perfect' ? 280 : 180)
}

export function spawnWhiff(fx, text, x, y) {
  fx.popups.push({ text, x, y: y - 16, life: 0.55, max: 0.55, size: 22 })
}

export function spawnBounce(fx, x, y) {
  fx.squash = 0.55
  burst(fx, x, y, 4, 90)
}

function burst(fx, x, y, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const s = speed * (0.4 + Math.random() * 0.8)
    fx.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 40,
      life: 0.28 + Math.random() * 0.12,
      max: 0.4,
      w: 2 + Math.random() * 3,
    })
  }
}

export function updateFx(fx, dt) {
  fx.shake *= Math.exp(-dt * 9)
  if (fx.shake < 0.2) fx.shake = 0
  fx.squash = Math.max(0, fx.squash - dt * 3.2)
  fx.punch += (1 - fx.punch) * Math.min(1, dt * 12)
  for (const p of fx.particles) {
    p.life -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 520 * dt
  }
  fx.particles = fx.particles.filter((p) => p.life > 0)
  for (const p of fx.popups) {
    p.life -= dt
    p.y -= 36 * dt
  }
  fx.popups = fx.popups.filter((p) => p.life > 0)
}
