"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Content Creator
          </h1>
          <p className="text-gray-600">
            Select a brand to create marketing content
          </p>
        </div>

        {brands.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              No brands found. Please sync a brand first using the Brand
              Research Agent.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brands.map((brand) => (
              <div
                key={brand.id}
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow cursor-pointer overflow-hidden"
                onClick={() => setSelectedBrand(brand)}
              >
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    {brand.logo_url ? (
                      <img
                        src={brand.logo_url}
                        alt={brand.brand_name}
                        className="w-16 h-16 object-contain mr-4 bg-gray-50 rounded-lg p-2"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center mr-4">
                        <span className="text-gray-400 text-xs">Logo</span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {brand.brand_name}
                      </h3>
                      <p className="text-sm text-gray-500">{brand.industry || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
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
  const { authHeader } = useAuth();
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");

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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 text-blue-600 hover:text-blue-700 flex items-center"
        >
          ← Back to Brands
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Brand Info Panel */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Brand Information</h2>

            <div className="mb-6">
              {brand.logo_url ? (
                <img
                  src={brand.logo_url}
                  alt={brand.brand_name}
                  className="w-32 h-32 object-contain mb-4 bg-gray-50 rounded-lg p-2"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-gray-400 text-sm">No Logo</span>
                </div>
              )}
              <h3 className="text-xl font-bold">{brand.brand_name}</h3>
              <p className="text-gray-600">{brand.domain}</p>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-700">Industry</h4>
                <p className="text-gray-600">{brand.industry || 'N/A'}</p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-700">Company Vibe</h4>
                <p className="text-gray-600">{brand.company_vibe || 'N/A'}</p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-700">Target Audience</h4>
                <p className="text-gray-600">{brand.target_audience || 'N/A'}</p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-700">
                  Product/Service
                </h4>
                <p className="text-gray-600">{brand.product_service || 'N/A'}</p>
              </div>

              {brand.colors && Array.isArray(brand.colors) && brand.colors.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">
                    Brand Colors
                  </h4>
                  <div className="flex gap-2 flex-wrap">
                    {brand.colors.map((color, idx) => (
                      <div key={idx} className="text-center">
                        <div
                          className="w-16 h-16 rounded-lg shadow-md border border-gray-200"
                          style={{ backgroundColor: color.hex }}
                        />
                        <p className="text-xs mt-1 text-gray-600">
                          {color.hex}
                        </p>
                        {color.name && (
                          <p className="text-xs text-gray-400">{color.name}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {brand.social_links && Array.isArray(brand.social_links) && brand.social_links.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">
                    Social Media
                  </h4>
                  <div className="space-y-2">
                    {brand.social_links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
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
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Generate UGC Content</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Upload Product Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {productImagePreview && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Preview
                  </p>
                  <img
                    src={productImagePreview}
                    alt="Product preview"
                    className="w-full h-64 object-contain bg-gray-100 rounded-lg"
                  />
                </div>
              )}

              <button
                onClick={handleGenerateContent}
                disabled={!productImage || generating}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                {generating ? "Generating..." : "Generate UGC Content"}
              </button>

              {generatedImage && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">
                    Generated Content
                  </h3>
                  <img
                    src={generatedImage}
                    alt="Generated UGC"
                    className="w-full rounded-lg shadow-md"
                  />
                  <button className="mt-4 w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700">
                    Download Image
                  </button>
                </div>
              )}

              {prompt && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                    View Prompt Used
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-4 rounded-lg overflow-auto">
                    {prompt}
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
