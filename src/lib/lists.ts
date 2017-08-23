import { isArrayLike, isDefined, isFunction } from './inspect';
import { _ } from './constants'

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
  for (let i = 0, ilen = indexed.length; i < ilen; i++) {
    if (predicate(indexed[i])) {
      return indexed[i]
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
    const a1 = a[fieldName]
    const b1 = b[fieldName]
    return a1 < b1 ? -1 : a1 > b1 ? 1 : 0
  }
}

/**
 * Returns an array if already an array or an object wrapped in an array
 * 
 * @export
 * @template T
 * @param {(IList<T> | T)} indexed
 * @returns {T[]}
 */
export function list<T>(indexed: IList<T> | T): T[] {
  return isArrayLike(indexed) ? indexed as T[] : [indexed as T]
}

/**
 * 
 * @param indexed 
 * @param item 
 */
export function push<T>(indexed: T[], item: T): T {
  Array.prototype.push.call(indexed, item)
  return item
}

export function pushDistinct<T extends string | number>(indexed: T[], item: T): T {
  const index = indexed.indexOf(item)
  if (index !== -1) {
    return item
  }
  push(indexed, item)
  return item
}

export function mapFlatten<TInput, TOutput>(items: TInput[], mapper: (input: TInput) => TOutput | TOutput[]) {
  var results: TOutput[] = []
  for (var i = 0, ilen = items.length; i < ilen; i++) {
    var result = mapper(items[i])
    if (isArrayLike(result)) {
      pushAll(results, result as TOutput[])
    } else {
      push(results, result as TOutput)
    }
  }
  return results
}

/**
 * Pushes multiple items into the array
 * @param items 
 * @param newItems 
 */
function pushAll<T>(items: T[], newItems: T[]) {
  for (let i = 0, ilen = newItems.length; i < ilen; i++) {
    if (isDefined(newItems[i])) {
      push(items, newItems[i])
    }
  }
}

export type Action<T1> = (input: T1, index: number, len: number) => void
export type ActionWithBreak<T1> = (input: T1, index: number, len: number) => void | false
export type Mapper<T1, T2> = (t1?: T1, index?: number, len?: number) => T2

/**
 * iterates over all items until [false] is returned or it runs out of items
 * @param items 
 * @param action 
 */
export function forEach<T1>(items: IList<T1>, action: Action<T1>): void
export function forEach<T1>(items: IList<T1>, action: ActionWithBreak<T1>): void
export function forEach<T1>(items: IList<T1>, action: Action<T1> | ActionWithBreak<T1>): void {
  if (items) {
    for (let i = 0, ilen = items.length; i < ilen; i++) {
      if (action(items[i], i, ilen) === false) {
        break
      }
    }
  }
}

/**
 * iterates over all items until [false] is returned or it runs out of items
 * @param items 
 * @param action 
 */
export function map<TInput, TOutput>(items: IList<TInput>, func: Mapper<TInput, TOutput>) {
  if (!items) {
    return []
  }
  var results: TOutput[] = []
  for (let i = 0, ilen = items.length; i < ilen; i++) {
    push(results, func(items[i], i, ilen))
  }
  return results
}
