import {
  S_FINISHED,
  S_IDLE,
  S_PAUSED,
  S_PENDING,
  S_RUNNING,
  _,
  CANCEL,
  FINISH,
  PAUSE,
  REVERSE,
  UPDATE,
  PLAY
} from './constants';

import { getPlugins } from './plugins';
import { loopOn, loopOff } from './timeloop';
import { toEffects, addPropertyKeyframes } from './effects';
import {
  // sortBy,
  forEach,
  push,
  mapFlatten,
  list,
  includes,
  head,
  sortBy,
  map
} from './lists';
import {
  isDefined, 
  isNumber,
  isObject,
  isString
} from './inspect';
import { getTargets } from './get-targets';
import { max, inRange, minMax, flr } from './math';

import {
  AddAnimationOptions,
  AnimationOptions,
  BaseAnimationOptions,
  Effect,
  AnimationTimelineController,
  ITimeline,
  BaseSetOptions,
  TargetConfiguration,
  PropertyKeyframe,
  PropertyOptions,
  PropertyValueOptions,
  PropertyValue,
  PropertyObject
} from './types';
import { resolveProperty } from './resolve-property'; 
import { resolveRefs, replaceWithRefs } from './references';

const propKeyframeSort = sortBy<PropertyKeyframe>('time')

const timelineProto: ITimeline = {
  get currentTime() {
    return this._time;
  },
  set currentTime(time: number) {
    const self = this;
    time = +time;
    self._time = isFinite(time) ? time : self._rate < 0 ? self.duration : 0;
    updateTimeline(self, UPDATE);
  },
  get playbackRate() {
    return this._rate;
  },
  set playbackRate(rate: number) {
    const self = this;
    self._rate = +rate || 1;
    updateTimeline(self, REVERSE);
  },
  add(this: ITimeline, opts: AddAnimationOptions | AddAnimationOptions[]) {
    const self = this;

    list(opts).forEach(opt => {
      const _nextTime = self._nextTime;
      const hasTo = isDefined(opt.to);
      const hasFrom = isDefined(opt.from);
      const hasDuration = isDefined(opt.duration);

      // pretty exaustive rules for importing times
      let from: number, to: number;
      if (hasFrom && hasTo) {
        from = opt.from;
        to = opt.to;
      } else if (hasFrom && hasDuration) {
        from = opt.from;
        to = from + opt.duration;
      } else if (hasTo && hasDuration) {
        to = opt.to;
        from = to - opt.duration;
      } else if (hasTo && !hasDuration) {
        from = _nextTime;
        to = from + opt.to;
      } else if (hasDuration) {
        from = _nextTime;
        to = from + opt.duration;
      } else {
        throw new Error('Missing duration');
      }
      insert(self, from, to, opt);
    });

    // recalculate property keyframe times and total duration
    estimateTimes(self);
    return self;
  },
  fromTo(
    this: ITimeline,
    from: number,
    to: number,
    options: BaseAnimationOptions | BaseAnimationOptions[]
  ) {
    const self = this;

    list(options).forEach(options2 => insert(self, from, to, options2));

    // recalculate property keyframe times and total duration
    estimateTimes(self);
    return self;
  },
  cancel(this: ITimeline) {
    return updateTimeline(this, CANCEL);
  },
  finish(this: ITimeline) {
    return updateTimeline(this, FINISH);
  },
  on(this: ITimeline, eventName: string, listener: (time: number) => void) {
    const self = this;
    const { _listeners } = self;

    const listeners = _listeners[eventName] || (_listeners[eventName] = []);
    if (listeners.indexOf(listener) === -1) {
      push(listeners, listener);
    }

    return self;
  },
  off(this: ITimeline, eventName: string, listener: (time: number) => void) {
    const self = this;
    const listeners = self._listeners[eventName];
    if (listeners) {
      const indexOfListener = listeners.indexOf(listener);
      if (indexOfListener !== -1) {
        listeners.splice(indexOfListener, 1);
      }
    }
    return self;
  },
  pause(this: ITimeline) {
    return updateTimeline(this, PAUSE);
  },
  play(this: ITimeline, options?: { repeat?: number; alternate?: boolean }) {
    const self = this;
    if (options) {
      self._repeat = options.repeat;
      self._alternate = options.alternate === true;
    }

    self._repeat = self._repeat || 1;
    self._alternate = self._alternate || false;
    self._state = S_RUNNING;
    return updateTimeline(self, PLAY);
  },
  reverse(this: ITimeline) {
    const self = this;
    self.playbackRate = (self.playbackRate || 0) * -1;
    return self;
  },
  seek(this: ITimeline, time: number) {
    const self = this;
    self.currentTime = time;
    return self;
  },
  set(this: ITimeline, options: BaseSetOptions | BaseSetOptions[]) {
    const self = this;
    const pluginNames = Object.keys(getPlugins());

    list(options).forEach(opts => {
      const at = opts.at || self._nextTime;
      const opts2 = {} as BaseAnimationOptions;

      for (var name in opts) {
        if (includes(pluginNames, name)) {
          // if property is going to be handled by a plugin, replace each of its properties with an array with an empty spot
          // this empty will be resolved when the timeline creates effects
          const props = opts[name];
          const props2 = {} as typeof props;
          for (var propName in props) {
            props2[propName] = [_, props[propName]];
          }
          opts2[name] = props2;
        } else {
          opts2[name] = opts[name];
        }
      }
      // insert from (time - super small decimal) + the time specified, this should create a tween that is effectively
      // so small as to not occur in most cases.  This should "look like" setting it
      insert(self, max(at - 0.00000000001, 0), at, opts2);
    });

    estimateTimes(self);
    return self;
  },
  getEffects(this: ITimeline): Effect[] {
    const self = this
    const plugins = getPlugins();
    const targetConfig = resolveTargetConfig(self)
    
    return mapFlatten(Object.keys(targetConfig), pluginName =>
      toEffects(plugins[pluginName], targetConfig[pluginName])
    );
  }
};

