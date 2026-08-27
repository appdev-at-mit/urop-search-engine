import { Link } from 'react-router-dom'
import { Building2, Calendar, MapPin } from 'lucide-react'
import type { Listing } from '../types'
import {
  classifyOpportunityType,
  opportunityKindLabel,
  opportunityAccentHex,
} from '../lib/opportunityType'

interface ListingCardProps {
  listing: Listing
  index?: number
}

export default function ListingCard({ listing, index = 0 }: ListingCardProps) {
  const kind = classifyOpportunityType(listing.theme)
  const typeLabel = opportunityKindLabel(kind)
  const accent = opportunityAccentHex(kind)

  const termTags =
    listing.terms
      ?.split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 3) ?? []

  const postedLabel = listing.posted_date
    ? new Date(listing.posted_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <Link
      to={`/listings/${listing._id}`}
      className="group block animate-slide-up rounded-md bg-surface p-6 transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5"
      style={{
        animationDelay: `${index * 40}ms`,
        border: '2px solid var(--color-text)',
        boxShadow: `4px 4px 0 0 ${accent}`,
      }}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        {typeLabel && (
          <span
            className="rounded-sm px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white"
            style={{ backgroundColor: accent }}
          >
            {typeLabel}
          </span>
        )}
        {postedLabel && (
          <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-text-tertiary">
            <Calendar className="h-3.5 w-3.5" />
            {postedLabel}
          </span>
        )}
      </div>

      <h3 className="mb-2 text-xl font-black leading-tight tracking-tight text-text">{listing.title}</h3>

      {(listing.department || listing.city) && (
        <p className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-text-secondary">
          {listing.department && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              {listing.department}
            </span>
          )}
          {listing.city && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {listing.city}
            </span>
          )}
        </p>
      )}

      {listing.description && (
        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-text-secondary">{listing.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {listing.pay_or_credit && (
          <span className="rounded-sm bg-text px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-surface">
            {listing.pay_or_credit}
          </span>
        )}
        {termTags.map((tag) => (
          <span
            key={tag}
            className="rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: accent }}
          >
            {tag}
          </span>
        ))}
      </div>
    </Link>
  )
}
