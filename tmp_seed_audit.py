
from infra.infra import init_tables

if __name__ == "__main__":
    print("Iniciando creación de tablas...")
    success = init_tables()
    if success:
        print("Tablas creadas exitosamente.")
    else:
        print("Error al crear las tablas.")
