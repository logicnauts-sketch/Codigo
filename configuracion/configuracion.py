from flask import Blueprint, render_template, request, jsonify, session, current_app
from functools import wraps
import json
from datetime import datetime

import os
bp = Blueprint('configuracion', __name__, 
               url_prefix='/configuracion',
               template_folder=os.path.dirname(os.path.abspath(__file__)),
               static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static'),
               static_url_path='/configuracion/static')

# --- MOCK DATA ---
MOCK_EMPRESA = {
    'nombre': 'Next Design',
    'email': 'contacto@Next Design.com',
    'telefono': '809-555-0199',
    'direccion': 'Jarabacoa, República Dominicana',
    'rnc': '131-00000-1',
    'moneda': 'DOP',
    'formato_fecha': 'DD/MM/YYYY',
    'zona_horaria': 'America/Santo_Domingo',
    'tipo_negocio': 'minorista'
}

MOCK_CONFIG = {
    'uso_multimoneda': '1',
    'tasa_dolar': '59.50',
    'global_print_format': 'ticket',
    'tema_color': '#0ea5e9',
    'tema_color_secundario': '#64748b',
    'logo_path': '/static/images/logo.png',
    
    # Facturación Parameters
    'tipo_comprobante_b01': '1',
    'tipo_comprobante_b02': '1',
    'tipo_comprobante_b15': '0',
    'secuencia_b01': '000001000',
    'secuencia_b02': '000005500',
    'ncf_vencimiento': '2027-12-31',
    'impresion_automatica': '1',
    'mostrar_vendedor_ticket': '1',
    'permitir_descuento_global': '1',
    'limite_descuento': '15',
    'mensaje_ticket': 'Â¡Gracias por preferir Next Design!',
    
    # Inventario Parameters
    'alerta_stock_bajo': '1',
    'nivel_stock_bajo_global': '5',
    'permitir_venta_sin_stock': '0',
    'calculo_costo': 'promedio',
    'dias_vencimiento_alerta': '30',
    
    # Caja Parameters
    'requerir_apertura_caja': '1',
    'requerir_cierre_ciego': '1',
    'monto_apertura_default': '2000',
    'permitir_retiro_sin_venta': '0',
    
    # Seguridad Parameters
    'password_min_length': '8',
    'requerir_alfanumerico': '1',
    'sesion_timeout': '30',
    'bloqueo_intentos': '3',
    'doble_factor_admin': '0'
}

MOCK_LICENSE = {
    'plan': 'PREMIUM',
    'status': 'ACTIVE',
    'can_operate': True,
    'expires_at': '2026-12-31',
    'users_limit': 'ilimitado',
    'branches_limit': 1,
    'features': ['facturacion_basica', 'inventario_avanzado', 'reportes_personalizados', 'multi_caja']
}

MOCK_MODULES_STATE = {
    'facturacion': True,
    'inventario': True,
    'clientes': True,
    'proveedores': True,
    'caja': True,
    'reportes': True,
    'contabilidad': False,
    'recursos_humanos': False
}

MOCK_TOGGLES = [
    {'name': 'new_dashboard', 'description': 'Habilitar nuevo panel de inicio', 'enabled': True},
    {'name': 'beta_reports', 'description': 'Reportes avanzados en fase beta', 'enabled': False},
    {'name': 'sync_cloud', 'description': 'Sincronización en la nube en tiempo real', 'enabled': True},
    {'name': 'api_access', 'description': 'Acceso API para integraciones', 'enabled': False}
]

# --- DECORATORS MOCK ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            session['user_id'] = 1
            session['rol'] = 'admin'
            session['nombre_completo'] = 'Admin Demo'
            session['iniciales'] = 'AD'
        return f(*args, **kwargs)
    return decorated_function

def solo_admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session.get('rol') != 'admin':
            return jsonify({'ok': False, 'error': 'Acceso denegado (requiere admin)'}), 403
        return f(*args, **kwargs)
    return decorated_function

# --- HELPER ---
def _get_mock_context():
    return {
        'empresa': MOCK_EMPRESA,
        'config': MOCK_CONFIG,
        'license': MOCK_LICENSE,
        'modulos_estado': MOCK_MODULES_STATE,
        'toggles': MOCK_TOGGLES,
        'sesion': {
            'nombre_completo': session.get('nombre_completo', 'Admin Demo'),
            'rol': session.get('rol', 'admin'),
            'iniciales': session.get('iniciales', 'AD')
        }
    }

# --- ROUTES ---
@bp.route('/')
@bp.route('/general')
@login_required
def index():
    ctx = _get_mock_context()
    return render_template('configuracion_ui.html', active_panel='general', panel_title='Formatos y Ubicación', **ctx)

