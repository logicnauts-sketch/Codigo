import pymysql
import json
import os

def check_and_fix():
    config_path = r'c:\Users\Anyelis\Desktop\Jarabacoa_Proyecto\Negocios\Next Design\Proyectos\Next_Design_Sistema\Codigo\db_config.json'
    if not os.path.exists(config_path):
        print("Config file not found")
        return

    with open(config_path, 'r') as f:
        cfg = json.load(f)

    try:
        conn = pymysql.connect(
            host=cfg['host'],
            port=int(cfg['port']),
            user=cfg['user'],
            password=cfg['password'],
            database=cfg['database'],
            charset='utf8mb4'
        )
        with conn.cursor() as cursor:
            # Check if columns exist
            cursor.execute("DESCRIBE trabajos_pendientes")
            columns = [col[0] for col in cursor.fetchall()]
            print(f"Current columns: {columns}")

            if 'fecha_finalizado' not in columns:
                print("Adding fecha_finalizado column...")
                cursor.execute("ALTER TABLE trabajos_pendientes ADD COLUMN fecha_finalizado DATETIME")
                conn.commit()
                print("Column added successfully!")
            else:
                print("Column fecha_finalizado already exists.")

        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_and_fix()
