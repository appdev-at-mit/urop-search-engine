import { Link } from 'react-router-dom'
import { Building2, Calendar, MapPin } from 'lucide-react'
import type { Listing } from '../types'
import {
  classifyOpportunityType,
  opportunityCardClass,
  opportunityBadgeClass,
  opportunityKindLabel,
} from '../lib/opportunityType'

interface ListingCardProps {
  listing: Listing
  index?: number
}

const payBadgeColors: Record<string, string> = {
  Pay: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  Credit: 'bg-blue-50 text-blue-600 border-blue-200',
  Both: 'bg-violet-50 text-violet-600 border-violet-200',
}

export default function ListingCard({ listing, index = 0 }: ListingCardProps) {
  const kind = classifyOpportunityType(listing.theme)
  const typeLabel = opportunityKindLabel(kind)

  const termTags =
    listing.terms
      ?.split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 3) ?? []

  return (
    <Link
      to={`/listings/${listing._id}`}
      className={`group block animate-slide-up rounded-xl p-6 transition-all duration-200 hover:shadow-md ${opportunityCardClass(kind)}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-xl font-bold leading-snug tracking-tight text-text transition-colors group-hover:text-primary">
          {listing.title}
        </h3>
        {typeLabel && (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${opportunityBadgeClass(kind)}`}
          >
            {typeLabel}
          </span>
        )}
      </div>

      <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-text-tertiary">
        {listing.department && (
          <span className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {listing.department}
          </span>
        )}
        {listing.city && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {listing.city}
          </span>
        )}
        {listing.posted_date && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(listing.posted_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
      </div>

      {listing.description && (
        <p className="mb-4 line-clamp-2 text-base leading-relaxed text-text-secondary">
          {listing.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {listing.pay_or_credit && (
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
              payBadgeColors[listing.pay_or_credit] ?? 'bg-gray-50 text-text-secondary border-border'
            }`}
          >
            {listing.pay_or_credit}
          </span>
        )}
        {termTags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-black/[0.06] px-2.5 py-1 text-xs font-medium text-text-secondary"
          >
            {tag}
          </span>
        ))}
      </div>
    </Link>
  )
}
