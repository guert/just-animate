import { isArrayLike } from './type'
import { _ } from '.'

const slice = Array.prototype.slice
const push = Array.prototype.push

export interface IList<T> {
  [key: number]: T
  length: number
}

export function includes<T>(items: T[], item: T) {
  return items.indexOf(item) !== -1
}

/**
 * Returns the first object in the list or undefined
 */
export function head<T>(indexed: IList<T>, predicate?: { (t: T): boolean }): T {
  if (!indexed || indexed.length < 1) {
    return _
  }
  if (predicate === _) {
    return indexed[0]
  }
  for (const item of indexed as T[]) {
    if (predicate(item)) {
      return item
    }
  }
  return _
}

/**
 * Returns the last object in the list or undefined
 */
export function tail<T>(indexed: IList<T>, predicate?: { (t: T): boolean }): T {
  var ilen = indexed && indexed.length
  if (!indexed || ilen < 1) {
    return _
  }
  if (predicate === _) {
    return indexed[ilen - 1]
  }
  for (var i = 0; i < ilen; i++) {
    var item = indexed[i]
    if (predicate(item)) {
      return item
    }
  }
  return _
}

/**
 * Returns the index of the first matching item or -1
 */
export function indexOf<T>(items: T[], predicate: { (t: T): boolean }) {
  for (var i = 0, ilen = items.length; i < ilen; i++) {
    var item = items[i]
    if (predicate(item)) {
      return i
    }
  }
  return -1
}

export function sortBy<T>(fieldName: keyof T) {
  return (a: T, b: T) => {
    const a1 = a[fieldName],
      b1 = b[fieldName]
    return a1 < b1 ? -1 : a1 > b1 ? 1 : 0
  }
}

/**
 * Converts list to an Array.
 * Useful for converting NodeList and arguments to []
 * 
 * @export
 * @template T
 * @param {T[]} list to convert
 * @returns {T[]} array clone of list
 */
export function toArray<T>(indexed: IList<T>, index?: number): T[] {
  return slice.call(indexed, index || 0)
}

/**
 * returns an array or an object wrapped in an array
 * 
 * @export
 * @template T
 * @param {(IList<T> | T)} indexed
 * @returns {T[]}
 */
export function listify<T>(indexed: IList<T> | T): T[] {
  return isArrayLike(indexed) ? indexed as T[] : [indexed as T]
}

export function pushAll<T>(items: T[], newItems: T[]) {
  return push.apply(items, newItems)
}

export type AllAction<T1> = (input?: T1, index?: number) => undefined
export type AllFunc<T1, T2> = (input?: T1, index?: number) => T2 | undefined

/**
 * A combination of map/filter/forEach that handles undefined lists
 * @param items 
 * @param action 
 */
export function each<T1>(items: IList<T1>, action: AllAction<T1>): undefined
export function each<T1, T2>(items: IList<T1>, mapper: AllFunc<T1, T2>): T2[]
export function each<T1, T2>(
  items: T1[],
  mapper: AllAction<T1> | AllFunc<T1, T2>
): T2[] | undefined {
  var len = items && items.length
  var i = 0
  var item: T2
  var results: T2[]
  while (i < len) {
    item = mapper(items[i], i)
    if (item) {
      (results || (results = [])).push(item)
    }
    i++
  }
  return len ? results : (items as any) as T2[] | undefined
}
