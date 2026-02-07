"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function SignupPage() {
  const router = useRouter();
  const { signup, isAuthenticated } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    router.replace("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(username.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#f7f7f4' }}>
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#deddd6] p-8">
        <h1 className="text-2xl font-semibold text-center text-[#26251e] mb-2">Sign up</h1>
        <p className="text-center text-[#5c5a52] text-sm mb-8">Brandpilot AI</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-[#26251e] mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-[#deddd6] rounded-lg focus:outline-none focus:border-[#26251e] focus:ring-1 focus:ring-[#26251e] transition-all text-[#26251e] placeholder:text-[#8a887e]"
              placeholder="Choose a username"
              required
              minLength={2}
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#26251e] mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-[#deddd6] rounded-lg focus:outline-none focus:border-[#26251e] focus:ring-1 focus:ring-[#26251e] transition-all text-[#26251e] placeholder:text-[#8a887e]"
              placeholder="Choose a password"
              required
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-100">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#26251e] text-white py-3 rounded-lg font-medium hover:bg-[#3d3c33] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>
        <p className="mt-8 text-center text-[#5c5a52] text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-[#26251e] font-medium hover:underline">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}
