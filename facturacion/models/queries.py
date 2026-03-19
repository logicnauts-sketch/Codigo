from infra.infra import execute_query, execute_write
from decimal import Decimal


def search_productos_facturacion(q):
    """Busca productos por código, código de barra o nombre, optimizado para facturación."""
    sql = """
        SELECT id, codigo, codigo_barra, nombre, precio, stock, impuesto
        FROM productos 
        WHERE estado = 'activo' AND (codigo LIKE %s OR nombre LIKE %s OR codigo_barra LIKE %s)
        LIMIT 20
    """
    param = f"%{q}%"
    resultados = execute_query(sql, (param, param, param))
    if not resultados:
        resultados = []
    
    for row in resultados:
        itbis_val = float(row.get('impuesto', 18) or 18)
        row['itbis'] = itbis_val
        row['itbis_incluido'] = True
        if isinstance(row.get('precio'), Decimal):
            row['precio'] = float(row['precio'])
        if isinstance(row.get('stock'), Decimal):
            row['stock'] = float(row['stock'])
            
    return resultados


def get_all_productos_facturacion():
    sql = """
        SELECT id, codigo, codigo_barra, nombre, precio, stock, impuesto
        FROM productos 
        WHERE estado = 'activo'
        LIMIT 50
    """
    resultados = execute_query(sql)
    if not resultados:
        resultados = []
    for row in resultados:
        itbis_val = float(row.get('impuesto', 18) or 18)
        row['itbis'] = itbis_val
        row['itbis_incluido'] = True
        if isinstance(row.get('precio'), Decimal):
            row['precio'] = float(row['precio'])
        if isinstance(row.get('stock'), Decimal):
            row['stock'] = float(row['stock'])
    return resultados


def search_personas_facturacion(q, tipo='cliente'):
    """Busca clientes o proveedores por nombre, teléfono o documento."""
    if tipo == 'proveedor':
        sql = """
            SELECT id, nombre as name, rnc_cedula as rnc, email, direccion, telefono, 'proveedor' as type
            FROM proveedores
            WHERE (nombre LIKE %s OR rnc_cedula LIKE %s OR telefono LIKE %s)
            AND estado = 'Activo'
            LIMIT 20
        """
    else:
        sql = """
            SELECT id, nombre as name, COALESCE(cedula, rnc) as rnc, email, direccion, telefono, 'cliente' as type,
                   limite_credito, saldo_actual as saldo
            FROM clientes
            WHERE (nombre LIKE %s OR cedula LIKE %s OR rnc LIKE %s OR telefono LIKE %s)
            AND estado = 'activo'
            LIMIT 20
        """
        param = f"%{q}%"
        resultados = execute_query(sql, (param, param, param, param))
        return resultados if resultados else []


def get_all_personas_facturacion(tipo='cliente'):
    if tipo == 'proveedor':
        sql = """
            SELECT id, nombre as name, rnc_cedula as rnc, email, direccion, telefono, 'proveedor' as type
            FROM proveedores
            WHERE estado = 'Activo'
            LIMIT 50
        """
    else:
        sql = """
            SELECT id, nombre as name, cedula as rnc, email, direccion, telefono, 'cliente' as type,
                   limite_credito, saldo_actual as saldo
            FROM clientes
            WHERE estado = 'activo'
            LIMIT 50
        """
    resultados = execute_query(sql)
    return resultados if resultados else []


