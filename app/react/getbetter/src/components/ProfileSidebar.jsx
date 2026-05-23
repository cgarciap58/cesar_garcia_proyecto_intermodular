// ProfileSidebar — the narrow left column shown on both dashboards.
//
// Props:
//   user        – current user object from AuthContext
//   namePrefix  – optional string prepended to the name (e.g. "Dr.")
//   roleLabel   – string shown below the name (e.g. "Patient", "Psychologist")
//   actions     – array of action descriptors rendered as buttons/links:
//                 { label, href?, onClick?, variant? }
//                 variant: 'primary' (default) | 'secondary'

const VARIANTS = {
  primary:
    'w-full text-center rounded-lg bg-blue-500 hover:bg-blue-400 px-3 py-2 ' +
    'text-xs font-semibold text-white transition-colors',
  secondary:
    'w-full rounded-lg border border-slate-700 hover:border-slate-500 px-3 py-2 ' +
    'text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors',
}

export default function ProfileSidebar({ user, namePrefix, roleLabel, actions = [] }) {
  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`
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
          {actions.map(({ label, href, onClick, variant = 'primary' }) =>
            href ? (
              <a key={label} href={href} className={VARIANTS[variant]}>
                {label}
              </a>
            ) : (
              <button key={label} onClick={onClick} className={VARIANTS[variant]}>
                {label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
