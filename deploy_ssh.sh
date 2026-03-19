#!/bin/bash
set -e

PROJECT_DIR="$HOME/Next_Design"
BRANCH="main"
VENV_DIR="$PROJECT_DIR/venv"
WSGI_FILE="/var/www/nextdesign_pythonanywhere_com_wsgi.py"

echo "===> Entrando al proyecto ($PROJECT_DIR)"
cd "$PROJECT_DIR"

echo "===> Limpiando archivos temporales y cachÃ©s"
find . -type d -name "__pycache__" -exec rm -rf {} +
rm -rf flask_session/*

echo "===> Trayendo cambios desde GitHub ($BRANCH)"
git fetch origin
git reset --hard "origin/$BRANCH"

if [ ! -d "$VENV_DIR" ]; then
    echo "===> Creando entorno virtual con Python 3.10"
    python3.10 -m venv "$VENV_DIR"
fi

echo "===> Activando entorno virtual"
source "$VENV_DIR/bin/activate"

echo "===> Instalando/Actualizando dependencias de requirements.txt"
pip install --upgrade pip
pip install -r requirements.txt

# Reiniciar la aplicaciÃ³n de PythonAnywhere (CrÃtico)
if [ -f "$WSGI_FILE" ]; then
    echo "===> Reiniciando aplicaciÃ³n web (touch WSGI)"
    touch "$WSGI_FILE"
else
    echo "!!! ADVERTENCIA: No se encontrÃ³ el archivo WSGI en $WSGI_FILE"
fi

echo "âœ… Deploy completado con Ã©xito"
