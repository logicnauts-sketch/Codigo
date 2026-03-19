
from infra.infra import execute_query

def check_history():
    print("--- Últimos 5 movimientos ---")
    res = execute_query("SELECT * FROM inventario_movimientos ORDER BY id DESC LIMIT 5")
    if res:
        for row in res:
            print(row)
    else:
        print("No movements found.")

if __name__ == "__main__":
    check_history()
