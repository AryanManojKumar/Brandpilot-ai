"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface XUserInsights {
  data?: {
    id?: string;
    username?: string;
    name?: string;
    bio?: string | null;
    location?: string | null;
    website?: string | null;
    avatar?: string;
    banner?: string;
    verified?: boolean;
    isBlueVerified?: boolean;
    // API returns camelCase
    followerCount?: number;
    followingCount?: number;
    tweetCount?: number;
    listedCount?: number;
    mediaCount?: number;
    favoritesCount?: number;
    createdAt?: string;
    pinnedTweetIds?: string[];
    professional?: { type?: string; category?: string[] };
    businessAccount?: { affiliatesCount?: number };
    creatorSubscriptionsCount?: number;
    highlightsInfo?: { canHighlight?: boolean; highlightedTweetsCount?: string };
    affiliatesHighlightedLabel?: { label?: { description?: string } };
    // snake_case fallbacks
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
    listed_count?: number;
    media_count?: number;
    favorites_count?: number;
    created_at?: string;
  };
}

interface XUserTweet {
  id?: string;
  text?: string;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  quoteCount?: number;
  createdAt?: string;
  like_count?: number;
  retweet_count?: number;
  reply_count?: number;
  quote_count?: number;
  created_at?: string;
}

interface GeneratedContent {
  id: number;
  brand_id: number;
  brand_name: string;
  logo_url: string;
  industry: string;
  domain: string;
  product_image_url: string;
  generated_image_url: string;
  prompt_used: string;
  created_at: string;
  status: string;
  content_type: string; // 'ugc_image' or 'ugc_video'
}

interface SocialMediaManagerDashboardProps {
  username: string;
}

