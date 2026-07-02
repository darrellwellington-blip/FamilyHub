import { createContext, useContext, useState, useEffect } from 'react'
import { usersApi } from './api'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [users, setUsers]           = useState([])
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    usersApi.list().then(data => {
      setUsers(data)
      const storedId = Number(localStorage.getItem('currentUserId'))
      const found = data.find(u => u.id === storedId)
      setCurrentUser(found || data[0] || null)
    }).catch(console.error)
  }, [])

  const selectUser = (user) => {
    setCurrentUser(user)
    localStorage.setItem('currentUserId', user.id)
  }

  const reloadUsers = async () => {
    const data = await usersApi.list()
    setUsers(data)
  }

  return (
    <UserContext.Provider value={{ currentUser, users, selectUser, reloadUsers }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
