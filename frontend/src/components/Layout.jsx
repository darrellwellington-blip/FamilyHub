import { Outlet, NavLink } from 'react-router-dom'
import { useUser } from '../UserContext'
import { useAuth } from '../AuthContext'

const NAV = [
  { to: '/tasks',      label: 'Tasks',      icon: '✅' },
  { to: '/meals',      label: 'Meals',      icon: '🍽️' },
  { to: '/shopping',   label: 'Shopping',   icon: '🛒' },
  { to: '/purchases',  label: 'Purchases',  icon: '🧾' },
  { to: '/inventory',  label: 'Inventory',  icon: '📦' },
  { to: '/adventures', label: 'Adventures', icon: '🎯' },
]

export default function Layout() {
  const { currentUser, users, selectUser } = useUser()
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header */}
      <header className="bg-slate-800 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <span className="text-white font-bold text-base tracking-tight shrink-0">
            Family Hub
          </span>

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden sm:flex gap-0.5 flex-1">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-slate-800'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Current user + sign out */}
          <div className="shrink-0 flex items-center gap-2">
            {currentUser && (
              <span className="text-slate-300 text-sm font-medium hidden sm:inline">
                {currentUser.name}
              </span>
            )}
            <button
              onClick={signOut}
              className="text-slate-400 hover:text-white text-xs px-2 py-1.5 rounded
                         hover:bg-slate-700 transition-colors whitespace-nowrap"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Page content — extra bottom padding on mobile to clear the tab bar */}
      <main className="max-w-7xl mx-auto px-4 py-6 pb-24 sm:pb-6">
        <Outlet />
      </main>

      {/* Bottom tab bar — mobile only */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200
                      flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                isActive ? 'text-indigo-600' : 'text-gray-500'
              }`
            }
          >
            <span className="text-xl leading-none">{icon}</span>
            <span className="leading-none">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
