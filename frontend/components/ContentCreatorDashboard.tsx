"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Brand {
  id: number;
  brand_name: string;
  logo_url: string;
  industry: string;
  domain: string;
  company_vibe: string;
  target_audience: string;
  product_service: string;
  colors: Array<{ name: string; hex: string }>;
  social_links: Array<{ platform: string; url: string }>;
}

interface ContentCreatorDashboardProps {
  username: string;
}

export default function ContentCreatorDashboard({
  username,
}: ContentCreatorDashboardProps) {
  const router = useRouter();
  const { authHeader } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBrands();
  }, [username]);

  const fetchBrands = async () => {
    try {
      const response = await fetch(`${API_BASE}/brands/me`, {
        headers: authHeader(),
      });
      const data = await response.json();
      setBrands(data.brands || []);
    } catch (error) {
      console.error("Error fetching brands:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading brands...</div>
      </div>
    );
  }

  if (selectedBrand) {
    return (
      <BrandContentCreator
        brand={selectedBrand}
        onBack={() => setSelectedBrand(null)}
      />
    );
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#f7f7f4' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
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
              Content Creator
            </h1>
            <p className="text-[#5c5a52]">
              Select a brand to create marketing content
            </p>
          </div>
        </div>

        {brands.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#5c5a52] text-base">
              No brands found. Please sync a brand first using the Brand
              Research Agent.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brands.map((brand) => (
              <div
                key={brand.id}
                className="bg-white rounded-xl border border-[#deddd6] hover:border-[#26251e] transition-all cursor-pointer overflow-hidden"
                onClick={() => setSelectedBrand(brand)}
              >
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    {brand.logo_url ? (
                      <img
                        src={brand.logo_url}
                        alt={brand.brand_name}
                        className="w-14 h-14 object-contain mr-4 bg-[#f7f7f4] rounded-lg p-2 border border-[#deddd6]"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-14 h-14 bg-[#efefe9] rounded-lg flex items-center justify-center mr-4 border border-[#deddd6]">
                        <span className="text-[#8a887e] text-xs">Logo</span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-[#26251e]">
                        {brand.brand_name}
                      </h3>
                      <p className="text-sm text-[#5c5a52]">{brand.industry || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#deddd6]">
                    <button className="w-full bg-[#26251e] text-white py-2.5 px-4 rounded-lg hover:bg-[#3d3c33] transition-colors font-medium">
                      Create Content
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface BrandContentCreatorProps {
  brand: Brand;
  onBack: () => void;
}

function BrandContentCreator({
  brand,
  onBack,
}: BrandContentCreatorProps) {
  const router = useRouter();
  const { authHeader } = useAuth();
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");

  // Video generation state
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoContentId, setVideoContentId] = useState<number | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string>("");
  const [videoError, setVideoError] = useState<string>("");
  const [videoPrompt, setVideoPrompt] = useState<string>("");
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProductImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProductImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateContent = async () => {
    if (!productImage) {
      toast.warning("Please upload a product image first");
      return;
    }

    setGenerating(true);

    try {
      const formData = new FormData();
      formData.append("brand_id", brand.id.toString());
      formData.append("product_image", productImage);

      const response = await fetch(`${API_BASE}/generate-ugc`, {
        method: "POST",
        headers: authHeader(),
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        setGeneratedImage(data.generated_image_url);
        setPrompt(data.prompt);
        toast.success("Content generated!");
      } else {
        const message = typeof data.detail === "string" ? data.detail : "Failed to generate content";
        toast.error(response.status === 402 ? "Payment required" : "Failed to generate content", {
          description: message,
          duration: 8000,
        });
      }
    } catch (error) {
      console.error("Error generating content:", error);
      toast.error("Failed to generate content");
    } finally {
      setGenerating(false);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const pollVideoStatus = async (contentId: number) => {
    try {
      const response = await fetch(`${API_BASE}/video-status/${contentId}`, {
        headers: authHeader(),
      });

      const data = await response.json().catch(() => ({}));

      if (data.status === "completed" && data.video_url) {
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setGeneratedVideoUrl(data.video_url);
        setGeneratingVideo(false);
        toast.success("Video generated successfully!");
      } else if (data.status === "failed") {
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setVideoError(data.error || "Video generation failed");
        setGeneratingVideo(false);
        toast.error("Video generation failed", {
          description: data.error,
          duration: 8000,
        });
      }
      // If still generating, continue polling
    } catch (error) {
      console.error("Error polling video status:", error);
    }
  };

  const handleGenerateVideo = async () => {
    if (!productImage) {
      toast.warning("Please upload a product image first");
      return;
    }

    setGeneratingVideo(true);
    setVideoError("");
    setGeneratedVideoUrl("");
    setVideoPrompt("");

    try {
      const formData = new FormData();
      formData.append("brand_id", brand.id.toString());
      formData.append("product_image", productImage);
      formData.append("model", "veo3_fast"); // Use fast model
      formData.append("aspect_ratio", "9:16"); // Portrait for social media

      const response = await fetch(`${API_BASE}/generate-video`, {
        method: "POST",
        headers: authHeader(),
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        setVideoContentId(data.content_id);
        setVideoPrompt(data.prompt);
        toast.info("Video generation started! This may take 2-5 minutes.", {
          duration: 10000,
        });

        // Start polling for video status
        pollingRef.current = setInterval(() => {
          pollVideoStatus(data.content_id);
        }, 15000); // Poll every 15 seconds
      } else {
        const message = typeof data.detail === "string" ? data.detail : "Failed to start video generation";
        toast.error(response.status === 402 ? "Payment required" : "Failed to generate video", {
          description: message,
          duration: 8000,
        });
        setGeneratingVideo(false);
      }
    } catch (error) {
      console.error("Error generating video:", error);
      toast.error("Failed to generate video");
      setGeneratingVideo(false);
    }
  };

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#f7f7f4' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
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
            onClick={onBack}
            className="text-[#26251e] hover:underline flex items-center text-sm font-medium"
          >
            ← Back to Brands
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Brand Info Panel */}
          <div className="bg-white rounded-xl border border-[#deddd6] p-6">
            <h2 className="text-xl font-semibold text-[#26251e] mb-6">Brand Information</h2>

            <div className="mb-6">
              {brand.logo_url ? (
                <img
                  src={brand.logo_url}
                  alt={brand.brand_name}
                  className="w-24 h-24 object-contain mb-4 bg-[#f7f7f4] rounded-lg p-2 border border-[#deddd6]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-24 h-24 bg-[#efefe9] rounded-lg flex items-center justify-center mb-4 border border-[#deddd6]">
                  <span className="text-[#8a887e] text-sm">No Logo</span>
                </div>
              )}
              <h3 className="text-lg font-semibold text-[#26251e]">{brand.brand_name}</h3>
              <p className="text-[#5c5a52] text-sm">{brand.domain}</p>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-[#26251e] text-sm">Industry</h4>
                <p className="text-[#5c5a52]">{brand.industry || 'N/A'}</p>
              </div>

              <div>
                <h4 className="font-medium text-[#26251e] text-sm">Company Vibe</h4>
                <p className="text-[#5c5a52]">{brand.company_vibe || 'N/A'}</p>
              </div>

              <div>
                <h4 className="font-medium text-[#26251e] text-sm">Target Audience</h4>
                <p className="text-[#5c5a52]">{brand.target_audience || 'N/A'}</p>
              </div>

              <div>
                <h4 className="font-medium text-[#26251e] text-sm">
                  Product/Service
                </h4>
                <p className="text-[#5c5a52]">{brand.product_service || 'N/A'}</p>
              </div>

              {brand.colors && Array.isArray(brand.colors) && brand.colors.length > 0 && (
                <div>
                  <h4 className="font-medium text-[#26251e] text-sm mb-2">
                    Brand Colors
                  </h4>
                  <div className="flex gap-2 flex-wrap">
                    {brand.colors.map((color, idx) => (
                      <div key={idx} className="text-center">
                        <div
                          className="w-12 h-12 rounded-lg border border-[#deddd6]"
                          style={{ backgroundColor: color.hex }}
                        />
                        <p className="text-xs mt-1 text-[#5c5a52]">
                          {color.hex}
                        </p>
                        {color.name && (
                          <p className="text-xs text-[#8a887e]">{color.name}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {brand.social_links && Array.isArray(brand.social_links) && brand.social_links.length > 0 && (
                <div>
                  <h4 className="font-medium text-[#26251e] text-sm mb-2">
                    Social Media
                  </h4>
                  <div className="space-y-2">
                    {brand.social_links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[#26251e] hover:underline text-sm"
                      >
                        <span className="capitalize">{link.platform}</span>
                        <span>→</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Content Generation Panel */}
          <div className="bg-white rounded-xl border border-[#deddd6] p-6">
            <h2 className="text-xl font-semibold text-[#26251e] mb-6">Generate UGC Content</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#26251e] mb-2">
                  Upload Product Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="block w-full text-sm text-[#5c5a52] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-[#deddd6] file:text-sm file:font-medium file:bg-[#f7f7f4] file:text-[#26251e] hover:file:bg-[#efefe9] file:cursor-pointer"
                />
              </div>

              {productImagePreview && (
                <div>
                  <p className="text-sm font-medium text-[#26251e] mb-2">
                    Preview
                  </p>
                  <img
                    src={productImagePreview}
                    alt="Product preview"
                    className="w-full h-64 object-contain bg-[#f7f7f4] rounded-lg border border-[#deddd6]"
                  />
                </div>
              )}

              <button
                onClick={handleGenerateContent}
                disabled={!productImage || generating || generatingVideo}
                className="w-full bg-[#26251e] text-white py-3 px-6 rounded-lg hover:bg-[#3d3c33] disabled:bg-[#cccbc2] disabled:cursor-not-allowed transition-colors font-medium"
              >
                {generating ? "Generating..." : "Generate UGC Image"}
              </button>

              {/* Video Generation Button */}
              <button
                onClick={handleGenerateVideo}
                disabled={!productImage || generating || generatingVideo}
                className="w-full bg-white border border-[#26251e] text-[#26251e] py-3 px-6 rounded-lg hover:bg-[#26251e] hover:text-white disabled:bg-[#efefe9] disabled:border-[#cccbc2] disabled:text-[#8a887e] disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
              >
                {generatingVideo ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Video (2-5 min)...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Generate Marketing Video
                  </>
                )}
              </button>

              {generatedImage && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">
                    Generated Image
                  </h3>
                  <img
                    src={generatedImage}
                    alt="Generated UGC"
                    className="w-full rounded-lg shadow-md"
                  />
                  <a
                    href={generatedImage}
                    download="generated-ugc.png"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 inline-block text-center"
                  >
                    Download Image
                  </a>
                </div>
              )}

              {/* Generated Video Section */}
              {generatedVideoUrl && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">
                    Generated Video
                  </h3>
                  <video
                    src={generatedVideoUrl}
                    controls
                    autoPlay
                    loop
                    muted
                    className="w-full rounded-lg shadow-md"
                    style={{ aspectRatio: '9/16', maxHeight: '500px' }}
                  />
                  <a
                    href={generatedVideoUrl}
                    download="generated-video.mp4"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 inline-block text-center"
                  >
                    Download Video
                  </a>
                </div>
              )}

              {/* Video Error Message */}
              {videoError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm font-medium">
                    Video Error: {videoError}
                  </p>
                </div>
              )}

              {prompt && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                    View Image Prompt
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-4 rounded-lg overflow-auto">
                    {prompt}
                  </pre>
                </details>
              )}

              {videoPrompt && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                    View Video Prompt
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-4 rounded-lg overflow-auto">
                    {videoPrompt}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
