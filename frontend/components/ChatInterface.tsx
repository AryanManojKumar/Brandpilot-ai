'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { Send, Loader2, Video, Sparkles, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface Message {
  content: string
  isUser: boolean
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function ChatInterface() {
  const router = useRouter()
  const { username, authHeader, logout } = useAuth()
  const [messages, setMessages] = useState<Message[]>([
    {
      content: "👋 Hi! I'm GOJO, your guide for the IIT Gandhinagar Social Media Agent platform.\n\nTo get started, share your website URL (e.g., nike.com, apple.com) and I'll run our brand fetch tool to analyze your brand and save it. After that, you can use the Content Creation Dashboard for your brand info and to create content, and the Social Media Manager for your created assets and X analytics (when connected).",
      isUser: false,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { content: userMessage, isUser: true }])
    setLoading(true)

    try {
      const response = await axios.post(`${API_BASE}/chat`, {
        message: userMessage,
      }, { headers: authHeader() })

      const agentResponse = response.data.response
      setMessages((prev) => [...prev, { content: agentResponse, isUser: false }])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { content: 'Sorry, something went wrong. Please try again.', isUser: false },
      ])
    } finally {
      setLoading(false)
    }
  }

  const openContentDashboard = () => {
    router.push('/content-creator')
  }

  const openSocialMediaManager = () => {
    router.push('/social-media-manager')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#f7f7f4' }}>
      <div className="w-full max-w-6xl flex gap-6">
        {/* Chat Box */}
        <div className="flex-1 h-[85vh] bg-white rounded-2xl shadow-sm border border-[#deddd6] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#26251e] text-white p-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">GOJO</h2>
              <p className="text-sm opacity-80 mt-1">IIT Gandhinagar Social Media Agent</p>
              {username && (
                <p className="text-xs opacity-60 mt-2">Logged in as {username}</p>
              )}
            </div>
            <button
              onClick={() => { logout(); router.replace('/login'); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ backgroundColor: '#fafaf8' }}>
            {messages.map((message, index) => (
              <MessageBubble key={index} message={message} />
            ))}
            {loading && (
              <div className="flex items-start gap-3">
                <div className="bg-[#efefe9] rounded-2xl p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-[#26251e]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-6 border-t border-[#deddd6]">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Enter your website URL (e.g., nike.com)..."
                className="flex-1 px-5 py-3 border border-[#deddd6] rounded-xl focus:outline-none focus:border-[#26251e] focus:ring-1 focus:ring-[#26251e] transition-all text-[#26251e] placeholder:text-[#8a887e]"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="bg-[#26251e] text-white px-5 py-3 rounded-xl hover:bg-[#3d3c33] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Agents Sidebar */}
        <div className="w-80 space-y-4">
          <AgentCard
            icon={<Sparkles className="w-5 h-5" />}
            title="Content Creation"
            description="Generate UGC marketing images for your synced brands"
            onClick={openContentDashboard}
          />
          <AgentCard
            icon={<Video className="w-5 h-5" />}
            title="Social Media Manager"
            description="View and schedule your generated marketing content"
            onClick={openSocialMediaManager}
          />
        </div>
      </div>
    </div>
  )
}

function AgentCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onClick?: () => void
}) {
  return (
    <div
      className="bg-white rounded-xl border border-[#deddd6] p-5 hover:border-[#26251e] transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="bg-[#f7f7f4] border border-[#deddd6] group-hover:border-[#26251e] group-hover:bg-[#26251e] group-hover:text-white text-[#26251e] w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-all">
        {icon}
      </div>
      <h4 className="text-base font-semibold text-[#26251e] mb-1">{title}</h4>
      <p className="text-[#5c5a52] text-sm leading-relaxed">{description}</p>
      <div className="mt-4 pt-4 border-t border-[#deddd6]">
        <span className="text-sm text-[#26251e] font-medium group-hover:underline">
          Open Dashboard →
        </span>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <div className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl p-4 ${message.isUser
            ? 'bg-[#26251e] text-white'
            : 'bg-white border border-[#deddd6] text-[#26251e]'
          }`}
      >
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
      </div>
    </div>
  )
}
