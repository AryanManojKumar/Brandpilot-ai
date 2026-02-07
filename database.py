import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import os
from dotenv import load_dotenv
import json

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/brandsync_db")


def get_connection():
    """Get database connection"""
    return psycopg2.connect(DATABASE_URL)


def setup_database():
    """Create all necessary tables"""
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        # Conversations table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id SERIAL PRIMARY KEY,
                conversation_id VARCHAR(255) UNIQUE NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(50) DEFAULT 'active'
            )
        """)
        
        # Brands table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS brands (
                id SERIAL PRIMARY KEY,
                conversation_id VARCHAR(255) REFERENCES conversations(conversation_id),
                brand_name VARCHAR(255) NOT NULL,
                domain VARCHAR(255) NOT NULL,
                logo_url TEXT,
                product_service TEXT,
                company_vibe TEXT,
                target_audience TEXT,
                industry VARCHAR(100),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(conversation_id, domain)
            )
        """)
        
        # Brand colors table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS brand_colors (
                id SERIAL PRIMARY KEY,
                brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE,
                color_name VARCHAR(50),
                color_hex VARCHAR(7),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Brand social links table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS brand_social_links (
                id SERIAL PRIMARY KEY,
                brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE,
                platform VARCHAR(50),
                url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Generated content table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS generated_content (
                id SERIAL PRIMARY KEY,
                brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE,
                conversation_id VARCHAR(255) REFERENCES conversations(conversation_id),
                content_type VARCHAR(50) DEFAULT 'ugc_image',
                product_image_url TEXT,
                generated_image_url TEXT,
                prompt_used TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Scheduled posts table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_posts (
                id SERIAL PRIMARY KEY,
                content_id INTEGER REFERENCES generated_content(id) ON DELETE CASCADE,
                conversation_id VARCHAR(255) REFERENCES conversations(conversation_id),
                platform VARCHAR(50) DEFAULT 'twitter',
                caption TEXT,
                scheduled_time TIMESTAMP,
                status VARCHAR(50) DEFAULT 'scheduled',
                posted_at TIMESTAMP,
                post_url TEXT,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Messages table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                conversation_id VARCHAR(255) REFERENCES conversations(conversation_id),
                role VARCHAR(20) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        print("✅ Database tables created successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error creating tables: {e}")
        raise
    finally:
        cur.close()
        conn.close()


def create_conversation(conversation_id: str):
    """Create a new conversation"""
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO conversations (conversation_id, started_at, last_message_at)
            VALUES (%s, %s, %s)
            ON CONFLICT (conversation_id) DO NOTHING
            RETURNING id
        """, (conversation_id, datetime.now(), datetime.now()))
        
        conn.commit()
        result = cur.fetchone()
        return result[0] if result else None
        
    except Exception as e:
        conn.rollback()
        print(f"Error creating conversation: {e}")
        return None
    finally:
        cur.close()
        conn.close()


def save_message(conversation_id: str, role: str, content: str):
    """Save a message to the conversation"""
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        # Update conversation last_message_at
        cur.execute("""
            UPDATE conversations 
            SET last_message_at = %s 
            WHERE conversation_id = %s
        """, (datetime.now(), conversation_id))
        
        # Insert message
        cur.execute("""
            INSERT INTO messages (conversation_id, role, content, created_at)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (conversation_id, role, content, datetime.now()))
        
        conn.commit()
        result = cur.fetchone()
        return result[0] if result else None
        
    except Exception as e:
        conn.rollback()
        print(f"Error saving message: {e}")
        return None
    finally:
        cur.close()
        conn.close()


def save_brand(conversation_id: str, brand_data: dict):
    """Save brand information to database"""
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        # Insert brand
        cur.execute("""
            INSERT INTO brands (
                conversation_id, brand_name, domain, logo_url, 
                product_service, company_vibe, target_audience, 
                industry, description, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (conversation_id, domain) 
            DO UPDATE SET
                brand_name = EXCLUDED.brand_name,
                logo_url = EXCLUDED.logo_url,
                product_service = EXCLUDED.product_service,
                company_vibe = EXCLUDED.company_vibe,
                target_audience = EXCLUDED.target_audience,
                industry = EXCLUDED.industry,
                description = EXCLUDED.description,
                updated_at = EXCLUDED.updated_at
            RETURNING id
        """, (
            conversation_id,
            brand_data.get('brand_name'),
            brand_data.get('domain'),
            brand_data.get('logo_url'),
            brand_data.get('product_service'),
            brand_data.get('company_vibe'),
            brand_data.get('target_audience'),
            brand_data.get('industry'),
            brand_data.get('description'),
            datetime.now(),
            datetime.now()
        ))
        
        brand_id = cur.fetchone()[0]
        
        # Delete existing colors and social links for this brand
        cur.execute("DELETE FROM brand_colors WHERE brand_id = %s", (brand_id,))
        cur.execute("DELETE FROM brand_social_links WHERE brand_id = %s", (brand_id,))
        
        # Insert brand colors
        if brand_data.get('colors'):
            for color in brand_data['colors']:
                cur.execute("""
                    INSERT INTO brand_colors (brand_id, color_name, color_hex)
                    VALUES (%s, %s, %s)
                """, (brand_id, color.get('name'), color.get('hex')))
        
        # Insert social links
        if brand_data.get('social_links'):
            for link in brand_data['social_links']:
                cur.execute("""
                    INSERT INTO brand_social_links (brand_id, platform, url)
                    VALUES (%s, %s, %s)
                """, (brand_id, link.get('platform'), link.get('url')))
        
        conn.commit()
        print(f"✅ Brand saved successfully! Brand ID: {brand_id}")
        return brand_id
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error saving brand: {e}")
        return None
    finally:
        cur.close()
        conn.close()


def get_brand_by_domain(domain: str):
    """Retrieve brand by domain"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("""
            SELECT * FROM brands WHERE domain = %s ORDER BY created_at DESC LIMIT 1
        """, (domain,))
        
        brand = cur.fetchone()
        
        if brand:
            brand_id = brand['id']
            
            # Get colors
            cur.execute("SELECT * FROM brand_colors WHERE brand_id = %s", (brand_id,))
            colors = cur.fetchall()
            
            # Get social links
            cur.execute("SELECT * FROM brand_social_links WHERE brand_id = %s", (brand_id,))
            social_links = cur.fetchall()
            
            return {
                **dict(brand),
                'colors': [dict(c) for c in colors],
                'social_links': [dict(s) for s in social_links]
            }
        
        return None
        
    except Exception as e:
        print(f"Error retrieving brand: {e}")
        return None
    finally:
        cur.close()
        conn.close()


def get_conversation_history(conversation_id: str, limit: int = 50):
    """Get conversation message history"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("""
            SELECT role, content, created_at 
            FROM messages 
            WHERE conversation_id = %s 
            ORDER BY created_at ASC 
            LIMIT %s
        """, (conversation_id, limit))
        
        messages = cur.fetchall()
        return [dict(m) for m in messages]
        
    except Exception as e:
        print(f"Error retrieving conversation: {e}")
        return []
    finally:
        cur.close()
        conn.close()


def get_all_brands():
    """Get all brands from database"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("""
            SELECT id, brand_name, domain, logo_url, industry, created_at 
            FROM brands 
            ORDER BY created_at DESC
        """)
        
        brands = cur.fetchall()
        return [dict(b) for b in brands]
        
    except Exception as e:
        print(f"Error retrieving brands: {e}")
        return []
    finally:
        cur.close()
        conn.close()


def get_brands_by_conversation(conversation_id: str):
    """Get all brands for a specific conversation"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("""
            SELECT b.*, 
                   COALESCE(array_agg(DISTINCT jsonb_build_object('name', bc.color_name, 'hex', bc.color_hex)) 
                   FILTER (WHERE bc.id IS NOT NULL), '{}') as colors,
                   COALESCE(array_agg(DISTINCT jsonb_build_object('platform', bs.platform, 'url', bs.url)) 
                   FILTER (WHERE bs.id IS NOT NULL), '{}') as social_links
            FROM brands b
            LEFT JOIN brand_colors bc ON b.id = bc.brand_id
            LEFT JOIN brand_social_links bs ON b.id = bs.brand_id
            WHERE b.conversation_id = %s
            GROUP BY b.id
            ORDER BY b.created_at DESC
        """, (conversation_id,))
        
        brands = cur.fetchall()
        result = []
        for brand in brands:
            brand_dict = dict(brand)
            # Ensure colors and social_links are lists
            if brand_dict.get('colors') is None:
                brand_dict['colors'] = []
            if brand_dict.get('social_links') is None:
                brand_dict['social_links'] = []
            result.append(brand_dict)
        return result
        
    except Exception as e:
        print(f"Error retrieving brands by conversation: {e}")
        import traceback
        traceback.print_exc()
        return []
    finally:
        cur.close()
        conn.close()


def save_generated_content(brand_id: int, conversation_id: str, product_image_url: str, 
                          generated_image_url: str, prompt_used: str, content_type: str = 'ugc_image'):
    """Save generated content to database"""
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO generated_content 
            (brand_id, conversation_id, content_type, product_image_url, 
             generated_image_url, prompt_used, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            brand_id, conversation_id, content_type, product_image_url,
            generated_image_url, prompt_used, 'completed',
            datetime.now(), datetime.now()
        ))
        
        conn.commit()
        result = cur.fetchone()
        return result[0] if result else None
        
    except Exception as e:
        conn.rollback()
        print(f"Error saving generated content: {e}")
        return None
    finally:
        cur.close()
        conn.close()


def get_generated_content_by_brand(brand_id: int):
    """Get all generated content for a brand"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("""
            SELECT * FROM generated_content 
            WHERE brand_id = %s 
            ORDER BY created_at DESC
        """, (brand_id,))
        
        content = cur.fetchall()
        return [dict(c) for c in content]
        
    except Exception as e:
        print(f"Error retrieving generated content: {e}")
        return []
    finally:
        cur.close()
        conn.close()


def get_generated_content_by_conversation(conversation_id: str):
    """Get all generated content for a conversation"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("""
            SELECT gc.*, 
                   b.brand_name, 
                   b.logo_url,
                   b.industry,
                   b.domain
            FROM generated_content gc
            JOIN brands b ON gc.brand_id = b.id
            WHERE gc.conversation_id = %s
            ORDER BY gc.created_at DESC
        """, (conversation_id,))
        
        content = cur.fetchall()
        return [dict(c) for c in content]
        
    except Exception as e:
        print(f"Error retrieving generated content by conversation: {e}")
        return []
    finally:
        cur.close()
        conn.close()


def save_scheduled_post(content_id: int, conversation_id: str, caption: str, 
                       scheduled_time: datetime, platform: str = 'twitter'):
    """Save a scheduled post"""
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            INSERT INTO scheduled_posts 
            (content_id, conversation_id, platform, caption, scheduled_time, 
             status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            content_id, conversation_id, platform, caption, scheduled_time,
            'scheduled', datetime.now(), datetime.now()
        ))
        
        conn.commit()
        result = cur.fetchone()
        return result[0] if result else None
        
    except Exception as e:
        conn.rollback()
        print(f"Error saving scheduled post: {e}")
        return None
    finally:
        cur.close()
        conn.close()


def get_scheduled_posts_by_conversation(conversation_id: str):
    """Get all scheduled posts for a conversation"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("""
            SELECT sp.*, gc.generated_image_url, gc.product_image_url,
                   b.brand_name
            FROM scheduled_posts sp
            JOIN generated_content gc ON sp.content_id = gc.id
            JOIN brands b ON gc.brand_id = b.id
            WHERE sp.conversation_id = %s
            ORDER BY sp.scheduled_time ASC
        """, (conversation_id,))
        
        posts = cur.fetchall()
        return [dict(p) for p in posts]
        
    except Exception as e:
        print(f"Error retrieving scheduled posts: {e}")
        return []
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    print("Setting up BrandSync database...")
    setup_database()
    print("Database setup complete!")
