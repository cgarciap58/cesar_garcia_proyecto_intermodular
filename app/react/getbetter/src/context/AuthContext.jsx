import { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children, onReady }) {
  const [user, setUser] = useState(undefined) // undefined = still loading, null = not logged in

  useEffect(() => {
    fetch('/api/auth/me/', { credentials: 'include' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        setUser(data)
        onReady?.()
      })
      .catch(() => {
        setUser(null)
        onReady?.()
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const logout = async () => {
    await fetch('/api/auth/logout/', { method: 'POST', credentials: 'include' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
