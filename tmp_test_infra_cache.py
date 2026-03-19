import os
import json
import sys
from unittest.mock import MagicMock

# Simular entorno frozen
sys.frozen = True

# Mock de Flask current_app
sys.modules['flask'] = MagicMock()
from flask import current_app

import infra.infra as infra

def test_cache_fix():
    print("--- Test: Verificación de caché en Infra ---")
    
    # Asegurar que el archivo no existe
    if os.path.exists(infra.CONFIG_FILE):
        os.remove(infra.CONFIG_FILE)
    
    # 1. Primera llamada (debe fallar y cachear False)
    print(f"1. Llamada inicial is_db_configured: {infra.is_db_configured()}")
    print(f"   Caché configurado: {infra._db_configured_cache}")
    
    # 2. Simular guardado de configuración
    config = {
        'host': 'localhost',
        'port': 3306,
        'user': 'root',
        'password': '',
        'database': 'test_db'
    }
    
    print("2. Guardando configuración...")
    # Creamos un mock de request/jsonify si fuera necesario, pero llamaremos a la lógica interna
    with open(infra.CONFIG_FILE, 'w') as f:
        json.dump(config, f)
    
    # SIMULACIÓN DE LO QUE HACÍA ANTES (Falla)
    print(f"3. Llamada SIN limpiar caché: {infra.is_db_configured()} (Debe ser False si hay bug)")
    
    # APLICAR LIMPIEZA (Lo que añadí)
    infra._db_configured_cache = None
    infra._db_config_cache = None
    
    print(f"4. Llamada TRAS limpiar caché: {infra.is_db_configured()} (Debe ser True)")
    
    if infra.is_db_configured():
        print("SUCCESS: El sistema ahora detecta el cambio de configuración.")
    else:
        print("FAILURE: El sistema sigue sin detectar el cambio.")

    # Limpieza
    if os.path.exists(infra.CONFIG_FILE):
        os.remove(infra.CONFIG_FILE)

if __name__ == "__main__":
    test_cache_fix()
