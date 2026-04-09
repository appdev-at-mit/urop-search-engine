import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Search, Building2, Sparkles } from 'lucide-react'
import SearchBar from '../components/SearchBar'
import ListingCard from '../components/ListingCard'
import { fetchListings, fetchDepartments } from '../lib/api'

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
      <section className="px-8 pb-24 pt-28">
        <div className="mx-auto max-w-6xl">
          <div className="animate-fade-in-up max-w-2xl">
            <p className="mb-4 text-sm font-medium text-text-tertiary">
              mit undergraduate research opportunities
            </p>
            <h1 className="mb-4 text-5xl font-bold leading-[1.1] tracking-tight text-text sm:text-6xl">
              find your next
              <br />
              research opportunity.
            </h1>
            <p className="mb-10 max-w-lg text-base leading-relaxed text-text-secondary">
              search across MIT research opportunities. match your skills with
              labs, professors, and projects that need you.
            </p>
          </div>
          <div className="animate-fade-in-up max-w-xl" style={{ animationDelay: '150ms' }}>
            <SearchBar onSearch={handleSearch} large />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-8 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {[
              { icon: Search, label: 'Active Listings', value: stats.listings },
              { icon: Building2, label: 'Departments', value: stats.departments },
              { icon: Sparkles, label: 'Full-Text Search', value: 'Instant' },
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
                  <div className="text-2xl font-bold tracking-tight text-text">{stat.value}</div>
                  <div className="text-sm text-text-tertiary">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Browse by Department */}
      <section className="px-8 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl bg-surface p-8 sm:p-10">
            <SectionDots />
            <h2 className="mb-2 text-2xl font-bold tracking-tight text-primary">browse by department</h2>
            <p className="mb-6 text-sm text-text-secondary">explore research areas across MIT.</p>
            <div className="flex flex-wrap gap-2">
              {deptData?.map((dept, i) => (
                <button
                  key={dept}
                  onClick={() => navigate(`/listings?department=${encodeURIComponent(dept)}`)}
                  className="animate-fade-in rounded-full border border-border bg-bg px-4 py-2 text-sm font-medium text-text-secondary transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:scale-[0.97]"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Recent Listings */}
      {previewListings.length > 0 && (
        <section className="px-8 pb-20">
          <div className="mx-auto max-w-6xl">
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
              <div className="grid grid-cols-1 gap-4">
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
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="text-sm text-text-tertiary">urop search</p>
          <p className="text-sm text-text-tertiary">built for MIT students</p>
        </div>
      </footer>
    </main>
  )
}
