// BugReportButton
// ────────────────
// A persistent floating circular button (bottom-right, bug icon from lucide-react)
// that opens a centered overlay where any visitor can submit a bug report.
//
// • Logged-in users  → the report is associated with their account.
// • Anonymous users  → reporter is null (backend labels it "anonymous").
//
// The button renders on every page via App.jsx and sits above all other content
// (z-50).  It does NOT interfere with existing routing or auth logic.

import { useState } from 'react'
import { Bug, X, Send } from 'lucide-react'
import { submitBugReport } from '../services/bugs'

export default function BugReportButton() {
  const [isOpen,       setIsOpen]       = useState(false)
  const [description,  setDescription]  = useState('')
  const [status,       setStatus]       = useState(null) // null | 'loading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('')

  const open  = () => { setIsOpen(true); setStatus(null); setDescription(''); setErrorMessage('') }
  const close = () => { setIsOpen(false) }

  const handleSubmit = async () => {
    const trimmed = description.trim()
    if (!trimmed) return

    setStatus('loading')
    const result = await submitBugReport(trimmed)

    if (result.ok) {
      setStatus('success')
      setDescription('')
    } else {
      setStatus('error')
      setErrorMessage(result.error || 'Something went wrong. Please try again.')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
  }

  return (
    <>
      {/* ── Floating trigger button ────────────────────────────────────────── */}
      <button
        onClick={open}
        aria-label="Report a bug"
        className={[
          'fixed bottom-6 right-6 z-50',
          'w-12 h-12 rounded-full',
          'bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500',
          'flex items-center justify-center',
          'shadow-lg shadow-black/40',
          'transition-colors duration-150',
        ].join(' ')}
      >
        <Bug className="w-5 h-5 text-slate-300" />
      </button>

      {/* ── Overlay backdrop ──────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) close() }}
        >
          {/* ── Modal panel ──────────────────────────────────────────────── */}
          <div className="relative w-full max-w-md mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/60 p-6">

            {/* Close button */}
            <button
              onClick={close}
              aria-label="Close"
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2.5 mb-4">
              <Bug className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <h2 className="text-sm font-semibold text-white">Report a bug</h2>
            </div>

            {status === 'success' ? (
              // ── Success state ─────────────────────────────────────────────
              <div className="py-4 text-center">
                <p className="text-slate-300 text-sm mb-1">Thanks for the report!</p>
                <p className="text-slate-500 text-xs">We&apos;ll look into it as soon as possible.</p>
                <button
                  onClick={close}
                  className="mt-5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              // ── Form state ────────────────────────────────────────────────
              <>
                <textarea
                  autoFocus
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe what happened…"
                  rows={5}
                  className={[
                    'w-full resize-none rounded-xl',
                    'bg-slate-800 border',
                    status === 'error' ? 'border-red-500/50' : 'border-slate-700 focus:border-slate-500',
                    'text-slate-200 text-sm placeholder-slate-500',
                    'px-3.5 py-3',
                    'focus:outline-none transition-colors',
                  ].join(' ')}
                />

                {status === 'error' && (
                  <p className="mt-1.5 text-xs text-red-400">{errorMessage}</p>
                )}

                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-slate-600">⌘ / Ctrl + Enter to send</p>
                  <button
                    onClick={handleSubmit}
                    disabled={!description.trim() || status === 'loading'}
                    className={[
                      'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      description.trim() && status !== 'loading'
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed',
                    ].join(' ')}
                  >
                    <Send className="w-3 h-3" />
                    {status === 'loading' ? 'Sending…' : 'Send report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
