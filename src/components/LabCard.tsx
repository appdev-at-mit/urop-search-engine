import { Link } from 'react-router-dom'
import { Building2, User, ExternalLink } from 'lucide-react'
import type { Lab } from '../types'

interface LabCardProps {
  lab: Lab
  index?: number
}

const ACCENT = 'var(--color-primary)'

export default function LabCard({ lab, index = 0 }: LabCardProps) {
  const areaTags = lab.research_areas.slice(0, 4)
  const extraAreas = lab.research_areas.length - 4

  return (
    <Link
      to={`/labs/${lab._id}`}
      className="group block animate-slide-up rounded-md bg-surface p-6 transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5"
      style={{ animationDelay: `${index * 40}ms`, border: '2px solid var(--color-text)', boxShadow: `4px 4px 0 0 ${ACCENT}` }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-xl font-black leading-tight tracking-tight text-text">
          {lab.name}
          {lab.acronym && <span className="ml-1.5 text-sm font-bold text-text-tertiary">({lab.acronym})</span>}
        </h3>
        {lab.website && <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-text-tertiary" />}
      </div>

      {(lab.parent_org || lab.pi) && (
        <p className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-text-secondary">
          {lab.parent_org && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              {lab.parent_org}
            </span>
          )}
          {lab.pi && (
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {lab.pi}
            </span>
          )}
        </p>
      )}

      {lab.description && (
        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-text-secondary">{lab.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {lab.parent_org && (
          <span
            className="rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: ACCENT }}
          >
            {lab.parent_org}
          </span>
        )}
        {areaTags.map((area) => (
          <span key={area} className="rounded-sm bg-text px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-surface">
            {area}
          </span>
        ))}
        {extraAreas > 0 && <span className="text-xs font-bold text-text-tertiary">+{extraAreas}</span>}
      </div>
    </Link>
  )
}
