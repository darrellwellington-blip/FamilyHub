import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { usersApi } from './api'
import { supabase } from './supabaseClient'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [users, setUsers]               = useState([])
  const [currentUser, setCurrentUser]   = useState(null)
  const [profileFound, setProfileFound] = useState(null) // null=loading, true, false
  const [initError, setInitError]       = useState(null)

  const resolveProfile = useCallback(async (authUser) => {
    setProfileFound(null)
    setInitError(null)
    try {
      const data = await usersApi.list()
      setUsers(data)
      if (authUser?.email) {
        const match = data.find(u => u.email === authUser.email)
        if (match) {
          setCurrentUser(match)
          setProfileFound(true)
        } else {
          setCurrentUser(null)
          setProfileFound(false)
        }
      } else {
        // Signed out — clear state
        setCurrentUser(null)
        setProfileFound(false)
      }
    } catch (err) {
      console.error('UserContext init error:', err)
      setInitError(err.message)
    }
  }, [])

  useEffect(() => {
    // Resolve on mount
    supabase.auth.getUser().then(({ data: { user } }) => resolveProfile(user))

    // Re-resolve whenever auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveProfile(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [resolveProfile])

  const reloadUsers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    await resolveProfile(user)
  }, [resolveProfile])

  const selectUser = (user) => setCurrentUser(user)

  return (
    <UserContext.Provider value={{ currentUser, users, selectUser, reloadUsers, profileFound, initError }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
