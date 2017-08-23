import { AnimationTarget } from './types';
import { mapFlatten } from './lists';
import { isArrayLike, isFunction, isObject, isString } from './inspect';

/**
 * Recursively resolves the element source from dom, selector, jquery, array, and function sources
 * 
 * @param {ElementSource} source from which to locate elements
 * @returns {Element[]} array of elements found
 */
export function getTargets(target: AnimationTarget): AnimationTarget[] {
  if (isString(target)) {
    return [].slice.call(document.querySelectorAll(target as string))
  }
  if (isFunction(target)) {
    // if function, call it and call this function
    return getTargets((target as { (): AnimationTarget })());
  }
  if (isArrayLike(target)) {
    // if array or jQuery object, flatten to an array
    // recursively call this function in case of nested elements
    return mapFlatten(target as any[], t => getTargets(t));
  }
  if (isObject(target)) {
    // if it is an actual object at this point, handle it
    return [target];
  } 
  return [];
}
