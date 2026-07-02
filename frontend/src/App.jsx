import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider } from './UserContext'
import Layout from './components/Layout'
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

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/tasks" replace />} />
            <Route path="tasks"     element={<Tasks />} />
            <Route path="meals"     element={<Meals />} />
            <Route path="shopping"  element={<Shopping />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="adventures"                  element={<Adventures />} />
            <Route path="adventures/escape-rooms"     element={<EscapeRooms />} />
            <Route path="adventures/mini-golf"        element={<MiniGolf />} />
            <Route path="adventures/bowling"          element={<Bowling />} />
            <Route path="adventures/movies"           element={<Movies />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </UserProvider>
  )
}
