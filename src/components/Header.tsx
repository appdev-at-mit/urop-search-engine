import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { User, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '../lib/auth'

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/listings', label: 'Browse' },
    { to: '/labs', label: 'Labs' },
  ]

  async function handleLogout() {
    setDropdownOpen(false)
    await logout()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 border-b-4 border-border bg-bg/80 backdrop-blur-lg">
      <div className="mx-auto flex min-h-[4.5rem] items-center justify-between px-24 py-3">
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-70">
          <img src="/logo.png" alt="UROP Search logo" className="h-27 w-25" />
          <span className="text-2xl font-bold tracking-tight text-primary">urop search</span>
        </Link>

        <nav className="flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-lg transition-colors ${
                location.pathname === link.to
                  ? 'font-semibold text-text'
                  : 'font-medium text-text-secondary hover:text-text'
              }`}
            >
              {link.label}
            </Link>
          ))}

          {/* Profile avatar / sign-in */}
          {!loading && (
            <div className="relative" ref={dropdownRef}>
              {user ? (
                <button
                  onClick={() => setDropdownOpen(prev => !prev)}
                  className="flex items-center gap-1.5 rounded-full transition-opacity hover:opacity-80"
                >
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="h-9 w-9 rounded-full border-2 border-transparent hover:border-primary/40 transition-colors"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                  )}
                  <ChevronDown className={`h-3.5 w-3.5 text-text-tertiary transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              ) : (
                <Link
                  to="/profile"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-text-tertiary transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <User className="h-5 w-5" />
                </Link>
              )}

              {/* Dropdown */}
              {dropdownOpen && user && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-text-tertiary/10 bg-bg shadow-xl animate-fade-in">
                  <div className="border-b border-text-tertiary/10 px-5 py-4">
                    <div className="flex items-center gap-3">
                      {user.picture ? (
                        <img src={user.picture} alt={user.name} className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <User className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text">{user.name}</p>
                        <p className="truncate text-xs text-text-tertiary">{user.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface"
                    >
                      <User className="h-4 w-4 text-text-tertiary" />
                      View full profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface"
                    >
                      <LogOut className="h-4 w-4 text-text-tertiary" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
