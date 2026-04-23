import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Upload, FileText, X, CheckCircle, AlertCircle, LogOut, User } from 'lucide-react'
import ListingCard from '../components/ListingCard'

interface UserProfile {
  googleId: string
  email: string
  name: string
  picture?: string
}

interface ResumeInfo {
  filename: string
  uploadedAt: string
}

interface RankedListing {
  elx_id: string
  title: string
  department: string
  score: number
  major_match: boolean
  [key: string]: unknown
}

async function fetchUser(): Promise<UserProfile | null> {
  const res = await fetch('/auth/me', { credentials: 'include' })
  const data = await res.json()
  return data.user
}

async function fetchResumeInfo(): Promise<ResumeInfo | null> {
  const res = await fetch('/api/profile/resume', { credentials: 'include' })
  const data = await res.json()
  return data.resume
}

async function uploadResume(file: File): Promise<void> {
  const formData = new FormData()
  formData.append('resume', file)
  const res = await fetch('/api/profile/resume', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Upload failed')
  }
}

async function rankListings(topK = 10): Promise<RankedListing[]> {
  const res = await fetch('/api/profile/resume/rank', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ top_k: topK }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Ranking failed')
  return data.results
}

async function logout(): Promise<void> {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
}

export default function ProfilePage() {
  const [searchParams] = useSearchParams()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [resumeInfo, setResumeInfo] = useState<ResumeInfo | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [rankStatus, setRankStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [results, setResults] = useState<RankedListing[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const authError = searchParams.get('error')

  useEffect(() => {
    fetchUser().then((u) => {
      setUser(u)
      setAuthLoading(false)
      if (u) fetchResumeInfo().then(setResumeInfo)
    })
  }, [])

  async function handleFileSelect(file: File) {
    if (!file.name.endsWith('.pdf')) {
      setErrorMsg('Please upload a PDF file.')
      return
    }
    setUploadStatus('uploading')
    setErrorMsg('')
    try {
      await uploadResume(file)
      const info = await fetchResumeInfo()
      setResumeInfo(info)
      setUploadStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
      setUploadStatus('error')
    }
  }

  async function handleRank() {
    setRankStatus('loading')
    setResults([])
    setErrorMsg('')
    try {
      const ranked = await rankListings(10)
      setResults(ranked)
      setRankStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ranking failed')
      setRankStatus('error')
    }
  }

  async function handleLogout() {
    await logout()
    setUser(null)
    setResumeInfo(null)
    setResults([])
    setRankStatus('idle')
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  // ── Not logged in ──
  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-8 py-24 text-center">
        <div className="animate-fade-in">
          <div className="mb-6 flex justify-center">
            <div className="rounded-2xl bg-surface p-5">
              <User className="h-10 w-10 text-text-tertiary" />
            </div>
          </div>
          <p className="mb-1 text-sm font-medium text-text-tertiary">personalized</p>
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-text">your profile</h1>
          <p className="mb-8 text-sm text-text-tertiary">
            Sign in with your MIT Google account to upload your resume and get personalized UROP rankings.
          </p>

          {authError === 'not_mit' && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-left">
              <AlertCircle className="h-4 w-4 shrink-0 text-accent" />
              <p className="text-sm text-accent">Only @mit.edu accounts are allowed.</p>
            </div>
          )}
          {authError === 'auth_failed' && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-left">
              <AlertCircle className="h-4 w-4 shrink-0 text-accent" />
              <p className="text-sm text-accent">Sign-in failed. Please try again.</p>
            </div>
          )}

          <a
            href="/auth/google"
            className="inline-flex items-center gap-3 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-800 shadow-md transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 border border-gray-200"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </a>
          <p className="mt-4 text-xs text-text-tertiary">MIT accounts only (@mit.edu)</p>
        </div>
      </main>
    )
  }

  // ── Logged in ──
  return (
    <main className="mx-auto max-w-7xl px-8 py-12">
      {/* Header */}
      <div className="animate-fade-in mb-10 flex items-center justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-text-tertiary">personalized</p>
          <h1 className="text-4xl font-bold tracking-tight text-text">your profile</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {user.picture && (
              <img src={user.picture} alt={user.name} className="h-9 w-9 rounded-full" />
            )}
            <div className="text-right">
              <p className="text-sm font-medium text-text">{user.name}</p>
              <p className="text-xs text-text-tertiary">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl border border-text-tertiary/20 px-4 py-2 text-sm text-text-tertiary transition-colors hover:border-accent/30 hover:text-accent"
          >
            <LogOut className="h-4 w-4" />
            sign out
          </button>
        </div>
      </div>

      {/* Resume upload */}
      <div className="animate-fade-in-up mb-10" style={{ animationDelay: '100ms' }}>
        <h2 className="mb-4 text-lg font-semibold text-text">resume</h2>

        {resumeInfo ? (
          <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-surface px-6 py-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-text">{resumeInfo.filename}</p>
                <p className="text-xs text-text-tertiary">
                  Uploaded {new Date(resumeInfo.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => inputRef.current?.click()}
              className="text-xs text-text-tertiary hover:text-primary transition-colors"
            >
              replace
            </button>
            <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFileSelect(f)
            }} />
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) handleFileSelect(f)
            }}
            onClick={() => inputRef.current?.click()}
            className={[
              'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-12 transition-all duration-200',
              isDragging
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-text-tertiary/30 bg-surface hover:border-primary/50 hover:bg-primary/5',
            ].join(' ')}
          >
            <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFileSelect(f)
            }} />
            {uploadStatus === 'uploading' ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-text-tertiary">uploading…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <Upload className="h-10 w-10 text-text-tertiary" />
                <div>
                  <p className="font-medium text-text">drop your resume here</p>
                  <p className="mt-1 text-sm text-text-tertiary">or click to select a PDF</p>
                </div>
              </div>
            )}
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-accent" />
            <p className="text-sm text-accent">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Rank button */}
      {resumeInfo && rankStatus !== 'loading' && (
        <div className="animate-fade-in mb-10">
          <button
            onClick={handleRank}
            className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md active:scale-95"
          >
            rank listings for me
          </button>
        </div>
      )}

      {/* Loading */}
      {rankStatus === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-text-tertiary">analyzing your resume…</p>
        </div>
      )}

      {/* Rank error */}
      {rankStatus === 'error' && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-medium text-accent">Ranking failed</p>
            <p className="mt-0.5 text-xs text-text-tertiary">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {rankStatus === 'success' && results.length > 0 && (
        <div className="animate-fade-in">
          <div className="mb-5 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            <p className="text-sm text-text-tertiary">
              showing <span className="font-medium text-text">{results.length} listings</span> ranked by relevance to your major
              {results[0]?.major_match && (
                <> — <span className="font-medium text-primary">major match</span> listings appear first</>
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.map((listing, i) => (
              <div key={listing.elx_id ?? i} className="relative">
                {listing.major_match && (
                  <span className="absolute -top-2 -right-2 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                    major match
                  </span>
                )}
                <ListingCard listing={listing as any} index={i} />
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
