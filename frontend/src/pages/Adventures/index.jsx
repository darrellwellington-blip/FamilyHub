import { useNavigate } from 'react-router-dom'

const ACTIVITIES = [
  { id: 'escape-rooms', label: 'Escape Rooms', icon: '🔐', description: 'Track rooms conquered across Ottawa venues', path: '/adventures/escape-rooms' },
  { id: 'mini-golf',   label: 'Mini Golf',    icon: '⛳', description: 'Log rounds, scores and course history',       path: '/adventures/mini-golf' },
  { id: 'bowling',     label: 'Bowling',      icon: '🎳', description: 'Track games, scores and lane sessions',       path: '/adventures/bowling' },
  { id: 'movies',      label: 'Movies',       icon: '🎬', description: 'Log movies watched at home or in theaters',   path: '/adventures/movies' },
]

export default function Adventures() {
  const navigate = useNavigate()
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Adventures</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ACTIVITIES.map(a => (
          <button key={a.id} onClick={() => navigate(a.path)}
            className="text-left p-6 bg-white rounded-2xl border border-gray-200 shadow-sm
                       hover:shadow-md hover:border-indigo-300 transition-all group">
            <div className="text-4xl mb-3">{a.icon}</div>
            <div className="font-semibold text-gray-900 text-lg group-hover:text-indigo-700 transition-colors">{a.label}</div>
            <div className="text-sm text-gray-500 mt-1">{a.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
