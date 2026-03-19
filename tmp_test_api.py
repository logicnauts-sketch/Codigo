
from flask import Flask
from inventario.models.queries import get_historial_movimientos

# Mock app context if needed, but queries.py just needs infra
def test_api():
    print("--- testing get_historial_movimientos(30) ---")
    items = get_historial_movimientos(30)
    print(items)

if __name__ == "__main__":
    test_api()
