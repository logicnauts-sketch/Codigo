import logging
import os
import sys
import json
import traceback
import time
from datetime import timedelta, datetime
from ln_engine.utils.paths import get_data_dir, get_logs_dir

# --- VERSIONING ---
APP_VERSION = '1.0.0'

# --- EARLY LOGGING (Fase 63 Debug) ---
try:
    _log_dir = get_logs_dir()
    os.makedirs(_log_dir, exist_ok=True)
    _log_file = os.path.join(_log_dir, "system.log")
    logging.basicConfig(
        filename=_log_file,
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(module)s: %(message)s'
    )
    logging.info("!!! ENGINE PRE-STOP: Start of app_engine.py execution !!!")
except Exception as e:
    print(f"Early logging failed: {e}")

from flask import Flask, session, request, jsonify, redirect, url_for, render_template, send_from_directory, make_response
from flask_session import Session
from ln_engine.extensions import limiter

# El Engine se localiza a sí mismo para encontrar plantillas y estáticos
engine_dir = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, 
            template_folder=os.path.join(engine_dir, 'templates'),
            static_folder=os.path.join(engine_dir, 'static'))

# --- DETECCIÓN DE ENTORNO ---
_IS_PA = 'PYTHONANYWHERE_DOMAIN' in os.environ or os.environ.get('LN_ENVIRONMENT') == 'pythonanywhere'

# --- MIDDLEWARE (Phase 10 Proxy Stability) ---
from werkzeug.middleware.proxy_fix import ProxyFix
if _IS_PA:
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
    
    @app.before_request
    def force_https_on_pa():
        if _IS_PA:
            request.environ['wsgi.url_scheme'] = 'https'
        
        if not hasattr(app, '_log_headers_done'):
             cookie = request.headers.get('Cookie', '')
             cookie_telemetry = f"Len={len(cookie)}"
             if cookie:
                 cookie_telemetry += f", Starts={cookie[:10]}..." if len(cookie) > 10 else f", val={cookie}"
             
             logging.info(f"DEBUG HEADERS: Proto={request.headers.get('X-Forwarded-Proto')}, Host={request.headers.get('Host')}, IsSecure={request.is_secure}, Cookie: {cookie_telemetry}")
             app._log_headers_done = True

        is_heartbeat = (
            request.path.startswith('/api/network/heartbeat') or 
            request.path.startswith('/api/v1/agent/heartbeat') or 
            request.path.startswith('/api/v1/public/agent/heartbeat')
        )
        if _IS_PA and not request.is_secure and not is_heartbeat:
            url = request.url.replace('http://', 'https://', 1)
            return redirect(url, code=301)

# --- REFACTOR: INYECCIÓN DE CONFIGURACIÓN MODULAR ---
# Agregar la raíz del proyecto al sys.path para importaciones
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

env = os.environ.get('LN_ENVIRONMENT', 'development')
if getattr(sys, 'frozen', False):
    # Si somos un empaquetado PyInstaller, forzamos producción
    env = 'production'

try:
    if env == 'production' or _IS_PA:
        from config.production import ProductionConfig
        app.config.from_object(ProductionConfig)
        ProductionConfig.init_app(app)
        logging.info(f"[CONFIG] Entorno de PRODUCCIÓN cargado correctamente.")
    else:
        from config.development import DevelopmentConfig
        app.config.from_object(DevelopmentConfig)
        DevelopmentConfig.init_app(app)
        logging.info(f"[CONFIG] Entorno de DESARROLLO cargado correctamente.")
except Exception as config_err:
    logging.error(f"[CONFIG] Error cargando configuración modular: {config_err}")
    # Forzamos la versión a nivel global para que sea accesible incluso en logs
    app.config['VERSION'] = '1.1.2'
    # Fallback: configuración mínima de emergencia
    app.config.update(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'LN-STABLE-PROD-KEY-FORCE-2024'),
        SESSION_TYPE='filesystem',
        SESSION_PERMANENT=True,
        PROPAGATE_EXCEPTIONS=True
    )

Session(app)

@app.after_request
def debug_cookie_delivery(response):
    set_cookie = response.headers.get('Set-Cookie')
    if set_cookie:
        logging.info(f"[TELEMETRIA_COOKIE] Set-Cookie: {set_cookie[:100]}...")
    return response

# --- LOGGING ALREADY INITIALIZED EARLY ---
logging.info("LN Engine Initializing (v1 Standardized)...")

