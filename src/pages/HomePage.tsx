import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Search, Building2 } from 'lucide-react'
import SearchBar from '../components/SearchBar'
import ListingCard from '../components/ListingCard'
import { fetchListings, fetchDepartments, fetchListingLabs } from '../lib/api'

function SectionDots() {
  return (
    <div className="mb-4 flex gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
      <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()

  const { data: deptData } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  })

  const { data: labsData } = useQuery({
    queryKey: ['listing-labs'],
    queryFn: fetchListingLabs,
  })

  const { data: recentData } = useQuery({
    queryKey: ['listings', 'recent-preview'],
    queryFn: () => fetchListings({ page: 1 }),
  })

  function handleSearch(
    query: string,
    filters?: { department?: string; pay?: string; opportunity?: string; lab?: string },
  ) {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (filters?.department) params.set('department', filters.department)
    if (filters?.pay) params.set('pay_or_credit', filters.pay)
    if (filters?.opportunity) params.set('opportunity', filters.opportunity)
    if (filters?.lab) params.set('lab', filters.lab)
    navigate(`/listings?${params}`)
  }

  const stats = {
    listings: recentData?.pagination.total ?? 0,
    departments: deptData?.length ?? 0,
  }

  const previewListings = recentData?.listings.slice(0, 3) ?? []

  return (
    <main>
      {/* Hero */}
      <section className="relative z-10 px-8 pb-28 pt-36">
        <div className="mx-auto max-w-4xl text-center">
          <div className="animate-fade-in-up">
            <p className="mb-4 text-sm font-medium text-text-tertiary">
              mit undergraduate research opportunities
            </p>
            <h1 className="mb-6 text-5xl font-bold leading-[1.1] tracking-tight text-text sm:text-7xl">
              find your next
              <br />
              <span className="rotating-texts">
                <span className="width-setter">research opportunity.</span>
                <span className="rotate-word">research opportunity.</span>
                <span className="rotate-word">UROP.</span>
                <span className="rotate-word">lab position.</span>
                <span className="rotate-word">project.</span>
              </span>
            </h1>
            <p className="mx-auto mb-12 max-w-xl text-lg leading-relaxed text-text-secondary">
              search across MIT research opportunities. match your skills with
              labs, professors, and projects that need you.
            </p>
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
            <SearchBar
              onSearch={handleSearch}
              large
              departments={deptData ?? []}
              labs={labsData ?? []}
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-8 pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {[
              { icon: Search, label: 'Active Listings', value: stats.listings },
              { icon: Building2, label: 'Departments', value: stats.departments },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="animate-fade-in-up flex items-center gap-4 rounded-2xl bg-surface p-6"
                style={{ animationDelay: `${i * 100 + 300}ms` }}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-3xl font-bold tracking-tight text-text">{stat.value}</div>
                  <div className="text-sm font-medium text-text-tertiary">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Listings */}
      {previewListings.length > 0 && (
        <section className="px-8 pb-20">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-2xl bg-surface p-8 sm:p-10">
              <SectionDots />
              <div className="mb-6 flex items-end justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-primary">recent listings</h2>
                  <p className="mt-1 text-sm text-text-secondary">the latest research opportunities.</p>
                </div>
                <Link
                  to="/listings"
                  className="flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {previewListings.map((listing, i) => (
                  <ListingCard key={listing._id} listing={listing} index={i} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="px-8 pb-10 pt-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <p className="text-sm text-text-tertiary">urop search</p>
          <p className="text-sm text-text-tertiary">built for MIT students</p>
        </div>
      </footer>
    </main>
  )
}
