'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ChatInterface from '@/components/ChatInterface'
import { useAuth } from '@/contexts/AuthContext'

export default function Home() {
  const router = useRouter()
  const { isAuthenticated, loading } = useAuth()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [loading, isAuthenticated, router])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f7f7f4' }}>
        <div className="text-[#5c5a52]">Loading…</div>
      </main>
    )
  }
  if (!isAuthenticated) return null

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f7f7f4' }}>
      <ChatInterface />
    </main>
  )
}