export default function SocialMediaManagerDashboard({
  username,
}: SocialMediaManagerDashboardProps) {
  const { authHeader } = useAuth();
  const [content, setContent] = useState<GeneratedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [xConnected, setXConnected] = useState<boolean | null>(null);
  const [xConnecting, setXConnecting] = useState(false);
  const [xUsername, setXUsername] = useState<string | null>(null);
  const [xInsights, setXInsights] = useState<XUserInsights | null>(null);
  const [xInsightsLoading, setXInsightsLoading] = useState(false);
  const [xTweets, setXTweets] = useState<XUserTweet[]>([]);
  const [xTweetsLoading, setXTweetsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchGeneratedContent();
  }, [username]);

  useEffect(() => {
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
  }, [username]);

  useEffect(() => {
    if (xConnected && xUsername) {
      setXInsightsLoading(true);
      setXInsights(null);
      setXTweets([]);
      fetch(
        `${API_BASE}/twitter/user-insights?username=${encodeURIComponent(xUsername)}`
      )
        .then((res) => res.json())
        .then((data) => {
          setXInsights(data);
        })
        .catch((err) => {
          console.error("Failed to fetch X insights:", err);
        })
        .finally(() => {
          setXInsightsLoading(false);
        });
    } else {
      setXInsights(null);
      setXTweets([]);
    }
  }, [xConnected, xUsername]);

  useEffect(() => {
    const userId = xInsights?.data?.id;
    if (!userId) {
      setXTweets([]);
      return;
    }
    setXTweetsLoading(true);
    fetch(
      `${API_BASE}/twitter/user-tweets?user_id=${encodeURIComponent(userId)}`
    )
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data?.data) ? data.data : [];
        setXTweets(list);
      })
      .catch((err) => {
        console.error("Failed to fetch X tweets:", err);
        setXTweets([]);
      })
      .finally(() => {
        setXTweetsLoading(false);
      });
  }, [xInsights?.data?.id]);

  const fetchGeneratedContent = async () => {
    try {
      const response = await fetch(`${API_BASE}/generated-content/me`, {
        headers: authHeader(),
      });
      const data = await response.json();
      setContent(data.content || []);
    } catch (error) {
      console.error("Error fetching generated content:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectX = async () => {
    setXConnecting(true);
    setXConnected(null);
    try {
      const response = await fetch(`${API_BASE}/twitter/connect`, {
        headers: authHeader(),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setXConnected(true);
        setXUsername(data.username || data.name || null);
      } else {
        setXConnected(false);
        console.error("X connect failed:", data.error || data.detail || response.statusText);
      }
    } catch (err) {
      setXConnected(false);
      console.error("X connect error:", err);
    } finally {
      setXConnecting(false);
    }
  };

  const handlePostToX = (contentItem: GeneratedContent) => {
    router.push(`/post-to-x?content_id=${contentItem.id}`);
  };

  // Group content by brand
  const contentByBrand = content.reduce((acc, item) => {
    const brandName = item.brand_name;
    if (!acc[brandName]) {
      acc[brandName] = {
        brand_id: item.brand_id,
        brand_name: item.brand_name,
        logo_url: item.logo_url,
        industry: item.industry,
        domain: item.domain,
        items: [],
      };
    }
    acc[brandName].items.push(item);
    return acc;
  }, {} as Record<string, any>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading content...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#f7f7f4' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="p-2 bg-white border border-[#deddd6] hover:border-[#26251e] rounded-lg transition-colors"
              title="Go to Home"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#26251e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-semibold text-[#26251e] mb-1">
                Social Media Manager
              </h1>
              <p className="text-[#5c5a52]">
                Manage and schedule your generated marketing content
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {xConnected === true ? (
              <span className="inline-flex items-center gap-2 bg-[#efefe9] text-[#26251e] px-4 py-2 rounded-lg font-medium border border-[#deddd6]">
                <span>✓</span> Connected to X @{xUsername || "X"}
              </span>
            ) : (
              <button
                onClick={handleConnectX}
                disabled={xConnecting}
                className="inline-flex items-center gap-2 bg-[#26251e] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#3d3c33] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {xConnecting ? (
                  "Connecting..."
                ) : (
                  <>
                    <span aria-hidden>𝕏</span> Connect X
                  </>
                )}
              </button>
            )}
            {xConnected === false && !xConnecting && (
              <span className="text-sm text-red-600">Connection failed. Check backend logs.</span>
            )}
          </div>
        </div>

        {/* X Analytics - shown when connected and insights loaded */}
        {xConnected && xUsername && (
          <section className="mb-10">
            {xInsightsLoading ? (
              <div className="bg-white rounded-xl border border-[#deddd6] p-8 flex items-center justify-center min-h-[200px]">
                <div className="text-center">
                  <div className="inline-block w-8 h-8 border-2 border-[#26251e] border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-[#5c5a52] font-medium">Loading your X analytics...</p>
                </div>
              </div>
            ) : xInsights?.data ? (
              <XAnalyticsSection insights={xInsights} recentTweets={xTweets.slice(0, 2)} tweetsLoading={xTweetsLoading} />
            ) : xInsights && !xInsights.data ? (
              <div className="bg-[#fef8e8] border border-[#e5d9a8] rounded-xl p-4 text-[#8a7a3a] text-sm">
                Could not load analytics for @{xUsername}. Check TWEETAPI key in .env.
              </div>
            ) : null}
          </section>
        )}

        {Object.keys(contentByBrand).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#5c5a52] text-base">
              No content generated yet. Create some marketing images first!
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.values(contentByBrand).map((brandGroup: any) => (
              <div key={brandGroup.brand_id} className="bg-white rounded-xl border border-[#deddd6] p-6">
                {/* Brand Header */}
                <div className="flex items-center mb-6 pb-4 border-b border-[#deddd6]">
                  {brandGroup.logo_url && (
                    <img
                      src={brandGroup.logo_url}
                      alt={brandGroup.brand_name}
                      className="w-10 h-10 object-contain mr-4 bg-[#f7f7f4] rounded-lg p-1 border border-[#deddd6]"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <div>
                    <h2 className="text-xl font-semibold text-[#26251e]">
                      {brandGroup.brand_name}
                    </h2>
                    <p className="text-sm text-[#5c5a52]">{brandGroup.industry}</p>
                  </div>
                  <div className="ml-auto">
                    <span className="bg-[#efefe9] text-[#26251e] px-3 py-1 rounded-full text-sm font-medium border border-[#deddd6]">
                      {brandGroup.items.length} {brandGroup.items.length === 1 ? 'Asset' : 'Assets'}
                    </span>
                  </div>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {brandGroup.items.map((item: GeneratedContent) => (
                    item.content_type === 'ugc_video' ? (
                      <VideoCard
                        key={item.id}
                        item={item}
                        onPostToX={() => handlePostToX(item)}
                      />
                    ) : (
                      <div
                        key={item.id}
                        className="relative group rounded-xl overflow-hidden border border-[#deddd6] hover:border-[#26251e] transition-all"
                      >
                        <img
                          src={item.generated_image_url}
                          alt="Generated content"
                          className="w-full h-80 object-cover"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center">
                          <button
                            onClick={() => handlePostToX(item)}
                            className="opacity-0 group-hover:opacity-100 bg-white text-[#26251e] px-5 py-2.5 rounded-lg font-medium transition-opacity hover:bg-[#f7f7f4] flex items-center gap-2 border border-[#deddd6]"
                          >
                            <span>🐦</span> Post to X
                          </button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function XAnalyticsSection({
  insights,
  recentTweets = [],
  tweetsLoading = false,
}: {
  insights: XUserInsights;
  recentTweets?: XUserTweet[];
  tweetsLoading?: boolean;
}) {
  const d = insights.data;
  if (!d) return null;

  const followers = d.followerCount ?? d.followers_count ?? 0;
  const following = d.followingCount ?? d.following_count ?? 0;
  const tweets = d.tweetCount ?? d.tweet_count ?? 0;
  const listed = d.listedCount ?? d.listed_count ?? 0;
  const media = d.mediaCount ?? d.media_count ?? 0;
  const favorites = d.favoritesCount ?? d.favorites_count ?? 0;
  const createdAt = d.createdAt ?? d.created_at;
  const proType = d.professional?.type;
  const highlightedCount = d.highlightsInfo?.highlightedTweetsCount;

  const maxVal = Math.max(followers, following, tweets, 1);

  const formatNum = (n: number) =>
    n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(n);

  const formatDate = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    } catch {
      return null;
    }
  };

  const stat = (value: number, label: string) => (
    <div className="min-w-0">
      <p className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-medium">{label}</p>
      <p className="text-base sm:text-lg font-semibold text-gray-900 tabular-nums">{formatNum(value)}</p>
    </div>
  );

  const chip = (label: string, value: string) => (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-gray-700">{value}</span>
    </span>
  );

  return (
    <div className="bg-white/80 backdrop-blur rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 space-y-4">
        {/* Profile row */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3 min-w-0">
            {d.avatar ? (
              <img
                src={d.avatar}
                alt=""
                className="w-11 h-11 rounded-full bg-gray-100 object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-gray-200 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {d.name || d.username || "—"}
                {(d.verified || d.isBlueVerified) && (
                  <span className="text-blue-500 ml-1" title="Verified">✓</span>
                )}
              </p>
              <p className="text-sm text-gray-500 truncate">@{d.username || "—"}</p>
              {d.bio && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 max-w-[200px] sm:max-w-xs">{d.bio}</p>
              )}
            </div>
          </div>
          <div className="hidden sm:block w-px h-10 bg-gray-200 flex-shrink-0" />
          <div className="flex flex-wrap gap-6 sm:gap-8 flex-1 min-w-0">
            {stat(followers, "Followers")}
            {stat(following, "Following")}
            {stat(tweets, "Tweets")}
          </div>
        </div>

        {/* Secondary metrics + meta */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2 border-t border-gray-100">
          {listed > 0 && chip("Listed", formatNum(listed))}
          {media > 0 && chip("Media", formatNum(media))}
          {favorites > 0 && chip("Likes given", formatNum(favorites))}
          {createdAt && chip("Member since", formatDate(createdAt) ?? createdAt)}
          {proType && (
            <span className="inline-flex items-center text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2.5 py-1">
              {proType}
            </span>
          )}
          {highlightedCount != null && highlightedCount !== "0" && (
            chip("Highlights", String(highlightedCount))
          )}
        </div>

        {/* Recent tweets — last 2 */}
        {(tweetsLoading || recentTweets.length > 0) && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">
              Recent tweets
            </p>
            {tweetsLoading ? (
              <div className="flex gap-2">
                <div className="flex-1 h-16 rounded-lg bg-gray-100 animate-pulse" />
                <div className="flex-1 h-16 rounded-lg bg-gray-100 animate-pulse" />
              </div>
            ) : (
              <div className="space-y-2">
                {recentTweets.map((t) => {
                  const text = t.text ?? "";
                  const likes = t.likeCount ?? t.like_count ?? 0;
                  const retweets = t.retweetCount ?? t.retweet_count ?? 0;
                  const replies = t.replyCount ?? t.reply_count ?? 0;
                  const hasEngagement = likes > 0 || retweets > 0 || replies > 0;
                  return (
                    <div
                      key={t.id ?? text.slice(0, 20)}
                      className="text-sm rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5"
                    >
                      <p className="text-gray-800 line-clamp-2">{text || "—"}</p>
                      {hasEngagement && (
                        <p className="mt-1.5 text-xs text-gray-400 flex flex-wrap gap-3">
                          {likes > 0 && <span>♥ {likes >= 1e3 ? (likes / 1e3).toFixed(1) + "K" : likes}</span>}
                          {retweets > 0 && <span>↻ {retweets >= 1e3 ? (retweets / 1e3).toFixed(1) + "K" : retweets}</span>}
                          {replies > 0 && <span>↩ {replies >= 1e3 ? (replies / 1e3).toFixed(1) + "K" : replies}</span>}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// VideoCard component with Intersection Observer for auto play/pause
function VideoCard({
  item,
  onPostToX,
}: {
  item: GeneratedContent;
  onPostToX: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Intersection Observer for auto play/pause when scrolling
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // Video is at least 50% visible - auto play
            video.play().catch(() => { });
            setIsPlaying(true);
          } else {
            // Video is less than 50% visible - pause
            video.pause();
            setIsPlaying(false);
          }
        });
      },
      {
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: "0px",
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

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

    video.addEventListener("timeupdate", updateProgress);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      video.removeEventListener("timeupdate", updateProgress);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, []);

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => { });
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    video.currentTime = percentage * video.duration;
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className="relative group rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow bg-black"
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={item.generated_image_url}
        className="w-full h-80 object-cover"
        muted
        loop
        playsInline
        poster=""
      />

      {/* Video Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        {/* Progress Bar */}
        <div
          className="w-full h-1.5 bg-white/30 rounded-full cursor-pointer mb-2 group/progress"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-purple-500 rounded-full relative transition-all"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlayPause}
              className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            >
              {isPlaying ? (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Time Display */}
            <span className="text-white/90 text-xs font-medium tabular-nums">
              {formatTime((progress / 100) * duration)} / {formatTime(duration)}
            </span>
          </div>

          {/* Video Badge */}
          <div className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Video
          </div>
        </div>
      </div>

      {/* Center Play Button (when paused) */}
      {!isPlaying && (
        <button
          onClick={togglePlayPause}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-full transition-colors"
        >
          <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      {/* Hover Overlay for Post Button */}
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center pointer-events-none">
        <button
          onClick={onPostToX}
          className="opacity-0 group-hover:opacity-100 bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold transition-opacity hover:bg-blue-600 flex items-center gap-2 pointer-events-auto"
        >
          <span>🐦</span> Post to X
        </button>
      </div>
    </div>
  );
}
