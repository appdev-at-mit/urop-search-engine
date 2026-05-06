import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Building2,
  User,
  ExternalLink,
  Mail,
  Loader2,
  Tag,
  Globe,
} from 'lucide-react'
import { fetchLab, fetchListings } from '../lib/api'
import ListingCard from '../components/ListingCard'

export default function LabDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: lab, isLoading, isError } = useQuery({
    queryKey: ['lab', id],
    queryFn: () => fetchLab(id!),
    enabled: !!id,
  })

  const { data: relatedListings } = useQuery({
    queryKey: ['labListings', lab?.name, lab?.department],
    queryFn: () => fetchListings({ q: lab!.name, page: 1 }),
    enabled: !!lab,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (isError || !lab) {
    return (
      <main className="mx-auto max-w-6xl px-24 py-20 text-center">
        <p className="font-medium text-text">Lab not found</p>
        <Link to="/labs" className="mt-4 inline-block text-base text-primary hover:underline">
          Back to labs
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-24 py-12">
      <Link
        to="/labs"
        className="animate-fade-in mb-8 inline-flex items-center gap-2 text-base text-text-tertiary transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to labs
      </Link>

      <article className="animate-fade-in-up rounded-2xl bg-surface p-8 sm:p-10">
        <div className="mb-8">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-text">
              {lab.name}
              {lab.acronym && (
                <span className="ml-2 text-xl font-normal text-text-tertiary">
                  ({lab.acronym})
                </span>
              )}
            </h1>
            {lab.parent_org && (
              <span className="shrink-0 rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5 text-base font-medium text-primary">
                {lab.parent_org}
              </span>
            )}
          </div>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lab.pi && (
            <InfoItem icon={User} label="Principal Investigator" value={lab.pi} />
          )}
          {lab.department && (
            <InfoItem icon={Building2} label="Department" value={lab.department} />
          )}
          {lab.parent_org && (
            <InfoItem icon={Tag} label="Center / Institute" value={lab.parent_org} />
          )}
          {lab.website && (
            <InfoItem icon={Globe} label="Website" value={new URL(lab.website).hostname} />
          )}
        </div>

        {lab.description && (
          <section className="mb-10">
            <h2 className="mb-4 text-base font-semibold uppercase tracking-wide text-primary">
              about
            </h2>
            <p className="whitespace-pre-line text-lg leading-[1.8] text-text-secondary">
              {lab.description}
            </p>
          </section>
        )}

        {lab.research_areas.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-base font-semibold uppercase tracking-wide text-primary">
              research areas
            </h2>
            <div className="flex flex-wrap gap-2">
              {lab.research_areas.map((area) => (
                <Link
                  key={area}
                  to={`/labs?research_area=${encodeURIComponent(area)}`}
                  className="rounded-full bg-primary/8 px-3.5 py-1.5 text-base font-medium text-primary transition-colors hover:bg-primary/15"
                >
                  {area}
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="border-t border-border pt-8">
          <div className="flex flex-wrap gap-3">
            {lab.website && (
              <a
                href={lab.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-medium text-white transition-all hover:bg-primary-dark active:scale-[0.97]"
              >
                <ExternalLink className="h-4 w-4" />
                Visit Lab Website
              </a>
            )}
            {lab.contact_email && (
              <a
                href={`mailto:${lab.contact_email}`}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-bg px-6 py-3 text-base font-medium text-text-secondary transition-all hover:border-primary/40 hover:text-primary active:scale-[0.97]"
              >
                <Mail className="h-4 w-4" />
                Contact
              </a>
            )}
          </div>
        </div>
      </article>

      {relatedListings && relatedListings.listings.length > 0 && (
        <section className="animate-fade-in-up mt-8" style={{ animationDelay: '200ms' }}>
          <h2 className="mb-4 text-base font-semibold uppercase tracking-wide text-primary">
            related UROP listings
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {relatedListings.listings.slice(0, 6).map((listing, i) => (
              <ListingCard key={listing._id} listing={listing} index={i} />
            ))}
          </div>
          {relatedListings.pagination.total > 6 && (
            <Link
              to={`/listings?q=${encodeURIComponent(lab.name)}`}
              className="mt-4 inline-block text-base text-primary hover:underline"
            >
              View all {relatedListings.pagination.total} listings
            </Link>
          )}
        </section>
      )}
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
