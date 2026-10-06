import { tuning, currentTier, saveTuning, resetTuning } from './tuning.js'

const GLOBALS = [
  ['windows.perfect', 'Идеально, ±мс', 20, 160, 1],
  ['windows.good', 'Хорошо, ±мс', 60, 300, 1],
  ['windows.weak', 'Рано: слабо, мс', 100, 480, 1],
  ['windows.late', 'Поздно, мс', 40, 260, 1],
  ['contactDelay', 'Задержка удара, с', 0.03, 0.2, 0.005],
  ['hitStop.perfect', 'Стоп кадра, идеально, мс', 0, 140, 1],
  ['hitStop.good', 'Стоп кадра, хорошо, мс', 0, 100, 1],
  ['shake.perfect', 'Тряска, идеально', 0, 18, 0.5],
  ['shake.good', 'Тряска, хорошо', 0, 12, 0.5],
  ['rallySpeedStep', 'Ускорение за удар', 0, 0.25, 0.005],
  ['rallySpeedMax', 'Потолок скорости', 1, 2.2, 0.05],
  ['pointsToWin', 'Очков до победы', 1, 11, 1],
  ['receiveShift.perfect', 'Идеально: промах ИИ', 0, 0.6, 0.01],
  ['receiveShift.good', 'Хорошо: промах ИИ', -0.1, 0.4, 0.01],
  ['receiveShift.weak', 'Слабо: промах ИИ', -0.6, 0.2, 0.01],
  ['returns.perfect.speed', 'Скорость идеального', 0.8, 1.8, 0.01],
  ['returns.good.speed', 'Скорость хорошего', 0.6, 1.5, 0.01],
  ['returns.weak.speed', 'Скорость слабого', 0.45, 1.2, 0.01],
  ['returns.perfect.place', 'Угол идеального', 0, 1, 0.01],
  ['returns.good.place', 'Угол хорошего', 0, 1, 0.01],
  ['returns.weak.place', 'Угол слабого', 0, 1, 0.01],
]

const TIER_FIELDS = [
  ['flightTime', 'Время полёта, с', 0.4, 1.5, 0.01],
  ['receiveSkill', 'Навык приёма', 0, 1, 0.01],
  ['cornerAccuracy', 'Удар в угол', 0, 1, 0.01],
  ['smashRate', 'Частота смэша', 0, 1, 0.01],
  ['serveSpread', 'Разброс подачи', 0, 1, 0.01],
]