# --- EARLY SETUP DETECTION (Fase 68) ---
def check_first_run():
    """Detecta si el sistema necesita configuración inicial."""
    from ln_engine.utils.paths import get_data_dir
    data_dir = get_data_dir()
    config_path = os.path.join(data_dir, 'config.json')
    
    # 1. Check if config file exists (Fastest)
    if os.path.exists(config_path):
        return False
        
    # 2. Check for infra.dat as a proxy for 'Migrated' status
    infra_path = os.path.join(data_dir, 'infra.dat')
    if os.path.exists(infra_path):
        # We assume if infra.dat exists, the user has at least tried to setup
        # Defer deeper DB checks to avoid blocking the MAIN THREAD at boot
        return False
        
    return True

app.config['SETUP_MODE'] = check_first_run()
app.config['REPAIR_MODE'] = False
app.config['INFRA_ERROR'] = False

# Auto-detección de fallas de infraestructura al arranque (Fase 75)
# Diferido: Se ejecuta en un hilo de fondo con un retraso para dar tiempo a MariaDB Embebido a arrancar.
def _detect_infrastructure_failures():
    if app.config.get('SETUP_MODE'): return
    import threading
    def _deferred_check():
        time.sleep(3)  # Esperar 3 segundos para que MariaDB termine de arrancar
        try:
            from ln_engine.services.security.health import SystemHealthService
            health = SystemHealthService.get_overall_health()
            if health.get('status') == 'ERROR':
                app.config['REPAIR_MODE'] = True
                app.config['BOOT_ERROR'] = health.get('label', 'Falla de Motor de Datos')
                logging.warning(f"[BOOT] Modo Reparación ACTIVADO debido a: {app.config['BOOT_ERROR']}")
        except: pass
    threading.Thread(target=_deferred_check, daemon=True).start()

_detect_infrastructure_failures()

# --- EMAIL CONFIGURATION (Resilient Startup) ---
def _load_smtp_config(flask_app):
    """Carga configuración SMTP de forma segura sin bloquear el boot."""
    try:
        from ln_agent.database.connection import conectar
        # Usar un timeout muy agresivo para el boot
        conn = conectar()
        if conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT clave, valor FROM configuracion WHERE clave IN ('smtp_user', 'smtp_password')")
            db_conf = {row['clave']: row['valor'] for row in cursor.fetchall()}
            cursor.close(); conn.close()
            
            with flask_app.app_context():
                if db_conf.get('smtp_user'): flask_app.config['MAIL_USERNAME'] = db_conf['smtp_user']
                if db_conf.get('smtp_password'): flask_app.config['MAIL_PASSWORD'] = db_conf['smtp_password']
                logging.info(f"SMTP config updated from DB: {db_conf.get('smtp_user')}")
    except Exception as e:
        logging.debug(f"Async SMTP load skipped: {e}")

try:
    from flask_mail import Mail
    mail_user = 'logicnauts@gmail.com'
    mail_pass = os.environ.get('MAIL_PASSWORD', 'lcbm ttjd akus vkcy')
    
    app.config.update(
        MAIL_SERVER='smtp.gmail.com',
        MAIL_PORT=587,
        MAIL_USE_TLS=True,
        MAIL_USERNAME=mail_user,
        MAIL_PASSWORD=mail_pass,
        MAIL_DEFAULT_SENDER=('LN Systems – Notification Engine', mail_user)
    )
    
    mail = Mail(app)
    if not hasattr(app, 'extensions'): app.extensions = {}
    app.extensions['mail'] = mail
    
    # Cargar de DB en un hilo para no bloquear el arranque
    if not check_first_run():
        import threading
        threading.Thread(target=_load_smtp_config, args=(app,), daemon=True).start()
    
    logging.info("Email subsystem initialized (Default settings).")

except Exception as e:
    logging.error(f"Email subsystem failed to initialize: {e}")

except ImportError:
    logging.warning("Flask-Mail not installed. Email features disabled.")
except Exception as e:
    logging.error(f"Email subsystem failed: {e}")

# --- ERROR HANDLING ---
from werkzeug.exceptions import HTTPException

