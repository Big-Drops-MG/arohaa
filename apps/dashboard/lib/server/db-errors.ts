export function isUniqueViolation(err: unknown): boolean {
  const e = err as {
    code?: string
    cause?: { code?: string }
    message?: string
  }
  const code = e?.code ?? e?.cause?.code
  return (
    code === "23505" ||
    (typeof e?.message === "string" && e.message.includes("duplicate key"))
  )
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
