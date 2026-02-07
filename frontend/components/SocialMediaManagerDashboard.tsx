"use client";

import { useState, useEffect } from "react";
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Social Media Manager
            </h1>
            <p className="text-gray-600">
              Manage and schedule your generated marketing content
            </p>
          </div>
          <div className="flex items-center gap-3">
            {xConnected === true ? (
              <span className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-lg font-medium">
                <span>✓</span> Connected to X @{xUsername || "X"}
              </span>
            ) : (
              <button
                onClick={handleConnectX}
                disabled={xConnecting}
                className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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
              <div className="bg-white rounded-2xl shadow-lg p-8 flex items-center justify-center min-h-[280px]">
                <div className="text-center">
                  <div className="inline-block w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-gray-600 font-medium">Loading your X analytics...</p>
                </div>
              </div>
            ) : xInsights?.data ? (
              <XAnalyticsSection insights={xInsights} recentTweets={xTweets.slice(0, 2)} tweetsLoading={xTweetsLoading} />
            ) : xInsights && !xInsights.data ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm">
                Could not load analytics for @{xUsername}. Check TWEETAPI key in .env.
              </div>
            ) : null}
          </section>
        )}

        {Object.keys(contentByBrand).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              No content generated yet. Create some marketing images first!
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.values(contentByBrand).map((brandGroup: any) => (
              <div key={brandGroup.brand_id} className="bg-white rounded-lg shadow-md p-6">
                {/* Brand Header */}
                <div className="flex items-center mb-6 pb-4 border-b">
                  {brandGroup.logo_url && (
                    <img
                      src={brandGroup.logo_url}
                      alt={brandGroup.brand_name}
                      className="w-12 h-12 object-contain mr-4 bg-gray-50 rounded-lg p-2"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {brandGroup.brand_name}
                    </h2>
                    <p className="text-sm text-gray-500">{brandGroup.industry}</p>
                  </div>
                  <div className="ml-auto">
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                      {brandGroup.items.length} {brandGroup.items.length === 1 ? 'Asset' : 'Assets'}
                    </span>
                  </div>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {brandGroup.items.map((item: GeneratedContent) => (
                    <div
                      key={item.id}
                      className="relative group rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow"
                    >
                      <img
                        src={item.generated_image_url}
                        alt="Generated content"
                        className="w-full h-64 object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all flex items-center justify-center">
                        <button
                          onClick={() => handlePostToX(item)}
                          className="opacity-0 group-hover:opacity-100 bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold transition-opacity hover:bg-blue-600 flex items-center gap-2"
                        >
                          <span>🐦</span> Post to X
                        </button>
                      </div>
                      <div className="absolute top-2 right-2">
                        {/* <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold">
                          {item.status}
                        </span> */}
                      </div>
                    </div>
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
