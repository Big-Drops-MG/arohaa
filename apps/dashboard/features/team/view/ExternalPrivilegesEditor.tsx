"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, ChevronRight, Search, X } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  EXTERNAL_PRIVILEGE_TABS,
  type ExternalPrivilegeGrant,
  type ExternalProjectScope,
} from "@/features/team/model/external-privileges"
import type { ProjectTabValue } from "@/features/dashboard/model/project-tab"

export type PrivilegeProjectOption = {
  publicId: string
  brandName: string
}

type ExternalPrivilegesEditorProps = {
  projects: PrivilegeProjectOption[]
  grants: ExternalPrivilegeGrant[]
  onChange: (grants: ExternalPrivilegeGrant[]) => void
  scopes: ExternalProjectScope[]
  onScopesChange: (scopes: ExternalProjectScope[]) => void
  disabled?: boolean
}

const privilegeCheckboxClassName =
  "size-4 shrink-0 appearance-none rounded border border-neutral-300 bg-white checked:border-neutral-900 checked:bg-white checked:bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22none%22%20stroke%3D%22%23171717%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3.5%208.5%206.5%2011.5%2012.5%204.5%22%2F%3E%3C%2Fsvg%3E')] checked:bg-center checked:bg-no-repeat disabled:cursor-not-allowed disabled:opacity-50"

function grantKey(
  publicId: string,
  tab: ProjectTabValue,
  section: string
): string {
  return `${publicId}::${tab}::${section}`
}

function parseGrantKey(key: string): ExternalPrivilegeGrant | null {
  const parts = key.split("::")
  if (parts.length < 2) return null
  const [publicId, tab, ...sectionParts] = parts
  if (!publicId || !tab) return null
  return {
    landingPagePublicId: publicId,
    tab: tab as ProjectTabValue,
    section: sectionParts.join("::"),
  }
}

