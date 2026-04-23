import { useState, type FormEvent } from 'react'
import { Search, ArrowRight, X } from 'lucide-react'
import Dropdown from './Dropdown'
import type { DropdownOption } from './Dropdown'

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

const payOptions: DropdownOption[] = [
  { value: 'Pay', label: 'Pay' },
  { value: 'Credit', label: 'Credit' },
  { value: 'Both', label: 'Both' },
]

const opportunityOptions: DropdownOption[] = [
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
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-7 py-3.5">
            <Dropdown
              value={opportunity}
              onChange={setOpportunity}
              options={opportunityOptions}
              placeholder="All Types"
            />

            <Dropdown
              value={department}
              onChange={setDepartment}
              options={departments.map((d) => ({ value: d, label: d }))}
              placeholder="All Departments"
            />

            <Dropdown
              value={lab}
              onChange={setLab}
              options={labs.map((l) => ({ value: l, label: l }))}
              placeholder="All Labs"
            />

            <Dropdown
              value={pay}
              onChange={setPay}
              options={payOptions}
              placeholder="Compensation"
            />

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
        )}
      </div>
    </form>
  )
}
