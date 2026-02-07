"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ContentCreatorDashboard from "@/components/ContentCreatorDashboard";

export default function ContentCreatorPage() {
  const searchParams = useSearchParams();
  const [conversationId, setConversationId] = useState("");

  useEffect(() => {
    const id = searchParams.get("conversation_id");
    if (id) {
      setConversationId(id);
    }
  }, [searchParams]);

  if (!conversationId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            No Conversation ID
          </h1>
          <p className="text-gray-600 mb-6">
            Please start a conversation and sync brands first.
          </p>
          <a
            href="/"
            className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Chat
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ContentCreatorDashboard conversationId={conversationId} />
    </div>
  );
}