function ProjectUtmSourceMultiSelect({
  publicId,
  values,
  onChange,
  disabled,
}: {
  publicId: string
  values: string[]
  onChange: (utmSources: string[]) => void
  disabled?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [draft, setDraft] = useState<string[]>(values)
  const [options, setOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    void fetch(
      `/api/landing-pages/${encodeURIComponent(publicId)}/utm-values?dim=utm_source`,
      { cache: "no-store" }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load UTM sources")
        return (await res.json()) as string[]
      })
      .then((nextValues) => {
        if (cancelled) return
        const list = Array.isArray(nextValues)
          ? nextValues.filter((v) => typeof v === "string" && v.trim())
          : []
        setOptions(list)
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([])
          setLoadError("Could not load UTM sources for this project.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [publicId])

  useEffect(() => {
    if (values.length === 0) return
    setOptions((prev) => {
      const missing = values.filter((value) => !prev.includes(value))
      if (missing.length === 0) return prev
      return [...prev, ...missing].sort((a, b) => a.localeCompare(b))
    })
  }, [values])

  useEffect(() => {
    if (!open) return
    setDraft(values)
  }, [open, values])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  const selected = useMemo(() => new Set(draft), [draft])

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => option.toLowerCase().includes(q))
  }, [options, search])

  const isDirty = useMemo(() => {
    if (draft.length !== values.length) return true
    const applied = new Set(values)
    return draft.some((value) => !applied.has(value))
  }, [draft, values])

  function toggleValue(value: string) {
    setDraft((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value)
      }
      return [...prev, value].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      )
    })
  }

  function applyDraft() {
    onChange(draft)
    setOpen(false)
  }

  function clearDraft() {
    setDraft([])
  }

  const triggerLabel =
    values.length === 0
      ? loading
        ? "Loading sources…"
        : "Select utm_source"
      : values.length === 1
        ? values[0]
        : `${values.length} sources selected`

  return (
    <div className="space-y-1.5 pb-2" ref={rootRef}>
      <label className="text-xs font-medium text-foreground">
        UTM Source <span className="text-destructive">*</span>
      </label>

      <div className="relative">
        <button
          type="button"
          disabled={disabled || loading}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="Select UTM Sources for this project"
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-left text-sm shadow-xs",
            "hover:border-neutral-300 focus-visible:border-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-900/10 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            open && "border-neutral-400 ring-2 ring-neutral-900/10"
          )}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              values.length === 0 ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {triggerLabel}
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-neutral-400 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>

        {open ? (
          <div
            className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg ring-1 shadow-neutral-950/8 ring-black/5"
            role="listbox"
            aria-multiselectable
          >
            <div className="border-b border-neutral-200 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-neutral-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search sources…"
                  className="h-8 border-neutral-200 bg-white pl-8 text-sm shadow-none focus-visible:border-neutral-400 focus-visible:ring-neutral-900/10"
                  aria-label="Search UTM sources"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto py-1">
              {loading ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  Loading…
                </p>
              ) : filteredOptions.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {search.trim()
                    ? "No matching sources"
                    : "No utm_source values found for this project."}
                </p>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = selected.has(option)
                  return (
                    <button
                      key={option}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50",
                        isSelected && "bg-neutral-50"
                      )}
                      onClick={() => toggleValue(option)}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border bg-white",
                          isSelected
                            ? "border-neutral-900"
                            : "border-neutral-300"
                        )}
                        aria-hidden
                      >
                        {isSelected ? (
                          <Check
                            className="size-2.5 text-neutral-900"
                            strokeWidth={3}
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{option}</span>
                    </button>
                  )
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-neutral-200 bg-neutral-50 px-3 py-2">
              <button
                type="button"
                className={cn(
                  "text-xs font-medium",
                  draft.length > 0
                    ? "text-neutral-700 hover:text-neutral-950"
                    : "cursor-default text-neutral-400"
                )}
                disabled={draft.length === 0}
                onClick={clearDraft}
              >
                Clear
              </button>
              <Button
                type="button"
                size="sm"
                className="h-8 px-3"
                disabled={!isDirty}
                onClick={applyDraft}
              >
                Apply
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-700"
            >
              <span className="truncate">{value}</span>
              <button
                type="button"
                className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50"
                disabled={disabled}
                aria-label={`Remove ${value}`}
                onClick={() =>
                  onChange(values.filter((item) => item !== value))
                }
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {loadError ? (
        <p className="text-xs text-destructive">{loadError}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          This collaborator only sees traffic for the selected source
          {values.length === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  )
}

export function ExternalPrivilegesEditor({
  projects,
  grants,
  onChange,
  scopes,
  onScopesChange,
  disabled,
}: ExternalPrivilegesEditorProps) {
  const [checkedProjects, setCheckedProjects] = useState<Set<string>>(
    () =>
      new Set([
        ...grants.map((g) => g.landingPagePublicId),
        ...scopes.map((s) => s.landingPagePublicId),
      ])
  )
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () =>
      new Set([
        ...grants.map((g) => g.landingPagePublicId),
        ...scopes.map((s) => s.landingPagePublicId),
      ])
  )
  const [expandedTabs, setExpandedTabs] = useState<Set<string>>(() => {
    const next = new Set<string>()
    for (const g of grants) {
      if (g.section) next.add(`${g.landingPagePublicId}::${g.tab}`)
    }
    return next
  })
  const [searchQuery, setSearchQuery] = useState("")

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((project) =>
      project.brandName.toLowerCase().includes(q)
    )
  }, [projects, searchQuery])

  const grantSet = useMemo(() => {
    const set = new Set<string>()
    for (const g of grants) {
      set.add(grantKey(g.landingPagePublicId, g.tab, g.section || ""))
    }
    return set
  }, [grants])

  const utmByProject = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const scope of scopes) {
      const source = scope.utmSource.trim()
      if (!source) continue
      const existing = map.get(scope.landingPagePublicId) ?? []
      if (!existing.includes(source)) {
        existing.push(source)
        map.set(scope.landingPagePublicId, existing)
      }
    }
    for (const [publicId, sources] of map) {
      map.set(
        publicId,
        [...sources].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        )
      )
    }
    return map
  }, [scopes])

  const selectedProjects = useMemo(() => {
    const set = new Set(checkedProjects)
    for (const g of grants) set.add(g.landingPagePublicId)
    for (const s of scopes) set.add(s.landingPagePublicId)
    return set
  }, [checkedProjects, grants, scopes])

  function setGrantsFromKeys(keys: Set<string>) {
    const next: ExternalPrivilegeGrant[] = []
    for (const key of keys) {
      const parsed = parseGrantKey(key)
      if (!parsed) continue
      next.push(parsed)
    }
    onChange(next)
  }

  function setUtmSources(publicId: string, utmSources: string[]) {
    const next = scopes.filter((s) => s.landingPagePublicId !== publicId)
    for (const source of utmSources) {
      const trimmed = source.trim()
      if (!trimmed) continue
      next.push({ landingPagePublicId: publicId, utmSource: trimmed })
    }
    onScopesChange(next)
  }

  function clearProjectScope(publicId: string) {
    onScopesChange(scopes.filter((s) => s.landingPagePublicId !== publicId))
  }

  function toggleProject(publicId: string, checked: boolean) {
    setCheckedProjects((prev) => {
      const next = new Set(prev)
      if (checked) next.add(publicId)
      else next.delete(publicId)
      return next
    })

    if (checked) {
      setExpandedProjects((prev) => new Set(prev).add(publicId))
      return
    }

    setExpandedProjects((prev) => {
      const copy = new Set(prev)
      copy.delete(publicId)
      return copy
    })
    setExpandedTabs((prev) => {
      const copy = new Set(prev)
      for (const key of [...copy]) {
        if (key.startsWith(`${publicId}::`)) copy.delete(key)
      }
      return copy
    })

    const nextGrants = new Set(grantSet)
    for (const key of [...nextGrants]) {
      if (key.startsWith(`${publicId}::`)) nextGrants.delete(key)
    }
    setGrantsFromKeys(nextGrants)
    clearProjectScope(publicId)
  }

  function isTabSelected(publicId: string, tab: ProjectTabValue): boolean {
    for (const key of grantSet) {
      if (key.startsWith(`${publicId}::${tab}::`)) return true
    }
    return false
  }

  function toggleTab(publicId: string, tab: ProjectTabValue, checked: boolean) {
    if (checked && !(utmByProject.get(publicId)?.length ?? 0)) return

    const next = new Set(grantSet)
    const tabDef = EXTERNAL_PRIVILEGE_TABS.find((t) => t.value === tab)
    const expandKey = `${publicId}::${tab}`

    for (const key of [...next]) {
      if (key.startsWith(`${publicId}::${tab}::`)) next.delete(key)
    }

    if (checked) {
      setCheckedProjects((prev) => new Set(prev).add(publicId))
      if (tabDef && tabDef.sections.length > 0) {
        for (const section of tabDef.sections) {
          next.add(grantKey(publicId, tab, section.id))
        }
        setExpandedTabs((prev) => new Set(prev).add(expandKey))
      } else {
        next.add(grantKey(publicId, tab, ""))
      }
    } else {
      setExpandedTabs((prev) => {
        const copy = new Set(prev)
        copy.delete(expandKey)
        return copy
      })
    }

    setGrantsFromKeys(next)
  }

  function isSectionSelected(
    publicId: string,
    tab: ProjectTabValue,
    sectionId: string
  ): boolean {
    return grantSet.has(grantKey(publicId, tab, sectionId))
  }

  function toggleSection(
    publicId: string,
    tab: ProjectTabValue,
    sectionId: string,
    checked: boolean
  ) {
    if (checked && !(utmByProject.get(publicId)?.length ?? 0)) return

    const next = new Set(grantSet)
    next.delete(grantKey(publicId, tab, ""))
    const key = grantKey(publicId, tab, sectionId)
    if (checked) next.add(key)
    else next.delete(key)
    setGrantsFromKeys(next)
  }

  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No projects available. Create a landing page first, then assign
        privileges.
      </p>
    )
  }

  return (
    <div className="space-y-3 p-0.5">
      <p className="text-xs text-muted-foreground">
        Access is read-only. Choose a project, pick one or more UTM Sources,
        then enable tabs and sections. Team and Ops are never available to
        external members.
      </p>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search projects..."
          className="h-9 rounded-lg border-neutral-200 bg-white pl-8 text-sm shadow-xs"
          aria-label="Search projects"
          disabled={disabled}
        />
      </div>
      {filteredProjects.length === 0 ? (
        <p className="rounded-lg border border-border bg-neutral-50 px-3 py-6 text-center text-sm text-muted-foreground">
          No projects match &ldquo;{searchQuery.trim()}&rdquo;.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-white">
          {filteredProjects.map((project) => {
            const projectOn = selectedProjects.has(project.publicId)
            const expanded = expandedProjects.has(project.publicId)
            const utmSources = utmByProject.get(project.publicId) ?? []
            const tabsEnabled = utmSources.length > 0
            return (
              <li key={project.publicId}>
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className={privilegeCheckboxClassName}
                    checked={projectOn}
                    disabled={disabled}
                    onChange={(e) =>
                      toggleProject(project.publicId, e.target.checked)
                    }
                    aria-label={`Show project ${project.brandName}`}
                  />
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm font-medium text-foreground disabled:opacity-50"
                    disabled={!projectOn || disabled}
                    onClick={() =>
                      setExpandedProjects((prev) => {
                        const copy = new Set(prev)
                        if (copy.has(project.publicId)) {
                          copy.delete(project.publicId)
                        } else {
                          copy.add(project.publicId)
                        }
                        return copy
                      })
                    }
                  >
                    {expanded ? (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{project.brandName}</span>
                    {projectOn && utmSources.length > 0 ? (
                      <span className="truncate text-xs font-normal text-muted-foreground">
                        ·{" "}
                        {utmSources.length === 1
                          ? utmSources[0]
                          : `${utmSources.length} sources`}
                      </span>
                    ) : null}
                  </button>
                </div>

                {projectOn && expanded ? (
                  <div className="space-y-2 border-t border-border bg-neutral-50/80 px-3 py-2 pl-9">
                    <ProjectUtmSourceMultiSelect
                      publicId={project.publicId}
                      values={utmSources}
                      onChange={(next) => setUtmSources(project.publicId, next)}
                      disabled={disabled}
                    />

                    {!tabsEnabled ? (
                      <p className="pb-1 text-xs text-muted-foreground">
                        Select at least one UTM Source to enable tabs for this
                        project.
                      </p>
                    ) : null}

                    <ul
                      className={cn(
                        "space-y-0.5",
                        !tabsEnabled && "pointer-events-none opacity-50"
                      )}
                    >
                      {EXTERNAL_PRIVILEGE_TABS.map((tab) => {
                        const tabOn = isTabSelected(project.publicId, tab.value)
                        const tabExpandKey = `${project.publicId}::${tab.value}`
                        const tabExpanded = expandedTabs.has(tabExpandKey)
                        const hasSections = tab.sections.length > 0
                        return (
                          <li key={tab.value} className="py-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className={privilegeCheckboxClassName}
                                checked={tabOn}
                                disabled={disabled || !tabsEnabled}
                                onChange={(e) =>
                                  toggleTab(
                                    project.publicId,
                                    tab.value,
                                    e.target.checked
                                  )
                                }
                                aria-label={`Show tab ${tab.label}`}
                              />
                              {hasSections ? (
                                <button
                                  type="button"
                                  className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm text-foreground disabled:opacity-50"
                                  disabled={!tabOn || disabled || !tabsEnabled}
                                  onClick={() =>
                                    setExpandedTabs((prev) => {
                                      const copy = new Set(prev)
                                      if (copy.has(tabExpandKey)) {
                                        copy.delete(tabExpandKey)
                                      } else {
                                        copy.add(tabExpandKey)
                                      }
                                      return copy
                                    })
                                  }
                                >
                                  {tabExpanded ? (
                                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                                  )}
                                  <span>{tab.label}</span>
                                </button>
                              ) : (
                                <span className="text-sm text-foreground">
                                  {tab.label}
                                </span>
                              )}
                            </div>

                            {hasSections && tabOn && tabExpanded ? (
                              <ul className="mt-1 space-y-1 border-l border-neutral-200 pl-5">
                                {tab.sections.map((section) => {
                                  const sectionOn = isSectionSelected(
                                    project.publicId,
                                    tab.value,
                                    section.id
                                  )
                                  return (
                                    <li
                                      key={section.id}
                                      className="flex items-center gap-2 py-0.5"
                                    >
                                      <input
                                        type="checkbox"
                                        className={cn(
                                          privilegeCheckboxClassName,
                                          "size-3.5"
                                        )}
                                        checked={sectionOn}
                                        disabled={disabled || !tabsEnabled}
                                        onChange={(e) =>
                                          toggleSection(
                                            project.publicId,
                                            tab.value,
                                            section.id,
                                            e.target.checked
                                          )
                                        }
                                        aria-label={`Show section ${section.label}`}
                                      />
                                      <span
                                        className={cn(
                                          "text-xs text-muted-foreground",
                                          sectionOn && "text-foreground"
                                        )}
                                      >
                                        {section.label}
                                      </span>
                                    </li>
                                  )
                                })}
                              </ul>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