def procesar_factura_db(data):
    """Guarda la factura y gestiona saldos si es a crédito."""
    sql_venta = """
        INSERT INTO ventas (total, subtotal, impuesto, metodo_pago, cliente_id, estado, fecha)
        VALUES (%s, %s, %s, %s, %s, 'completada', NOW())
    """
    c_id = data.get('cliente_id')
    cliente_id = None if not c_id or str(c_id).lower() == 'cf' else c_id
    metodo_pago = data.get('metodo_pago', 'efectivo')
    
    total = float(data.get('total', 0))
    impuesto = float(data.get('itbis_total', 0))
    subtotal = total - impuesto
    
    venta_id = execute_write(sql_venta, (
        total,
        subtotal,
        impuesto,
        metodo_pago,
        cliente_id
    ))
    
    if not venta_id:
        raise Exception("Error al guardar la factura")

    # ✅ GESTIÓN DE CRÉDITO
    if metodo_pago == 'credito' and cliente_id:
        # 1. Sumar al saldo actual del cliente
        execute_write("UPDATE clientes SET saldo_actual = saldo_actual + %s WHERE id = %s", (total, cliente_id))
        
        # 2. Registrar en tabla de créditos (detectar tabla)
        from clientes.models.queries import detect_schema
        schema = detect_schema()
        cxc_table = schema['cxc_table']
        cxc_cols = schema['cxc_cols']
        
        f_emision = schema['f_emision']
        f_vence = schema['f_vence']
        
        # Determinar fecha de vencimiento (30 días por defecto)
        dias_credito = 30
        res_cli = execute_query("SELECT dias_credito FROM clientes WHERE id = %s", (cliente_id,), fetch_one=True)
        if res_cli and res_cli.get('dias_credito'):
            dias_credito = int(res_cli['dias_credito'])

        if 'saldo_pendiente' in cxc_cols:
            sql_cxc = f"""
                INSERT INTO {cxc_table} (cliente_id, factura_id, monto_total, saldo_pendiente, estado, {f_emision}, {f_vence})
                VALUES (%s, %s, %s, %s, 'pendiente', NOW(), DATE_ADD(NOW(), INTERVAL %s DAY))
            """
            execute_write(sql_cxc, (cliente_id, venta_id, total, total, dias_credito))
        else:
            sql_cxc = f"""
                INSERT INTO {cxc_table} (cliente_id, factura_id, monto_total, monto_pagado, estado, {f_emision}, {f_vence})
                VALUES (%s, %s, %s, 0, 'pendiente', NOW(), DATE_ADD(NOW(), INTERVAL %s DAY))
            """
            execute_write(sql_cxc, (cliente_id, venta_id, total, dias_credito))
        
    sql_detalles = """
        INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio, itbis, medida_valor)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    for det in data.get('detalles', []):
        execute_write(sql_detalles, (
            venta_id,
            det.get('producto_id'),
            det.get('cantidad', 1),
            det.get('precio', 0),
            18.0 if det.get('itbis') else 0.0,
            det.get('medida_valor', 1)
        ))
        
    return venta_id


def get_factura_con_detalles(factura_id):
    """Obtiene una factura con sus detalles para generar PDF."""
    venta = execute_query("""
        SELECT v.id, v.fecha, v.total, v.subtotal, v.impuesto, 
               v.metodo_pago, v.estado, v.cliente_id,
               c.nombre as cliente_nombre, COALESCE(c.rnc, c.cedula) as cliente_rnc,
               c.direccion as cliente_direccion, c.telefono as cliente_telefono
        FROM ventas v
        LEFT JOIN clientes c ON v.cliente_id = c.id
        WHERE v.id = %s
    """, (factura_id,), fetch_one=True)
    
    if not venta:
        return None
    
    detalles = execute_query("""
        SELECT vd.cantidad, vd.precio, vd.itbis, vd.medida_valor,
               p.nombre as producto_nombre, p.codigo as producto_codigo
        FROM venta_detalles vd
        LEFT JOIN productos p ON vd.producto_id = p.id
        WHERE vd.venta_id = %s
    """, (factura_id,))
    
    # Convert Decimals to float for JSON/template rendering
    if detalles:
        for d in detalles:
            for k in ['cantidad', 'precio', 'itbis', 'medida_valor']:
                val = d.get(k)
                if isinstance(val, Decimal):
                    d[k] = float(val)
    
    for k in ['total', 'subtotal', 'impuesto']:
        v_val = venta.get(k)
        if isinstance(v_val, Decimal):
            venta[k] = float(v_val)
    
    venta['detalles'] = detalles if detalles else []
    return venta


def get_ultima_factura_id():
    """Retorna el ID de la última venta/factura registrada."""
    sql = "SELECT id FROM ventas ORDER BY id DESC LIMIT 1"
    res = execute_query(sql, fetch_one=True)
    return res['id'] if res else None
