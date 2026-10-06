export function bindInput({ onHit, onConfirm, onPause, onDebug, onTier }) {
  const hitL = document.getElementById('hitL')
  const hitR = document.getElementById('hitR')
  const pause = document.getElementById('pause')
  const tune = document.getElementById('tune')
  const frame = document.getElementById('frame')

  const press = (side, event) => {
    event.preventDefault()
    event.stopPropagation()
    onHit(side)
  }
  hitL.addEventListener('pointerdown', (e) => press('L', e))
  hitR.addEventListener('pointerdown', (e) => press('R', e))

  pause.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onPause()
  })

  tune.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onDebug()
  })

  frame.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#controls, #pause, #tune')) return
    onConfirm()
  })

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return
    if (e.code === 'ArrowLeft' || e.code === 'KeyZ' || e.code === 'KeyA') {
      e.preventDefault()
      onHit('L')
    } else if (e.code === 'ArrowRight' || e.code === 'KeyX' || e.code === 'Slash') {
      e.preventDefault()
      onHit('R')
    } else if (e.code === 'KeyD') {
      onDebug()
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      onPause()
    } else if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      onConfirm()
    } else if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5))
      if (n >= 1 && n <= 5) onTier(n - 1)
    }
  })

  document.body.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })
}
