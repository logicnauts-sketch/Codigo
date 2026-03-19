from flask import Flask, redirect, url_for, session, request, jsonify
from datetime import timedelta
import time
import threading
import os

app = Flask(__name__)
app.secret_key = 'surti-kids-secret-key-enterprise'
app.permanent_session_lifetime = timedelta(days=365)

# --- Life Cycle Management (Heartbeat) ---
# NOTA: Desactivado porque session_guard.js no se usa en este proyecto.
# El servidor ya no se auto-apaga por falta de heartbeats.
_last_heartbeat = time.time()

@app.route('/api/system/heartbeat', methods=['POST'])
def system_heartbeat():
    global _last_heartbeat
    _last_heartbeat = time.time()
    return jsonify(success=True)

# Monitor de apagado desactivado — no hay JS que envíe heartbeats
# def _shutdown_monitor():
#     ...
# if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
#     threading.Thread(target=_shutdown_monitor, daemon=True).start()

# --- Routes ---
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('home.home'))
    return redirect(url_for('login.login'))

# --- Middleware: Verificar DB configurada ---
@app.before_request
def check_db_configured():
    """Redirige a /infra/db si no hay base de datos configurada."""
    # Rutas que NO requieren DB configurada
    exempt_prefixes = ('/infra', '/login', '/logout', '/static')
    path = request.path
    
    if any(path.startswith(p) for p in exempt_prefixes):
        return  # Permitir acceso libre
    
    from infra.infra import is_db_configured, init_tables
    if not is_db_configured():
        return redirect('/infra/db')
    
    # Asegurar que las tablas estén al día (migraciones ligeras)
    if not getattr(app, 'tables_initialized', False):
        init_tables()
        app.tables_initialized = True

# --- Blueprint Registration ---
from login.login import bp as login_bp
app.register_blueprint(login_bp)

from home import bp as home_bp
app.register_blueprint(home_bp)

from facturacion import bp as facturacion_bp
app.register_blueprint(facturacion_bp, url_prefix='/facturacion')

from caja import caja_bp
app.register_blueprint(caja_bp, url_prefix='/caja')

from productos import bp as productos_bp
app.register_blueprint(productos_bp, url_prefix='/productos')

from inventario import bp as inventario_bp
app.register_blueprint(inventario_bp, url_prefix='/inventario')

from clientes import bp as clientes_bp
app.register_blueprint(clientes_bp)

from proveedores import bp as proveedores_bp
app.register_blueprint(proveedores_bp)

from reporte_ventas import bp as reporteventas_bp
app.register_blueprint(reporteventas_bp, url_prefix='/reporteventas')

from usuarios import bp as usuarios_bp
app.register_blueprint(usuarios_bp)

from configuracion.configuracion import bp as configuracion_bp
app.register_blueprint(configuracion_bp)

from infra.infra import bp as infra_bp
app.register_blueprint(infra_bp)

from trabajos_pendientes import bp as trabajos_pendientes_bp
app.register_blueprint(trabajos_pendientes_bp, url_prefix='/trabajos_pendientes')

from gastos_diarios import bp as gastos_diarios_bp
app.register_blueprint(gastos_diarios_bp, url_prefix='/gastos_diarios')

# Nota: Si calculadora y mis_logros no tienen archivo .py, solo se sirven como templates estáticos o vía otros blueprints.
# Pero si tienen lógica propia, se registrarían aquí.

if __name__ == '__main__':
    print("=" * 50)
    print("  Next Design - Premium Management System")
    print("  Server running on http://127.0.0.1:5000")
    print("=" * 50)
    app.run(debug=True, port=5000)
