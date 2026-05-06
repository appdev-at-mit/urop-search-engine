import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, Upload, FileText, X, CheckCircle, AlertCircle, LogOut, User, Save, Sparkles } from 'lucide-react'
import ListingCard from '../components/ListingCard'
import { useAuth } from '../lib/auth'

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

interface ParsedFields {
  major?: string
  year?: string
  gpa?: string
  skills?: string[]
  interests?: string[]
}

async function fetchResumeInfo(): Promise<ResumeInfo | null> {
  const res = await fetch('/api/profile/resume', { credentials: 'include' })
  if (!res.ok) return null
  const data = await res.json()
  return data.resume
}

async function uploadResume(file: File): Promise<{ filename: string; parsed: ParsedFields }> {
  const formData = new FormData()
  formData.append('resume', file)
  const res = await fetch('/api/profile/resume', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  if (!res.ok) {
    const text = await res.text()
    let msg = 'Upload failed'
    try { msg = JSON.parse(text).error || msg } catch {}
    throw new Error(msg)
  }
  const data = await res.json()
  return { filename: data.filename, parsed: data.parsed || {} }
}

async function rankListings(topK = 10): Promise<RankedListing[]> {
  const res = await fetch('/api/profile/resume/rank', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ top_k: topK }),
  })
  if (!res.ok) {
    const text = await res.text()
    let msg = 'Ranking failed'
    try { msg = JSON.parse(text).error || msg } catch {}
    throw new Error(msg)
  }
  const data = await res.json()
  return data.results
}

