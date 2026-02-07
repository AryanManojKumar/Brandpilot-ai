"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ContentCreatorDashboard from "@/components/ContentCreatorDashboard";
import { useAuth } from "@/contexts/AuthContext";

export default function ContentCreatorPage() {
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
      <ContentCreatorDashboard username={username} />
    </div>
  );
}
