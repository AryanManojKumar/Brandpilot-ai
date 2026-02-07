"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import SocialMediaManagerDashboard from "@/components/SocialMediaManagerDashboard";
import { useAuth } from "@/contexts/AuthContext";

export default function SocialMediaManagerPage() {
  const router = useRouter();
  const { username, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login");
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading…</div>
      </div>
    );
  }
  if (!isAuthenticated || !username) return null;

  return (
    <div>
      <SocialMediaManagerDashboard username={username} />
    </div>
  );
}
