import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import { UserProvider, useUser } from './UserContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Tasks from './pages/Tasks'
import Meals from './pages/Meals'
import Shopping from './pages/Shopping'
import Purchases from './pages/Purchases'
import Inventory from './pages/Inventory'
import Adventures from './pages/Adventures'
import EscapeRooms from './pages/Adventures/EscapeRooms'
import MiniGolf from './pages/Adventures/MiniGolf'
import Bowling from './pages/Adventures/Bowling'
import Movies from './pages/Adventures/Movies'

function AppRoutes() {
  const { session } = useAuth()
  const { profileFound, reloadUsers, initError } = useUser()

  // Still loading
  if (session === undefined || profileFound === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
        {initError ? (
          <div className="text-center">
            <p className="text-red-500 font-medium">Failed to load</p>
            <p className="text-sm mt-1">{initError}</p>
            <button className="mt-4 btn-primary" onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : 'Loading…'}
      </div>
    )
  }

  // Not signed in
  if (!session) return <Login />

  // Signed in but no profile yet
  if (profileFound === false) return <Onboarding onComplete={reloadUsers} />

  // Fully authenticated
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/tasks" replace />} />
          <Route path="tasks"      element={<Tasks />} />
          <Route path="meals"      element={<Meals />} />
          <Route path="shopping"   element={<Shopping />} />
          <Route path="purchases"  element={<Purchases />} />
          <Route path="inventory"  element={<Inventory />} />
          <Route path="adventures"                  element={<Adventures />} />
          <Route path="adventures/escape-rooms"     element={<EscapeRooms />} />
          <Route path="adventures/mini-golf"        element={<MiniGolf />} />
          <Route path="adventures/bowling"          element={<Bowling />} />
          <Route path="adventures/movies"           element={<Movies />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <UserProvider>
        <AppRoutes />
      </UserProvider>
    </AuthProvider>
  )
}
