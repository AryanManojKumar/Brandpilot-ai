"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth();
  const [content, setContent] = useState<ContentData | null>(null);
  const [caption, setCaption] = useState("");
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [posting, setPosting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [xConnected, setXConnected] = useState<boolean | null>(null);
  const [xUsername, setXUsername] = useState<string | null>(null);
  const [xConnecting, setXConnecting] = useState(false);
  const [typingDisplay, setTypingDisplay] = useState("");
  const captionFetchedRef = useRef(false);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const TYPING_PHRASE = "Writing your caption... ";

  const contentId = searchParams.get("content_id");
  const isConnectedToX = xConnected === true;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (contentId && isAuthenticated) {
      captionFetchedRef.current = false;
      fetchContentDetails();
    }
  }, [contentId, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch(`${API_BASE}/twitter/connection`, { headers: authHeader() })
      .then((res) => res.json())
      .then((data) => {
        if (data.connected && data.username) {
          setXConnected(true);
          setXUsername(data.username);
        } else {
          setXConnected(false);
        }
      })
      .catch(() => setXConnected(false));
  }, [isAuthenticated]);

  const fetchContentDetails = async () => {
    if (!contentId) return;
    try {
      const response = await fetch(`${API_BASE}/generated-content/me`, {
        headers: authHeader(),
      });
      const data = await response.json();
      const item = data.content?.find((c: any) => c.id === parseInt(contentId, 10));
      if (item) {
        setContent(item);
      }
    } catch (error) {
      console.error("Error fetching content:", error);
    }
  };

  useEffect(() => {
    if (!generatingCaption) {
      setTypingDisplay("");
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      return;
    }
    setTypingDisplay("");
    let index = 0;
    typingIntervalRef.current = setInterval(() => {
      index = index >= TYPING_PHRASE.length ? 0 : index;
      index += 1;
      setTypingDisplay(TYPING_PHRASE.slice(0, index));
    }, 80);
    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    };
  }, [generatingCaption]);

  const handleGenerateCaption = async () => {
    if (!content) return;
    setGeneratingCaption(true);
    try {
      const formData = new FormData();
      formData.append("content_id", content.id.toString());
      formData.append("brand_id", content.brand_id.toString());
      const response = await fetch(`${API_BASE}/generate-caption`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        setCaption(data.caption);
      }
    } catch (error) {
      console.error("Error generating caption:", error);
      toast.error("Failed to generate caption");
    } finally {
      setGeneratingCaption(false);
    }
  };

  useEffect(() => {
    if (!content || !isConnectedToX || captionFetchedRef.current) return;
    captionFetchedRef.current = true;
    (async () => {
      setGeneratingCaption(true);
      try {
        const formData = new FormData();
        formData.append("content_id", content.id.toString());
        formData.append("brand_id", content.brand_id.toString());
        const response = await fetch(`${API_BASE}/generate-caption`, {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (data.success) setCaption(data.caption);
      } catch {
        // ignore
      } finally {
        setGeneratingCaption(false);
      }
    })();
  }, [content?.id, isConnectedToX]);

  const handleConnectX = async () => {
    setXConnecting(true);
    try {
      const response = await fetch(`${API_BASE}/twitter/connect`, {
        headers: authHeader(),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setXConnected(true);
        setXUsername(data.username || data.name || null);
      }
    } catch {
      setXConnected(false);
    } finally {
      setXConnecting(false);
    }
  };

  const handlePostNow = async () => {
    if (!content || !caption.trim()) {
      toast.warning("Please add a caption first.");
      return;
    }
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append("content_id", content.id.toString());
      formData.append("caption", caption.trim());
      const response = await fetch(`${API_BASE}/post-now`, {
        method: "POST",
        headers: authHeader(),
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        toast.success("Posted to X!", { description: data.post_url && "View your tweet", action: data.post_url ? { label: "Open", onClick: () => window.open(data.post_url) } : undefined });
        router.push("/social-media-manager");
      } else {
        toast.error("Failed to post", { description: typeof data.detail === "string" ? data.detail : undefined });
      }
    } catch (error) {
      console.error("Error posting:", error);
      toast.error("Failed to post");
    } finally {
      setPosting(false);
    }
  };

  const handleScheduleTweet = async () => {
    if (!content || !caption.trim()) {
      toast.warning("Please add a caption first.");
      return;
    }
    if (!scheduleDate || !scheduleTime) {
      toast.warning("Please set the date and time for your post.");
      return;
    }
    const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledDateTime <= new Date()) {
      toast.warning("Please choose a future date and time.");
      return;
    }
    setScheduling(true);
    try {
      const formData = new FormData();
      formData.append("content_id", content.id.toString());
      formData.append("caption", caption.trim());
      formData.append("scheduled_time", scheduledDateTime.toISOString());
      formData.append("platform", "twitter");
      const response = await fetch(`${API_BASE}/schedule-post`, {
        method: "POST",
        headers: authHeader(),
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Post scheduled!", { description: "It will go live at the chosen time." });
        router.push("/social-media-manager");
      } else {
        toast.error("Failed to schedule post", { description: typeof data.detail === "string" ? data.detail : undefined });
      }
    } catch (error) {
      console.error("Error scheduling post:", error);
      toast.error("Failed to schedule post");
    } finally {
      setScheduling(false);
    }
  };

  if (authLoading || !contentId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">
          {authLoading ? "Loading…" : !contentId ? "Missing content_id" : "Loading..."}
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:text-blue-700 flex items-center"
            >
              ← Back to Social Media Manager
            </button>
            {isConnectedToX && xUsername && (
              <span className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1.5 rounded-lg text-sm font-medium">
                <span>✓</span> Connected as @{xUsername}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold mb-6">Post to X (Twitter)</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Image Preview - same for both flows */}
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

            {/* Right: Connected = Scheduler; Not connected = Caption + Login */}
            <div>
              <h3 className="text-lg font-semibold mb-4">
                {isConnectedToX ? "Schedule your tweet" : "Create Your Post"}
              </h3>

              {!isConnectedToX && (
                <button
                  onClick={handleGenerateCaption}
                  disabled={generatingCaption}
                  className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors font-semibold mb-4"
                >
                  {generatingCaption ? "Generating..." : "🤖 Generate AI Caption"}
                </button>
              )}

              {(caption || isConnectedToX || generatingCaption) && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Caption
                  </label>
                  {generatingCaption ? (
                    <div
                      className="w-full min-h-[120px] p-4 border-2 border-purple-200 rounded-lg bg-purple-50/50 resize-none font-sans text-gray-700 flex items-start"
                      aria-busy="true"
                      aria-label="AI is writing your caption"
                    >
                      <span className="whitespace-pre-wrap break-words">
                        {typingDisplay}
                        <span
                          className="inline-block w-0.5 h-4 bg-purple-500 align-middle animate-cursor-blink"
                          aria-hidden
                        />
                      </span>
                    </div>
                  ) : (
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value.slice(0, 280))}
                      disabled={!isConnectedToX}
                      className={`w-full p-4 border-2 rounded-lg resize-none font-sans text-gray-700 ${
                        isConnectedToX
                          ? "border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          : "border-gray-300 bg-gray-100 cursor-not-allowed opacity-90"
                      }`}
                      rows={6}
                      maxLength={280}
                      placeholder="Your caption will appear here..."
                    />
                  )}
                  {!generatingCaption && (
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
                  )}
                </div>
              )}

              {isConnectedToX ? (
                <div className="border-t pt-4 mt-4 space-y-4">
                  <button
                    onClick={handlePostNow}
                    disabled={posting || scheduling || !caption.trim()}
                    className="w-full bg-black text-white py-3 px-6 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    {posting ? "Posting..." : "Post now to X"}
                  </button>
                  <p className="text-sm text-gray-600 text-center">— or schedule for later —</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        min={minDate}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleScheduleTweet}
                    disabled={scheduling || posting || !caption.trim() || !scheduleDate || !scheduleTime}
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    {scheduling ? "Scheduling..." : "Schedule tweet"}
                  </button>
                </div>
              ) : (
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Connect your X account to schedule or post this content.
                  </p>
                  <button
                    onClick={handleConnectX}
                    disabled={xConnecting}
                    className="w-full bg-black text-white py-3 px-6 rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors font-semibold flex items-center justify-center gap-2"
                  >
                    {xConnecting ? "Connecting..." : <><span aria-hidden>𝕏</span> Connect X to continue</>}
                  </button>
                </div>
              )}

              {!isConnectedToX && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>💡 Tip:</strong> Generate an AI caption, edit it, then connect X to schedule or post.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