ERROR_MAPPINGS = {
    400: {"title": "Solicitud Incorrecta", "msg": "Los datos enviados no son válidos.", "icon": "fa-circle-exclamation"},
    401: {"title": "Autenticación Requerida", "msg": "Es necesario iniciar sesión.", "icon": "fa-user-lock"},
    403: {"title": "Acceso Restringido", "msg": "No tienes permisos suficientes.", "icon": "fa-shield-halved"},
    404: {"title": "Módulo No Encontrado", "msg": "El recurso solicitado no existe.", "icon": "fa-magnifying-glass"},
    405: {"title": "Método No Permitido", "msg": "Operación no permitida.", "icon": "fa-ban"},
    429: {"title": "Límite de Solicitudes", "msg": "Demasiadas peticiones. Por favor, espera.", "icon": "fa-gauge-high"},
    500: {"title": "Error Interno", "msg": "Hemos experimentado un problema técnico.", "icon": "fa-bug-slash"},
    503: {"title": "Mantenimiento", "msg": "Sistema bajo mantenimiento programado.", "icon": "fa-wrench"},
}

def generate_incident_hash():
    ts = int(time.time())
    return f"LN-{ts}-{os.urandom(2).hex().upper()}"

@app.errorhandler(Exception)
def handle_global_exception(e):
    code = getattr(e, 'code', 500)
    mapping = ERROR_MAPPINGS.get(code, {"title": f"Error {code}", "msg": "Problema inesperado.", "icon": "fa-triangle-exclamation"})
    incident_id = generate_incident_hash() if code >= 500 else None
    
    if incident_id:
        logging.error(f"SYSTEM EXCEPTION [{incident_id}] [{code}]: {str(e)}\n{traceback.format_exc()}")
        try:
            from ln_engine.services.audit import log_audit
            log_audit(f'ERROR_{code}', 'CORE', 0, {"incident_id": incident_id, "url": request.url})
        except: pass

    # FIX: is_ajax detection logic robusta
    is_ajax = (
        request.headers.get('X-Requested-With') == 'XMLHttpRequest' or 
        'application/json' in (request.headers.get('Accept') or '').lower() or
        'application/json' in (request.headers.get('Content-Type') or '').lower()
    )
    
    if code == 404:
        logging.warning(f"[404_NOT_FOUND] URL: {request.url} | Metodo: {request.method} | AJAX: {is_ajax} | IP: {request.remote_addr}")

    if is_ajax:
        return jsonify(success=False, error=mapping['title'], message=mapping['msg'], code=code, incident_id=incident_id), code

    template = 'errors/404.html' if code == 404 else 'errors/unified_error.html'
    try:
        # Usar Get para evitar KeyError si la sesión está dañada o vacía
        user_role = session.get('user_role') if session else None
        return render_template(
            template, 
            code=code, 
            title=mapping['title'], 
            message=mapping['msg'], 
            incident_id=incident_id, 
            is_admin=(user_role == 'admin'), 
            now=datetime.now() # Cambio a now para evitar conflictos con el nombre del módulo
        ), code
    except Exception as render_err:
        logging.error(f"CRITICAL: Error rendering error template: {render_err}")
        # Fallback ultra-seguro sin plantillas
        return f"<html><body style='background:#0f172a;color:white;font-family:sans-serif;padding:50px;text-align:center;'><h1>Error {code}</h1><p>{mapping['msg']}</p><p style='opacity:0.5'>Incident ID: {incident_id or 'N/A'}</p></body></html>", code

# --- GLOBAL SELF-HEALING (Fase 102) ---
_FISCAL_TABLES_LOADED = False

@app.before_request
def ensure_db_readiness():
    global _FISCAL_TABLES_LOADED
    if not _FISCAL_TABLES_LOADED and not request.path.startswith('/static'):
        try:
            from ln_engine.routes.produccion.facturacion import ensure_fiscal_tables
            from ln_agent.database.connection import DBContext
            with DBContext() as conn:
                cursor = conn.cursor(dictionary=True, buffered=True)
                ensure_fiscal_tables(cursor, conn)
                _FISCAL_TABLES_LOADED = True
                logging.info("[SELF-HEALING] Fiscal/Production tables verified successfully.")
        except Exception as e:
            logging.error(f"[SELF-HEALING] Failed to initialize tables: {e}")

# --- INTERCEPTORES DE REDIRECCIÓN ---

