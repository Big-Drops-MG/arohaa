const DEVICES = new Set(['mobile', 'tablet', 'desktop'])

export const HEATMAP_EVENT_NAMES = new Set([
  'heatmap_click',
  'heatmap_move',
  'heatmap_section',
])

export function isHeatmapEvent(ev: string): boolean {
  return HEATMAP_EVENT_NAMES.has(ev)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isUnitInterval(value: unknown): boolean {
  return isFiniteNumber(value) && value >= 0 && value <= 1
}

function isPositiveNumber(value: unknown): boolean {
  return isFiniteNumber(value) && value > 0
}

function isDevice(value: unknown): boolean {
  return typeof value === 'string' && DEVICES.has(value)
}

function requireUnit(
  props: Record<string, unknown>,
  key: string,
): string | null {
  if (!isUnitInterval(props[key])) {
    return `props.${key} must be a number between 0 and 1`
  }
  return null
}

function requirePositive(
  props: Record<string, unknown>,
  key: string,
): string | null {
  if (!isPositiveNumber(props[key])) {
    return `props.${key} must be a positive number`
  }
  return null
}

function requireDevice(props: Record<string, unknown>): string | null {
  if (!isDevice(props.device)) {
    return 'props.device must be mobile, tablet, or desktop'
  }
  return null
}

function requireSelector(props: Record<string, unknown>): string | null {
  const selector = props.selector
  if (typeof selector !== 'string' || selector.length === 0) {
    return 'props.selector must be a non-empty string'
  }
  if (selector.length > 500) {
    return 'props.selector must be at most 500 characters'
  }
  return null
}


export function validateHeatmapProps(
  ev: string,
  props: Record<string, unknown> | undefined,
): string | null {
  if (!isHeatmapEvent(ev)) return null

  const p = props ?? {}

  if (ev === 'heatmap_click') {
    for (const key of ['x', 'y', 'vx', 'vy'] as const) {
      const err = requireUnit(p, key)
      if (err) return err
    }
    const sel = requireSelector(p)
    if (sel) return sel
    for (const key of ['vw', 'vh'] as const) {
      const err = requirePositive(p, key)
      if (err) return err
    }
    const deviceErr = requireDevice(p)
    if (deviceErr) return deviceErr
    if (typeof p.rage !== 'boolean') {
      return 'props.rage must be a boolean'
    }
    return null
  }

  if (ev === 'heatmap_move') {
    for (const key of ['vx', 'vy'] as const) {
      const err = requireUnit(p, key)
      if (err) return err
    }
    for (const key of ['vw', 'vh'] as const) {
      const err = requirePositive(p, key)
      if (err) return err
    }
    return requireDevice(p)
  }

  if (ev === 'heatmap_section') {
    const sel = requireSelector(p)
    if (sel) return sel
    if (!isFiniteNumber(p.dwell_ms) || p.dwell_ms < 0) {
      return 'props.dwell_ms must be a number >= 0'
    }
    return null
  }

  return null
}
