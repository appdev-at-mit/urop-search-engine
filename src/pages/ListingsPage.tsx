import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import SearchBar from '../components/SearchBar'
import ListingCard from '../components/ListingCard'
import Pagination from '../components/Pagination'
import { fetchListings, fetchDepartments } from '../lib/api'

export default function ListingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') ?? ''
  const department = searchParams.get('department') ?? ''
  const pay_or_credit = searchParams.get('pay_or_credit') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['listings', q, department, pay_or_credit, page],
    queryFn: () => fetchListings({ q, department, pay_or_credit, page }),
  })

  function handleSearch(query: string, filters?: { department?: string; pay?: string }) {
    const next = new URLSearchParams()
    if (query) next.set('q', query)
    if (filters?.department) next.set('department', filters.department)
    if (filters?.pay) next.set('pay_or_credit', filters.pay)
    setSearchParams(next)
  }

  function updatePage(p: number) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(p))
    setSearchParams(next)
  }

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <div className="animate-fade-in mb-2">
        <p className="mb-1 text-sm font-medium text-text-tertiary">
          search
        </p>
        <h1 className="mb-8 text-4xl font-bold tracking-tight text-text">browse listings</h1>
      </div>

      <div className="animate-fade-in-up mb-8" style={{ animationDelay: '100ms' }}>
        <SearchBar
          initialQuery={q}
          onSearch={handleSearch}
          large
          departments={departments}
          initialDepartment={department}
          initialPay={pay_or_credit}
        />
      </div>

      {data && (
        <p className="mb-5 text-sm text-text-tertiary">
          {data.pagination.total} result{data.pagination.total !== 1 ? 's' : ''}
          {q && (
            <>
              {' '}
              for <span className="font-medium text-text">"{q}"</span>
            </>
          )}
        </p>
      )}

      {isLoading && (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {isError && (
        <div className="animate-fade-in rounded-2xl border border-accent/20 bg-accent/5 p-10 text-center">
          <p className="text-sm text-accent">
            Failed to load listings. Make sure the backend is running on port 3001.
          </p>
        </div>
      )}

      {data && data.listings.length === 0 && (
        <div className="animate-fade-in rounded-2xl bg-surface p-16 text-center">
          <p className="font-medium text-text">No listings found</p>
          <p className="mt-2 text-sm text-text-tertiary">Try adjusting your search or filters</p>
        </div>
      )}

      {data && data.listings.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.listings.map((listing, i) => (
            <ListingCard key={listing._id} listing={listing} index={i} />
          ))}
        </div>
      )}

      {data && (
        <div className="mt-10">
          <Pagination
            page={page}
            totalPages={data.pagination.totalPages}
            onPageChange={updatePage}
          />
        </div>
      )}
    </main>
  )
}
