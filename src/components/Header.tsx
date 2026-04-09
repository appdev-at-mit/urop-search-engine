import { Link, useLocation } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'

export default function Header() {
  const location = useLocation()

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/listings', label: 'Browse' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-bg/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-8">
        <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-70">
          <FlaskConical className="h-5 w-5 text-primary" />
          <span className="text-[15px] font-semibold tracking-tight text-text">urop search</span>
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
          <Link
            to="/admin"
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  )
}
