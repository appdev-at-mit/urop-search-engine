import { Link, useLocation } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'

export default function Header() {
  const location = useLocation()

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/listings', label: 'Browse' },
    { to: '/labs', label: 'Labs' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-bg/80 backdrop-blur-lg">
      <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between px-8 py-3">
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-70">
          <FlaskConical className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold tracking-tight text-text">urop search</span>
        </Link>

        <nav className="flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-base transition-colors ${
                location.pathname === link.to
                  ? 'font-semibold text-text'
                  : 'font-medium text-text-secondary hover:text-text'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/admin"
            className="rounded-full bg-primary px-5 py-2 text-base font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  )
}
