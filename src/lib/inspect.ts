export function isDefined(a: any) {
  return !!a || a === 0 || a === false
}
export function isFunction(a: any) {
  return typeof a === 'function'
}
export function isNumber(a: any) {
  return typeof a === 'number'
}
export function isObject(a: any) {
  return typeof a === 'object' && !!a && !isArrayLike(a)
}
export function isString(a: any) {
  return typeof a === 'string'
}
export function isArrayLike(a: any) {
  return a && isFinite(a.length) && !isString(a) && !isFunction(a)
}
export function isSVG(target: SVGElement | any) {
  return target instanceof SVGElement
}
export function isDOM(target: Node | any) {
  return target && target.nodeType || isSVG(target)
}
