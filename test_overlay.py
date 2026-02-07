from image_generator import add_brand_overlay

# Test with a sample image (no API call needed)
test_image_url = "https://tempfile.aiquickdraw.com/h/b0f63a35bca5fc2d6c69dac6a399554b_1770417816.png"

test_brand = {
    'brand_name': 'Nike',
    'logo_url': 'https://cdn.brandfetch.io/nike.com/w/400/h/400/logo',
    'colors': [{'hex': '#FF6B00', 'name': 'Orange'}]
}

output_path = "uploads/products/test_overlay.jpg"

print("Testing brand overlay...")
try:
    result = add_brand_overlay(test_image_url, test_brand, output_path)
    print(f"✅ Success! Check: {result}")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
