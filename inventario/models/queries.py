from infra.infra import execute_query, execute_write

def get_inventory_stats():
    """Retorna estadísticas reales del inventario."""
    sql = """
        SELECT 
            SUM(stock * precio) as valor_inventario,
            SUM(stock * costo) as valor_costo,
            COUNT(*) as total_productos,
            SUM(CASE WHEN stock <= stock_minimo THEN 1 ELSE 0 END) as stock_bajo
        FROM productos
        WHERE estado = 'Activo'
    """
    stats = execute_query(sql, fetch_one=True)
    
    # Movimientos del mes actual
    sql_mov = """
        SELECT COUNT(*) as mov_mes 
        FROM inventario_movimientos 
        WHERE MONTH(fecha) = MONTH(CURRENT_DATE()) 
          AND YEAR(fecha) = YEAR(CURRENT_DATE())
    """
    mov = execute_query(sql_mov, fetch_one=True)
    
    if stats:
        stats['movimientos_mes'] = mov['mov_mes'] if mov else 0
        return stats
    return None

def get_inventario_lista():
    """Retorna la lista de productos con su stock actual."""
    sql = """
        SELECT id, codigo, nombre, categoria, precio, costo, stock, stock_minimo as stock_min
        FROM productos
        WHERE estado = 'Activo'
        ORDER BY nombre ASC
    """
    res = execute_query(sql)
    return res if res is not None else []

def get_historial_movimientos(limit=50):
    """Retorna los últimos movimientos registrados."""
    sql = f"""
        SELECT m.id, DATE_FORMAT(m.fecha, '%%d/%%m/%%Y %%H:%%i') as fecha, 
               m.tipo, p.nombre as producto, p.codigo,
               m.cantidad, m.responsable, m.motivo
        FROM inventario_movimientos m
        JOIN productos p ON m.producto_id = p.id
        ORDER BY m.fecha DESC
        LIMIT {int(limit)}
    """
    res = execute_query(sql)
    return res if res is not None else []

def registrar_movimiento_db(p_id, tipo, cantidad, responsable, motivo):
    """Registra un movimiento y actualiza el stock del producto."""
    # 1. Registrar el movimiento
    sql_mov = """
        INSERT INTO inventario_movimientos (tipo, producto_id, cantidad, responsable, motivo)
        VALUES (%s, %s, %s, %s, %s)
    """
    execute_write(sql_mov, (tipo, p_id, cantidad, responsable, motivo))
    
    # 2. Actualizar el stock
    # Ajustar signo según tipo
    factor = 1
    if tipo.lower() in ['salida', 'merma', 'venta']:
        factor = -1
    
    sql_stock = "UPDATE productos SET stock = stock + %s WHERE id = %s"
    execute_write(sql_stock, (cantidad * factor, p_id))
    
    # Retornar el nuevo stock
    res = execute_query("SELECT stock FROM productos WHERE id = %s", (p_id,), fetch_one=True)
    return res['stock'] if res else 0

# --- AUDIT / STOCK COUNTING LOGIC ---

def get_active_audit():
    """Busca si hay una sesión de conteo activa."""
    sql = "SELECT id, fecha_inicio FROM inventario_auditorias WHERE estado = 'en_progreso' LIMIT 1"
    return execute_query(sql, fetch_one=True)

def iniciar_auditoria_db(usuario_id=None):
    """Inicia una nueva sesión de conteo y congela el stock actual."""
    # 1. Crear cabecera
    sql_h = "INSERT INTO inventario_auditorias (usuario_id, estado) VALUES (%s, 'en_progreso')"
    audit_id = execute_write(sql_h, (usuario_id,))
    
    if not audit_id:
        raise Exception("No se pudo iniciar la sesión de conteo.")

    # 2. Capturar snapshot de stock actual de todos los productos activos
    sql_d = """
        INSERT INTO inventario_auditoria_detalles (auditoria_id, producto_id, stock_teorico, stock_fisico)
        SELECT %s, id, stock, stock FROM productos WHERE estado = 'Activo'
    """
    execute_write(sql_d, (audit_id,))
    return audit_id

def get_audit_session_data(audit_id):
    """Retorna los productos y sus conteos para la sesión dada."""
    sql = """
        SELECT d.id as detail_id, p.codigo, p.nombre, d.stock_teorico, d.stock_fisico
        FROM inventario_auditoria_detalles d
        JOIN productos p ON d.producto_id = p.id
        WHERE d.auditoria_id = %s
        ORDER BY p.nombre ASC
    """
    return execute_query(sql, (audit_id,))

def actualizar_conteo_db(detail_id, cantidad):
    """Actualiza el conteo físico de un producto específico."""
    sql = "UPDATE inventario_auditoria_detalles SET stock_fisico = %s WHERE id = %s"
    return execute_write(sql, (cantidad, detail_id))

def finalizar_auditoria_db(audit_id, responsable="Sistema"):
    """Aplica los ajustes de stock y cierra la sesión."""
    # 1. Obtener discrepancias
    detalles = execute_query("""
        SELECT producto_id, stock_teorico, stock_fisico 
        FROM inventario_auditoria_detalles 
        WHERE auditoria_id = %s AND stock_teorico <> stock_fisico
    """, (audit_id,))

    # 2. Aplicar ajustes y registrar movimientos
    for item in detalles:
        diff = item['stock_fisico'] - item['stock_teorico']
        tipo = 'Entrada' if diff > 0 else 'Salida'
        # Usar la función existente para ajustar stock y grabar historial
        registrar_movimiento_db(
            item['producto_id'], 
            tipo, 
            abs(diff), 
            responsable, 
            f"Ajuste por Conteo de Mercancía (Sesión #{audit_id})"
        )

    # 3. Cerrar sesión
    sql_close = "UPDATE inventario_auditorias SET estado = 'finalizada', fecha_fin = CURRENT_TIMESTAMP WHERE id = %s"
    execute_write(sql_close, (audit_id,))
    return True

def cancelar_auditoria_db(audit_id):
    """Cancela la sesión sin aplicar cambios."""
    sql = "UPDATE inventario_auditorias SET estado = 'cancelada', fecha_fin = CURRENT_TIMESTAMP WHERE id = %s"
    return execute_write(sql, (audit_id,))
