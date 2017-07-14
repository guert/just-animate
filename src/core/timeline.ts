import * as types from '../types'
import {
  D_ALTERNATIVE,
  D_NORMAL,
  S_FINISHED,
  S_IDLE,
  S_PAUSED,
  S_PENDING,
  S_RUNNING
} from '../constants'

import {
  _,
  convertToMs,
  getTargets,
  inRange,
  isDefined,
  isArrayLike,
  sortBy,
  head,
  CANCEL,
  FINISH,
  PAUSE,
  PLAY,
  SEEK,
  UPDATE,
  max,
  each
} from '../utils'

import { loop, getPlugins } from '.'
import { toEffects, addKeyframes } from './effects'
import { inferOffsets, propsToKeyframes } from '../transformers'

const propKeyframeSort = sortBy<types.PropertyKeyframe>('time')

export class Timeline {
  public duration: number
  public playbackRate: number

  private _state: number
  private _config: types.TargetConfiguration[]
  private _effects: types.AnimationController[]
  private _times: number
  private _iteration: number
  private _time: number
  private _dir: number
  private _listeners: { [key: string]: { (time: number): void }[] }

  public get currentTime() {
    return this._time
  }
  public set currentTime(time: number) {
    this.seek(time)
  }

  constructor() {
    const self = this
    self.duration = 0
    self._time = _
    self.playbackRate = 1
    self._state = S_IDLE
    self._effects = _
    self._config = []
    self._iteration = _
    self._dir = D_NORMAL
    self._times = _
    self._listeners = {}
  }

  public add(opts: types.AddAnimationOptions) {
    const { duration } = this
    const hasTo = isDefined(opts.to)
    const hasFrom = isDefined(opts.from)
    const hasDuration = isDefined(opts.duration)

    // pretty exaustive rules for importing times
    let from: number, to: number
    if (hasFrom && hasTo) {
      from = convertToMs(opts.from)
      to = convertToMs(opts.to)
    } else if (hasFrom && hasDuration) {
      from = convertToMs(opts.from)
      to = from + convertToMs(opts.duration)
    } else if (hasTo && hasDuration) {
      to = convertToMs(opts.to)
      from = to - convertToMs(opts.duration)
    } else if (hasTo && !hasDuration) {
      from = duration
      to = from + convertToMs(opts.to)
    } else if (hasDuration) {
      from = duration
      to = from + convertToMs(opts.duration)
    } else {
      throw new Error('Please provide to/from/duration')
    }

    // ensure from/to is not negative
    from = max(from, 0)
    to = max(to, 0)

    return this.fromTo(from, to, opts)
  }

  public fromTo(
    from: number | string,
    to: number | string,
    options: types.BaseAnimationOptions
  ) {
    const config = this._config

    if (isArrayLike(options.css)) {
      // fill in missing offsets
      inferOffsets(options.css as types.KeyframeOptions[])
    } else {
      // convert properties to offsets
      options.css = propsToKeyframes(options.css as types.PropertyOptions)
    }

    // ensure to/from are in milliseconds (as numbers)
    const options2 = options as types.AnimationOptions
    options2.from = convertToMs(from)
    options2.to = convertToMs(to)
    options2.duration = options2.to - options2.from

    // add all targets as property keyframes
    const targets = getTargets(options.targets)
    each(targets, (target, i) => {
      var targetConfig = head(config, t2 => t2.target === target)

      if (!targetConfig) {
        targetConfig = {
          from: options2.from,
          to: options2.to,
          duration: options2.to - options2.from,
          target,
          keyframes: [],
          propOrder: {}
        }
        config.push(targetConfig)
      }

      addKeyframes(targetConfig, i, options2)
    })

    // sort property keyframes
    each(config, c => c.keyframes.sort(propKeyframeSort))

    // recalculate property keyframe times and total duration
    this._calcTimes()
    return this
  }

  public to(toTime: string | number, opts: types.ToAnimationOptions) {
    const { duration } = this
    const to = convertToMs(toTime)

    let fromTime: number
    if (isDefined(opts.from)) {
      fromTime = convertToMs(opts.from)
    } else if (isDefined(opts.duration)) {
      fromTime = to - convertToMs(opts.duration)
    } else {
      fromTime = duration
    }

    return this.fromTo(max(fromTime, 0), to, opts)
  }

  public cancel() {
    const self = this
    loop.off(self._tick)
    self._time = 0
    self._iteration = _
    self._state = S_IDLE
    each(self._effects, c => c(CANCEL, 0, self.playbackRate))
    each(self._listeners[CANCEL], c => c(0))
    self._teardown()
    return self
  }

  public finish() {
    const self = this
    self._setup()
    loop.off(self._tick)
    self._time = _
    self._iteration = _
    self._state = S_FINISHED
    each(self._effects, c => c(FINISH, _, self.playbackRate))
    each(self._listeners[FINISH], c => c(_))
    return self
  }