function insert(
  self: ITimeline,
  from: number,
  to: number,
  options2: BaseAnimationOptions
) {
  const refs = self._refs
  const options = self._options  
  options2 = replaceWithRefs(options2, refs, true) as BaseAnimationOptions
  
  const delay: any = options2.delay;
  const endDelay: any = options2.endDelay;

  for (var pluginName in getPlugins()) {
    if (!options2.hasOwnProperty(pluginName)) {
      continue
    }
    
    const props = options2[pluginName] as PropertyOptions
    for (var propName in props) { 
      var prop = props[propName]
      var isObj = isObject(prop)
      var propAsObj = prop as PropertyValueOptions
      var defaultEasing = (isObj && propAsObj.easing) || options2.easing || _
      var defaultInterpolator = (isObj && propAsObj.interpolate) || _
      var valueList = list(isObj ? propAsObj.value : prop as any) as (PropertyValue | PropertyObject)[]
      
      var values = map(valueList, v => { 
        var isPropObj = isDefined(v) && !isNumber(v) && !isString(v)
        var propObj = v as PropertyObject 
        
        return {
          value: isPropObj && propObj.value !== _
            ? propObj.value as PropertyValue
            : v as PropertyValue,
          offset: isPropObj && propObj.offset !== _ ? propObj.offset : _,
          easing: (isPropObj && propObj.easing) || defaultEasing,
          interpolate: (isPropObj && propObj.interpolate) || defaultInterpolator
        } 
      })
      
      const config: AnimationOptions = {
        targets: options2.targets,
        from: from,
        to: to,
        duration: to - from,
        easing: options2.easing,
        stagger: options2.stagger || 0,
        prop: propName,
        plugin: pluginName,
        values: values,
        delay: delay,
        endDelay: endDelay,
        interpolate: propAsObj.interpolate
      } 
      push(options, config);
    } 
  }
}

