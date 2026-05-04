import { useState, useEffect, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, ArrowRight, X, Loader2, Filter } from 'lucide-react'
import LabCard from '../components/LabCard'
import Pagination from '../components/Pagination'
import LabeledFilterSelect from '../components/LabeledFilterSelect'
import { fetchLabs, fetchLabFilters } from '../lib/api'

export default function LabsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const q = searchParams.get('q') ?? ''
  const department = searchParams.get('department') ?? ''
  const parent_org = searchParams.get('parent_org') ?? ''
  const research_area = searchParams.get('research_area') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const [query, setQuery] = useState(q)

  useEffect(() => {
    setQuery(q)
  }, [q])

  const { data: filterOptions } = useQuery({
    queryKey: ['labFilters'],
    queryFn: fetchLabFilters,
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['labs', q, department, parent_org, research_area, page],
    queryFn: () => fetchLabs({ q, department, parent_org, research_area, page }),
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

  function commitFilters(
    overrides: Partial<{ department: string; parent_org: string; research_area: string }>,
  ) {
    const next = new URLSearchParams(searchParams)
    const dept = overrides.department !== undefined ? overrides.department : department
    const org = overrides.parent_org !== undefined ? overrides.parent_org : parent_org
    const area = overrides.research_area !== undefined ? overrides.research_area : research_area

    if (dept) next.set('department', dept)
    else next.delete('department')
    if (org) next.set('parent_org', org)
    else next.delete('parent_org')
    if (area) next.set('research_area', area)
    else next.delete('research_area')
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

  const hasFilters = q || department || parent_org || research_area

  const parentOrgs = filterOptions?.parentOrgs ?? []
  const researchAreas = filterOptions?.researchAreas ?? []
  const departments = filterOptions?.departments ?? []

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

      <form
        onSubmit={handleSearch}
        className="animate-fade-in-up mb-8 w-full"
        style={{ animationDelay: '100ms' }}
      >
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

          <div className="border-t border-border/60 px-7 py-4">
            {filterOptions && (
              <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-text-secondary">
                  <Filter className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
                  <span className="text-sm font-medium text-text">Filters</span>
                  <span className="text-xs text-text-tertiary">narrow results by field</span>
                </div>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-text-tertiary transition-colors hover:bg-bg hover:text-text"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear all
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                <LabeledFilterSelect
                  id="lab-filter-department"
                  label="Department"
                  value={department}
                  onChange={(v) => commitFilters({ department: v })}
                >
                  <option value="">Any department</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </LabeledFilterSelect>

                <LabeledFilterSelect
                  id="lab-filter-center"
                  label="Center"
                  value={parent_org}
                  onChange={(v) => commitFilters({ parent_org: v })}
                >
                  <option value="">Any</option>
                  {parentOrgs.map((org) => (
                    <option key={org} value={org}>
                      {org}
                    </option>
                  ))}
                </LabeledFilterSelect>

                <LabeledFilterSelect
                  id="lab-filter-area"
                  label="Research area"
                  value={research_area}
                  onChange={(v) => commitFilters({ research_area: v })}
                >
                  <option value="">Any area</option>
                  {researchAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </LabeledFilterSelect>
              </div>
              </>
            )}
          </div>
        </div>
      </form>

      {data && (
        <p className="mb-5 text-sm text-text-tertiary">
          {data.pagination.total} lab{data.pagination.total !== 1 ? 's' : ''}
          {q && (
            <>
              {' '}
              for <span className="font-medium text-text">"{q}"</span>
            </>
          )}
          {department && (
            <>
              {' '}
              in <span className="font-medium text-text">{department}</span>
            </>
          )}
          {parent_org && (
            <>
              {' '}
              · <span className="font-medium text-text">{parent_org}</span>
            </>
          )}
          {research_area && (
            <>
              {' '}
              · <span className="font-medium text-text">{research_area}</span>
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
