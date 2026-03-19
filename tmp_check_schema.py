
from infra.infra import execute_query

def check_schema():
    print("--- inventario_movimientos ---")
    res = execute_query("DESCRIBE inventario_movimientos")
    if res:
        for row in res:
            print(row)
    else:
        print("No matches or error.")

if __name__ == "__main__":
    check_schema()
