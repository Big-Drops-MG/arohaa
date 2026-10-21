export type SemanticHook = (
  event: string,
  props: Record<string, unknown>,
) => void

let hook: SemanticHook | null = null

export function registerSemanticHook(next: SemanticHook): void {
  hook = next
}

export function runSemanticHook(
  event: string,
  props: Record<string, unknown>,
): void {
  if (!hook) return
  try {
    hook(event, props)
  } catch {
    /* side effects must never block the event */
  }
}
