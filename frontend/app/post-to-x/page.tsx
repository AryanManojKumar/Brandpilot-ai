"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";

interface ContentData {
  id: number;
  brand_id: number;
  brand_name: string;
  generated_image_url: string;
  industry: string;
  created_at: string;
}

export default function PostToXPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [content, setContent] = useState<ContentData | null>(null);
  const [caption, setCaption] = useState("");
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [posting, setPosting] = useState(false);

  const contentId = searchParams.get("content_id");
  const conversationId = searchParams.get("conversation_id");
  const isAuthenticated = status === "authenticated";

  useEffect(() => {
    if (contentId) {
      fetchContentDetails();
    }
  }, [contentId]);

  const fetchContentDetails = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/generated-content/conversation/${conversationId}`
      );
      const data = await response.json();
      const item = data.content.find((c: any) => c.id === parseInt(contentId!));
      if (item) {
        setContent(item);
      }
    } catch (error) {
      console.error("Error fetching content:", error);
    }
  };

  const handleGenerateCaption = async () => {
    if (!content) return;

    setGeneratingCaption(true);
    try {
      const formData = new FormData();
      formData.append("content_id", content.id.toString());
      formData.append("brand_id", content.brand_id.toString());

      const response = await fetch("http://localhost:8000/generate-caption", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setCaption(data.caption);
      }
    } catch (error) {
      console.error("Error generating caption:", error);
      alert("Failed to generate caption");
    } finally {
      setGeneratingCaption(false);
    }
  };

  const handleTwitterLogin = () => {
    signIn("twitter", { callbackUrl: window.location.href });
  };

  const handleTwitterLogout = () => {
    signOut({ callbackUrl: window.location.href });
  };

  const handlePostNow = async () => {
    if (!caption) {
      alert("Please generate a caption first");
      return;
    }

    if (!isAuthenticated) {
      alert("Please login to Twitter first");
      return;
    }

    setPosting(true);
    try {
      // TODO: Implement actual Twitter posting
      alert("Post functionality coming soon! For now, the caption is ready to copy.");
    } catch (error) {
      console.error("Error posting:", error);
      alert("Failed to post");
    } finally {
      setPosting(false);
    }
  };

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-6 text-blue-600 hover:text-blue-700 flex items-center"
        >
          ← Back to Social Media Manager
        </button>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold mb-6">Post to X (Twitter)</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Image Preview */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Your Marketing Image</h3>
              <img
                src={content.generated_image_url}
                alt="Marketing content"
                className="w-full rounded-lg shadow-md"
              />
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Brand:</strong> {content.brand_name}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Industry:</strong> {content.industry}
                </p>
              </div>
            </div>

            {/* Caption & Posting */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Create Your Post</h3>

              {/* Generate Caption */}
              <button
                onClick={handleGenerateCaption}
                disabled={generatingCaption}
                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors font-semibold mb-4"
              >
                {generatingCaption ? "Generating..." : "🤖 Generate AI Caption"}
              </button>

              {/* Caption Editor */}
              {caption && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Caption
                  </label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                    rows={6}
                    maxLength={280}
                    placeholder="Your caption will appear here..."
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-500">
                      {caption.length}/280 characters
                    </p>
                    <button
                      onClick={() => navigator.clipboard.writeText(caption)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Copy to clipboard
                    </button>
                  </div>
                </div>
              )}

              {/* Twitter Login */}
              {caption && (
                <div className="border-t pt-4 mt-4">
                  {!isAuthenticated ? (
                    <div>
                      <button
                        onClick={handleTwitterLogin}
                        className="w-full bg-blue-500 text-white py-3 px-6 rounded-lg hover:bg-blue-600 transition-colors font-semibold flex items-center justify-center gap-2"
                      >
                        <span>🐦</span> Login with X (Twitter)
                      </button>
                      {status === "loading" && (
                        <p className="text-sm text-gray-500 mt-2 text-center">
                          Checking authentication...
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-green-600">
                          <span>✓</span> Connected as {session?.user?.name || "Twitter User"}
                        </div>
                        <button
                          onClick={handleTwitterLogout}
                          className="text-sm text-gray-600 hover:text-gray-800"
                        >
                          Logout
                        </button>
                      </div>
                      <button
                        onClick={handlePostNow}
                        disabled={posting}
                        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-semibold"
                      >
                        {posting ? "Posting..." : "📤 Post Now"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Help Text */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>💡 Tip:</strong> Generate an AI caption, edit it to your liking, then login to X and post directly!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
