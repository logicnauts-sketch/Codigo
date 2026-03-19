
from infra.infra import execute_query

def check_audit_tables():
    tables = ['inventario_auditorias', 'inventario_auditoria_detalles']
    for table in tables:
        print(f"--- {table} ---")
        res = execute_query(f"DESCRIBE {table}")
        if res:
            for row in res:
                print(row)
        else:
            print(f"Table {table} does not exist.")

if __name__ == "__main__":
    check_audit_tables()
