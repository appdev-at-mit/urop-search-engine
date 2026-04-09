import { Link } from 'react-router-dom'
import { Building2, User, Calendar, ArrowUpRight, MapPin } from 'lucide-react'
import type { Listing } from '../types'

interface ListingCardProps {
  listing: Listing
  index?: number
}

const payBadgeColors: Record<string, string> = {
  Pay: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  Credit: 'bg-blue-50 text-blue-600 border-blue-100',
  Both: 'bg-violet-50 text-violet-600 border-violet-100',
}

export default function ListingCard({ listing, index = 0 }: ListingCardProps) {
  const reqTags = listing.requirements
    ?.split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4)

  const termTags = listing.terms
    ?.split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  const tags = reqTags?.length ? reqTags : [
    ...(listing.theme ? [listing.theme] : []),
    ...(termTags || []),
  ].slice(0, 4)

  return (
    <Link
      to={`/listings/${listing._id}`}
      className="group block animate-slide-up rounded-2xl border border-border bg-surface p-6 transition-all duration-300 hover:border-text-tertiary hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <h3 className="text-[15px] font-semibold leading-snug text-text transition-colors group-hover:text-accent">
          {listing.title}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          {listing.pay_or_credit && (
            <span
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                payBadgeColors[listing.pay_or_credit] ?? 'bg-gray-50 text-text-secondary border-border'
              }`}
            >
              {listing.pay_or_credit}
            </span>
          )}
          <ArrowUpRight className="h-4 w-4 text-text-tertiary opacity-0 transition-all group-hover:opacity-100" />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-text-secondary">
        {listing.professor && (
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-text-tertiary" />
            {listing.professor}
          </span>
        )}
        {listing.department && (
          <span className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-text-tertiary" />
            {listing.department}
          </span>
        )}
        {listing.city && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-text-tertiary" />
            {listing.city}
          </span>
        )}
        {listing.posted_date && (
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-text-tertiary" />
            {new Date(listing.posted_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
      </div>

      {listing.description && (
        <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-text-secondary">
          {listing.description}
        </p>
      )}

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-lg bg-bg px-2.5 py-1 text-xs font-medium text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
