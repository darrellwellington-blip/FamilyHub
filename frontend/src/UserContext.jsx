import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { usersApi } from './api'
import { supabase } from './supabaseClient'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [users, setUsers]             = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [profileFound, setProfileFound] = useState(null) // null=loading, true/false

  const loadUsers = useCallback(async () => {
    const data = await usersApi.list()
    setUsers(data)
    return data
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const data = await loadUsers()

      if (authUser?.email) {
        const match = data.find(u => u.email === authUser.email)
        if (match) {
          setCurrentUser(match)
          setProfileFound(true)
        } else {
          setProfileFound(false)
        }
      } else {
        setProfileFound(true) // no auth yet, handled by AuthContext
      }
    }
    init().catch(console.error)
  }, [loadUsers])

  const selectUser = (user) => setCurrentUser(user)

  const reloadUsers = useCallback(async () => {
    const data = await loadUsers()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser?.email) {
      const match = data.find(u => u.email === authUser.email)
      if (match) { setCurrentUser(match); setProfileFound(true) }
    }
  }, [loadUsers])

  return (
    <UserContext.Provider value={{ currentUser, users, selectUser, reloadUsers, profileFound }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
