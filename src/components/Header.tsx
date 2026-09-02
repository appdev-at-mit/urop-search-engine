import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { User, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '../lib/auth'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/listings', label: 'Browse' },
  { to: '/labs', label: 'Labs' },
]

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const navRef = useRef<HTMLElement>(null)
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([])
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)

  const activeIdx = navLinks.findIndex(link => link.to === location.pathname)
  // Hover wins; otherwise the capsule rests on the current route. Null when
  // neither applies (e.g. /profile), which fades it out entirely.
  const targetIdx = hoverIdx ?? (activeIdx === -1 ? null : activeIdx)

  // Measure the target link rather than computing offsets, so the capsule
  // stays aligned as label widths change with font loading or breakpoints.
  useLayoutEffect(() => {
    if (targetIdx === null) {
      setPill(null)
      return
    }
    const item = itemRefs.current[targetIdx]
    const nav = navRef.current
    if (!item || !nav) return

    const measure = () => {
      const itemBox = item.getBoundingClientRect()
      const navBox = nav.getBoundingClientRect()
      setPill({ x: itemBox.left - navBox.left, w: itemBox.width })
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(nav)
    observer.observe(item)
    return () => observer.disconnect()
  }, [targetIdx])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  async function handleLogout() {
    setDropdownOpen(false)
    await logout()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      {/* Equal 1fr side tracks keep the nav dead-centre in the bar regardless
          of how wide the logo or the profile control happen to be. */}
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-white/50 bg-surface/60 px-3 py-2 shadow-[0_8px_30px_-12px_rgb(26_26_46/0.25)] backdrop-blur-xl sm:gap-4 sm:px-5 sm:py-2.5">
        <Link to="/" className="flex items-center gap-2.5 justify-self-start transition-opacity hover:opacity-70">
          <img src="/logo.png" alt="UROP Search logo" className="h-9 w-9" />
          <span className="hidden text-lg font-bold tracking-tight text-primary sm:inline">urop search</span>
        </Link>

        <nav
          ref={navRef}
          className="liquid-nav flex items-center justify-center gap-0.5 sm:gap-1"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <span
            aria-hidden="true"
            className="liquid-pill"
            style={{
              transform: `translateX(${pill?.x ?? 0}px)`,
              width: pill?.w ?? 0,
              opacity: pill ? 1 : 0,
            }}
          />
          {navLinks.map((link, i) => (
            <Link
              key={link.to}
              ref={el => { itemRefs.current[i] = el }}
              to={link.to}
              onMouseEnter={() => setHoverIdx(i)}
              onFocus={() => setHoverIdx(i)}
              onBlur={() => setHoverIdx(null)}
              aria-current={location.pathname === link.to ? 'page' : undefined}
              className={`relative z-10 rounded-full px-3 py-1.5 text-sm transition-colors sm:px-4 sm:text-base ${
                location.pathname === link.to
                  ? 'font-semibold text-text'
                  : 'font-medium text-text-secondary hover:text-text'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="justify-self-end">
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
                      className="h-9 w-9 rounded-full border-2 border-transparent transition-colors hover:border-primary/40"
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

              {dropdownOpen && user && (
                <div className="absolute right-0 top-full mt-2 w-72 animate-fade-in rounded-2xl border border-text-tertiary/10 bg-bg shadow-xl">
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
        </div>
      </div>
    </header>
  )
}
