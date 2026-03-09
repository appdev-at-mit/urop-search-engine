import { Link, useLocation } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'

export default function Header() {
  const location = useLocation()

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/listings', label: 'Browse' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-70">
          <FlaskConical className="h-5 w-5 text-accent" />
          <span className="text-[15px] font-semibold tracking-tight text-text">UROP Search</span>
        </Link>

        <nav className="flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-sm transition-colors ${
                location.pathname === link.to
                  ? 'font-medium text-text'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px bg-border" />
      </div>
    </header>
  )
}
