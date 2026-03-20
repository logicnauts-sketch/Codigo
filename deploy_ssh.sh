#!/bin/bash
set -e # Detener el script si hay algún error crítico

echo "=================================================="
echo "🚀 Iniciando Despliegue Premium: Next Design OS"
echo "📅 $(date)"
echo "=================================================="

# Variables de configuración
APP_DIR="$HOME/Next_Design"
VENV_DIR="$APP_DIR/venv"
WSGI_FILE="/var/www/nextdesign_pythonanywhere_com_wsgi.py"
LAST_DEPLOY_FILE="$APP_DIR/.last_deploy_commit"

# Navegar al directorio raíz
cd "$APP_DIR" || { echo "❌ Error: Directorio $APP_DIR no encontrado."; exit 1; }

# Recordar el commit actual antes de traer los cambios nuevos
if [ -f "$LAST_DEPLOY_FILE" ]; then
    OLD_COMMIT=$(cat "$LAST_DEPLOY_FILE")
else
    OLD_COMMIT=$(git rev-parse HEAD)
fi

echo "📦 1. Sincronizando código fuente con GitHub..."
git fetch origin main
NEW_COMMIT=$(git rev-parse origin/main)

if [ "$OLD_COMMIT" == "$NEW_COMMIT" ]; then
    echo "✨ El código ya está en su última versión."
    # Aún así haremos un reset duro por si modificaste archivos a mano en el servidor sin querer
    git reset --hard origin/main
else
    echo "🔄 Actualizando proyecto de la versión ${OLD_COMMIT:0:7} a ${NEW_COMMIT:0:7}..."
    git reset --hard origin/main
fi

echo "🐍 2. Verificando Entorno Virtual y Dependencias..."
# Buscar o crear el entorno virtual (Virtualenv)
if [ -f "$VENV_DIR/bin/activate" ]; then
    source "$VENV_DIR/bin/activate"
else
    echo "⚠️  Entorno virtual no encontrado. Creando entorno aislado 'venv'..."
    python3 -m venv "$VENV_DIR"
    source "$VENV_DIR/bin/activate"
    pip install --upgrade pip
fi

# Lógica inteligente para instalar paquetes solo cuando sea necesario
if git diff --name-only "$OLD_COMMIT" "$NEW_COMMIT" | grep -q 'requirements.txt' || [ ! -f "$LAST_DEPLOY_FILE" ]; then
    echo "⬇️  Se detectaron cambios en requirements.txt. Instalando nuevas librerías..."
    pip install -q --disable-pip-version-check -r requirements.txt
else
    echo "⚡ No hay nuevas dependencias. Omitiendo instalación de pip (Despliegue ultra-rápido)."
fi

echo "🧹 3. Mantenimiento y limpieza de caché..."
find . -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
find . -type f -name '*.pyc' -delete 2>/dev/null || true
# Limpiar flask_session solo si necesitas desconectar a todos los usuarios; mejor dejarlo comentado
# rm -rf flask_session/*

echo "🌐 4. Reiniciando servidor web..."
if [ -f "$WSGI_FILE" ]; then
    touch "$WSGI_FILE"
    echo "✅ Toque de recarga enviado al archivo WSGI."
else
    echo "⚠️  Archivo WSGI ($WSGI_FILE) no encontrado. Asegúrate de que el nombre de usuario y dominio coincidan."
fi

# Marcar este commit como el último desplegado con éxito
echo "$NEW_COMMIT" > "$LAST_DEPLOY_FILE"

echo "=================================================="
echo "🎉 ¡Despliegue completado maravillosamente en tiempo récord!"
echo "🌐 Refresca tu navegador (Ctrl+Shift+R) para ver la magia."
echo "=================================================="