@app.before_request
def redirect_intercepts():
    from ln_engine.services.security.engine import security_engine
    if not getattr(security_engine, '_initialized', False) and not os.environ.get('SHE_DISABLED') == 'true':
        security_engine.initialize()

    path = request.path
    if path.startswith('/static') or path == '/favicon.ico': return None

    always_safe = (path.startswith('/login') or path.startswith('/logout') or path.startswith('/api/debug-session') or path.startswith('/api/network/heartbeat') or path.startswith('/api/v1/agent/heartbeat') or path == '/system-repair' or path == '/system-lock' or path.startswith('/infra') or path.startswith('/admin/infra'))
    
    if not always_safe and not security_engine.verify_integrity():
        from ln_engine.services.security.taunts import dynamic_taunt
        session['lock_msg'] = dynamic_taunt(ip=request.remote_addr)
        return redirect(url_for('system_lock'))

    if app.config.get('REPAIR_MODE', False) and not always_safe:
        return redirect('/system-repair')

    if check_first_run() and not always_safe and not path.startswith('/setup'):
        return redirect('/setup/welcome')
    
    return None

@app.route('/infra/db')
def infra_db_alias(): return redirect('/admin/infra/db')

@app.route('/api/debug-session')
def debug_session():
    return jsonify({'session_keys': list(session.keys()), 'user_id': session.get('user_id'), 'is_secure': request.is_secure, 'is_pa': _IS_PA})


@app.route('/system-repair')
def system_repair():
    error_msg = app.config.get('BOOT_ERROR')
    if not error_msg:
        error_msg = "MariaDB Offline (Verifique Servicios de Windows)"
    return render_template('mantenimiento/system_repair.html', boot_error=error_msg)

# --- DETECCIÓN DE MODO PRODUCCIÓN (Fase 101) ---
# Por defecto ACTIVO para mostrar solo módulos de producción.
_PRODUCTION_ONLY = os.environ.get('LN_PRODUCTION_ONLY', '1') == '1'

# --- REGISTRO DE BLUEPRINTS OPTIMIZADO (Fase 61) ---
import importlib
import pkgutil
import ln_engine.routes

def _auto_register_blueprints(flask_app):
    """Registra Blueprints de forma robusta compatible con PyInstaller."""
    registered = set()
    
    # 1. Carga Estática de Blueprints Críticos (Garantizados)
    static_imports = [
        ('admin.setup', 'bp'),
        ('admin.login', 'bp'),
        ('produccion.home', 'bp'),
        ('admin.diagnostics', 'bp'),
        ('admin.updates', 'bp'),
        ('admin.infraestructura', 'bp'),
        ('admin.seguridad', 'bp'),
        ('admin.empresa', 'bp'),
        ('produccion.licencia', 'bp'),
        ('produccion.configuracion', 'bp'),
        ('produccion.usuarios', 'bp'),
        ('admin.auditoria', 'bp'),
        ('api.ln_network', 'bp'),
        ('produccion.facturacion', 'bp'),
        ('produccion.caja', 'bp'),
        ('produccion.reporteventas', 'bp'),
        ('produccion.productos', 'bp'),
        ('produccion.inventario', 'bp'),
        ('produccion.proveedores', 'bp'),
        ('produccion.clientes', 'bp'),
        ('produccion.servicios', 'bp')
    ]

    for mod_path, alias in static_imports:
        # MODO PRODUCCIÓN: Solo registrar admin.setup/login y el resto de la carpeta produccion.*
        if _PRODUCTION_ONLY:
            is_essential_admin = mod_path in ['admin.setup', 'admin.login', 'api.ln_network', 'admin.infraestructura', 'admin.empresa']
            is_production_mod = mod_path.startswith('produccion.')
            if not (is_essential_admin or is_production_mod):
                logging.info(f"[PROD-ONLY] Saltando registro de blueprint técnico: {mod_path}")
                continue

        try:
            full_path = f"ln_engine.routes.{mod_path}"
            module = importlib.import_module(full_path)
            # Intentar obtener por el alias sugerido, luego por 'bp' estándar
            bp = getattr(module, alias, getattr(module, 'bp', None))
            if bp and bp.name not in flask_app.blueprints:
                flask_app.register_blueprint(bp)
                registered.add(bp.name)
        except Exception as e:
            logging.error(f"Error registrando blueprint {mod_path}: {e}")

    # 2. Descubrimiento Automático (Legacy/Opcional)
    # ... (Discovery logic follows)

    # 2. Descubrimiento Dinámico mediante pkgutil (Compatible con Frozen/Zip/Pyz)
    def walk_routes(package):
        for loader, module_name, is_pkg in pkgutil.walk_packages(package.__path__, package.__name__ + "."):
            if not is_pkg:
                try:
                    # MODO PRODUCCIÓN: Solo permitir descubrimiento en paquetes permitidos
                    if _PRODUCTION_ONLY:
                        # Extraer el sub-paquete (ej: ln_engine.routes.admin.login -> admin)
                        parts = module_name.split('.')
                        if len(parts) >= 4:
                            sub_pkg = parts[3]
                            allowed_sub_pkgs = ['produccion', 'api', 'setup', 'auth']
                            # Permitir login, setup e infraestructura explícitamente si están en admin
                            is_essential = any(x in module_name for x in ['login', 'setup', 'diagnostics', 'updates', 'infraestructura', 'empresa'])
                            if sub_pkg not in allowed_sub_pkgs and not is_essential:
                                continue

                    module = importlib.import_module(module_name)
                    bp = getattr(module, 'bp', None)
                    if bp and bp.name not in flask_app.blueprints:
                        flask_app.register_blueprint(bp)
                        registered.add(bp.name)
                except Exception as e:
                    # Silencioso para módulos que no son Blueprints
                    continue
            elif is_pkg:
                try:
                    pkg_module = importlib.import_module(module_name)
                    walk_routes(pkg_module)
                except: continue

    try:
        walk_routes(ln_engine.routes)
        logging.info(f"[ENGINE] {len(registered)} Blueprints registrados (Static + Discovery).")
    except Exception as e:
        logging.error(f"[ENGINE] Error en descubrimiento dinámico: {e}")

