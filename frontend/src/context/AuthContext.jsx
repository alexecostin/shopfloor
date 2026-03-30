import { createContext, useContext, useState } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1]
    return JSON.parse(atob(base64))
  } catch { return {} }
}

function buildUser(dbUser, jwtPayload) {
  return {
    ...dbUser,
    // Merge JWT payload fields that frontend needs
    roles: jwtPayload.roles || [dbUser.role],
    permissions: jwtPayload.permissions || [],
    scopes: jwtPayload.scopes || [],
    activeModules: jwtPayload.activeModules || null,
    tenantId: jwtPayload.tenantId || dbUser.tenant_id || null,
    tier: jwtPayload.tier || 'basic',
    licenseStatus: jwtPayload.licenseStatus || 'active',
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('user'))
      if (!saved) return null
      // Re-decode token to get fresh JWT data
      const token = localStorage.getItem('token')
      if (token) {
        const payload = decodeJwtPayload(token)
        return buildUser(saved, payload)
      }
      return saved
    } catch { return null }
  })

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    const jwtPayload = decodeJwtPayload(data.token)
    const fullUser = buildUser(data.user, jwtPayload)
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(fullUser))
    setUser(fullUser)
    return fullUser
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
