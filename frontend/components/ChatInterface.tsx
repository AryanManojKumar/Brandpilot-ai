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
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-6xl flex gap-6">
        {/* Chat Box */}
        <div className="flex-1 h-[85vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="gradient-bg text-white p-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">GOJO</h2>
              <p className="text-sm opacity-90 mt-1">IIT Gandhinagar Social Media Agent</p>
              {username && (
                <p className="text-xs opacity-75 mt-2">Logged in as {username}</p>
              )}
            </div>
            <button
              onClick={() => { logout(); router.replace('/login'); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-sm"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message, index) => (
            <MessageBubble key={index} message={message} />
          ))}
          {loading && (
            <div className="flex items-start gap-3">
              <div className="bg-gray-100 rounded-2xl p-4">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

          {/* Input */}
          <div className="p-6 border-t">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Enter your website URL (e.g., nike.com)..."
                className="flex-1 px-6 py-3 border-2 border-gray-200 rounded-full focus:outline-none focus:border-purple-500 transition-colors"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="gradient-bg text-white px-6 py-3 rounded-full hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Agents Sidebar */}
        <div className="w-80 space-y-4">
          {/* <AgentCard
            icon={<Sparkles className="w-6 h-6" />}
            title="GOJO"
            description="Analyzes your brand identity, colors, and target audience"
            status="Active"
            color="purple"
          /> */}
          <AgentCard
            icon={<Video className="w-6 h-6" />}
            title="Content Creation Dashboard"
            description="Generate UGC marketing images for your synced brands"
            status="Ready"
            color="blue"
            onClick={openContentDashboard}
            clickable={true}
          />
          <AgentCard
            icon={<Video className="w-6 h-6" />}
            title="Social Media Manager"
            description="View and schedule your generated marketing content"
            status="Ready"
            color="green"
            onClick={openSocialMediaManager}
            clickable={true}
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
  status,
  color,
  onClick,
  clickable = false,
}: {
  icon: React.ReactNode
  title: string
  description: string
  status: string
  color: string
  onClick?: () => void
  clickable?: boolean
}) {
  const colorClasses = {
    purple: 'from-purple-500 to-purple-700',
    blue: 'from-blue-500 to-blue-700',
    green: 'from-green-500 to-green-700',
  }

  const statusColors = {
    Active: 'bg-green-100 text-green-700',
    Ready: 'bg-blue-100 text-blue-700',
  }

  return (
    <div 
      className={`bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all ${clickable ? 'cursor-pointer hover:scale-105' : ''}`}
      onClick={clickable ? onClick : undefined}
    >
      <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} text-white w-14 h-14 rounded-xl flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-lg font-bold">{title}</h4>
          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColors[status as keyof typeof statusColors]}`}>
            {status}
          </span>
        </div>
        <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
      </div>
      {clickable && (
        <button className="w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold">
          Open Dashboard →
        </button>
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <div className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl p-4 ${
          message.isUser
            ? 'gradient-bg text-white'
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
      </div>
    </div>
  )
}
