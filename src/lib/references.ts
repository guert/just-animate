import {
  isString,
  isArrayLike,
  isFunction,
  isNumber,
  isDOM,
  isDefined
} from './inspect';
import { mapFlatten, map } from './lists';

export interface Refs {
  [atName: string]: any;
}

let refId = 0

const objNameExp = /\[object ([a-z]+)\]/i;

function getName(target: any) {
  let name = target.id || target.name
  if (!name) {
    name = Object.prototype.toString.call(target)
    const matches = objNameExp.exec(name)
    if (matches) {
      name = matches[1]
    }
  }
  return '@' + name + '_' + (++refId)
}

function assignRef<T>(target: T, refs: Refs): T | string {
  for (var ref in refs) {
    if (refs[ref] === target) {
      return ref
    }
  }
  
  const refName = getName(target)
  refs[refName] = target
  return refName
}

export function replaceWithRefs<T>(target: T, refs: Refs, recurseObjects: boolean): T | string {
  if (!isDefined(target) || isString(target) || isNumber(target)) {
    return target
  }
  if (isArrayLike(target)) {
    return mapFlatten(target as any, (t: any) => replaceWithRefs(t, refs, recurseObjects)) as any
  }
  if (isFunction(target)) {
    return assignRef(target, refs)
  }
  if (recurseObjects) {
    for (var name in target as {}) {
      if (target.hasOwnProperty(name)) {
        target[name] = replaceWithRefs(target[name], refs, recurseObjects && name !== 'targets')
      }
    }
    return target
  }
  
  return assignRef(target, refs)
}

export function resolveRefs(value: any, refs: Refs, recurseObjects: boolean): any {
  if (!isDefined(value) || isNumber(value) || isFunction(value)) {
    return value;
  }
  if (isString(value)) {
    const str = value as string
    return refs.hasOwnProperty(str) && str.charAt(0) === '@'
      ? refs[str]
      : str;
  }
  if (isArrayLike(value)) {
    return map(value as any[], v => resolveRefs(v, refs, recurseObjects))
  }
  if (!recurseObjects || isDOM(value)) {
    return value
  } 
   
  var obj2 = {}
  for (var name in value) {
    if (value.hasOwnProperty(name)) {
      const value2 = value[name] 
      obj2[name] = recurseObjects
        ? resolveRefs(value2, refs, name !== 'targets')
        : value2
    } 
  }
  return obj2
}
