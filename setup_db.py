import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Connect to PostgreSQL server (default postgres database)
try:
    conn = psycopg2.connect(
        host="localhost",
        user="postgres",
        password="aryan",
        port=5432
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    
    # Check if database exists
    cur.execute("SELECT 1 FROM pg_database WHERE datname='iitgn'")
    exists = cur.fetchone()
    
    if not exists:
        print("Creating database 'iitgn'...")
        cur.execute("CREATE DATABASE iitgn")
        print("✅ Database 'iitgn' created successfully!")
    else:
        print("✅ Database 'iitgn' already exists!")
    
    cur.close()
    conn.close()
    
    # Now set up tables
    print("\nSetting up tables...")
    from database import setup_database
    setup_database()
    
except psycopg2.OperationalError as e:
    print(f"❌ Error connecting to PostgreSQL: {e}")
    print("\nMake sure:")
    print("1. PostgreSQL is running")
    print("2. Password 'aryan' is correct for user 'postgres'")
    print("3. PostgreSQL is listening on localhost:5432")
except Exception as e:
    print(f"❌ Error: {e}")
