import { useState, type FormEvent } from 'react'
import { Search, ArrowRight, ChevronDown, X } from 'lucide-react'

interface SearchBarProps {
  initialQuery?: string
  onSearch: (query: string, filters?: { department?: string; pay?: string }) => void
  placeholder?: string
  large?: boolean
  departments?: string[]
  initialDepartment?: string
  initialPay?: string
}

const payOptions = ['Pay', 'Credit', 'Both']

export default function SearchBar({
  initialQuery = '',
  onSearch,
  placeholder = 'Search by keyword, professor, skill, department...',
  large = false,
  departments,
  initialDepartment = '',
  initialPay = '',
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery)
  const [department, setDepartment] = useState(initialDepartment)
  const [pay, setPay] = useState(initialPay)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSearch(query.trim(), { department, pay })
  }

  const showFilters = large && departments

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
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-7 py-3.5">
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

            {(department || pay) && (
              <button
                type="button"
                onClick={() => { setDepartment(''); setPay('') }}
                className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm text-text-tertiary transition-colors hover:text-text"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  )
}
