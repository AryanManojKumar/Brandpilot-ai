from database import get_all_brands, get_connection
from psycopg2.extras import RealDictCursor

print("🔍 Checking database for saved brands...\n")

# Check brands table
brands = get_all_brands()
print(f"Total brands in database: {len(brands)}")

if brands:
    print("\n📋 Brands found:")
    for brand in brands:
        print(f"\n  - ID: {brand['id']}")
        print(f"    Name: {brand['brand_name']}")
        print(f"    Domain: {brand['domain']}")
        print(f"    Industry: {brand['industry']}")
        print(f"    Created: {brand['created_at']}")
else:
    print("\n❌ No brands found in database")

# Check conversations
conn = get_connection()
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT * FROM conversations ORDER BY started_at DESC LIMIT 5")
conversations = cur.fetchall()
print(f"\n💬 Recent conversations: {len(conversations)}")
for conv in conversations:
    print(f"  - {conv['conversation_id']} (Status: {conv['status']})")

# Check messages
cur.execute("SELECT COUNT(*) as count FROM messages")
msg_count = cur.fetchone()
print(f"\n📨 Total messages: {msg_count['count']}")

cur.close()
conn.close()