export function mountDebug(session, match, { onRestart, onTier }) {
  const root = document.getElementById('debug')
  root.innerHTML = ''
  const head = el('div', 'debug-head')
  const title = el('div', 'debug-title', 'Тюнинг')
  const close = button('Закрыть', () => toggle())
  close.className = 'debug-close'
  head.append(title, close)
  const hint = el('p', 'debug-hint', 'Клавиши 1–5 меняют соперника и начинают матч заново. Стрелки бьют слева и справа.')
  root.append(head, hint)

  const tel = el('div', 'telemetry')
  root.append(tel)

  const tiers = el('div', 'tier-row')
  tuning.tiers.forEach((tier, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = String(i + 1)
    b.title = tier.name
    b.addEventListener('click', () => onTier(i))
    tiers.append(b)
  })
  root.append(section('Соперник'), tiers)

  const tierBox = el('div', 'sliders')
  root.append(tierBox)

  root.append(section('Ощущение удара'))
  const globalBox = el('div', 'sliders')
  GLOBALS.forEach((spec) => globalBox.append(slider(spec, () => tuning)))
  root.append(globalBox)

  root.append(section('Подсказки'))
  root.append(checkbox('showBounceMarker', 'Метка отскока'))
  root.append(checkbox('showTimingGuide', 'Шкала тайминга'))

  root.append(section('Экономика'))
  const econ = el('div', 'sliders')
  econ.append(slider(['economy.energyCost', 'Энергия за заход', 0, 5, 1], () => tuning))
  econ.append(slider(['economy.energyMax', 'Максимум энергии', 1, 10, 1], () => tuning))
  tuning.economy.currencyPerWin.forEach((_, i) => {
    econ.append(
      slider([`economy.currencyPerWin.${i}`, `Награда: ${tuning.tiers[i].name}`, 0, 300, 1], () => tuning),
    )
  })
  root.append(econ)

  const actions = el('div', 'debug-actions')
  actions.append(button('Сыграть заново', onRestart))
  actions.append(
    button('Сбросить статистику', () => {
      session.qualities = { perfect: 0, good: 0, weak: 0, miss: 0, wrong: 0 }
      session.timingErrors = []
      session.rallyLengths = []
      session.byTier = tuning.tiers.map(() => ({ wins: 0, losses: 0 }))
    }),
  )
  actions.append(
    button('Скачать JSON', () => {
      const text = JSON.stringify(tuning, null, 2)
      const blob = new Blob([text], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'pong-king-tuning.json'
      a.click()
      URL.revokeObjectURL(a.href)
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {})
    }),
  )
  actions.append(
    button('Вернуть исходные', () => {
      resetTuning()
      sync()
      onRestart()
    }),
  )
  root.append(actions)

  function sync() {
    root.querySelectorAll('input[data-path]').forEach((input) => {
      const target = input.dataset.scope === 'tier' ? currentTier() : tuning
      input.value = String(getPath(target, input.dataset.path))
    })
    root.querySelectorAll('input[data-flag]').forEach((input) => {
      input.checked = Boolean(tuning[input.dataset.flag])
    })
    tiers.querySelectorAll('button').forEach((b, i) => {
      b.classList.toggle('active', i === tuning.tierIndex)
    })
    tierBox.innerHTML = ''
    const name = el('div', 'tier-name', currentTier().name)
    tierBox.append(name)
    TIER_FIELDS.forEach((spec) => tierBox.append(slider(spec, currentTier, 'tier')))
  }

  function paintTelemetry() {
    if (root.hidden) return
    const q = session.qualities
    const attempts = q.perfect + q.good + q.weak + q.miss + q.wrong
    const timed = session.timingErrors
    const avg = timed.length ? timed.reduce((s, n) => s + n, 0) / timed.length : 0
    const sorted = [...timed].sort((a, b) => a - b)
    const mid = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
    const rallies = session.rallyLengths
    const rallyAvg = rallies.length ? rallies.reduce((s, n) => s + n, 0) / rallies.length : 0
    const sign = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(0)} мс`
    const rows = tuning.tiers
      .map((tier, i) => {
        const rec = session.byTier[i] || { wins: 0, losses: 0 }
        const total = rec.wins + rec.losses
        const rate = total ? Math.round((rec.wins / total) * 100) : 0
        return `${tier.name.padEnd(8, ' ')} ${rec.wins}–${rec.losses}  ${total ? rate + '%' : '—'}`
      })
      .join('\n')
    const phase = { ready: 'готов', flight: 'полёт', point: 'очко', over: 'конец' }[match.phase] || match.phase
    const flight = match.shot ? match.shot.flightTime.toFixed(2).replace('.', ',') : '—'
    tel.textContent = [
      `фаза ${phase}   мяч ${flight} с   скорость ${match.rallySpeed.toFixed(2).replace('.', ',')}`,
      `идеально ${q.perfect}   хорошо ${q.good}   слабо ${q.weak}   мимо ${q.miss}   не туда ${q.wrong}   (${attempts})`,
      `тайминг, среднее ${sign(avg)}   медиана ${sign(mid)}`,
      `плюс\u00A0— опоздание`,
      `розыгрыш ${rallyAvg.toFixed(1).replace('.', ',')}   очков ${rallies.length}`,
      rows,
    ].join('\n')
  }

  sync()
  setInterval(paintTelemetry, 200)
  return { sync, toggle, isOpen: () => !root.hidden }

  function toggle() {
    root.hidden = !root.hidden
    const tune = document.getElementById('tune')
    const open = !root.hidden
    tune.textContent = open ? 'Закрыть' : 'Тюнинг'
    tune.setAttribute('aria-expanded', open ? 'true' : 'false')
    if (open) sync()
  }
}

function slider([path, label, min, max, step], targetFn, scope) {
  const wrap = el('label', 'row')
  const name = el('span', 'row-label', label)
  const value = el('span', 'row-value', '')
  const input = document.createElement('input')
  input.type = 'range'
  input.min = String(min)
  input.max = String(max)
  input.step = String(step)
  input.dataset.path = path
  if (scope) input.dataset.scope = scope
  const pull = () => getPath(targetFn(), path)
  input.value = String(pull())
  value.textContent = format(pull(), step)
  input.addEventListener('input', () => {
    const n = Number(input.value)
    setPath(targetFn(), path, n)
    value.textContent = format(n, step)
    saveTuning()
  })
  const top = el('div', 'row-top')
  top.append(name, value)
  wrap.append(top, input)
  return wrap
}

function checkbox(flag, label) {
  const wrap = el('label', 'check')
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.dataset.flag = flag
  input.checked = Boolean(tuning[flag])
  input.addEventListener('change', () => {
    tuning[flag] = input.checked
    saveTuning()
  })
  wrap.append(input, document.createTextNode(label))
  return wrap
}

function section(text) {
  return el('div', 'debug-section', text)
}

function button(text, fn) {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = text
  b.addEventListener('click', fn)
  return b
}

function el(tag, className, text) {
  const node = document.createElement(tag)
  node.className = className
  if (text != null) node.textContent = text
  return node
}

function format(n, step) {
  if (step >= 1) return String(Math.round(n))
  const digits = step < 0.01 ? 3 : 2
  return Number(n).toFixed(digits).replace('.', ',')
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => o[k], obj)
}

function setPath(obj, path, value) {
  const keys = path.split('.')
  let cursor = obj
  for (let i = 0; i < keys.length - 1; i++) cursor = cursor[keys[i]]
  cursor[keys[keys.length - 1]] = value
}