try: _auto_register_blueprints(app)
except Exception as e: logging.critical(f"Boot critical failure: {e}")

@app.route('/system-lock')
def system_lock(): return render_template('system_lock.html')

# --- HEARTBEAT SYSTEM ---
_last_heartbeat = time.time()
@app.route('/api/v1/system/heartbeat', methods=['POST'])
def system_heartbeat():
    global _last_heartbeat; _last_heartbeat = time.time()
    return jsonify(success=True)

def _shutdown_monitor():
    global _last_heartbeat; _last_heartbeat = time.time(); time.sleep(180)
    while True:
        time.sleep(10)
        if time.time() - _last_heartbeat > 90 and not _IS_PA:
            os.kill(os.getpid(), 15); break

if not _IS_PA and os.environ.get('WERKZEUG_RUN_MAIN') != 'true' and not getattr(sys, 'frozen', False):
    # Solo en desarrollo, el monitor de apagado puede ser molesto
    import threading; threading.Thread(target=_shutdown_monitor, daemon=True).start()

# --- CONTEXT PROCESSOR OPTIMIZADO ---
_GLOBAL_CONTEXT_CACHE = {'data': None, 'expiry': 0}
CACHE_TTL = 300 # 5 minutos de fluidez total (VM Opt)

def safe_url_for(endpoint, **values):
    """Generador de URL resiliente que evita BuildError si el blueprint no está registrado."""
    try:
        return url_for(endpoint, **values)
    except:
        return "#"

