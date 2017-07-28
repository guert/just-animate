import { caf, now, raf } from './utils'
import { _ } from './constants'
import { push } from './lists';

const active: TimeLoopCallback[] = []
const elapses: number[] = []

let lastHandle: number = _
let lastTime: number = _

export type TimeLoopCallback = (delta: number, elapsed: number) => any

function cancel() {
  caf(lastHandle)
  lastHandle = lastTime = _
}

function update() {
  const len = active.length

  lastTime = lastTime || now()
  const thisTime = now()
  const delta = thisTime - lastTime

  // if not is subscribed, kill the cycle
  if (!len) {
    // end recursion
    cancel()
    return
  }

  // ensure running and requestAnimationFrame is called
  lastTime = thisTime
  lastHandle = raf(update)

  for (let i = 0; i < len; i++) {
    // update delta and save result
    const existingElapsed = elapses[i]
    const updatedElapsed = existingElapsed + delta
    elapses[i] = updatedElapsed

    // call sub with updated delta
    active[i](delta, updatedElapsed)
  }
}

export function loopOn(fn: TimeLoopCallback) {
  const indexOfSub = active.indexOf(fn)
  if (indexOfSub === -1) {
    push(active, fn)
    push(elapses, 0)
  }

  if (!lastHandle) {
    lastHandle = raf(update)
  }
}

export function loopOff(fn: TimeLoopCallback) {
  const indexOfSub = active.indexOf(fn)
  if (indexOfSub !== -1) {
    active.splice(indexOfSub, 1)
    elapses.splice(indexOfSub, 1)
  }

  if (!active.length) {
    cancel()
  }
}