@bp.route('/licencia')
@login_required
def panel_license():
    ctx = _get_mock_context()
    return render_template('configuracion_ui.html', active_panel='license', panel_title='Suscripción y Licencia', **ctx)

@bp.route('/facturacion')
@login_required
def panel_facturacion():
    ctx = _get_mock_context()
    return render_template('configuracion_ui.html', active_panel='facturacion', panel_title='Reglas de Facturación', **ctx)

@bp.route('/caja')
@login_required
def panel_caja():
    ctx = _get_mock_context()
    return render_template('configuracion_ui.html', active_panel='caja', panel_title='Control de Caja', **ctx)

@bp.route('/inventario')
@login_required
def panel_inventario():
    ctx = _get_mock_context()
    return render_template('configuracion_ui.html', active_panel='inventario', panel_title='Gestión de Inventario', **ctx)

@bp.route('/modulos')
@login_required
def panel_modulos():
    ctx = _get_mock_context()
    return render_template('configuracion_ui.html', active_panel='modulos', panel_title='Gestión de Módulos', **ctx)

@bp.route('/seguridad')
@login_required
def panel_seguridad():
    ctx = _get_mock_context()
    return render_template('configuracion_ui.html', active_panel='seguridad', panel_title='Seguridad y Accesos', **ctx)

@bp.route('/interfaz')
@login_required
def panel_ui():
    ctx = _get_mock_context()
    return render_template('configuracion_ui.html', active_panel='ui', panel_title='Interfaz y Apariencia', **ctx)

# --- API ENDPOINTS (MOCK) ---
@bp.route('/api/guardar', methods=['POST'])
@login_required
@solo_admin_required
def api_guardar_configuracion():
    """Mock endpoint to save configuration data"""
    try:
        data = request.get_json()
        grupo = data.get('grupo', 'general')
        valores = data.get('valores', {})
        
        # Simular guardado basado en el grupo
        if grupo == 'general':
            MOCK_EMPRESA.update({k: v for k, v in valores.items() if k in MOCK_EMPRESA})
            MOCK_CONFIG.update({k: v for k, v in valores.items() if k in MOCK_CONFIG})
        else:
            MOCK_CONFIG.update(valores)
            
        print(f"[MOCK CONFIG] Guardado grupo {grupo}: {valores}")
        
        return jsonify({
            'ok': True, 
            'msg': 'Configuración guardada exitosamente.',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

@bp.route('/api/toggle-modulo', methods=['POST'])
@login_required
@solo_admin_required
def api_toggle_modulo():
    """Mock endpoint to toggle a module status"""
    try:
        data = request.get_json()
        modulo = data.get('modulo')
        estado = data.get('estado')
        
        if modulo in MOCK_MODULES_STATE:
            MOCK_MODULES_STATE[modulo] = bool(estado)
            
            return jsonify({
                'ok': True, 
                'msg': f'El módulo {modulo} ha sido {"activado" if estado else "desactivado"}.'
            })
        return jsonify({'ok': False, 'error': 'Módulo no encontrado'}), 404
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

@bp.route('/api/verificar-licencia', methods=['POST'])
@login_required
def api_verificar_licencia():
    """Mock endpoint to verify a new license token"""
    try:
        data = request.get_json()
        token = data.get('token', '')
        
        if not token or len(token) < 10:
            return jsonify({'ok': False, 'error': 'Token de licencia inválido o corrupto.'})
            
        # Simular actualización de licencia
        MOCK_LICENSE['plan'] = 'ENTERPRISE'
        MOCK_LICENSE['expires_at'] = '2028-12-31'
        MOCK_LICENSE['users_limit'] = 'ilimitado'
        
        return jsonify({
            'ok': True, 
            'msg': 'Licencia validada e instalada correctamente. (Plan Enterprise Activado)'
        })
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

@bp.route('/datos')
@login_required
def get_config_datos():
    """Retorna datos de configuración general."""
    return jsonify({
        "success": True,
        "params": MOCK_CONFIG,
        "empresa": MOCK_EMPRESA,
        "fact_itbis_tasa": 18,
        "moneda_simbolo": "RD$",
        "moneda_nombre": "Pesos Dominicanos"
    })

@bp.route('/unidades/listar')
@login_required
def get_unidades_listar():
    """Retorna lista de unidades de medida."""
    return [
        {"id": 1, "nombre": "Unidad", "abreviatura": "Und"},
        {"id": 2, "nombre": "Libra", "abreviatura": "Lb"},
        {"id": 3, "nombre": "Kilogramo", "abreviatura": "Kg"},
        {"id": 4, "nombre": "Caja", "abreviatura": "Cj"}
    ]

