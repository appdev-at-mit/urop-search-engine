/** Matches ELx `primary_theme.text` values */
export type OpportunityKind = 'urop' | 'global' | 'not_urop' | 'unknown'

export function classifyOpportunityType(theme: string | null | undefined): OpportunityKind {
  if (!theme?.trim()) return 'unknown'
  const t = theme.trim().toLowerCase()
  if (t.includes('global opportun')) return 'global'
  if (t.includes('not urop')) return 'not_urop'
  if (t.includes('undergraduate research') && t.includes('urop')) return 'urop'
  return 'unknown'
}

export function opportunityKindLabel(kind: OpportunityKind): string | null {
  switch (kind) {
    case 'urop':
      return 'UROP'
    case 'global':
      return 'Global opportunity'
    case 'not_urop':
      return 'Not UROP'
    default:
      return null
  }
}

/** Card shell: left accent + subtle tint */
export function opportunityCardClass(kind: OpportunityKind): string {
  switch (kind) {
    case 'urop':
      return 'border-l-[5px] border-l-primary bg-primary/[0.07]'
    case 'global':
      return 'border-l-[5px] border-l-sky-500 bg-sky-50/90'
    case 'not_urop':
      return 'border-l-[5px] border-l-amber-500 bg-amber-50/85'
    default:
      return 'border-l-[5px] border-l-border bg-surface'
  }
}

export function opportunityBadgeClass(kind: OpportunityKind): string {
  switch (kind) {
    case 'urop':
      return 'bg-primary/15 text-primary-dark border-primary/25'
    case 'global':
      return 'bg-sky-100 text-sky-800 border-sky-200'
    case 'not_urop':
      return 'bg-amber-100 text-amber-900 border-amber-200'
    default:
      return 'bg-bg text-text-secondary border-border'
  }
}
