// Tiny synthesized SFX for the Ludo game.
// No audio file dependencies — every effect is built from oscillators and
// envelopes so the bundle stays small and the sounds load instantly.

type Osc = OscillatorType

interface AudioState {
  ctx: AudioContext | null
  master: GainNode | null
  muted: boolean
}

const state: AudioState = {
  ctx: null,
  master: null,
  muted: false,
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!state.ctx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    state.ctx = new Ctx()
    state.master = state.ctx.createGain()
    state.master.gain.value = 0.6
    state.master.connect(state.ctx.destination)
  }
  // Browsers suspend the context until user gesture; resume opportunistically.
  if (state.ctx.state === 'suspended') {
    void state.ctx.resume()
  }
  return state.ctx
}

export function setMuted(muted: boolean) {
  state.muted = muted
  if (state.master) state.master.gain.value = muted ? 0 : 0.6
}

export function isMuted() {
  return state.muted
}

// One short tone with a gain envelope.
function tone(opts: {
  freq: number
  duration: number
  type?: Osc
  volume?: number
  delay?: number
  freqEnd?: number // optional pitch ramp
}) {
  if (state.muted) return
  const ctx = getCtx()
  if (!ctx || !state.master) return
  const { freq, duration, type = 'sine', volume = 0.25, delay = 0, freqEnd } = opts
  const t0 = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 0.01), t0 + duration)
  }
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(gain)
  gain.connect(state.master)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

// Quick filtered noise burst — used for the dice rattle.
function noise(opts: { duration: number; volume?: number; delay?: number }) {
  if (state.muted) return
  const ctx = getCtx()
  if (!ctx || !state.master) return
  const { duration, volume = 0.12, delay = 0 } = opts
  const t0 = ctx.currentTime + delay
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1800
  filter.Q.value = 0.9
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, t0)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(state.master)
  src.start(t0)
  src.stop(t0 + duration + 0.02)
}

export function playDice() {
  // Rattling dice — noise burst + a couple of percussive clicks.
  noise({ duration: 0.18, volume: 0.18 })
  tone({ freq: 210, duration: 0.06, type: 'square', volume: 0.18, delay: 0.02 })
  tone({ freq: 280, duration: 0.06, type: 'square', volume: 0.15, delay: 0.09 })
  tone({ freq: 360, duration: 0.08, type: 'triangle', volume: 0.18, delay: 0.18 })
}

export function playMove() {
  // Soft wooden tap.
  tone({ freq: 520, duration: 0.08, type: 'sine', volume: 0.22, freqEnd: 380 })
}

export function playCapture() {
  // Low thump + descending sweep.
  tone({ freq: 140, duration: 0.18, type: 'sawtooth', volume: 0.3, freqEnd: 60 })
  tone({ freq: 320, duration: 0.22, type: 'triangle', volume: 0.18, delay: 0.04, freqEnd: 100 })
}

export function playBonus() {
  // Bright arpeggio for a bonus turn / 6 rolled.
  tone({ freq: 523, duration: 0.12, type: 'triangle', volume: 0.22 })
  tone({ freq: 659, duration: 0.12, type: 'triangle', volume: 0.22, delay: 0.1 })
  tone({ freq: 784, duration: 0.18, type: 'triangle', volume: 0.22, delay: 0.2 })
}

export function playHome() {
  // Token reached center.
  tone({ freq: 659, duration: 0.12, type: 'triangle', volume: 0.22 })
  tone({ freq: 988, duration: 0.18, type: 'triangle', volume: 0.22, delay: 0.1 })
}

export function playVictory() {
  // C major fanfare.
  const notes = [523, 659, 784, 1047]
  notes.forEach((n, i) => {
    tone({ freq: n, duration: 0.32, type: 'triangle', volume: 0.28, delay: i * 0.14 })
  })
  // sparkle on top
  tone({ freq: 1568, duration: 0.4, type: 'sine', volume: 0.22, delay: 0.6 })
}

export function playClick() {
  tone({ freq: 600, duration: 0.04, type: 'square', volume: 0.12 })
}

// Initialise the AudioContext on the first user gesture — required by browser
// autoplay policy. Idempotent.
let bootstrapped = false
export function bootstrapAudioOnFirstGesture() {
  if (bootstrapped || typeof window === 'undefined') return
  bootstrapped = true
  const unlock = () => {
    getCtx() // creates + resumes
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}
