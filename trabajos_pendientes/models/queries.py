from infra.infra import execute_query, execute_write

def get_all_trabajos():
    """Retorna todos los trabajos pendientes con información del cliente si existe."""
    sql = """
        SELECT t.*, c.nombre as cliente_nombre 
        FROM trabajos_pendientes t
        LEFT JOIN clientes c ON t.cliente_id = c.id
        ORDER BY 
            CASE prioridad 
                WHEN 'alta' THEN 1 
                WHEN 'normal' THEN 2 
                WHEN 'baja' THEN 3 
                ELSE 4 
            END,
            fecha_inicio DESC
    """
    return execute_query(sql)

def add_trabajo(descripcion, cliente_id=None, fecha_entrega=None, costo_estimado=0, prioridad='normal'):
    """Registra un nuevo trabajo pendiente."""
    sql = """
        INSERT INTO trabajos_pendientes (descripcion, cliente_id, fecha_entrega, costo_estimado, prioridad, estado)
        VALUES (%s, %s, %s, %s, %s, 'pendiente')
    """
    return execute_write(sql, (descripcion, cliente_id, fecha_entrega, costo_estimado, prioridad))

def update_trabajo_status(trabajo_id, nuevo_estado):
    """Actualiza el estado de un trabajo y maneja la fecha de finalización."""
    if nuevo_estado == 'terminado':
        sql = "UPDATE trabajos_pendientes SET estado = %s, fecha_finalizado = CURRENT_TIMESTAMP WHERE id = %s"
    else:
        sql = "UPDATE trabajos_pendientes SET estado = %s, fecha_finalizado = NULL WHERE id = %s"
    return execute_write(sql, (nuevo_estado, trabajo_id))

def update_trabajo(trabajo_id, descripcion, cliente_id, fecha_entrega, costo_estimado, prioridad, estado):
    """Actualiza todos los campos de un trabajo."""
    sql = """
        UPDATE trabajos_pendientes 
        SET descripcion = %s, cliente_id = %s, fecha_entrega = %s, 
            costo_estimado = %s, prioridad = %s, estado = %s
        WHERE id = %s
    """
    return execute_write(sql, (descripcion, cliente_id, fecha_entrega, costo_estimado, prioridad, estado, trabajo_id))

def delete_trabajo(trabajo_id):
    """Elimina un trabajo pendiente."""
    sql = "DELETE FROM trabajos_pendientes WHERE id = %s"
    return execute_write(sql, (trabajo_id,))
