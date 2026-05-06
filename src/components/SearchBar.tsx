import { useState, useEffect, type FormEvent } from 'react'
import { Search, ArrowRight, Filter, X } from 'lucide-react'
import LabeledFilterSelect from './LabeledFilterSelect'

type SearchFilters = {
  department?: string
  pay?: string
  opportunity?: string
  lab?: string
}

interface SearchBarProps {
  initialQuery?: string
  onSearch: (query: string, filters?: SearchFilters) => void
  placeholder?: string
  large?: boolean
  departments?: string[]
  labs?: string[]
  initialDepartment?: string
  initialPay?: string
  initialOpportunity?: string
  initialLab?: string
}

const payOptions: { value: string; label: string }[] = [
  { value: 'Pay', label: 'Pay' },
  { value: 'Credit', label: 'Credit' },
  { value: 'Both', label: 'Both' },
]

const opportunityOptions: { value: string; label: string }[] = [
  { value: 'urop', label: 'UROP' },
  { value: 'global', label: 'Global opportunities' },
  { value: 'not_urop', label: 'Research (not UROP)' },
]

export default function SearchBar({
  initialQuery = '',
  onSearch,
  placeholder = 'Search by keyword, professor, skill, department...',
  large = false,
  departments,
  labs = [],
  initialDepartment = '',
  initialPay = '',
  initialOpportunity = '',
  initialLab = '',
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery)
  const [department, setDepartment] = useState(initialDepartment)
  const [pay, setPay] = useState(initialPay)
  const [opportunity, setOpportunity] = useState(initialOpportunity)
  const [lab, setLab] = useState(initialLab)

  useEffect(() => { setQuery(initialQuery) }, [initialQuery])
  useEffect(() => { setDepartment(initialDepartment) }, [initialDepartment])
  useEffect(() => { setPay(initialPay) }, [initialPay])
  useEffect(() => { setOpportunity(initialOpportunity) }, [initialOpportunity])
  useEffect(() => { setLab(initialLab) }, [initialLab])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSearch(query.trim(), { department, pay, opportunity, lab })
  }

  /** Apply filter fields and sync URL/results immediately (Airtable-style). */
  function commitFilters(overrides: Partial<SearchFilters>) {
    const next: SearchFilters = {
      department: overrides.department !== undefined ? overrides.department : department,
      pay: overrides.pay !== undefined ? overrides.pay : pay,
      opportunity: overrides.opportunity !== undefined ? overrides.opportunity : opportunity,
      lab: overrides.lab !== undefined ? overrides.lab : lab,
    }
    if (overrides.department !== undefined) setDepartment(next.department ?? '')
    if (overrides.pay !== undefined) setPay(next.pay ?? '')
    if (overrides.opportunity !== undefined) setOpportunity(next.opportunity ?? '')
    if (overrides.lab !== undefined) setLab(next.lab ?? '')
    onSearch(query.trim(), next)
  }

  const showFilters = large && departments

  const hasFilters = department || pay || opportunity || lab

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={`group rounded-2xl bg-surface transition-all ${
          large
            ? 'shadow-sm focus-within:shadow-md'
            : 'border border-border focus-within:border-primary/40'
        }`}
      >
        <div className={`flex items-center gap-3 ${large ? 'px-7 py-5' : 'px-4 py-3'}`}>
          <Search className={`shrink-0 text-text-tertiary ${large ? 'h-6 w-6' : 'h-4 w-4'}`} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className={`w-full bg-transparent text-text outline-none placeholder:text-text-tertiary ${
              large ? 'text-xl' : 'text-base'
            }`}
          />
          <button
            type="submit"
            className={`shrink-0 rounded-full bg-primary font-medium text-white transition-all hover:bg-primary-dark active:scale-[0.97] ${
              large ? 'flex items-center gap-2 px-7 py-3 text-lg' : 'px-4 py-1.5 text-base'
            }`}
          >
            Search
            {large && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>

        {showFilters && (
          <div className="border-t border-border/60 px-7 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-text-secondary">
                <Filter className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
                <span className="text-base font-medium text-text">Filters</span>
                <span className="text-sm text-text-tertiary">narrow results by field</span>
              </div>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => commitFilters({ department: '', pay: '', opportunity: '', lab: '' })}
                  className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-base text-text-tertiary transition-colors hover:bg-bg hover:text-text"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear all
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
              <LabeledFilterSelect
                id="filter-opportunity"
                label="Opportunity type"
                value={opportunity}
                onChange={(v) => commitFilters({ opportunity: v })}
              >
                <option value="">Any</option>
                {opportunityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </LabeledFilterSelect>

              <LabeledFilterSelect
                id="filter-department"
                label="Department"
                value={department}
                onChange={(v) => commitFilters({ department: v })}
              >
                <option value="">Any department</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </LabeledFilterSelect>

              <LabeledFilterSelect
                id="filter-lab"
                label="Lab / group"
                value={lab}
                onChange={(v) => commitFilters({ lab: v })}
              >
                <option value="">Any lab</option>
                {labs.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </LabeledFilterSelect>

              <LabeledFilterSelect
                id="filter-pay"
                label="Pay or credit"
                value={pay}
                onChange={(v) => commitFilters({ pay: v })}
              >
                <option value="">Any</option>
                {payOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </LabeledFilterSelect>
            </div>
          </div>
        )}
      </div>
    </form>
  )
}
