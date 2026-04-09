import { useState, useEffect, useCallback } from 'react'
import { Shield, RefreshCw, Clock, Database, Key, CheckCircle2, XCircle, Loader2, Copy } from 'lucide-react'

const API_BASE = '/api'

interface TokenStatus {
  valid: boolean
  reason?: string
  expiresAt?: string
  expiresInMs?: number
}

interface ScrapeResult {
  scrapedAt: string
  total: number
  inserted: number
  updated: number
}

interface ScrapeStatus {
  token: TokenStatus
  lastScrape: ScrapeResult | null
  totalListings: number
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Expired'
  const hours = Math.floor(ms / 3_600_000)
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

const BOOKMARKLET = `javascript:void(function(){var k=Object.keys(localStorage).find(function(k){return k.includes('accessToken')});if(k){prompt('Copy this token (Cmd+C):',localStorage[k])}else{alert('No ELx token found. Are you logged in to elx.mit.edu?')}})();`

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('admin_key') ?? '')
  const [authenticated, setAuthenticated] = useState(false)

  const [status, setStatus] = useState<ScrapeStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState('')

  const [token, setToken] = useState('')
  const [tokenSaving, setTokenSaving] = useState(false)
  const [tokenMsg, setTokenMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const headers = useCallback(
    () => ({ 'Content-Type': 'application/json', 'x-admin-key': adminKey }),
    [adminKey],
  )

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true)
    setStatusError('')
    try {
      const res = await fetch(`${API_BASE}/admin/scrape-status`, { headers: headers() })
      if (!res.ok) throw new Error(res.status === 401 ? 'Invalid admin key' : 'Failed to fetch status')
      const data = await res.json()
      setStatus(data)
      setAuthenticated(true)
      localStorage.setItem('admin_key', adminKey)
    } catch (err: any) {
      setStatusError(err.message)
      setAuthenticated(false)
    } finally {
      setStatusLoading(false)
    }
  }, [adminKey, headers])

  useEffect(() => {
    if (adminKey) fetchStatus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveToken() {
    setTokenSaving(true)
    setTokenMsg(null)
    try {
      const res = await fetch(`${API_BASE}/admin/elx-token`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTokenMsg({ ok: true, text: `Token saved. Expires ${formatDate(data.expiresAt)}` })
      setToken('')
      fetchStatus()
    } catch (err: any) {
      setTokenMsg({ ok: false, text: err.message })
    } finally {
      setTokenSaving(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const res = await fetch(`${API_BASE}/admin/refresh-listings`, {
        method: 'POST',
        headers: headers(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRefreshMsg({
        ok: true,
        text: `Done: ${data.inserted} new, ${data.updated} updated, ${data.total} total listings`,
      })
      fetchStatus()
    } catch (err: any) {
      setRefreshMsg({ ok: false, text: err.message })
    } finally {
      setRefreshing(false)
    }
  }

  if (!authenticated) {
    return (
      <main className="mx-auto max-w-lg px-8 py-20">
        <div className="animate-fade-in text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-text">admin panel</h1>
          <p className="mb-8 text-sm text-text-tertiary">enter the admin secret to continue</p>
        </div>
        <div className="animate-fade-in-up space-y-4">
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchStatus()}
            placeholder="Admin secret"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-tertiary focus:border-primary/40 focus:outline-none"
          />
          <button
            onClick={fetchStatus}
            disabled={statusLoading || !adminKey}
            className="w-full rounded-full bg-primary px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {statusLoading ? 'Verifying...' : 'Continue'}
          </button>
          {statusError && (
            <p className="text-center text-sm text-accent">{statusError}</p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <div className="animate-fade-in mb-8">
        <p className="mb-1 text-sm font-medium text-text-tertiary">
          admin
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-text">ELx scraper dashboard</h1>
      </div>

      <div className="animate-fade-in-up mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3" style={{ animationDelay: '100ms' }}>
        <StatusCard
          icon={<Key className="h-5 w-5" />}
          label="Token Status"
          value={status?.token.valid ? 'Valid' : 'Invalid'}
          sub={
            status?.token.valid && status.token.expiresInMs
              ? `Expires in ${formatTimeRemaining(status.token.expiresInMs)}`
              : status?.token.reason === 'no_token'
                ? 'No token set'
                : status?.token.reason === 'expired'
                  ? 'Token expired'
                  : ''
          }
          ok={status?.token.valid ?? false}
        />
        <StatusCard
          icon={<Database className="h-5 w-5" />}
          label="Listings in DB"
          value={String(status?.totalListings ?? 0)}
          sub="from ELx"
          ok
        />
        <StatusCard
          icon={<Clock className="h-5 w-5" />}
          label="Last Scrape"
          value={status?.lastScrape ? formatDate(status.lastScrape.scrapedAt) : 'Never'}
          sub={
            status?.lastScrape
              ? `${status.lastScrape.inserted} new, ${status.lastScrape.updated} updated`
              : 'Run a scrape to populate'
          }
          ok={!!status?.lastScrape}
        />
      </div>

      <section className="animate-fade-in-up mb-6 rounded-2xl bg-surface p-6" style={{ animationDelay: '200ms' }}>
        <h2 className="mb-1 text-sm font-semibold text-primary">set ELx token</h2>
        <p className="mb-4 text-xs text-text-tertiary">
          Log in to{' '}
          <a href="https://elx.mit.edu" target="_blank" rel="noreferrer" className="underline hover:text-primary">
            elx.mit.edu
          </a>
          , then use the bookmarklet below to copy your access token.
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste Cognito access token..."
            className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-tertiary focus:border-primary/40 focus:outline-none"
          />
          <button
            onClick={handleSaveToken}
            disabled={tokenSaving || !token.trim()}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {tokenSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
            Save
          </button>
        </div>
        {tokenMsg && (
          <p className={`mt-3 text-sm ${tokenMsg.ok ? 'text-emerald-600' : 'text-accent'}`}>
            {tokenMsg.text}
          </p>
        )}
      </section>

      <section className="animate-fade-in-up mb-6 rounded-2xl bg-surface p-6" style={{ animationDelay: '300ms' }}>
        <h2 className="mb-1 text-sm font-semibold text-primary">refresh listings</h2>
        <p className="mb-4 text-xs text-text-tertiary">
          Calls the ELx API with your token, fetches all listings, and upserts them into the database.
          Also runs automatically every day at 6 AM if a valid token is available.
        </p>
        <button
          onClick={handleRefresh}
          disabled={refreshing || !status?.token.valid}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {refreshing ? 'Scraping...' : 'Refresh Now'}
        </button>
        {refreshMsg && (
          <p className={`mt-3 text-sm ${refreshMsg.ok ? 'text-emerald-600' : 'text-accent'}`}>
            {refreshMsg.text}
          </p>
        )}
      </section>

      <section className="animate-fade-in-up rounded-2xl bg-surface p-6" style={{ animationDelay: '400ms' }}>
        <h2 className="mb-1 text-sm font-semibold text-primary">bookmarklet</h2>
        <p className="mb-4 text-xs text-text-tertiary">
          Drag the button below to your bookmarks bar. After logging into ELx, click it to copy
          your access token to clipboard, then paste it above.
        </p>
        <div className="flex items-center gap-4">
          <a
            href={BOOKMARKLET}
            onClick={(e) => e.preventDefault()}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary"
          >
            <Copy className="h-4 w-4" />
            Copy ELx Token
          </a>
          <span className="text-xs text-text-tertiary">
            Drag this to your bookmarks bar
          </span>
        </div>
      </section>
    </main>
  )
}

function StatusCard({
  icon,
  label,
  value,
  sub,
  ok,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  ok: boolean
}) {
  return (
    <div className="rounded-2xl bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <XCircle className="h-4 w-4 text-accent" />
        )}
      </div>
      <p className="text-xl font-bold tracking-tight text-text">{value}</p>
      <p className="text-xs text-text-tertiary">{label}</p>
      {sub && <p className="mt-1 text-xs text-text-tertiary">{sub}</p>}
    </div>
  )
}
