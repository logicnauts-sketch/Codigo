from infra.infra import init_tables

if __name__ == "__main__":
    print("Initializing tables...")
    result = init_tables()
    if result:
        print("Tables initialized successfully!")
    else:
        print("Failed to initialize tables.")
