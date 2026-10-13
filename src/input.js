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
  })
  tune.addEventListener('pointerup', (e) => {
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

  // iOS will not scroll a nested panel while the page cancels touchmove,
  // so the tuning list is moved by hand. A sideways drag on a slider still moves it.
  let scroll = null
  let originX = 0
  let originY = 0
  let lastY = 0
  let gesture = ''
  const endTouch = () => {
    scroll = null
    gesture = ''
  }
  document.body.addEventListener('touchstart', (e) => {
    scroll = e.target.closest?.('.debug-scroll') || null
    originX = e.touches[0].clientX
    originY = e.touches[0].clientY
    lastY = originY
    gesture = ''
  }, { passive: true })
  document.body.addEventListener('touchmove', (e) => {
    if (!scroll) {
      e.preventDefault()
      return
    }
    const x = e.touches[0].clientX
    const y = e.touches[0].clientY
    if (!gesture) {
      const dx = x - originX
      const dy = y - originY
      if (Math.hypot(dx, dy) < 8) return
      const slider = e.target.closest?.('input[type="range"]')
      gesture = slider && Math.abs(dx) > Math.abs(dy) ? 'slider' : 'scroll'
    }
    if (gesture !== 'scroll') return
    scroll.scrollTop += lastY - y
    lastY = y
    e.preventDefault()
  }, { passive: false })
  document.body.addEventListener('touchend', endTouch)
  document.body.addEventListener('touchcancel', endTouch)
}
