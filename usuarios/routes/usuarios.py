import logging
from functools import wraps
from flask import Blueprint, render_template, request, jsonify, session
from datetime import datetime
from werkzeug.security import generate_password_hash
from infra.infra import execute_query
from ..models.queries_usuarios import (
    get_usuarios_stats_db, get_usuarios_lista_db, get_usuario_por_id_db,
    create_usuario_db, update_usuario_db, toggle_usuario_status_db,
    reset_usuario_password_db, log_usuario_audit_db, get_usuarios_audit_db
)

bp = Blueprint('usuarios', __name__, template_folder='../templates', static_folder='../static', static_url_path='/usuarios/static')

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            from flask import redirect, url_for
            return redirect(url_for('login.login'))
        return f(*args, **kwargs)
    return decorated

def solo_admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('rol') != 'admin':
            return jsonify({"ok": False, "error": "Acceso denegado (Solo Admin)"}), 403
        return f(*args, **kwargs)
    return decorated

@bp.route('/usuarios')
@login_required
@solo_admin_required
def usuarios():
    return render_template("usuarios.html", 
        now=datetime.now(),
        nombre_completo=session.get('nombre_completo', 'Administrador'),
        rol=session.get('rol', 'admin'),
        iniciales=session.get('iniciales', 'AD')
    )

@bp.route('/usuarios/api/stats')
@login_required
@solo_admin_required
def api_stats():
    stats = get_usuarios_stats_db()
    return jsonify({"ok": True, "stats": stats})

@bp.route('/usuarios/data')
@login_required
@solo_admin_required
def usuarios_data():
    users = get_usuarios_lista_db() or []
    return jsonify(users)

@bp.route('/usuarios', methods=['POST'])
@login_required
@solo_admin_required
def crear_usuario():
    data = request.get_json() or {}
    
    # Validaciones básicas
    if not data.get('username') or not data.get('password'):
        return jsonify({"ok": False, "error": "Username y Contraseña requeridos"}), 400
    
    # Hashing
    data['password_hash'] = generate_password_hash(data['password'])
    
    try:
        new_id = create_usuario_db(data)
        if not new_id:
            return jsonify({"ok": False, "error": "El nombre de usuario ya existe o error interno"}), 500
            
        log_usuario_audit_db(
            user_id=session.get('user_id'),
            ejecutor_nombre=session.get('nombre_completo'),
            accion="CREAR",
            descripcion=f"Usuario {data['username']} creado",
            target_id=new_id,
            target_nombre=data.get('nombre_completo')
        )
        return jsonify({"ok": True, "user_id": new_id})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@bp.route('/usuarios/<int:user_id>', methods=['GET'])
@login_required
@solo_admin_required
def obtener_usuario(user_id):
    user = get_usuario_por_id_db(user_id)
    if not user: return jsonify({"ok": False, "error": "No encontrado"}), 404
    return jsonify({"ok": True, "user": user})

@bp.route('/usuarios/<int:user_id>', methods=['PUT'])
@login_required
@solo_admin_required
def actualizar_usuario(user_id):
    data = request.get_json() or {}
    user_prev = get_usuario_por_id_db(user_id)
    if not user_prev: return jsonify({"ok": False, "error": "No encontrado"}), 404
    
    # Asegurar que no se pierdan datos si no se envían
    update_data = {
        "nombre_completo": data.get('nombre', user_prev["nombre_completo"]),
        "email": data.get('email', user_prev["email"]),
        "rol": data.get('rol', user_prev["rol"]),
        "forzar_cambio_pwd": 1 if data.get('forzar_cambio') else 0,
        "dias_libres": data.get('dias_libres', user_prev["dias_libres"])
    }
    
    success = update_usuario_db(user_id, update_data)
    if success is not None:
        log_usuario_audit_db(
            user_id=session.get('user_id'),
            ejecutor_nombre=session.get('nombre_completo'),
            accion="EDITAR",
            descripcion=f"Perfil de {user_prev['username']} actualizado",
            target_id=user_id,
            target_nombre=update_data['nombre_completo']
        )
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "Error al actualizar"}), 500

@bp.route('/usuarios/api/toggle-status/<int:user_id>', methods=['POST'])
@login_required
@solo_admin_required
def toggle_status(user_id):
    data = request.get_json() or {}
    field = data.get('field')
    user = get_usuario_por_id_db(user_id)
    if not user: return jsonify({"ok": False, "error": "No encontrado"}), 404
    
    new_val = toggle_usuario_status_db(user_id, field)
    if new_val is not None:
        log_usuario_audit_db(
            user_id=session.get('user_id'),
            ejecutor_nombre=session.get('nombre_completo'),
            accion="ESTADO",
            descripcion=f"Campo {field} de {user['username']} cambiado a {new_val}",
            target_id=user_id,
            target_nombre=user['nombre_completo']
        )
        return jsonify({"ok": True, "nuevo_valor": int(new_val)})
    return jsonify({"ok": False, "error": "Campo inválido"}), 400

@bp.route('/usuarios/api/reset-password/<int:user_id>', methods=['POST'])
@login_required
@solo_admin_required
def reset_password(user_id):
    data = request.get_json() or {}
    new_pass = data.get('password')
    if not new_pass: return jsonify({"ok": False, "error": "Nueva contraseña requerida"}), 400
    
    user = get_usuario_por_id_db(user_id)
    if not user: return jsonify({"ok": False, "error": "No encontrado"}), 404
    
    pwd_hash = generate_password_hash(new_pass)
    reset_usuario_password_db(user_id, pwd_hash)
    
    log_usuario_audit_db(
        user_id=session.get('user_id'),
        ejecutor_nombre=session.get('nombre_completo'),
        accion="SEGURIDAD",
        descripcion=f"Reseteo de contraseña para {user['username']}",
        target_id=user_id,
        target_nombre=user['nombre_completo']
    )
    return jsonify({"ok": True})

@bp.route('/usuarios/api/auditoria/<int:user_id>')
@login_required
@solo_admin_required
def api_auditoria(user_id):
    logs = get_usuarios_audit_db(user_id)
    # Formatear fecha para JSON
    for l in logs:
        if isinstance(l.get('fecha'), datetime):
            l['fecha'] = l['fecha'].strftime('%d/%m/%Y %H:%M')
    return jsonify(logs)

@bp.route('/usuarios/api/security-log')
@login_required
@solo_admin_required
def api_security_log():
    logs = get_usuarios_audit_db()
    for l in logs:
        if isinstance(l.get('fecha'), datetime):
            l['fecha'] = l['fecha'].strftime('%d/%m/%Y %H:%M')
    return jsonify(logs)
