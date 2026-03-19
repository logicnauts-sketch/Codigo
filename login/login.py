"""
Next Design - Módulo de Login (Standalone)
==========================================
Versión simplificada sin dependencias de ln_engine/ln_agent.
"""

from flask import Blueprint, render_template, request, session, flash, redirect, url_for, jsonify
from werkzeug.security import check_password_hash
from datetime import datetime
import logging
from infra.infra import execute_query, execute_write

bp = Blueprint('login', __name__, template_folder='templates', static_folder='static', static_url_path='/login/static')

@bp.route('/login', methods=['GET', 'POST'])
def login():
    """Página de login con autenticación real."""
    if request.method == 'POST':
        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        
        if is_ajax:
            data = request.get_json()
            username = data.get('username', '').strip()
            password = data.get('password', '').strip()
        else:
            username = request.form.get('username', '').strip()
            password = request.form.get('password', '').strip()

        # Buscar usuario en la base de datos
        sql = "SELECT id, nombre_completo, username, password_hash, rol, activo, bloqueado FROM usuarios WHERE username = %s"
        user = execute_query(sql, (username,), fetch_one=True)

        if user:
            # Verificar si está activo y no bloqueado
            if not user.get('activo'):
                error_msg = 'Su cuenta ha sido desactivada. Contacte al administrador.'
                return jsonify(success=False, error=error_msg), 401 if is_ajax else flash(error_msg, 'danger')
            
            if user.get('bloqueado'):
                error_msg = 'Su cuenta está bloqueada por seguridad.'
                return jsonify(success=False, error=error_msg), 401 if is_ajax else flash(error_msg, 'danger')

            # Verificar contraseña
            if check_password_hash(user['password_hash'], password):
                # Ã‰xito
                session.permanent = True
                
                # Obtener iniciales
                nombres = user['nombre_completo'].split()
                iniciales = (nombres[0][0] if len(nombres) > 0 else "") + (nombres[1][0] if len(nombres) > 1 else "")
                iniciales = iniciales.upper() or "U"
                
                session.update({
                    'user_id': user['id'],
                    'nombre_completo': user['nombre_completo'],
                    'rol': user['rol'],
                    'iniciales': iniciales,
                    'last_login': datetime.now().isoformat()
                })
                session.modified = True
                
                # Actualizar último acceso en DB
                execute_write("UPDATE usuarios SET ultimo_acceso = %s WHERE id = %s", (datetime.now(), user['id']))
                
                logging.info(f"[LOGIN] Acceso exitoso: {username}")
                
                if is_ajax:
                    return jsonify(success=True, rol=user['rol'])
                return redirect(url_for('home.home'))

        # Fallido
        error_msg = 'Credenciales inválidas'
        if is_ajax:
            return jsonify(success=False, error=error_msg), 401
        
        flash(error_msg, 'danger')

    return render_template('login.html')

@bp.route('/logout')
def logout():
    """Cierra la sesión del usuario."""
    session.clear()
    flash('Sesión cerrada correctamente', 'success')
    return redirect(url_for('login.login'))

