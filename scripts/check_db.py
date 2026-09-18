import sqlite3
import os

def check_db():
    db_path = "backend/settleguard.db"
    if not os.path.exists(db_path):
        print(f"[ERR] DB file not found at {db_path}")
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"--- Database Tables at {db_path} ---")
        for t in tables:
            print(f"- {t[0]}")
        conn.close()
    except Exception as e:
        print(f"[ERR] DB check failed - {e}")

if __name__ == "__main__":
    check_db()
