'use client'

import { Sparkles, Zap, Target, TrendingUp } from 'lucide-react'

interface WelcomeScreenProps {
  onGetStarted: () => void
}

export default function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-6xl w-full">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-block gradient-bg text-white px-6 py-2 rounded-full text-sm font-semibold mb-6">
            🚀 AI-Powered Marketing Automation
          </div>
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Welcome to BrandSync
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Transform your brand into engaging content automatically. We analyze your brand, create content, and manage your social media presence.
          </p>
          <button
            onClick={onGetStarted}
            className="gradient-bg text-white px-8 py-4 rounded-full text-lg font-semibold hover:shadow-2xl transition-all transform hover:scale-105"
          >
            Get Started - It's Free
          </button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <FeatureCard
            icon={<Sparkles className="w-8 h-8" />}
            title="Brand Intelligence"
            description="AI analyzes your website to understand your brand identity, colors, and voice"
          />
          <FeatureCard
            icon={<Zap className="w-8 h-8" />}
            title="Content Creation"
            description="Automatically generate videos, graphics, and captions aligned with your brand"
          />
          <FeatureCard
            icon={<Target className="w-8 h-8" />}
            title="Social Media"
            description="Schedule and post content across all platforms with smart timing"
          />
          <FeatureCard
            icon={<TrendingUp className="w-8 h-8" />}
            title="Analytics"
            description="Track performance and optimize your content strategy with AI insights"
          />
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-3xl shadow-xl p-12">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Step
              number="1"
              title="BrandSync"
              description="Share your website URL. Our AI extracts your brand identity, colors, target audience, and vibe."
            />
            <Step
              number="2"
              title="Create Content"
              description="Our Content Creator Agent generates brand-consistent videos, graphics, and captions."
            />
            <Step
              number="3"
              title="Auto-Post"
              description="Social Media Agent schedules and posts content across platforms. You approve or let it run."
            />
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <p className="text-gray-600 mb-4">Join hundreds of businesses automating their marketing</p>
          <button
            onClick={onGetStarted}
            className="gradient-bg text-white px-8 py-3 rounded-full font-semibold hover:shadow-xl transition-all"
          >
            Start Your BrandSync Now →
          </button>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-1">
      <div className="gradient-bg text-white w-16 h-16 rounded-xl flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  )
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="gradient-bg text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  )
}
