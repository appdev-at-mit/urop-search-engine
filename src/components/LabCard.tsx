import { Link } from 'react-router-dom'
import { Building2, User, ExternalLink } from 'lucide-react'
import type { Lab } from '../types'

interface LabCardProps {
  lab: Lab
  index?: number
}

export default function LabCard({ lab, index = 0 }: LabCardProps) {
  const areaTags = lab.research_areas.slice(0, 4)

  return (
    <Link
      to={`/labs/${lab._id}`}
      className="group block animate-slide-up rounded-xl bg-surface p-6 transition-all duration-200 hover:shadow-md"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-lg font-bold leading-snug tracking-tight text-text transition-colors group-hover:text-primary">
          {lab.name}
          {lab.acronym && (
            <span className="ml-1.5 text-sm font-normal text-text-tertiary">
              ({lab.acronym})
            </span>
          )}
        </h3>
        {lab.website && (
          <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>

      <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-tertiary">
        {lab.parent_org && (
          <span className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {lab.parent_org}
          </span>
        )}
        {lab.pi && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {lab.pi}
          </span>
        )}
      </div>

      {lab.description && (
        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-text-secondary">
          {lab.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {lab.parent_org && (
          <span className="rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary">
            {lab.parent_org}
          </span>
        )}
        {areaTags.map((area) => (
          <span
            key={area}
            className="rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-text-secondary"
          >
            {area}
          </span>
        ))}
        {lab.research_areas.length > 4 && (
          <span className="text-xs text-text-tertiary">
            +{lab.research_areas.length - 4}
          </span>
        )}
      </div>
    </Link>
  )
}
