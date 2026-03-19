from infra.infra import execute_query, execute_write
from datetime import datetime

def get_usuarios_stats_db():
    """Calcula estadísticas rápidas de usuarios."""
    sql = """
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END) as activos,
            SUM(CASE WHEN bloqueado = 1 THEN 1 ELSE 0 END) as bloqueados,
            SUM(CASE WHEN DATE(ultimo_acceso) = CURRENT_DATE THEN 1 ELSE 0 END) as accesos_hoy
        FROM usuarios
    """
    res = execute_query(sql, fetch_one=True)
    return res or {"total": 0, "activos": 0, "bloqueados": 0, "accesos_hoy": 0}

def get_usuarios_lista_db():
    """Obtiene todos los usuarios para el listado."""
    sql = "SELECT id, nombre_completo, username, email, rol, activo, bloqueado, forzar_cambio_pwd, ultimo_acceso, dias_libres FROM usuarios ORDER BY id ASC"
    return execute_query(sql)

def get_usuario_por_id_db(user_id):
    """Obtiene un usuario específico."""
    sql = "SELECT * FROM usuarios WHERE id = %s"
    return execute_query(sql, (user_id,), fetch_one=True)

def create_usuario_db(data):
    """Crea un nuevo usuario."""
    sql = """
        INSERT INTO usuarios (nombre_completo, username, email, password_hash, rol, forzar_cambio_pwd, dias_libres)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    params = (
        data.get('nombre_completo'),
        data.get('username'),
        data.get('email'),
        data.get('password_hash'),
        data.get('rol', 'empleado'),
        data.get('forzar_cambio_pwd', 1),
        data.get('dias_libres', '')
    )
    return execute_write(sql, params)

def update_usuario_db(user_id, data):
    """Actualiza datos de un usuario."""
    sql = """
        UPDATE usuarios 
        SET nombre_completo = %s, email = %s, rol = %s, forzar_cambio_pwd = %s, dias_libres = %s
        WHERE id = %s
    """
    params = (
        data.get('nombre_completo'),
        data.get('email'),
        data.get('rol'),
        data.get('forzar_cambio_pwd'),
        data.get('dias_libres'),
        user_id
    )
    return execute_write(sql, params)

def toggle_usuario_status_db(user_id, field):
    """Cambia el estado de activo o bloqueado."""
    if field not in ['activo', 'bloqueado']:
        return None
        
    sql = f"UPDATE usuarios SET {field} = NOT {field} WHERE id = %s"
    execute_write(sql, (user_id,))
    
    # Retornar el nuevo valor
    new_data = get_usuario_por_id_db(user_id)
    return int(new_data[field])

def reset_usuario_password_db(user_id, new_hash):
    """Resetea la contraseña de un usuario."""
    sql = "UPDATE usuarios SET password_hash = %s, forzar_cambio_pwd = 1, bloqueado = 0 WHERE id = %s"
    return execute_write(sql, (new_hash, user_id))

def log_usuario_audit_db(user_id, accion, descripcion, target_id=None, target_nombre=None, ejecutor_nombre=None):
    """Registra un evento en la bitácora de auditoría."""
    sql = """
        INSERT INTO usuarios_auditoria (accion, descripcion, ejecutor_id, ejecutor_nombre, target_id, target_nombre, tabla, registro_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    params = (
        accion,
        descripcion,
        user_id,
        ejecutor_nombre,
        target_id,
        target_nombre,
        'usuarios',
        target_id or user_id
    )
    return execute_write(sql, params)

def get_usuarios_audit_db(user_id=None):
    """Obtiene logs de auditoría (global o por usuario)."""
    if user_id:
        sql = "SELECT * FROM usuarios_auditoria WHERE (ejecutor_id = %s OR target_id = %s) AND tabla = 'usuarios' ORDER BY fecha DESC"
        return execute_query(sql, (user_id, user_id))
    else:
        sql = "SELECT * FROM usuarios_auditoria ORDER BY fecha DESC LIMIT 500"
        return execute_query(sql)