function estimateTimes(self: ITimeline) {
  let timelineTo = 0;
  let maxNextTime = 0;

  forEach(self._options, config => {
    const endDelay = isNumber(config.endDelay) ? config.endDelay as number : 0;
    timelineTo = max(timelineTo, config.to);
    maxNextTime = max(timelineTo + endDelay, maxNextTime);
  });

  self._nextTime = maxNextTime;
  self.duration = timelineTo;
}
function setupEffects(self: ITimeline) {
  if (self._effects) {
    return;
  }
  
  const animations: AnimationTimelineController[] = [];
  const plugins = getPlugins();
  const targetConfig = resolveTargetConfig(self);

  // calculate max duration
  let duration = 0  
  for (let pluginName in plugins) { 
    const options = targetConfig[pluginName];
    if (options) {
      duration = max(...options.map(o => o.to).concat(duration));
    }
  }
  
  self.duration = duration;
  self._nextTime = duration;
  
  for (let pluginName in plugins) {
    const plugin = plugins[pluginName];
    const options = targetConfig[pluginName];
    if (!options) {
      continue;
    }

    const effects = toEffects(plugin, options);

    forEach(effects, effect => {
      const controller = plugin.animate(effect) as AnimationTimelineController;
      if (controller) {
        controller.from = effect.from;
        controller.to = effect.to;
        push(animations, controller);
      }
    }); 
  }
 
  self._time = self._rate < 0 ? self.duration : 0;
  self._effects = animations;
}

function resolveTargetConfig(self: ITimeline) {
  const plugins = getPlugins();
  
  const options = resolveRefs(self._options, self._refs, true) as typeof self._options

  const result: { [pluginName: string]: TargetConfiguration[] } = {};  
  forEach(options, options2 => {
    for (let pluginName in plugins) {
      if (options2.plugin !== pluginName) {
        continue;
      }

      const config =
        result[pluginName] ||
        (result[pluginName] = [] as TargetConfiguration[]);

      // add all targets as property keyframes
      forEach(getTargets(options2.targets), (target, i, ilen) => {
        
        const delay = resolveProperty(options2.delay as number, target, i, ilen) || 0;
        const endDelay = resolveProperty(options2.endDelay as number, target, i, ilen) || 0
        
        const targetConfig =
          head(config, (t2: TargetConfiguration) => t2.target === target) ||
          push(config, {
            from: max(options2.from + delay, 0),
            to: max(options2.to + delay, 0),
            easing: options2.easing || 'ease',
            duration: options2.to - options2.from,
            endDelay: endDelay,
            target: target,
            targetLength: ilen,
            keyframes: [],
            propNames: []
          });

        addPropertyKeyframes(targetConfig, i, options2); 
      });

      // sort property keyframes
      forEach(config, (c: TargetConfiguration) =>
        c.keyframes.sort(propKeyframeSort)
      );
    }
  });
  return result;
}