export default function ProfilePage() {
  const [searchParams] = useSearchParams()
  const { user, loading: authLoading, logout, updateProfile, refetch } = useAuth()

  const [resumeInfo, setResumeInfo] = useState<ResumeInfo | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [rankStatus, setRankStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [results, setResults] = useState<RankedListing[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Profile editing
  const [major, setMajor] = useState('')
  const [year, setYear] = useState('')
  const [gpa, setGpa] = useState('')
  const [bio, setBio] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [interests, setInterests] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [interestInput, setInterestInput] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [parsedHighlight, setParsedHighlight] = useState<Set<string>>(new Set())

  const authError = searchParams.get('error')

  // Populate fields from user profile
  useEffect(() => {
    if (user) {
      setMajor(user.major || '')
      setYear(user.year || '')
      setGpa(user.gpa || '')
      setBio(user.bio || '')
      setSkills(user.skills || [])
      setInterests(user.interests || [])
      fetchResumeInfo().then(setResumeInfo)
    }
  }, [user])

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    const ok = await updateProfile({ major, year, gpa, bio, skills, interests })
    setSaveStatus(ok ? 'saved' : 'error')
    if (ok) setTimeout(() => setSaveStatus('idle'), 2000)
  }, [major, year, gpa, bio, skills, interests, updateProfile])

  async function handleFileSelect(file: File) {
    if (!file.name.endsWith('.pdf')) {
      setErrorMsg('Please upload a PDF file.')
      return
    }
    setUploadStatus('uploading')
    setErrorMsg('')
    setParsedHighlight(new Set())
    try {
      const { parsed } = await uploadResume(file)
      const info = await fetchResumeInfo()
      setResumeInfo(info)
      setUploadStatus('success')

      // Auto-fill parsed fields and highlight them
      const filled = new Set<string>()
      if (parsed.major && !major) { setMajor(parsed.major); filled.add('major') }
      if (parsed.year && !year) { setYear(parsed.year); filled.add('year') }
      if (parsed.gpa && !gpa) { setGpa(parsed.gpa); filled.add('gpa') }
      if (parsed.skills?.length && skills.length === 0) { setSkills(parsed.skills); filled.add('skills') }
      if (parsed.interests?.length && interests.length === 0) { setInterests(parsed.interests); filled.add('interests') }
      setParsedHighlight(filled)
      if (filled.size > 0) setTimeout(() => setParsedHighlight(new Set()), 5000)

      await refetch()
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
    setResumeInfo(null)
    setResults([])
    setRankStatus('idle')
  }

  function addSkill() {
    const val = skillInput.trim()
    if (val && !skills.includes(val)) setSkills(prev => [...prev, val])
    setSkillInput('')
  }

  function addInterest() {
    const val = interestInput.trim()
    if (val && !interests.includes(val)) setInterests(prev => [...prev, val])
    setInterestInput('')
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-24 py-24 text-center">
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

  const highlightRing = (field: string) =>
    parsedHighlight.has(field) ? 'ring-2 ring-primary/40 bg-primary/5' : ''

  return (
    <main className="px-24 py-12">
      {/* Header */}
      <div className="animate-fade-in mb-10 flex items-center justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-text-tertiary">personalized</p>
          <h1 className="text-4xl font-bold tracking-tight text-text">your profile</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {user.picture && (
              <img src={user.picture} alt={user.name} className="h-9 w-9 rounded-full" referrerPolicy="no-referrer" />
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

      {/* Auto-fill banner */}
      {parsedHighlight.size > 0 && (
        <div className="animate-fade-in mb-6 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-primary">
            Auto-filled {parsedHighlight.size} field{parsedHighlight.size > 1 ? 's' : ''} from your resume. Review and save below.
          </p>
        </div>
      )}

      {/* Resume upload — compact bar at top */}
      <div className="animate-fade-in mb-8">
        {resumeInfo ? (
          <div className="flex items-center gap-4 rounded-xl border border-primary/20 bg-surface px-5 py-3">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm font-medium text-text">{resumeInfo.filename}</p>
            <p className="text-xs text-text-tertiary">
              Uploaded {new Date(resumeInfo.uploadedAt).toLocaleDateString()}
            </p>
            <div className="ml-auto flex items-center gap-3">
              {rankStatus !== 'loading' && (
                <button
                  onClick={handleRank}
                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                >
                  rank listings for me
                </button>
              )}
              <button
                onClick={() => inputRef.current?.click()}
                className="text-xs text-text-tertiary hover:text-primary transition-colors"
              >
                replace
              </button>
            </div>
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
              'flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed px-5 py-4 transition-all duration-200',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-text-tertiary/30 bg-surface hover:border-primary/50 hover:bg-primary/5',
            ].join(' ')}
          >
            <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFileSelect(f)
            }} />
            {uploadStatus === 'uploading' ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm text-text-tertiary">uploading & parsing...</p>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 shrink-0 text-text-tertiary" />
                <div>
                  <p className="text-sm font-medium text-text">drop your resume here or click to upload</p>
                  <p className="text-xs text-text-tertiary">PDF only — profile fields will be auto-filled</p>
                </div>
              </>
            )}
          </div>
        )}

        {uploadStatus === 'success' && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-2">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            <p className="text-xs text-green-600">Resume uploaded and parsed successfully.</p>
          </div>
        )}
        {uploadStatus === 'error' && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-accent" />
            <p className="text-xs text-accent">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Profile fields */}
      <div className="animate-fade-in-up max-w-3xl" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">your information</h2>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              saveStatus === 'saved'
                ? 'bg-green-500/10 text-green-600'
                : saveStatus === 'error'
                  ? 'bg-accent/10 text-accent'
                  : 'bg-primary text-white hover:opacity-90'
            }`}
          >
            {saveStatus === 'saving' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saveStatus === 'saved' ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saveStatus === 'saved' ? 'saved' : saveStatus === 'saving' ? 'saving...' : 'save'}
          </button>
        </div>

        <div className="space-y-4 rounded-2xl border border-text-tertiary/10 bg-surface p-6">
          {/* Major */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-tertiary">Major / Department</label>
            <input
              type="text"
              value={major}
              onChange={e => setMajor(e.target.value)}
              placeholder="e.g. Computer Science"
              className={`w-full rounded-xl border border-text-tertiary/20 bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-tertiary/50 transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 ${highlightRing('major')}`}
            />
          </div>

          {/* Year + GPA row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-tertiary">Graduation Year</label>
              <input
                type="text"
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="e.g. 2027"
                className={`w-full rounded-xl border border-text-tertiary/20 bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-tertiary/50 transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 ${highlightRing('year')}`}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-tertiary">GPA</label>
              <input
                type="text"
                value={gpa}
                onChange={e => setGpa(e.target.value)}
                placeholder="e.g. 3.85"
                className={`w-full rounded-xl border border-text-tertiary/20 bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-tertiary/50 transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 ${highlightRing('gpa')}`}
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-tertiary">Short Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell us a bit about yourself..."
              rows={3}
              className="w-full rounded-xl border border-text-tertiary/20 bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-tertiary/50 transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* Skills */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-tertiary">Skills</label>
            <div className={`rounded-xl border border-text-tertiary/20 bg-bg p-2 transition-all ${highlightRing('skills')}`}>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {skills.map(skill => (
                  <span key={skill} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {skill}
                    <button onClick={() => setSkills(prev => prev.filter(s => s !== skill))} className="hover:text-accent transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
                  placeholder="Add a skill..."
                  className="flex-1 bg-transparent px-2 py-1 text-sm text-text placeholder:text-text-tertiary/50 focus:outline-none"
                />
                <button onClick={addSkill} className="text-xs font-medium text-primary hover:text-primary-dark transition-colors">Add</button>
              </div>
            </div>
          </div>

          {/* Research Interests */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-tertiary">Research Interests</label>
            <div className={`rounded-xl border border-text-tertiary/20 bg-bg p-2 transition-all ${highlightRing('interests')}`}>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {interests.map(interest => (
                  <span key={interest} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {interest}
                    <button onClick={() => setInterests(prev => prev.filter(i => i !== interest))} className="hover:text-accent transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={interestInput}
                  onChange={e => setInterestInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInterest() } }}
                  placeholder="Add an interest..."
                  className="flex-1 bg-transparent px-2 py-1 text-sm text-text placeholder:text-text-tertiary/50 focus:outline-none"
                />
                <button onClick={addInterest} className="text-xs font-medium text-primary hover:text-primary-dark transition-colors">Add</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {rankStatus === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-text-tertiary">analyzing your resume...</p>
        </div>
      )}

      {/* Rank error */}
      {rankStatus === 'error' && (
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-medium text-accent">Ranking failed</p>
            <p className="mt-0.5 text-xs text-text-tertiary">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {rankStatus === 'success' && results.length > 0 && (
        <div className="animate-fade-in mt-10">
          <div className="mb-5 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            <p className="text-sm text-text-tertiary">
              showing <span className="font-medium text-text">{results.length} listings</span> ranked by relevance to your major
              {results[0]?.major_match && (
                <> — <span className="font-medium text-primary">major match</span> listings appear first</>
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
