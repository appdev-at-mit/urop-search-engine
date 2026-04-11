import { useRef, useState, useCallback } from 'react'
import { Loader2, Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react'
import ListingCard from '../components/ListingCard'

interface RankedListing {
  elx_id: string
  title: string
  department: string
  professor?: string
  lab?: string
  description?: string
  score: number
  major_match: boolean
  [key: string]: unknown
}

async function rankByResume(resumePath: string, topK = 10): Promise<RankedListing[]> {
  const res = await fetch('/api/listings/rank/resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumePath, top_k: topK }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Ranking failed')
  return data.results
}

export default function ResumeRanker() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [resumePath, setResumePath] = useState('')
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [results, setResults] = useState<RankedListing[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  // Since we can't upload files directly to the server in this setup,
  // we accept a file path string. The file input shows the filename for UX.
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    // Prompt user to confirm the full path (needed by Python script)
    const path = prompt(
      `Enter the full path to your resume PDF:\n(e.g. C:/Users/you/Desktop/${file.name})`,
      `C:/Users/${file.name}`
    )
    if (path) setResumePath(path.trim())
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.name.endsWith('.pdf')) return
    setFileName(file.name)
    const path = prompt(
      `Enter the full path to your resume PDF:\n(e.g. C:/Users/you/Desktop/${file.name})`,
      `C:/Users/${file.name}`
    )
    if (path) setResumePath(path.trim())
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  async function handleRank() {
    if (!resumePath) return
    setStatus('loading')
    setResults([])
    setErrorMsg('')
    try {
      const ranked = await rankByResume(resumePath, 10)
      setResults(ranked)
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  function handleClear() {
    setResumePath('')
    setFileName('')
    setStatus('idle')
    setResults([])
    setErrorMsg('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <section className="mx-auto max-w-7xl px-8 py-12">
      {/* Header */}
      <div className="animate-fade-in mb-2">
        <p className="mb-1 text-sm font-medium text-text-tertiary">personalized</p>
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-text">rank by resume</h1>
        <p className="mb-8 text-sm text-text-tertiary">
          Upload your resume PDF to see UROPs ranked by relevance to your major.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !resumePath && inputRef.current?.click()}
        className={[
          'animate-fade-in-up relative mb-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-12 transition-all duration-200',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : resumePath
            ? 'border-primary/40 bg-surface cursor-default'
            : 'border-text-tertiary/30 bg-surface hover:border-primary/50 hover:bg-primary/5',
        ].join(' ')}
        style={{ animationDelay: '100ms' }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileInput}
        />

        {resumePath ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <FileText className="h-10 w-10 text-primary" />
            <div>
              <p className="font-medium text-text">{fileName || 'Resume selected'}</p>
              <p className="mt-1 max-w-sm break-all text-xs text-text-tertiary">{resumePath}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleClear() }}
              className="mt-1 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-text-tertiary hover:bg-accent/10 hover:text-accent transition-colors"
            >
              <X className="h-3 w-3" /> clear
            </button>
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

      {/* Rank button */}
      {resumePath && status !== 'loading' && (
        <div className="animate-fade-in mb-8 flex justify-center">
          <button
            onClick={handleRank}
            className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md active:scale-95"
          >
            rank listings
          </button>
        </div>
      )}

      {/* Loading */}
      {status === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-text-tertiary">analyzing your resume…</p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="animate-fade-in mb-8 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-medium text-accent">Ranking failed</p>
            <p className="mt-0.5 text-xs text-text-tertiary">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {status === 'success' && results.length > 0 && (
        <div className="animate-fade-in">
          <div className="mb-5 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            <p className="text-sm text-text-tertiary">
              showing <span className="font-medium text-text">{results.length} listings</span> ranked
              by relevance to your major
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

      {status === 'success' && results.length === 0 && (
        <div className="animate-fade-in rounded-2xl bg-surface p-16 text-center">
          <p className="font-medium text-text">No listings returned</p>
          <p className="mt-2 text-sm text-text-tertiary">The ranker ran but returned no results.</p>
        </div>
      )}
    </section>
  )
}