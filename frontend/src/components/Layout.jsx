import { Outlet, NavLink } from 'react-router-dom'
import { useUser } from '../UserContext'

const NAV = [
  { to: '/tasks',      label: 'Tasks' },
  { to: '/meals',      label: 'Meals' },
  { to: '/shopping',   label: 'Shopping' },
  { to: '/purchases',  label: 'Purchases' },
  { to: '/inventory',  label: 'Inventory' },
  { to: '/adventures', label: 'Adventures' },
]

export default function Layout() {
  const { currentUser, users, selectUser } = useUser()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-800 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-6">

          {/* Logo */}
          <span className="text-white font-bold text-base tracking-tight shrink-0">
            Family Hub
          </span>

          {/* Nav */}
          <nav className="flex gap-0.5 flex-1">
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

          {/* User selector */}
          <div className="shrink-0">
            <select
              value={currentUser?.id ?? ''}
              onChange={e => {
                const user = users.find(u => u.id === Number(e.target.value))
                if (user) selectUser(user)
              }}
              className="bg-slate-700 text-white text-sm rounded px-3 py-1.5
                         border border-slate-600 focus:outline-none focus:ring-2
                         focus:ring-indigo-400 cursor-pointer"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
