from flask import Blueprint, render_template, session, jsonify, request
from functools import wraps
from proveedores.models.queries import (
    get_proveedores_db, get_provider_profile_db, create_provider_db,
    update_provider_db, toggle_provider_status_db, registrar_pago_proveedor_db,
    crear_proveedor_rapido_db
)

bp = Blueprint('proveedores', __name__, 
               url_prefix='/proveedores', 
               template_folder='../templates', 
               static_folder='../static')

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'No autenticado'}), 401
        return f(*args, **kwargs)
    return decorated_function

def solo_admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session.get('rol') != 'admin':
            return jsonify({'success': False, 'message': 'Acceso denegado'}), 403
        return f(*args, **kwargs)
    return decorated_function

@bp.route('/')
@login_required
def proveedores_page():
    return render_template("proveedores.html")

@bp.route('/api/list', methods=['GET'])
@login_required
def api_list():
    try:
        items = get_proveedores_db()
        return jsonify({"ok": True, "items": items})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@bp.route('/api/profile/<int:id>', methods=['GET'])
@login_required
def api_profile(id):
    try:
        result = get_provider_profile_db(id)
        if not result:
            return jsonify({"ok": False, "error": "No encontrado"}), 404
        return jsonify({
            "ok": True,
            "proveedor": result['proveedor'],
            "stats": result['stats'],
            "movimientos": result['movimientos']
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@bp.route('/api/create', methods=['POST'])
@login_required
@solo_admin_required
def api_create():
    try:
        data = request.get_json()
        new_id = create_provider_db(data)
        return jsonify({"ok": True, "id": new_id})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@bp.route('/api/update/<int:id>', methods=['POST'])
@login_required
@solo_admin_required
def api_update(id):
    try:
        data = request.get_json()
        update_provider_db(id, data)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@bp.route('/api/toggle_status/<int:id>', methods=['POST'])
@login_required
@solo_admin_required
def api_toggle_status(id):
    try:
        new_activo = toggle_provider_status_db(id)
        return jsonify({"ok": True, "nuevo_activo": new_activo})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@bp.route('/api/registrar_pago', methods=['POST'])
@login_required
def api_registrar_pago():
    try:
        data = request.get_json()
        pago_id = registrar_pago_proveedor_db(data, session.get('user_id'))
        return jsonify({"ok": True, "pago_id": pago_id})
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@bp.route('/api/crear-rapido', methods=['POST'])
@login_required
def api_crear_proveedor_rapido():
    try:
        data = request.get_json()
        result = crear_proveedor_rapido_db(data)
        return jsonify({
            'success': True,
            'message': 'Procesado correctamente',
            'proveedor': result['proveedor'],
            'proveedor_id': result['proveedor']['id']
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
