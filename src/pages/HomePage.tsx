import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Sparkles, FlaskConical } from 'lucide-react'
import SearchBar from '../components/SearchBar'
import ListingCard from '../components/ListingCard'
import LabCard from '../components/LabCard'
import { fetchListings, fetchDepartments, fetchListingLabs, fetchRecommendedListings, fetchRecommendedLabs } from '../lib/api'
import { useAuth } from '../lib/auth'

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
  const { user } = useAuth()

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

  const { data: recommendedListingsData } = useQuery({
    queryKey: ['listings', 'recommended'],
    queryFn: () => fetchRecommendedListings(6),
  })

  const { data: recommendedLabsData } = useQuery({
    queryKey: ['labs', 'recommended'],
    queryFn: () => fetchRecommendedLabs(3),
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

  const isPersonalized = recommendedListingsData?.personalized ?? false
  const previewListings = isPersonalized
    ? recommendedListingsData?.listings ?? []
    : recentData?.listings.slice(0, 3) ?? []

  const recommendedLabs = recommendedLabsData?.labs ?? []
  const labsPersonalized = recommendedLabsData?.personalized ?? false

  return (
    <main>
      {/* Hero */}
      <section className="relative z-10 px-24 pb-28 pt-36">
        <div className="mx-auto max-w-5xl text-center">
          <div className="animate-fade-in-up">
            <p className="mb-4 text-base font-medium uppercase tracking-wide text-text-tertiary">
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
            <p className="mx-auto mb-12 max-w-2xl text-xl leading-relaxed text-text-secondary">
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

      {/* Personalized / Recent Listings */}
      {previewListings.length > 0 && (
        <section className="px-24 pb-20">
          <div>
            <div className="rounded-2xl bg-surface p-8 sm:p-10">
              <SectionDots />
              <div className="mb-6 flex items-end justify-between">
                <div>
                  {isPersonalized ? (
                    <>
                      <div className="mb-1 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <h2 className="text-3xl font-bold tracking-tight text-primary">for you</h2>
                      </div>
                      <p className="mt-1 text-base text-text-secondary">
                        opportunities matched to your {[
                          user?.interests?.length ? 'interests' : '',
                          user?.skills?.length ? 'skills' : '',
                          user?.major ? 'major' : '',
                        ].filter(Boolean).join(', ') || 'profile'}.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-3xl font-bold tracking-tight text-primary">recent listings</h2>
                      <p className="mt-1 text-base text-text-secondary">the latest research opportunities.</p>
                    </>
                  )}
                </div>
                <Link
                  to="/listings"
                  className="flex items-center gap-1.5 rounded-full bg-primary/10 px-5 py-2.5 text-base font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {previewListings.map((listing, i) => (
                  <ListingCard key={listing._id} listing={listing} index={i} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recommended Labs */}
      {recommendedLabs.length > 0 && labsPersonalized && (
        <section className="px-24 pb-20">
          <div>
            <div className="rounded-2xl bg-surface p-8 sm:p-10">
              <SectionDots />
              <div className="mb-6 flex items-end justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-primary" />
                    <h2 className="text-3xl font-bold tracking-tight text-primary">labs for you</h2>
                  </div>
                  <p className="mt-1 text-base text-text-secondary">
                    research groups aligned with your background.
                  </p>
                </div>
                <Link
                  to="/labs"
                  className="flex items-center gap-1.5 rounded-full bg-primary/10 px-5 py-2.5 text-base font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  Browse labs
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {recommendedLabs.map((lab, i) => (
                  <LabCard key={lab._id} lab={lab} index={i} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="px-24 pb-10 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-base text-text-tertiary">urop search</p>
          <p className="text-base text-text-tertiary">built for MIT students</p>
        </div>
      </footer>
    </main>
  )
}
