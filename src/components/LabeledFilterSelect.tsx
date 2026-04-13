import { type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export const filterSelectClass =
  'w-full min-w-0 appearance-none rounded-lg border border-border bg-bg py-2 pl-3 pr-9 text-sm text-text outline-none transition-colors hover:border-primary/40 focus:border-primary/40 focus:ring-1 focus:ring-primary/20'

export default function LabeledFilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <div className="flex min-w-[10rem] max-w-full flex-1 flex-col gap-1 sm:min-w-[11rem]">
      <label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={filterSelectClass}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
      </div>
    </div>
  )
}
