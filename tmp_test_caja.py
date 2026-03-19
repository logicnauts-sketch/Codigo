import requests
import json

try:
    print("Testing /caja/api/abrir...")
    res = requests.post('http://127.0.0.1:5000/caja/api/abrir', json={"monto_inicial": 100})
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text}")
    
    print("\nTesting /caja/api/estado-actual...")
    res = requests.get('http://127.0.0.1:5000/caja/api/estado-actual')
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text}")
except Exception as e:
    print(e)
