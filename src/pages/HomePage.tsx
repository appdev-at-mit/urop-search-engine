import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Search, Building2, Sparkles } from 'lucide-react'
import SearchBar from '../components/SearchBar'
import ListingCard from '../components/ListingCard'
import { fetchListings, fetchDepartments } from '../lib/api'

export default function HomePage() {
  const navigate = useNavigate()

  const { data: deptData } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  })

  const { data: recentData } = useQuery({
    queryKey: ['listings', 'recent-preview'],
    queryFn: () => fetchListings({ page: 1 }),
  })

  function handleSearch(query: string) {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
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
      <section className="px-6 pb-20 pt-24">
        <div className="mx-auto max-w-5xl">
          <div className="animate-fade-in-up mx-auto max-w-2xl text-center">
            <p className="mb-5 text-sm font-medium uppercase tracking-widest text-text-tertiary">
              MIT Undergraduate Research
            </p>
            <h1 className="mb-5 text-5xl font-bold leading-[1.1] tracking-tight text-text sm:text-6xl">
              FIND YOUR
              <br />
              <span className="text-accent">PERFECT UROP.</span>
            </h1>
            <p className="mx-auto mb-12 max-w-md text-base leading-relaxed text-text-secondary">
              Search across MIT research opportunities. Match your skills with
              labs, professors, and projects that need you.
            </p>
          </div>
          <div className="animate-fade-in-up mx-auto max-w-xl" style={{ animationDelay: '150ms' }}>
            <SearchBar onSearch={handleSearch} large />
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border bg-surface px-6 py-10">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3">
          {[
            { icon: Search, label: 'Active Listings', value: stats.listings },
            { icon: Building2, label: 'Departments', value: stats.departments },
            { icon: Sparkles, label: 'Full-Text Search', value: 'Instant' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="animate-fade-in-up flex items-center gap-4"
              style={{ animationDelay: `${i * 100 + 300}ms` }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg">
                <stat.icon className="h-5 w-5 text-text-secondary" />
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-text">{stat.value}</div>
                <div className="text-sm text-text-tertiary">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Browse by Department */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-widest text-text-tertiary">
                explore
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-text">browse by department</h2>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {deptData?.map((dept, i) => (
              <button
                key={dept}
                onClick={() => navigate(`/listings?department=${encodeURIComponent(dept)}`)}
                className="animate-fade-in rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-secondary transition-all duration-200 hover:border-text-tertiary hover:text-text active:scale-[0.97]"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Listings */}
      {previewListings.length > 0 && (
        <section className="border-t border-border bg-surface px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-widest text-text-tertiary">
                  latest
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-text">recent listings</h2>
              </div>
              <Link
                to="/listings"
                className="flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text"
              >
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {previewListings.map((listing, i) => (
                <ListingCard key={listing.id} listing={listing} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <p className="text-sm text-text-tertiary">UROP Search</p>
          <p className="text-sm text-text-tertiary">Built for MIT students</p>
        </div>
      </footer>
    </main>
  )
}
