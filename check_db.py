
import pymysql
import json
import os

CONFIG_FILE = 'db_config.json'

def get_db_config():
    if not os.path.exists(CONFIG_FILE):
        return None
    with open(CONFIG_FILE, 'r') as f:
        return json.load(f)

def check_db():
    cfg = get_db_config()
    if not cfg:
        print("No db_config.json found")
        return

    try:
        conn = pymysql.connect(
            host=cfg['host'],
            port=int(cfg['port']),
            user=cfg['user'],
            password=cfg['password'],
            database=cfg['database'],
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        with conn.cursor() as cursor:
            cursor.execute("SHOW TABLES")
            tables = cursor.fetchall()
            print("Tables in database:")
            for t in tables:
                table_name = list(t.values())[0]
                print(f"- {table_name}")
                cursor.execute(f"DESCRIBE {table_name}")
                columns = cursor.fetchall()
                for c in columns:
                    print(f"  - {c['Field']} ({c['Type']})")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()
