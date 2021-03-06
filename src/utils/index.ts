import {
  RouteLocationNormalized,
  RouteParams,
  RouteComponent,
  RouteLocationNormalizedLoaded,
} from '../types'
import { guardToPromiseFn } from './guardToPromiseFn'
import { RouteRecord, RouteRecordNormalized } from '../matcher/types'
import { LocationQueryValue } from './query'
import { hasSymbol } from './injectionSymbols'

export * from './guardToPromiseFn'

function isESModule(obj: any): obj is { default: RouteComponent } {
  return obj.__esModule || (hasSymbol && obj[Symbol.toStringTag] === 'Module')
}

type GuardType = 'beforeRouteEnter' | 'beforeRouteUpdate' | 'beforeRouteLeave'

export function extractComponentsGuards(
  matched: RouteRecordNormalized[],
  guardType: GuardType,
  to: RouteLocationNormalized,
  from: RouteLocationNormalizedLoaded
) {
  const guards: Array<() => Promise<void>> = []

  for (const record of matched) {
    for (const name in record.components) {
      const rawComponent = record.components[name]
      if (typeof rawComponent === 'function') {
        // start requesting the chunk already
        const componentPromise = rawComponent().catch(() => null)
        guards.push(async () => {
          const resolved = await componentPromise
          if (!resolved) throw new Error('TODO: error while fetching')
          const resolvedComponent = isESModule(resolved)
            ? resolved.default
            : resolved
          // replace the function with the resolved component
          record.components[name] = resolvedComponent
          const guard = resolvedComponent[guardType]
          return (
            // @ts-ignore: the guards matched the instance type
            guard && guardToPromiseFn(guard, to, from, record.instances[name])()
          )
        })
      } else {
        const guard = rawComponent[guardType]
        guard &&
          // @ts-ignore: the guards matched the instance type
          guards.push(guardToPromiseFn(guard, to, from, record.instances[name]))
      }
    }
  }

  return guards
}

export function applyToParams(
  fn: (v: string) => string,
  params: RouteParams | undefined
): RouteParams {
  const newParams: RouteParams = {}

  for (const key in params) {
    const value = params[key]
    newParams[key] = Array.isArray(value) ? value.map(fn) : fn(value)
  }

  return newParams
}

export function isSameRouteRecord(a: RouteRecord, b: RouteRecord): boolean {
  // since the original record has an undefined value for aliasOf
  // but all aliases point to the original record, this will always compare
  // the original record
  return (a.aliasOf || a) === (b.aliasOf || b)
}

export function isSameLocationObject(
  a: RouteLocationNormalized['query'],
  b: RouteLocationNormalized['query']
): boolean
export function isSameLocationObject(
  a: RouteLocationNormalized['params'],
  b: RouteLocationNormalized['params']
): boolean
export function isSameLocationObject(
  a: RouteLocationNormalized['query' | 'params'],
  b: RouteLocationNormalized['query' | 'params']
): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  let i = 0
  let key: string
  while (i < aKeys.length) {
    key = aKeys[i]
    if (key !== bKeys[i]) return false
    if (!isSameLocationObjectValue(a[key], b[key])) return false
    i++
  }

  return true
}

function isSameLocationObjectValue(
  a: LocationQueryValue | LocationQueryValue[],
  b: LocationQueryValue | LocationQueryValue[]
): boolean
function isSameLocationObjectValue(a: RouteParams, b: RouteParams): boolean
function isSameLocationObjectValue(
  a: LocationQueryValue | LocationQueryValue[] | RouteParams,
  b: LocationQueryValue | LocationQueryValue[] | RouteParams
): boolean {
  if (typeof a !== typeof b) return false
  // both a and b are arrays
  if (Array.isArray(a))
    return (
      a.length === (b as any[]).length &&
      a.every((value, i) => value === (b as LocationQueryValue[])[i])
    )
  return a === b
}
