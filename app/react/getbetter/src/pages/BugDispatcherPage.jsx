// BugDispatcherPage
// ──────────────────
// Accessible at /bugs.
//
// Admin (is_staff=true) → sees ALL bug reports + a dropdown per row to assign them
//                          to any developer.
// Developer (role='developer') → sees only the bugs assigned to them (read-only).
//
// Access is NOT gated by ProtectedRoute (role prop) because we need two roles
// to land here.  Instead the component itself handles the auth/role check and
// shows a 403-style message for everyone else.

import { useEffect, useState, useCallback } from 'react'
import { Bug, User, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getBugReports, assignBugReport } from '../services/bugs'

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function reporterLabel(reporter) {
  if (!reporter) return 'anonymous'
  return `${reporter.first_name} ${reporter.last_name} (${reporter.email})`
}

// ─── AssignSelect — a single dropdown cell for admins ────────────────────────

function AssignSelect({ bug, developers, onAssigned }) {
  const [loading, setLoading] = useState(false)

  const handleChange = async (e) => {
    const value = e.target.value
    const developerId = value === '' ? null : parseInt(value, 10)
    setLoading(true)
    const result = await assignBugReport(bug.id, developerId)
    setLoading(false)
    if (result.ok) onAssigned(result.data)
  }

  const currentValue = bug.assigned_to ? String(bug.assigned_to.id) : ''

  return (
    <select
      value={currentValue}
      onChange={handleChange}
      disabled={loading}
      className={[
        'w-full rounded-lg px-2.5 py-1.5 text-xs',
        'bg-slate-800 border border-slate-700',
        'text-slate-300',
        'focus:outline-none focus:border-slate-500 transition-colors',
        loading ? 'opacity-50 cursor-wait' : '',
      ].join(' ')}
    >
      <option value="">— Unassigned —</option>
      {developers.map((dev) => (
        <option key={dev.id} value={String(dev.id)}>
          {dev.first_name} {dev.last_name}
        </option>
      ))}
    </select>
  )
}

// ─── BugRow ───────────────────────────────────────────────────────────────────

function BugRow({ bug, developers, isAdmin, onAssigned }) {
  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">#{bug.id}</td>
      <td className="px-4 py-3 text-sm text-slate-200 max-w-sm">
        <p className="line-clamp-3 leading-relaxed">{bug.description}</p>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
        {reporterLabel(bug.reporter)}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
        {formatDate(bug.created_at)}
      </td>
      <td className="px-4 py-3 min-w-[160px]">
        {isAdmin ? (
          <AssignSelect bug={bug} developers={developers} onAssigned={onAssigned} />
        ) : (
          <span className="text-xs text-slate-400">
            {bug.assigned_to
              ? `${bug.assigned_to.first_name} ${bug.assigned_to.last_name}`
              : '—'}
          </span>
        )}
      </td>
    </tr>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BugDispatcherPage() {
  const { user } = useAuth()

  const [bugs,       setBugs]       = useState([])
  const [developers, setDevelopers] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const isAdmin = user?.is_staff === true
  const isDev   = user?.role === 'developer'
  const canView = isAdmin || isDev

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await getBugReports()
    setLoading(false)
    if (result.ok) {
      setBugs(result.data.bugs || [])
      setDevelopers(result.data.developers || [])
    } else {
      setError(result.error || 'Failed to load bug reports.')
    }
  }, [])

  useEffect(() => {
    if (canView) load()
  }, [canView, load])

  // Update one bug in place after a successful assign
  const handleAssigned = (updatedBug) => {
    setBugs((prev) => prev.map((b) => (b.id === updatedBug.id ? updatedBug : b)))
  }

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (user === undefined) return null // still loading auth

  if (!canView) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-500 text-sm">You don&apos;t have permission to view this page.</p>
        </div>
      </main>
    )
  }

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Bug className="w-5 h-5 text-slate-400" />
            <h1 className="text-lg font-semibold text-white">
              {isAdmin ? 'Bug Dispatcher' : 'My Assigned Bugs'}
            </h1>
            {!loading && (
              <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
                {bugs.length}
              </span>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Empty / loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-5 h-5 text-slate-600 animate-spin" />
          </div>
        )}

        {!loading && !error && bugs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bug className="w-8 h-8 text-slate-700 mb-3" />
            <p className="text-slate-500 text-sm">No bug reports yet.</p>
          </div>
        )}

        {/* Table */}
        {!loading && bugs.length > 0 && (
          <div className="rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3 h-3" />
                      Reporter
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Submitted</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {isAdmin ? 'Assign to' : 'Assigned to'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {bugs.map((bug) => (
                  <BugRow
                    key={bug.id}
                    bug={bug}
                    developers={developers}
                    isAdmin={isAdmin}
                    onAssigned={handleAssigned}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
