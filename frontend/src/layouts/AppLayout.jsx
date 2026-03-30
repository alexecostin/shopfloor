import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getMenuForUser } from '../config/menuConfig'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'

function useScreenSize() {
  const [size, setSize] = useState(() => {
    if (typeof window === 'undefined') return 'desktop'
    if (window.innerWidth >= 1024) return 'desktop'
    if (window.innerWidth >= 768) return 'tablet'
    return 'mobile'
  })

  useEffect(() => {
    function handler() {
      const w = window.innerWidth
      setSize(w >= 1024 ? 'desktop' : w >= 768 ? 'tablet' : 'mobile')
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return size
}

export default function AppLayout({ children }) {
  const { user } = useAuth()
  const screenSize = useScreenSize()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const menu = useMemo(() => getMenuForUser(user), [user])

  // Close sidebar on resize to desktop
  useEffect(() => {
    if (screenSize === 'desktop') setSidebarOpen(false)
  }, [screenSize])

  if (screenSize === 'desktop') {
    return (
      <div className="flex h-screen bg-slate-100 overflow-hidden">
        <Sidebar menu={menu} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    )
  }

  if (screenSize === 'tablet') {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header mode="tablet" onToggleSidebar={() => setSidebarOpen(o => !o)} />
        {sidebarOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <div className="fixed inset-y-0 left-0 z-50">
              <Sidebar menu={menu} onClose={() => setSidebarOpen(false)} />
            </div>
          </>
        )}
        <main className="p-4">
          {children}
        </main>
      </div>
    )
  }

  // Mobile
  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <Header mode="mobile" />
      <main className="p-3">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