  public on(eventName: string, listener: () => void) {
    const self = this
    const { _listeners } = self

    const listeners = _listeners[eventName] || (_listeners[eventName] = [])
    if (listeners.indexOf(listener) === -1) {
      listeners.push(listener)
    }

    return self
  }
  public off(eventName: string, listener: () => void) {
    const self = this
    const listeners = self._listeners[eventName]
    if (listeners) {
      const indexOfListener = listeners.indexOf(listener)
      if (indexOfListener !== -1) {
        listeners.splice(indexOfListener, 1)
      }
    }
    return self
  }

  public pause() {
    const self = this
    const { currentTime, playbackRate, _listeners, _time } = self
    loop.off(self._tick)
    self._setup()
    self._state = S_PAUSED
    each(self._effects, e => e(PAUSE, currentTime, playbackRate))
    each(_listeners[PAUSE], c => c(_time))
    return self
  }

  public play(iterations = 1, dir = D_NORMAL) {
    const self = this
    self._setup()
    self._times = iterations
    self._dir = dir

    if (
      self._state === S_PAUSED ||
      (self._state !== S_RUNNING && self._state !== S_PENDING)
    ) {
      self._state = S_PENDING
    }

    loop.on(self._tick)
    each(self._listeners[PLAY], c => c(self._time))
    return self
  }

  public reverse() {
    const self = this
    self.playbackRate = (self.playbackRate || 0) * -1

    if (self._state === S_RUNNING) {
      // if currently running, pause the animation and replay from that position
      self.pause().play()
    }
    return self
  }

  public seek(time: number | string) {
    const self = this
    const timeMs = convertToMs(time)
    self._time = timeMs
    each(self._effects, e => e(SEEK, timeMs, self.playbackRate))
  }

  public getEffects(): types.Effect[] {
    return toEffects(this._config)
  }

  private _calcTimes() {
    const self = this
    let timelineTo = 0

    each(self._config, target => {
      const { keyframes } = target

      var targetFrom: number
      var targetTo: number

      each(keyframes, keyframe => {
        if (keyframe.time < targetFrom || targetFrom === undefined) {
          targetFrom = keyframe.time
        }
        if (keyframe.time > targetTo || targetTo === undefined) {
          targetTo = keyframe.time
          if (keyframe.time > timelineTo) {
            timelineTo = keyframe.time
          }
        }
      })

      target.to = targetTo
      target.from = targetFrom
      target.duration = targetTo - targetFrom
    })

    self.duration = timelineTo
  }

  private _setup(): void {
    const self = this
    if (!self._effects) {
      const effects = toEffects(self._config)
      const plugins = getPlugins()
      const animations: types.AnimationController[] = []
      each(plugins, p => p.animate(effects, animations))
      self._effects = animations
    }
  }

  private _teardown(): void {
    const self = this
    self._effects = _
  }

  private _tick = (delta: number) => {
    const self = this
    const playState = self._state

    // canceled
    if (playState === S_IDLE) {
      self.cancel()
      return
    }
    // finished
    if (playState === S_FINISHED) {
      self.finish()
      return
    }
    // paused
    if (playState === S_PAUSED) {
      self.pause()
      return
    }
    // running/pending

    // calculate running range
    const duration = self.duration
    const iterations = self._times
    const playbackRate = self.playbackRate
    const isReversed = playbackRate < 0

    let time = self._time
    let iteration = self._iteration || 0

    if (self._state === S_PENDING) {
      // reset position properties if necessary
      if (
        time === _ ||
        (isReversed && time > duration) ||
        (!isReversed && time < 0)
      ) {
        // if at finish, reset to start time
        time = isReversed ? duration : 0
      }
      if (iteration === iterations) {
        // if at finish reset iterations to 0
        iteration = 0
      }
      self._state = S_RUNNING
    }

    time += delta * playbackRate

    // check if timeline has finished
    let hasEnded = false
    if (!inRange(time, 0, duration)) {
      self._iteration = ++iteration
      time = isReversed ? 0 : duration
      hasEnded = true
    }

    // call update
    self._iteration = iteration
    self._time = time
    each(self._listeners[UPDATE], c => c(time))
    each(self._effects, c => c(UPDATE, time, playbackRate))

    if (!hasEnded) {
      // if not ended, return early
      return
    }

    if (iterations === iteration) {
      // end the cycle
      self.finish()
      return
    }

    if (self._dir === D_ALTERNATIVE) {
      // change direction
      self.playbackRate = (self.playbackRate || 0) * -1
    }

    // if not the last iteration, reset the clock and call tick again
    time = self.playbackRate < 0 ? duration : 0
    self._time = time
    self._tick(0)
  }
}
