import { useState, useEffect, useCallback } from 'react'
import { mealsApi } from '../../api'
import MealPlanTab    from './MealPlanTab'
import LibraryTab     from './LibraryTab'
import TryTab         from './TryTab'
import RestaurantsTab from './RestaurantsTab'

const TABS = [
  { key: 'plan',        label: '📅 Meal Plan' },
  { key: 'library',     label: '📖 Recipes' },
  { key: 'restaurants', label: '🍽️ Restaurants' },
  { key: 'try',         label: '🌟 Want to Try' },
]

export default function Meals() {
  const [tab,         setTab]         = useState('plan')
  const [meals,       setMeals]       = useState([])
  const [tryList,     setTryList]     = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [loading,     setLoading]     = useState(true)

  const loadMeals       = useCallback(() => mealsApi.list().then(setMeals).catch(() => {}), [])
  const loadTry         = useCallback(() => mealsApi.listTry().then(setTryList).catch(() => {}), [])
  const loadRestaurants = useCallback(() => mealsApi.listRestaurants().then(setRestaurants).catch(() => {}), [])

  useEffect(() => {
    Promise.all([loadMeals(), loadTry(), loadRestaurants()])
      .finally(() => setLoading(false))
  }, [loadMeals, loadTry, loadRestaurants])

  if (loading) return <p className="text-gray-400 text-center py-16">Loading…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Meals</h1>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plan'        && (
        <MealPlanTab meals={meals} restaurants={restaurants}
          onMealsChanged={async () => { await loadMeals(); await loadRestaurants() }} />
      )}
      {tab === 'library'     && (
        <LibraryTab meals={meals} onChanged={loadMeals} />
      )}
      {tab === 'try'         && (
        <TryTab tryList={tryList} onChanged={loadTry}
          onPromoted={() => { loadMeals(); loadTry() }}
          onRestaurantsChanged={loadRestaurants} />
      )}
      {tab === 'restaurants' && (
        <RestaurantsTab restaurants={restaurants} onChanged={loadRestaurants} />
      )}
    </div>
  )
}
