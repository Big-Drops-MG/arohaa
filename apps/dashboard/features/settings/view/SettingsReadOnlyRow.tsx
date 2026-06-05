type SettingsReadOnlyRowProps = {
  label: string
  value: string
}

export function SettingsReadOnlyRow({
  label,
  value,
}: SettingsReadOnlyRowProps) {
  return (
    <div className="grid gap-1 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-start sm:gap-4">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm break-all text-foreground">{value}</dd>
    </div>
  )
}
