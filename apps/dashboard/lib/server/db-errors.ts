export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err
  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (typeof current !== "object" || current === null) break
    const record = current as {
      code?: string
      cause?: unknown
      message?: string
    }
    if (record.code === "23505") return true
    if (
      typeof record.message === "string" &&
      record.message.includes("duplicate key")
    ) {
      return true
    }
    current = record.cause
  }
  return false
}

export function uniqueViolationMessage(err: unknown, fallback: string): string {
  const message =
    err && typeof err === "object" && "message" in err
      ? String((err as { message?: string }).message ?? "")
      : ""

  if (message.includes("experiment_landing_page_id_uidx")) {
    return "An experiment already exists for this project"
  }
  if (message.includes("experiment_variant_label_experiment_label_uidx")) {
    return "That variant label is already used in this experiment"
  }
  if (message.includes("landing_page_utm_param_page_key_value_uidx")) {
    return "That UTM parameter already exists"
  }

  return fallback
}
