from infra.infra import execute_query, execute_write
from decimal import Decimal

def get_proveedores_db():
    """Obtiene la lista de proveedores con su saldo pendiente."""
    query = """
        SELECT p.id, p.nombre, p.rnc_cedula, p.telefono, p.email, p.direccion,
               p.estado as estado_lbl, p.tipo_comprobante as tipo, p.categoria,
               (CASE WHEN p.estado = 'Activo' THEN 1 ELSE 0 END) as activo,
               (SELECT COALESCE(SUM(monto), 0) 
                FROM cuentas_por_pagar 
                WHERE proveedor_id = p.id AND estado = 'Pendiente') as saldo_pendiente
        FROM proveedores p
        ORDER BY p.nombre ASC
    """
    return execute_query(query)

def get_provider_profile_db(provider_id):
    """Obtiene datos detallados de un proveedor para su perfil."""
    # 1. Datos Generales
    prov = execute_query("""
        SELECT id, nombre, rnc_cedula, telefono, email, direccion,
               estado,
               (CASE WHEN estado = 'Activo' THEN 1 ELSE 0 END) as activo,
               tipo_comprobante as tipo, categoria
        FROM proveedores WHERE id=%s
    """, (provider_id,), fetch_one=True)
    
    if not prov:
        return None

    # 2. Resumen Financiero
    stats = execute_query("""
        SELECT 
            COALESCE(SUM(monto), 0) as total_compras,
            COALESCE(SUM(CASE WHEN estado='Pendiente' THEN monto ELSE 0 END), 0) as saldo_pendiente
        FROM cuentas_por_pagar
        WHERE proveedor_id = %s
    """, (provider_id,), fetch_one=True)
    
    total_pagado_row = execute_query("SELECT COALESCE(SUM(monto), 0) as total_pagado FROM pagos_proveedores WHERE proveedor_id=%s", (provider_id,), fetch_one=True)
    total_pagado = total_pagado_row["total_pagado"] if total_pagado_row else 0
    
    # 3. Movimientos Recientes
    movimientos = execute_query("""
        (SELECT 'factura' as tipo, id, numero_factura as ref, monto, fecha_emision as fecha, estado 
         FROM cuentas_por_pagar WHERE proveedor_id = %s)
        UNION ALL
        (SELECT 'pago' as tipo, id, referencia as ref, monto, fecha, metodo as estado 
         FROM pagos_proveedores WHERE proveedor_id = %s)
        ORDER BY fecha DESC LIMIT 20
    """, (provider_id, provider_id))
    
    return {
        "proveedor": prov,
        "stats": {
            "total_compras": float(stats["total_compras"] or 0),
            "total_pagado": float(total_pagado),
            "saldo_pendiente": float(stats["saldo_pendiente"] or 0)
        },
        "movimientos": movimientos
    }

def create_provider_db(data):
    """Crea un nuevo proveedor."""
    sql = """
        INSERT INTO proveedores (nombre, rnc_cedula, telefono, email, direccion, estado, tipo_comprobante, categoria, observations)
        VALUES (%s, %s, %s, %s, %s, 'Activo', %s, %s, %s)
    """
    return execute_write(sql, (
        data.get('nombre'), data.get('rnc'), data.get('tel'), 
        data.get('email'), data.get('dir'), data.get('tipo', 'informal'),
        data.get('categoria'), data.get('obs')
    ))

def update_provider_db(provider_id, data):
    """Actualiza un proveedor existente."""
    sql = """
        UPDATE proveedores 
        SET nombre=%s, rnc_cedula=%s, telefono=%s, email=%s, direccion=%s, 
            tipo_comprobante=%s, categoria=%s, observations=%s
        WHERE id=%s
    """
    return execute_write(sql, (
        data.get('nombre'), data.get('rnc'), data.get('tel'), 
        data.get('email'), data.get('dir'), data.get('tipo'),
        data.get('categoria'), data.get('obs'), provider_id
    ))

def toggle_provider_status_db(provider_id):
    """Cambia el estado de un proveedor (Activo/Inactivo)."""
    prov = execute_query("SELECT estado FROM proveedores WHERE id = %s", (provider_id,), fetch_one=True)
    if not prov:
        return None
    
    new_status = 'Inactivo' if prov['estado'] == 'Activo' else 'Activo'
    execute_write("UPDATE proveedores SET estado = %s WHERE id = %s", (new_status, provider_id))
    return 1 if new_status == 'Activo' else 0

def registrar_pago_proveedor_db(data, user_id):
    """Registra un pago a un proveedor."""
    prov_id = data.get('proveedor_id')
    monto = float(data.get('monto', 0))
    metodo = data.get('metodo', 'efectivo')
    cuenta_id = data.get('cuenta_id')
    referencia = data.get('referencia', '')

    # 1. Validar Caja si es efectivo
    turno = execute_query("SELECT id FROM caja_estado WHERE estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1", fetch_one=True)
    turno_id = turno["id"] if turno else None
    
    if metodo == 'efectivo' and not turno_id:
        raise ValueError("No hay turno de caja abierto.")

    # 2. Registrar Pago
    sql_pago = "INSERT INTO pagos_proveedores (proveedor_id, cuenta_id, monto, metodo, referencia, usuario_id, fecha) VALUES (%s, %s, %s, %s, %s, %s, NOW())"
    pago_id = execute_write(sql_pago, (prov_id, cuenta_id, monto, metodo, referencia, user_id))
    
    # 3. Movimiento Caja
    mov_id = None
    if turno_id and metodo == 'efectivo':
        p_row = execute_query("SELECT nombre FROM proveedores WHERE id=%s", (prov_id,), fetch_one=True)
        p_nom = p_row['nombre'] if p_row else "Proveedor"
        desc_mov = f"Pago a Proveedor: {p_nom} (Ref: {referencia})"
        sql_mov = "INSERT INTO movimientos_caja (turno_id, tipo, metodo_pago, descripcion, monto, fecha) VALUES (%s, 'gasto', %s, %s, %s, NOW())"
        mov_id = execute_write(sql_mov, (turno_id, metodo, desc_mov, monto))
        execute_write("UPDATE pagos_proveedores SET movimiento_caja_id=%s WHERE id=%s", (mov_id, pago_id))

    # 4. Actualizar factura si aplica
    if cuenta_id:
        execute_write("UPDATE cuentas_por_pagar SET estado='Pagado', movimiento_id=%s WHERE id=%s", (mov_id, cuenta_id))

    return pago_id

def crear_proveedor_rapido_db(data):
    """Crea un proveedor rápidamente desde otros módulos."""
    nombre = (data.get('nombre') or '').strip()
    rnc = (data.get('rnc') or '').strip()
    telefono = (data.get('telefono') or '').strip()
    
    # Limpiar RNC
    rnc_clean = ''.join(filter(str.isdigit, rnc))
    
    # Verificar existencia
    existing = execute_query(
        "SELECT id, nombre, rnc_cedula FROM proveedores WHERE rnc_cedula = %s AND estado = 'Activo'",
        (rnc_clean,), fetch_one=True
    )
    if existing:
        return {'existing': True, 'proveedor': existing}
    
    # Crear
    new_id = execute_write("""
        INSERT INTO proveedores (nombre, rnc_cedula, telefono, estado, created_at)
        VALUES (%s, %s, %s, 'Activo', NOW())
    """, (nombre, rnc_clean, telefono))
    
    new_prov = execute_query("SELECT id, nombre, rnc_cedula FROM proveedores WHERE id = %s", (new_id,), fetch_one=True)
    return {'existing': False, 'proveedor': new_prov}
