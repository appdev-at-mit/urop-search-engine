import { useState, type FormEvent } from 'react'
import { Search, ArrowRight, ChevronDown, X } from 'lucide-react'

export type SearchFilters = {
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

const payOptions = ['Pay', 'Credit', 'Both']

const opportunityOptions: { value: string; label: string }[] = [
  { value: 'urop', label: 'UROP' },
  { value: 'global', label: 'Global' },
  { value: 'not_urop', label: 'Not UROP' },
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSearch(query.trim(), { department, pay, opportunity, lab })
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
              large ? 'text-lg' : 'text-sm'
            }`}
          />
          <button
            type="submit"
            className={`shrink-0 rounded-full bg-primary font-medium text-white transition-all hover:bg-primary-dark active:scale-[0.97] ${
              large ? 'flex items-center gap-2 px-7 py-3 text-base' : 'px-4 py-1.5 text-sm'
            }`}
          >
            Search
            {large && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-col gap-3 border-t border-border/60 px-7 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium uppercase tracking-wide text-text-tertiary">
                Type
              </span>
              {opportunityOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setOpportunity(opportunity === opt.value ? '' : opt.value)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all active:scale-[0.97] ${
                    opportunity === opt.value
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-bg text-text-secondary hover:border-primary/40 hover:text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="appearance-none rounded-full border border-border bg-bg py-1.5 pl-3.5 pr-8 text-sm text-text-secondary outline-none transition-colors hover:border-primary/40 focus:border-primary/40"
                >
                  <option value="">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
              </div>

              <div className="relative min-w-[10rem] max-w-[min(100%,20rem)]">
                <select
                  value={lab}
                  onChange={(e) => setLab(e.target.value)}
                  className="max-w-full appearance-none rounded-full border border-border bg-bg py-1.5 pl-3.5 pr-8 text-sm text-text-secondary outline-none transition-colors hover:border-primary/40 focus:border-primary/40"
                  title="Filter by lab"
                >
                  <option value="">All labs</option>
                  {labs.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
              </div>

              {payOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPay(pay === opt ? '' : opt)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all active:scale-[0.97] ${
                    pay === opt
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-bg text-text-secondary hover:border-primary/40 hover:text-primary'
                  }`}
                >
                  {opt}
                </button>
              ))}

              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setDepartment('')
                    setPay('')
                    setOpportunity('')
                    setLab('')
                  }}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-text-tertiary transition-colors hover:text-text"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </form>
  )
}
