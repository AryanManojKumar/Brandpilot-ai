"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
  conversationId: string;
}

export default function SocialMediaManagerDashboard({
  conversationId,
}: SocialMediaManagerDashboardProps) {
  const [content, setContent] = useState<GeneratedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchGeneratedContent();
  }, [conversationId]);

  const fetchGeneratedContent = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/generated-content/conversation/${conversationId}`
      );
      const data = await response.json();
      setContent(data.content || []);
    } catch (error) {
      console.error("Error fetching generated content:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePostToX = (contentItem: GeneratedContent) => {
    // Navigate to posting page with content ID
    router.push(`/post-to-x?content_id=${contentItem.id}&conversation_id=${conversationId}`);
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
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Social Media Manager
          </h1>
          <p className="text-gray-600">
            Manage and schedule your generated marketing content
          </p>
        </div>

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
                        <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold">
                          {item.status}
                        </span>
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
