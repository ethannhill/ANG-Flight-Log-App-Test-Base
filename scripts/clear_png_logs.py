#!/usr/bin/env python3
"""Delete all PNG operation flight logs and related data."""
import psycopg2

DATABASE_URL = "postgresql://postgres.ynqtoiriigzivferlwud:aerlink2153@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM scanned_flight_logs WHERE operation = 'PNG'")
count = cur.fetchone()[0]
print(f"Found {count} PNG flight logs to delete.")

if count == 0:
    print("Nothing to delete.")
    conn.close()
    exit()

confirm = input(f"Delete all {count} PNG logs + their sectors and images? (yes/no): ")
if confirm.lower() != 'yes':
    print("Aborted.")
    conn.close()
    exit()

cur.execute("""
    DELETE FROM scanned_log_images
    WHERE log_id IN (SELECT id FROM scanned_flight_logs WHERE operation = 'PNG')
""")
print(f"Deleted {cur.rowcount} images.")

cur.execute("""
    DELETE FROM scanned_sectors
    WHERE log_id IN (SELECT id FROM scanned_flight_logs WHERE operation = 'PNG')
""")
print(f"Deleted {cur.rowcount} sectors.")

cur.execute("DELETE FROM scanned_flight_logs WHERE operation = 'PNG'")
print(f"Deleted {cur.rowcount} flight logs.")

conn.commit()
conn.close()
print("Done.")
