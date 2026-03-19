from infra.infra import execute_query

def verify():
    tables_to_check = ['clientes', 'caja_estado', 'creditos_clientes', 'pagos_creditos']
    for table in tables_to_check:
        print(f"\n--- Checking table: {table} ---")
        try:
            res = execute_query(f"DESCRIBE {table}")
            if res:
                for row in res:
                    print(f"  {row['Field']}: {row['Type']}")
            else:
                print("  No columns found or empty result.")
        except Exception as e:
            print(f"  Error checking table {table}: {e}")

if __name__ == "__main__":
    verify()
