import { X } from 'lucide-react'

interface FilterBarProps {
  departments: string[]
  selectedDepartment: string
  onDepartmentChange: (dept: string) => void
  selectedPay: string
  onPayChange: (pay: string) => void
}

const payOptions = ['Pay', 'Credit', 'Both']

export default function FilterBar({
  departments,
  selectedDepartment,
  onDepartmentChange,
  selectedPay,
  onPayChange,
}: FilterBarProps) {
  const hasActiveFilters = selectedDepartment || selectedPay

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <select
        value={selectedDepartment}
        onChange={(e) => onDepartmentChange(e.target.value)}
        className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-text outline-none transition-colors focus:border-primary/40"
      >
        <option value="">All Departments</option>
        {departments.map((dept) => (
          <option key={dept} value={dept}>
            {dept}
          </option>
        ))}
      </select>

      <div className="flex gap-1.5">
        {payOptions.map((opt) => (
          <button
            key={opt}
            onClick={() => onPayChange(selectedPay === opt ? '' : opt)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-[0.97] ${
              selectedPay === opt
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-primary'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      {hasActiveFilters && (
        <button
          onClick={() => {
            onDepartmentChange('')
            onPayChange('')
          }}
          className="flex items-center gap-1 rounded-full px-3 py-2 text-sm text-text-tertiary transition-colors hover:text-text"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}
    </div>
  )
}