@app.context_processor
def inject_global_config():
    global _GLOBAL_CONTEXT_CACHE
    from ln_engine.services.licensing.client import LicenseService
    from ln_agent.database.connection import conectar
    from ln_core.licensing.capabilities import has_capability, Capability
    from ln_core.licensing.plans import get_current_plan
    
    # 1. Validar Caché
    now_ts = time.time()
    if _GLOBAL_CONTEXT_CACHE['data'] and now_ts < _GLOBAL_CONTEXT_CACHE['expiry']:
        # Enriquecer con funciones dinámicas que dependen de la sesión
        res = _GLOBAL_CONTEXT_CACHE['data'].copy()
        user_modules = session.get('user_modules', [])
        role = (session.get('rol') or '').lower()
        res['check_perm'] = lambda m: role == 'admin' or (res.get('MODULOS', {}).get(m) and (role != 'empleado' or m in ['facturacion', 'caja']))
        return res

    repair_mode = app.config.get('REPAIR_MODE') or app.config.get('INFRA_ERROR')
    setup_mode = app.config.get('SETUP_MODE')
    
    brand_name, brand_tagline = "Next Design", "Gestión Profesional"
    modulos_dict = {m: True for m in ['home', 'facturacion', 'caja', 'clientes', 'proveedores', 'productos', 'inventario', 'usuarios', 'reporteventas', 'configuracion', 'licencia', 'gamificacion', 'calculadora']}
    license_status = {'status': 'DEBUG', 'plan': 'START', 'can_operate': True, 'msg': 'Iniciando...'}
    
    if not repair_mode and not setup_mode:
        try:
            license_status = LicenseService.get_license_status()
            conn = conectar()
            if conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nombre, mensaje_legal, modulos_activos FROM empresa LIMIT 1")
                emp = cursor.fetchone()
                if emp:
                    brand_name = emp['nombre'] or brand_name
                    brand_tagline = emp['mensaje_legal'] or brand_tagline
                    if emp.get('modulos_activos'): 
                        modulos_dict = {m.strip(): True for m in emp['modulos_activos'].split(',') if m.strip()}
                        # Forzar módulos core que siempre deben estar presentes independientemente de la base de datos
                        for core_mod in ['home', 'facturacion', 'caja']:
                            modulos_dict[core_mod] = True
                cursor.close(); conn.close()
        except: pass

    # Resiliencia Health Check (Auto-recovery: clears REPAIR_MODE when health recovers)
    # SKIP entirely during SETUP_MODE to avoid DB connection hangs on fresh installs
    if setup_mode:
        health_data = {"status": "SETUP", "label": "Configuración Inicial", "pillars": {}}
    else:
        try:
            from ln_engine.services.security.health import SystemHealthService
            health_data = SystemHealthService.get_overall_health()
            if health_data.get('status') == 'ERROR':
                app.config['REPAIR_MODE'] = True
                if not app.config.get('BOOT_ERROR'):
                    app.config['BOOT_ERROR'] = health_data.get('label', 'Falla de Infraestructura')
            else:
                # Auto-recuperación: si la DB arrancó tarde pero ahora responde, salir de REPAIR_MODE
                if app.config.get('REPAIR_MODE') and not app.config.get('_MANUAL_REPAIR'):
                    app.config['REPAIR_MODE'] = False
                    app.config.pop('BOOT_ERROR', None)
                    logging.info("[RESILIENCIA] REPAIR_MODE desactivado automáticamente - infraestructura recuperada.")
        except Exception as e:
            logging.error(f"[RESILIENCIA] Error en Health Context: {e}")
            health_data = {"status": "ERROR", "label": "Sistema en Arranque", "pillars": {}}

    try:
        from ln_engine.services.config_service import VisualConfigManager
        visual_config = VisualConfigManager.get_config()
    except:
        visual_config = {}

    res = dict(
        MODULOS=modulos_dict, 
        BRAND_NAME=brand_name, 
        BRAND_TAGLINE=brand_tagline, 
        license=license_status, 
        ln_config=visual_config, 
        CONFIG=visual_config,
        SETUP_MODE=setup_mode,
        PRODUCTION_ONLY=_PRODUCTION_ONLY,
        system_health=health_data,
        APP_VERSION=APP_VERSION,
        get_current_plan=get_current_plan,
        has_cap=lambda c: has_capability(license_status.get('plan', 'FREE'), Capability[c.upper()]) if c.upper() in Capability.__members__ else False,
        safe_url_for=safe_url_for
    )
    
    # Guardar en Caché
    _GLOBAL_CONTEXT_CACHE['data'] = res.copy()
    _GLOBAL_CONTEXT_CACHE['expiry'] = now_ts + CACHE_TTL
    
    # Agregar funciones dinámicas antes de retornar
    role = (session.get('rol') or '').lower()
    res['check_perm'] = lambda m: role == 'admin' or (res.get('MODULOS', {}).get(m) and (role != 'empleado' or m in ['facturacion', 'caja']))
    
    return res


if not _IS_PA and not os.environ.get('SHE_DISABLED') == 'true':
    try:
        from ln_engine.she.core import SHE
        if os.environ.get('WERKZEUG_RUN_MAIN') != 'true': SHE().start()
        from ln_engine.services.agent_monitor import agent_monitor
        if os.environ.get('WERKZEUG_RUN_MAIN') != 'true': agent_monitor.start()
    except: pass

try:
    from ln_engine.routes.admin.email_routes import bp as e_bp
    if 'email_dashboard' not in app.blueprints: app.register_blueprint(e_bp)
    from ln_engine.routes.admin.communication_panel import bp as c_bp
    if 'ln_communication' not in app.blueprints: app.register_blueprint(c_bp)
except: pass
