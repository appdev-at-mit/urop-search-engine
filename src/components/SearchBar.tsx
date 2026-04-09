import { useState, type FormEvent } from 'react'
import { Search, ArrowRight } from 'lucide-react'

interface SearchBarProps {
  initialQuery?: string
  onSearch: (query: string) => void
  placeholder?: string
  large?: boolean
}

export default function SearchBar({
  initialQuery = '',
  onSearch,
  placeholder = 'Search by keyword, professor, skill, department...',
  large = false,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSearch(query.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={`group flex items-center gap-3 rounded-2xl bg-surface transition-all ${
          large
            ? 'px-6 py-5 shadow-sm focus-within:shadow-md'
            : 'border border-border px-4 py-3 focus-within:border-primary/40'
        }`}
      >
        <Search className={`shrink-0 text-text-tertiary ${large ? 'h-5 w-5' : 'h-4 w-4'}`} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-transparent text-text outline-none placeholder:text-text-tertiary ${
            large ? 'text-base' : 'text-sm'
          }`}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-full bg-primary font-medium text-white transition-all hover:bg-primary-dark active:scale-[0.97] ${
            large ? 'flex items-center gap-2 px-6 py-2.5 text-sm' : 'px-4 py-1.5 text-sm'
          }`}
        >
          Search
          {large && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </form>
  )
}
