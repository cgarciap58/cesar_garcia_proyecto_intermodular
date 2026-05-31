// DashboardSidebar — the narrow left column shown on both dashboards.
// (Renamed from ProfileSidebar for clarity.)
//
// Props:
//   user        – current user object from AuthContext
//   namePrefix  – optional string prepended to the name (e.g. "Dr.")
//   roleLabel   – string shown below the name (e.g. "Patient", "Psychologist")
//   actions     – array of action descriptors rendered as buttons/links:
//                 { label, to?, onClick?, variant?, disabled?, disabledTooltip? }
//                 variant: 'primary' (default) | 'secondary'
//                 disabled: boolean — greys out the action and makes it unclickable
//                 disabledTooltip: string — shown as a floating notification on hover

import { useState } from 'react'
import { Link } from 'react-router-dom'

const VARIANTS = {
  primary:
    'w-full text-center rounded-lg bg-blue-500 hover:bg-blue-400 px-3 py-2 ' +
    'text-xs font-semibold text-white transition-colors',
  secondary:
    'w-full rounded-lg border border-slate-700 hover:border-slate-500 px-3 py-2 ' +
    'text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors',
}

const VARIANTS_DISABLED = {
  primary:
    'w-full text-center rounded-lg bg-slate-700 px-3 py-2 ' +
    'text-xs font-semibold text-slate-500 cursor-not-allowed select-none',
  secondary:
    'w-full rounded-lg border border-slate-800 px-3 py-2 ' +
    'text-xs font-medium text-slate-600 cursor-not-allowed select-none',
}

function DisabledActionWrapper({ tooltip, children }) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      {children}

      {/* Floating notification tooltip */}
      {showTooltip && tooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-52 pointer-events-none">
          <div className="rounded-lg border border-amber-500/30 bg-slate-900/95 backdrop-blur-sm px-3 py-2.5 shadow-xl shadow-black/40">
            {/* Lock icon */}
            <div className="flex items-start gap-2">
              <svg
                className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <p className="text-xs text-amber-300 leading-snug">{tooltip}</p>
            </div>
          </div>
          {/* Arrow pointing down */}
          <div className="flex justify-center">
            <div className="w-2 h-2 rotate-45 border-r border-b border-amber-500/30 bg-slate-900/95 -mt-1" />
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardSidebar({ user, namePrefix, roleLabel, actions = [] }) {
  const initials    = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`
  const displayName = [namePrefix, user?.first_name, user?.last_name].filter(Boolean).join(' ')

  return (
    <div className="flex-shrink-0 w-36 flex flex-col items-center gap-4">
      {/* Avatar */}
      <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden">
        {user?.profile_picture ? (
          <img src={user.profile_picture} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl font-semibold text-slate-400">{initials}</span>
        )}
      </div>

      {/* Name + role */}
      <div className="text-center">
        <p className="text-white font-medium text-sm leading-tight">{displayName}</p>
        <p className="text-slate-500 text-xs mt-0.5">{roleLabel}</p>
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="w-full flex flex-col gap-2 mt-2">
          {actions.map(({ label, to, href, onClick, variant = 'primary', disabled, disabledTooltip }) => {
            if (disabled) {
              const el = (
                <div
                  key={label}
                  className={VARIANTS_DISABLED[variant] ?? VARIANTS_DISABLED.primary}
                  aria-disabled="true"
                  role="button"
                  tabIndex={0}
                >
                  {label}
                </div>
              )
              return disabledTooltip ? (
                <DisabledActionWrapper key={label} tooltip={disabledTooltip}>
                  {el}
                </DisabledActionWrapper>
              ) : el
            }

            if (to) {
              return (
                <Link key={label} to={to} className={VARIANTS[variant]}>
                  {label}
                </Link>
              )
            }
            if (href) {
              return (
                <Link key={label} to={href} className={VARIANTS[variant]}>
                  {label}
                </Link>
              )
            }
            return (
              <button key={label} onClick={onClick} className={VARIANTS[variant]}>
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