function updateTimeline(self: ITimeline, type: string) {
  // update state and loop
  if (type === CANCEL) {
    self._iteration = 0;
    self._state = S_IDLE;
  } else if (type === FINISH) {
    self._iteration = 0;
    self._state = S_FINISHED;
    if (!self._alternate) {
      self._time = self._rate < 0 ? 0 : self.duration;
    }
  } else if (type === PAUSE) {
    self._state = S_PAUSED;
  } else if (type === PLAY) {
    // set current time (this will automatically start playing when the _state is running)
    const isForwards = self._rate >= 0;
    if (isForwards && self._time === self.duration) {
      self._time = 0;
    } else if (!isForwards && self._time === 0) {
      self._time = self.duration;
    }
  }

  // check current state
  const isTimelineActive = self._state === S_RUNNING;
  const isTimelineInEffect = self._state !== S_IDLE;
  const time = self.currentTime;

  // setup effects if required
  if (isTimelineInEffect && self._effects === _) {
    setupEffects(self);
  }

  // update effect clocks
  if (isTimelineInEffect) {
    // update effects
    forEach(self._effects, effect => {
      const { from, to } = effect;
      const isAnimationActive =
        isTimelineActive && inRange(flr(time), from, to);
      const offset = minMax((time - from) / ((to - from) || 1), 0, 1); 
      effect.update(offset, self._rate, isAnimationActive);
    });
  }

  // remove tick from loop if no timelines are active
  if (!isTimelineActive) {
    loopOff(self._tick);
  }
  if (type === PLAY) {
    loopOn(self._tick);
  }

  // teardown/destroy
  if (!isTimelineInEffect) {
    forEach(self._effects, effect => effect.cancel());
    self._time = 0;
    self._iteration = _;
    self._effects = _;
  }

  // call extra update event on finish
  if (type === FINISH) {
    forEach(self._listeners[UPDATE], c => c(time));
  }

  // notify event listeners
  forEach(self._listeners[type], c => c(time));
  return self;
}

function tick(self: ITimeline, delta: number) {
  const playState = self._state;

  // canceled
  if (playState === S_IDLE) {
    updateTimeline(self, CANCEL);
    return;
  }
  // finished
  if (playState === S_FINISHED) {
    updateTimeline(self, FINISH);
    return;
  }
  // paused
  if (playState === S_PAUSED) {
    updateTimeline(self, PAUSE);
    return;
  }

  // calculate running range
  const duration = self.duration;
  const repeat = self._repeat;
  const rate = self._rate;
  const isReversed = rate < 0;

  // set time use existing
  let time = self._time === _ ? (rate < 0 ? duration : 0) : self._time;

  let iteration = self._iteration || 0;

  if (self._state === S_PENDING) {
    self._state = S_RUNNING;

    // reset position properties if necessary
    if (
      time === _ ||
      (isReversed && time > duration) ||
      (!isReversed && time < 0)
    ) {
      // if at finish, reset to start time
      time = isReversed ? duration : 0;
    }
    if (iteration === repeat) {
      // if at finish reset iterations to 0
      iteration = 0;
    }
  }

  time += delta * rate;

  // check if timeline has finished
  let iterationEnded = false;
  if (!inRange(time, 0, duration)) {
    self._iteration = ++iteration;
    time = isReversed ? 0 : duration;
    iterationEnded = true;

    // reverse direction on alternate
    if (self._alternate) {
      self._rate = (self._rate || 0) * -1;
    }

    // reset the clock
    time = self._rate < 0 ? duration : 0;
  }

  // call update
  self._iteration = iteration;
  self._time = time;

  if (!iterationEnded) {
    // if not ended, return early
    forEach(self._listeners[UPDATE], c => c(time));
    updateTimeline(self, UPDATE);
    return;
  }

  if (repeat === iteration) {
    // end the cycle
    updateTimeline(self, FINISH);
    return;
  }

  // if not the last iteration reprocess this tick from the new starting point/direction
  forEach(self._listeners[UPDATE], c => c(time));
  updateTimeline(self, UPDATE);
}

/**
 * Animation timeline control.  Defines animation definition methods like .fromTo() and player controls like .play()
 */
export function timeline(options?: TimelineOptions): ITimeline {
  const self: ITimeline = Object.create(timelineProto);
  // initialize default values
  self.duration = 0;
  self._alternate = false;
  self._options = [];
  self._listeners = {};
  self._nextTime = 0;
  self._rate = 1;
  self._state = S_IDLE;
  self._time = 0;

  // copy all references
  const refs = {};
  if (options && options.refs) {
    for (const r in options.refs) {
      if (refs.hasOwnProperty(r)) {
        refs['@' + r] = options.refs[r];
      }
    }
  }
  self._refs = refs;

  self._tick = delta => tick(self, delta);
  return self;
}

export interface TimelineOptions {
  refs?: { [atName: string]: any };
}
