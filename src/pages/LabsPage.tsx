import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, ArrowRight, X, Loader2 } from 'lucide-react'
import LabCard from '../components/LabCard'
import Pagination from '../components/Pagination'
import { fetchLabs, fetchLabFilters } from '../lib/api'

export default function LabsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') ?? ''
  const parent_org = searchParams.get('parent_org') ?? ''
  const research_area = searchParams.get('research_area') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const [query, setQuery] = useState(q)

  const { data: filterOptions } = useQuery({
    queryKey: ['labFilters'],
    queryFn: fetchLabFilters,
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['labs', q, parent_org, research_area, page],
    queryFn: () => fetchLabs({ q, parent_org, research_area, page }),
  })

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    const next = new URLSearchParams(searchParams)
    if (query.trim()) {
      next.set('q', query.trim())
    } else {
      next.delete('q')
    }
    next.delete('page')
    setSearchParams(next)
  }

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    next.delete('page')
    setSearchParams(next)
  }

  function clearFilters() {
    setQuery('')
    setSearchParams({})
  }

  function updatePage(p: number) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(p))
    setSearchParams(next)
  }

  const hasFilters = q || parent_org || research_area

  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      <div className="animate-fade-in mb-2">
        <p className="mb-1 text-sm font-medium text-text-tertiary">
          discover
        </p>
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-text">lab groups</h1>
        <p className="mb-8 text-sm text-text-tertiary">
          Browse MIT research labs and groups to find research areas that interest you
        </p>
      </div>

      <form onSubmit={handleSearch} className="animate-fade-in-up mb-6" style={{ animationDelay: '100ms' }}>
        <div className="group rounded-2xl bg-surface shadow-sm transition-all focus-within:shadow-md">
          <div className="flex items-center gap-3 px-7 py-5">
            <Search className="h-6 w-6 shrink-0 text-text-tertiary" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by lab name, PI, or research area..."
              className="w-full bg-transparent text-lg text-text outline-none placeholder:text-text-tertiary"
            />
            <button
              type="submit"
              className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-7 py-3 text-base font-medium text-white transition-all hover:bg-primary-dark active:scale-[0.97]"
            >
              Search
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>

      {filterOptions && (
        <div className="animate-fade-in-up mb-6 flex flex-wrap items-center gap-2" style={{ animationDelay: '150ms' }}>
          <span className="text-xs font-medium text-text-tertiary">Center:</span>
          {filterOptions.parentOrgs.map((org) => (
            <button
              key={org}
              onClick={() => setFilter('parent_org', parent_org === org ? '' : org)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all active:scale-[0.97] ${
                parent_org === org
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-primary'
              }`}
            >
              {org}
            </button>
          ))}

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-text-tertiary transition-colors hover:text-text"
            >
              <X className="h-3.5 w-3.5" />
              Clear all
            </button>
          )}
        </div>
      )}

      {filterOptions && filterOptions.researchAreas.length > 0 && (
        <div className="animate-fade-in-up mb-8 flex flex-wrap items-center gap-1.5" style={{ animationDelay: '200ms' }}>
          <span className="mr-1 text-xs font-medium text-text-tertiary">Areas:</span>
          {filterOptions.researchAreas.slice(0, 20).map((area) => (
            <button
              key={area}
              onClick={() => setFilter('research_area', research_area === area ? '' : area)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all active:scale-[0.97] ${
                research_area === area
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-bg text-text-secondary hover:border-primary/40 hover:text-primary'
              }`}
            >
              {area}
            </button>
          ))}
          {filterOptions.researchAreas.length > 20 && (
            <span className="text-xs text-text-tertiary">
              +{filterOptions.researchAreas.length - 20} more
            </span>
          )}
        </div>
      )}

      {data && (
        <p className="mb-5 text-sm text-text-tertiary">
          {data.pagination.total} lab{data.pagination.total !== 1 ? 's' : ''}
          {q && (
            <>
              {' '}
              for <span className="font-medium text-text">"{q}"</span>
            </>
          )}
          {parent_org && (
            <>
              {' '}
              in <span className="font-medium text-text">{parent_org}</span>
            </>
          )}
          {research_area && (
            <>
              {' '}
              working on <span className="font-medium text-text">{research_area}</span>
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
            Failed to load labs. Make sure the backend is running on port 3001.
          </p>
        </div>
      )}

      {data && data.labs.length === 0 && (
        <div className="animate-fade-in rounded-2xl bg-surface p-16 text-center">
          <p className="font-medium text-text">No labs found</p>
          <p className="mt-2 text-sm text-text-tertiary">Try adjusting your search or filters</p>
        </div>
      )}

      {data && data.labs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.labs.map((lab, i) => (
            <LabCard key={lab._id} lab={lab} index={i} />
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
