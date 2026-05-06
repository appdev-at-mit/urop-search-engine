import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Building2,
  User,
  FlaskConical,
  Calendar,
  Mail,
  ExternalLink,
  Loader2,
  MapPin,
  Tag,
  Clock,
} from 'lucide-react'
import { fetchListing, fetchLabs } from '../lib/api'
import {
  classifyOpportunityType,
  opportunityCardClass,
  opportunityBadgeClass,
  opportunityKindLabel,
} from '../lib/opportunityType'

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => fetchListing(id!),
    enabled: !!id,
  })

  const labSearchTerm = listing?.lab || null
  const { data: matchingLabs } = useQuery({
    queryKey: ['labMatch', labSearchTerm],
    queryFn: () => fetchLabs({ q: labSearchTerm! }),
    enabled: !!labSearchTerm,
  })
  const matchedLab = matchingLabs?.labs?.[0] ?? null

  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (isError || !listing) {
    return (
      <main className="mx-auto max-w-6xl px-24 py-20 text-center">
        <p className="font-medium text-text">Listing not found</p>
        <Link to="/listings" className="mt-4 inline-block text-base text-primary hover:underline">
          Back to listings
        </Link>
      </main>
    )
  }

  const tags = listing.requirements
    ?.split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  const payColors: Record<string, string> = {
    Pay: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    Credit: 'bg-blue-50 text-blue-600 border-blue-200',
    Both: 'bg-violet-50 text-violet-600 border-violet-200',
  }

  const oppKind = classifyOpportunityType(listing.theme)
  const oppLabel = opportunityKindLabel(oppKind)

  return (
    <main className="mx-auto max-w-6xl px-24 py-12">
      <Link
        to="/listings"
        className="animate-fade-in mb-8 inline-flex items-center gap-2 text-base text-text-tertiary transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to listings
      </Link>

      <article
        className={`animate-fade-in-up rounded-2xl p-8 sm:p-10 ${opportunityCardClass(oppKind)}`}
      >
        <div className="mb-8">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-text">
              {listing.title}
            </h1>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {oppLabel && (
                <span
                  className={`rounded-full border px-4 py-1.5 text-base font-semibold ${opportunityBadgeClass(oppKind)}`}
                >
                  {oppLabel}
                </span>
              )}
              {listing.pay_or_credit && (
                <span
                  className={`rounded-full border px-4 py-1.5 text-base font-medium ${
                    payColors[listing.pay_or_credit] ?? 'bg-bg text-text-secondary border-border'
                  }`}
                >
                  {listing.pay_or_credit}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {listing.professor && (
            <InfoItem icon={User} label="Professor" value={listing.professor} />
          )}
          {listing.department && (
            <InfoItem icon={Building2} label="Department" value={listing.department} />
          )}
          {listing.lab && (
            matchedLab ? (
              <Link
                to={`/labs/${matchedLab._id}`}
                className="flex items-center gap-3 rounded-xl bg-bg p-4 transition-colors hover:bg-primary/5"
              >
                <FlaskConical className="h-4 w-4 shrink-0 text-primary" />
                <div>
                  <div className="text-sm text-text-tertiary">Lab</div>
                  <div className="text-base font-medium text-primary">{listing.lab}</div>
                </div>
              </Link>
            ) : (
              <InfoItem icon={FlaskConical} label="Lab" value={listing.lab} />
            )
          )}
          {listing.city && (
            <InfoItem icon={MapPin} label="Location" value={listing.city} />
          )}
          {listing.terms && (
            <InfoItem icon={Clock} label="Terms" value={listing.terms} />
          )}
          {listing.theme && (
            <InfoItem icon={Tag} label="Type" value={listing.theme} />
          )}
          {listing.posted_date && (
            <InfoItem
              icon={Calendar}
              label="Posted"
              value={new Date(listing.posted_date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            />
          )}
          {listing.deadline_date && (
            <InfoItem
              icon={Calendar}
              label="Deadline"
              value={new Date(listing.deadline_date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            />
          )}
        </div>

        {listing.description && (
          <section className="mb-10">
            <h2 className="mb-4 text-base font-semibold uppercase tracking-wide text-primary">
              description
            </h2>
            <p className="whitespace-pre-line text-lg leading-[1.8] text-text-secondary">
              {listing.description}
            </p>
          </section>
        )}

        {tags && tags.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-base font-semibold uppercase tracking-wide text-primary">
              requirements
            </h2>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-primary/8 px-3.5 py-1.5 text-base font-medium text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        <div className="border-t border-border pt-8">
          <div className="flex flex-wrap gap-3">
            {listing.contact_email && (
              <a
                href={`mailto:${listing.contact_email}`}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-medium text-white transition-all hover:bg-primary-dark active:scale-[0.97]"
              >
                <Mail className="h-4 w-4" />
                Contact Professor
              </a>
            )}
            {listing.source_url && (
              <a
                href={listing.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-bg px-6 py-3 text-base font-medium text-text-secondary transition-all hover:border-primary/40 hover:text-primary active:scale-[0.97]"
              >
                <ExternalLink className="h-4 w-4" />
                View Original
              </a>
            )}
          </div>
        </div>
      </article>
    </main>
  )
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl bg-bg p-4">
      <Icon className="h-5 w-5 shrink-0 text-primary" />
      <div>
        <div className="text-sm font-medium text-text-tertiary">{label}</div>
        <div className="text-base font-medium text-text">{value}</div>
      </div>
    </div>
  )
}
