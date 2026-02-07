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
  content_type: string; // 'ugc_image' or 'ugc_video'
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
    <div className="min-h-screen p-8" style={{ backgroundColor: '#f7f7f4' }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => router.push("/")}
              className="p-2 bg-white border border-[#deddd6] hover:border-[#26251e] rounded-lg transition-colors"
              title="Go to Home"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#26251e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
            <button
              onClick={() => router.back()}
              className="text-[#26251e] hover:underline flex items-center text-sm font-medium"
            >
              ← Back to Social Media Manager
            </button>
            {isConnectedToX && xUsername && (
              <span className="inline-flex items-center gap-2 bg-[#efefe9] text-[#26251e] px-3 py-1.5 rounded-lg text-sm font-medium border border-[#deddd6]">
                <span>✓</span> Connected as @{xUsername}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#deddd6] p-8">
          <h1 className="text-2xl font-semibold text-[#26251e] mb-6">Post to X (Twitter)</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Content Preview */}
            <div>
              <h3 className="text-base font-medium text-[#26251e] mb-4">
                Your Marketing {content.content_type === 'ugc_video' ? 'Video' : 'Image'}
              </h3>

              {content.content_type === 'ugc_video' ? (
                <VideoPlayer src={content.generated_image_url} />
              ) : (
                <img
                  src={content.generated_image_url}
                  alt="Marketing content"
                  className="w-full rounded-xl border border-[#deddd6]"
                />
              )}

              <div className="mt-4 p-4 bg-[#f7f7f4] rounded-lg border border-[#deddd6]">
                <p className="text-sm text-[#5c5a52]">
                  <strong className="text-[#26251e]">Brand:</strong> {content.brand_name}
                </p>
                <p className="text-sm text-[#5c5a52]">
                  <strong className="text-[#26251e]">Industry:</strong> {content.industry}
                </p>
              </div>
            </div>

            {/* Right: Connected = Scheduler; Not connected = Caption + Login */}
            <div>
              <h3 className="text-base font-medium text-[#26251e] mb-4">
                {isConnectedToX ? "Schedule your tweet" : "Create Your Post"}
              </h3>

              {!isConnectedToX && (
                <button
                  onClick={handleGenerateCaption}
                  disabled={generatingCaption}
                  className="w-full bg-[#26251e] text-white py-3 px-6 rounded-lg hover:bg-[#3d3c33] disabled:bg-[#cccbc2] transition-colors font-medium mb-4"
                >
                  {generatingCaption ? "Generating..." : "🤖 Generate AI Caption"}
                </button>
              )}

              {(caption || isConnectedToX || generatingCaption) && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[#26251e] mb-2">
                    Caption
                  </label>
                  {generatingCaption ? (
                    <div
                      className="w-full min-h-[120px] p-4 border border-[#deddd6] rounded-lg bg-[#f7f7f4] resize-none font-sans text-[#26251e] flex items-start"
                      aria-busy="true"
                      aria-label="AI is writing your caption"
                    >
                      <span className="whitespace-pre-wrap break-words">
                        {typingDisplay}
                        <span
                          className="inline-block w-0.5 h-4 bg-[#26251e] align-middle animate-cursor-blink"
                          aria-hidden
                        />
                      </span>
                    </div>
                  ) : (
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value.slice(0, 280))}
                      disabled={!isConnectedToX}
                      className={`w-full p-4 border rounded-lg resize-none font-sans text-[#26251e] ${isConnectedToX
                        ? "border-[#deddd6] bg-white focus:ring-1 focus:ring-[#26251e] focus:border-[#26251e]"
                        : "border-[#deddd6] bg-[#f7f7f4] cursor-not-allowed opacity-90"
                        }`}
                      rows={6}
                      maxLength={280}
                      placeholder="Your caption will appear here..."
                    />
                  )}
                  {!generatingCaption && (
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-xs text-[#8a887e]">
                        {caption.length}/280 characters
                      </p>
                      <button
                        onClick={() => navigator.clipboard.writeText(caption)}
                        className="text-xs text-[#26251e] hover:underline"
                      >
                        Copy to clipboard
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isConnectedToX ? (
                <div className="border-t border-[#deddd6] pt-4 mt-4 space-y-4">
                  <button
                    onClick={handlePostNow}
                    disabled={posting || scheduling || !caption.trim()}
                    className="w-full bg-[#26251e] text-white py-3 px-6 rounded-lg hover:bg-[#3d3c33] disabled:bg-[#cccbc2] disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    {posting ? "Posting..." : "Post now to X"}
                  </button>
                  <p className="text-sm text-[#5c5a52] text-center">— or schedule for later —</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#26251e] mb-1">Date</label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        min={minDate}
                        className="w-full p-3 border border-[#deddd6] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#26251e] focus:border-[#26251e]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#26251e] mb-1">Time</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full p-3 border border-[#deddd6] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#26251e] focus:border-[#26251e]"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleScheduleTweet}
                    disabled={scheduling || posting || !caption.trim() || !scheduleDate || !scheduleTime}
                    className="w-full bg-white border border-[#26251e] text-[#26251e] py-3 px-6 rounded-lg hover:bg-[#26251e] hover:text-white disabled:bg-[#efefe9] disabled:border-[#cccbc2] disabled:text-[#8a887e] disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    {scheduling ? "Scheduling..." : "Schedule tweet"}
                  </button>
                </div>
              ) : (
                <div className="border-t border-[#deddd6] pt-4 mt-4">
                  <p className="text-sm text-[#5c5a52] mb-4">
                    Connect your X account to schedule or post this content.
                  </p>
                  <button
                    onClick={handleConnectX}
                    disabled={xConnecting}
                    className="w-full bg-[#26251e] text-white py-3 px-6 rounded-lg hover:bg-[#3d3c33] disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    {xConnecting ? "Connecting..." : <><span aria-hidden>𝕏</span> Connect X to continue</>}
                  </button>
                </div>
              )}

              {!isConnectedToX && (
                <div className="mt-6 p-4 bg-[#f7f7f4] rounded-lg border border-[#deddd6]">
                  <p className="text-sm text-[#5c5a52]">
                    <strong className="text-[#26251e]">💡 Tip:</strong> Generate an AI caption, edit it, then connect X to schedule or post.
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

// VideoPlayer component with controls
function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Update progress bar
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", updateProgress);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("timeupdate", updateProgress);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, []);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => { });
    } else {
      video.pause();
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    video.currentTime = percentage * video.duration;
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative rounded-lg overflow-hidden shadow-md bg-black">
      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        className="w-full"
        style={{ aspectRatio: '9/16', maxHeight: '500px', objectFit: 'cover' }}
        muted
        loop
        playsInline
        onClick={togglePlayPause}
      />

      {/* Center Play Button (when paused) */}
      {!isPlaying && (
        <button
          onClick={togglePlayPause}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-full transition-colors"
        >
          <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      {/* Video Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
        {/* Progress Bar */}
        <div
          className="w-full h-1.5 bg-white/30 rounded-full cursor-pointer mb-3 group"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-white rounded-full relative transition-all"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlayPause}
              className="w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            >
              {isPlaying ? (
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Time Display */}
            <span className="text-white text-sm font-medium tabular-nums">
              {formatTime((progress / 100) * duration)} / {formatTime(duration)}
            </span>
          </div>

          {/* Video Badge */}
          <div className="bg-white text-[#26251e] px-3 py-1 rounded text-sm font-medium flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Video
          </div>
        </div>
      </div>
    </div>
  );
}
