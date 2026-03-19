from infra.infra import execute_query, execute_write
from decimal import Decimal
import datetime

def detect_schema():
    """Detecta dinámicamente tablas y columnas para compatibilidad local/PROD."""
    # 1) Detectar columna de email en clientes
    try:
        c_cols_res = execute_query("SHOW COLUMNS FROM clientes") or []
        c_cols = {c['Field'] for c in c_cols_res}
    except:
        c_cols = set()
        
    email_col = 'correo' if 'correo' in c_cols else ('email' if 'email' in c_cols else 'id')
    cedula_col = 'cedula' if 'cedula' in c_cols else 'id'
    has_rnc = 'rnc' in c_cols

    # 2) Detectar tabla de créditos
    cxc_res = execute_query("SHOW TABLES LIKE 'creditos_clientes'", fetch_one=True)
    cxc_table = 'creditos_clientes' if cxc_res else 'cuentas_por_cobrar'

    # 3) Detectar columnas en la tabla de créditos
    try:
        cxc_cols_res = execute_query(f"SHOW COLUMNS FROM {cxc_table}") or []
        cxc_cols = {c['Field'] for c in cxc_cols_res}
    except:
        cxc_cols = set()
    
    if 'saldo_pendiente' in cxc_cols:
        saldo_expr = f"{cxc_table}.saldo_pendiente"
    elif 'monto_pagado' in cxc_cols and 'monto_total' in cxc_cols:
        saldo_expr = f"({cxc_table}.monto_total - {cxc_table}.monto_pagado)"
    else:
        saldo_expr = "0"
        
    # Columna de fecha en facturas
    try:
        # Detectar tabla de ventas (ventas o facturas)
        tables_res = execute_query("SHOW TABLES") or []
        tables = {list(t.values())[0] for t in tables_res}
        sales_table = 'facturas' if 'facturas' in tables else 'ventas'
        
        f_cols_res = execute_query(f"SHOW COLUMNS FROM {sales_table}") or []
        f_cols = {c['Field'] for c in f_cols_res}
        has_ncf_col = 'ncf' in f_cols
    except:
        f_cols = set()
        sales_table = 'ventas'
        has_ncf_col = False
        
    f_date_col = 'fecha_creacion' if 'fecha_creacion' in f_cols else ('fecha' if 'fecha' in f_cols else 'NOW()')
    has_tipo_col = 'tipo' in f_cols

    # Columnas de fecha en créditos
    f_emision = 'fecha_emision' if 'fecha_emision' in cxc_cols else ('fecha_creacion' if 'fecha_creacion' in cxc_cols else 'NOW()')
    f_vence = 'fecha_vencimiento' if 'fecha_vencimiento' in cxc_cols else f_emision

    return {
        'email_col': email_col,
        'cedula_col': cedula_col,
        'has_rnc': has_rnc,
        'cxc_table': cxc_table,
        'sales_table': sales_table,
        'saldo_expr': saldo_expr,
        'f_date_col': f_date_col,
        'has_tipo_col': has_tipo_col,
        'has_ncf_col': has_ncf_col,
        'f_emision': f_emision,
        'f_vence': f_vence,
        'cxc_cols': cxc_cols
    }

def get_clientes_db(search='', page=1, per_page=20):
    schema = detect_schema()
    email_col = schema['email_col']
    
    sales_table = schema['sales_table']
    has_tipo_col = schema['has_tipo_col']
    tipo_filter = "AND tipo = 'venta'" if has_tipo_col else ""
    
    query = f"""
        SELECT c.*, c.{email_col} as correo,
               (SELECT id FROM {sales_table} WHERE cliente_id = c.id {tipo_filter} AND LOWER(estado) NOT IN ('anulada', 'cancelada') ORDER BY id DESC LIMIT 1) as last_invoice_id,
               (SELECT fecha FROM {sales_table} WHERE cliente_id = c.id {tipo_filter} AND LOWER(estado) NOT IN ('anulada', 'cancelada') ORDER BY id DESC LIMIT 1) as last_invoice_date
        FROM clientes c 
        WHERE c.estado = 'activo'
    """
    params = []
    
    if search:
        cedula_col = schema.get('cedula_col', 'cedula')
        rnc_search = "OR rnc LIKE %s" if schema.get('has_rnc') else ""
        query += f" AND (nombre LIKE %s OR {cedula_col} LIKE %s {rnc_search} OR {email_col} LIKE %s)"
        input_wild = f"%{search}%"
        params.append(input_wild)
        params.append(input_wild)
        if schema.get('has_rnc'):
            params.append(input_wild)
        params.append(input_wild)
        
    query += " ORDER BY nombre ASC"
    
    if per_page > 0:
        offset = (page - 1) * per_page
        query += " LIMIT %s OFFSET %s"
        params.extend([per_page, offset])
        
    clients = execute_query(query, params) or []
    
    count_query = "SELECT COUNT(*) as total FROM clientes WHERE estado = 'activo'"
    count_params = []
    if search:
        cedula_col = schema.get('cedula_col', 'cedula')
        count_query += f" AND (nombre LIKE %s OR {cedula_col} LIKE %s OR {email_col} LIKE %s)"
        count_params.extend([input_wild, input_wild, input_wild])
        
    total_res = execute_query(count_query, count_params, fetch_one=True)
    total = total_res['total'] if total_res else 0
    
    return clients, total

def get_cliente_by_id(client_id):
    schema = detect_schema()
    sales_table = schema['sales_table']
    f_date_col = schema['f_date_col']
    has_tipo_col = schema['has_tipo_col']
    tipo_filter = "AND tipo = 'venta'" if has_tipo_col else ""
    
    client = execute_query("SELECT * FROM clientes WHERE id = %s", (client_id,), fetch_one=True)
    if not client:
        return None
        
    # Stats
    stats = execute_query(f"""
        SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
        FROM {sales_table}
        WHERE cliente_id = %s {tipo_filter}
    """, (client_id,), fetch_one=True)
    client['facturas_count'] = stats['count']
    client['total_facturado'] = float(stats['total'] or 0)
    
    if f_date_col:
        last_inv = execute_query(f"""
            SELECT {f_date_col} as fecha FROM {sales_table}
            WHERE cliente_id = %s {tipo_filter} AND metodo_pago = 'credito'
            ORDER BY {f_date_col} DESC LIMIT 1
        """, (client_id,), fetch_one=True)
        client['ultima_factura'] = last_inv['fecha'].isoformat() if last_inv and last_inv['fecha'] and hasattr(last_inv['fecha'], 'isoformat') else None
    
    last_pay = execute_query("""
        SELECT fecha_pago FROM pagos_creditos
        WHERE cliente_id = %s
        ORDER BY fecha_pago DESC LIMIT 1
    """, (client_id,), fetch_one=True)
    client['ultimo_pago'] = last_pay['fecha_pago'].isoformat() if last_pay and hasattr(last_pay['fecha_pago'], 'isoformat') else None
    
    for k in ('fechaRegistro', 'creado_en', 'fecha_registro'):
        if k in client and client[k] and hasattr(client[k], 'isoformat'):
            client['fecha_registro'] = client[k].isoformat()
            break
            
    return client

def create_cliente_db(data):
    schema = detect_schema()
    email_col = schema['email_col']
    
    cedula = (data.get('cedula') or '').replace('-', '').replace(' ', '').strip()
    
    # ✅ VALIDACIÓN DE DUPLICADOS INTEGRAL
    if cedula:
        # Buscar en ambas columnas para evitar que el mismo documento se repita
        check_sql = "SELECT id FROM clientes WHERE cedula = %s"
        if schema.get('has_rnc'):
            check_sql += " OR rnc = %s"
        
        check_params = (cedula, cedula) if schema.get('has_rnc') else (cedula,)
        existing = execute_query(check_sql + " LIMIT 1", check_params, fetch_one=True)
        
        if existing:
            raise Exception(f"Ya existe un cliente registrado con el documento {cedula} (en RNC o Cédula)")

    nombre = (data.get('nombre') or '').strip()
    correo = (data.get('correo') or '').strip().lower()
    telefono = (data.get('telefono') or '').strip()
    direccion = (data.get('direccion') or '').strip()
    tipo = data.get('tipo', 'Normal')
    limite_credito = float(data.get('limite_credito', 0))
    dias_credito = int(data.get('dias_credito', 30))

    if not correo:
        correo = f"cliente_{cedula or id(data)}@auto.local"

    sql = f"""
        INSERT INTO clientes (nombre, cedula, telefono, direccion, {email_col}, tipo, estado,
                             limite_credito, saldo_actual, dias_credito, fechaRegistro)
        VALUES (%s, %s, %s, %s, %s, %s, 'activo', %s, %s, %s, NOW())
    """
    return execute_write(sql, (nombre, cedula, telefono, direccion, correo, tipo, limite_credito, 0.0, dias_credito))

def update_cliente_db(client_id, data):
    schema = detect_schema()
    email_col = schema['email_col']
    
    sql = f"""
        UPDATE clientes
        SET nombre = %s, cedula = %s, telefono = %s, direccion = %s,
            {email_col} = %s, tipo = %s, limite_credito = %s, dias_credito = %s
        WHERE id = %s
    """
    return execute_write(sql, (
        (data.get('nombre') or '').strip(),
        (data.get('cedula') or '').strip(),
        (data.get('telefono') or '').strip(),
        (data.get('direccion') or '').strip(),
        data.get('correo', '').strip().lower(),
        data.get('tipo', 'Normal'),
        float(data.get('limite_credito', 0)),
        int(data.get('dias_credito', 30)),
        client_id
    ))

def toggle_cliente_status(client_id):
    client = execute_query("SELECT estado FROM clientes WHERE id = %s", (client_id,), fetch_one=True)
    if not client:
        return None
    new_status = 'inactivo' if client['estado'] == 'activo' else 'activo'
    execute_write("UPDATE clientes SET estado = %s WHERE id = %s", (new_status, client_id))
    return new_status

def registrar_pago_db(client_id, monto_pago, metodo, referencia, credito_id=None, usuario_nombre='Sistema'):
    monto_pago = Decimal(str(monto_pago))
    schema = detect_schema()
    cxc_table = schema['cxc_table']
    cxc_cols = schema['cxc_cols']
    
    # 1) Actualizar saldo crédito si aplica
    pago_aplicado = monto_pago
    real_factura_id = None
    
    if credito_id:
        credito = execute_query(f"""
            SELECT id, cliente_id, factura_id, { 'saldo_pendiente' if 'saldo_pendiente' in cxc_cols else '(monto_total - monto_pagado)' } AS saldo_pendiente, monto_total
            FROM {cxc_table}
            WHERE id = %s AND cliente_id = %s
        """, (credito_id, client_id), fetch_one=True)
        
        if not credito:
            raise Exception("Crédito no encontrado")
            
        saldo_credito = Decimal(str(credito['saldo_pendiente'] or 0))
        pago_aplicado = monto_pago if monto_pago <= saldo_credito else saldo_credito
        nuevo_saldo = saldo_credito - pago_aplicado
        nuevo_estado = 'pagado' if nuevo_saldo == 0 else 'parcial'
        real_factura_id = credito['factura_id']
        
        if 'saldo_pendiente' in cxc_cols:
            execute_write(f"UPDATE {cxc_table} SET saldo_pendiente = %s, estado = %s WHERE id = %s", (float(nuevo_saldo), nuevo_estado, credito_id))
        else:
            execute_write(f"UPDATE {cxc_table} SET monto_pagado = monto_total - %s, estado = %s WHERE id = %s", (float(nuevo_saldo), nuevo_estado, credito_id))

    # 2) Registrar en pagos_creditos
    pago_id = execute_write("""
        INSERT INTO pagos_creditos (credito_id, cliente_id, fecha_pago, monto_pago, metodo_pago, referencia_pago)
        VALUES (%s, %s, NOW(), %s, %s, %s)
    """, (credito_id, client_id, float(pago_aplicado), metodo, referencia))

    # 3) Reducir saldo cliente
    cliente = execute_query("SELECT saldo_actual FROM clientes WHERE id = %s", (client_id,), fetch_one=True)
    saldo_actual = Decimal(str(cliente['saldo_actual'] or 0))
    nuevo_saldo_cli = max(Decimal('0'), saldo_actual - pago_aplicado)
    execute_write("UPDATE clientes SET saldo_actual = %s WHERE id = %s", (float(nuevo_saldo_cli), client_id))

    # 4) Registrar en caja
    turno = execute_query("SELECT id FROM caja_estado WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1", fetch_one=True)
    if turno:
        cliente_info = execute_query("SELECT nombre FROM clientes WHERE id = %s", (client_id,), fetch_one=True)
        client_name = cliente_info['nombre'] if cliente_info else f"Cliente #{client_id}"
        descr = f"Cobro Factura {real_factura_id}" if real_factura_id else f"Abono a cuenta: {client_name}"
        
        execute_write("""
            INSERT INTO movimientos_caja (turno_id, factura_id, tipo, metodo_pago, descripcion, monto, referencia, usuario_nombre, fecha)
            VALUES (%s, %s, 'ingreso', %s, %s, %s, %s, %s, NOW())
        """, (turno['id'], real_factura_id, metodo, descr, float(pago_aplicado), referencia, usuario_nombre))

    return pago_id

def get_credit_history_db(client_id):
    schema = detect_schema()
    cxc_table = schema['cxc_table']
    saldo_expr = schema['saldo_expr']
    f_emision = schema['f_emision']
    f_vence = schema['f_vence']
    
    cliente = execute_query("""
        SELECT id, nombre, cedula, tipo, limite_credito, saldo_actual, dias_credito
        FROM clientes WHERE id = %s AND estado = 'activo'
    """, (client_id,), fetch_one=True)
    
    if not cliente: return None, [], []
    
    ncf_expr = "f.ncf" if schema['has_ncf_col'] else "''"
    
    facturas = execute_query(f"""
        SELECT cc.id AS credito_id, f.id AS factura_id, {ncf_expr} AS ncf, cc.monto_total AS total, {saldo_expr} AS saldo_pendiente,
               DATE_FORMAT(f.{f_emision}, '%%d/%%m/%%Y %%H:%%i') AS fecha_emision,
               DATE_FORMAT(f.{f_vence}, '%%d/%%m/%%Y') AS fecha_vencimiento,
               DATEDIFF(f.{f_vence}, CURDATE()) AS dias_restantes, cc.estado
        FROM {cxc_table} cc JOIN {schema['sales_table']} f ON f.id = cc.factura_id
        WHERE cc.cliente_id = %s AND cc.estado IN ('pendiente','parcial','vencido','Pendiente','Parcial','Vencido')
        ORDER BY f.{f_vence} ASC LIMIT 10
    """, (client_id,))
    
    pagos = execute_query(f"""
        SELECT DATE_FORMAT(p.fecha_pago, '%%d/%%m/%%Y %%H:%%i') AS fecha_pago, p.monto_pago, p.metodo_pago, p.referencia_pago, p.credito_id,
               (SELECT factura_id FROM {cxc_table} WHERE id = p.credito_id LIMIT 1) as factura_id
        FROM pagos_creditos p WHERE p.cliente_id = %s ORDER BY p.fecha_pago DESC LIMIT 100
    """, (client_id,))
    
    for p in pagos:
        p['factura_ncf'] = '—'
        if p.get('credito_id'):
            ncf_expr_inner = "f.ncf" if schema['has_ncf_col'] else "''"
            res = execute_query(f"SELECT {ncf_expr_inner} as ncf, cc.factura_id FROM {cxc_table} cc JOIN {schema['sales_table']} f ON cc.factura_id = f.id WHERE cc.id = %s", (p['credito_id'],), fetch_one=True)
            if res: 
                p['factura_ncf'] = res['ncf']
                p['factura_id'] = res['factura_id']
            
    return cliente, facturas, pagos

def get_client_invoices_db(client_id, start_date=None, end_date=None, only_pending=False):
    schema = detect_schema()
    sales_table = schema['sales_table']
    f_date_col = schema['f_date_col']
    cxc_table = schema['cxc_table']
    saldo_expr = schema['saldo_expr']
    
    ncf_expr = "ncf" if schema['has_ncf_col'] else "''"
    
    query = f"""
        SELECT id as factura_id, {ncf_expr} AS ncf, DATE_FORMAT({f_date_col}, '%%d/%%m/%%Y') as fecha, total, estado as estado_ui, 
               metodo_pago, (SELECT id FROM {cxc_table} WHERE factura_id = {sales_table}.id LIMIT 1) as credito_id,
               (SELECT {saldo_expr} FROM {cxc_table} WHERE factura_id = {sales_table}.id LIMIT 1) as saldo_pendiente
        FROM {sales_table}
        WHERE cliente_id = %s
    """
    params = [client_id]
    
    if only_pending:
        query += f" AND (SELECT {saldo_expr} FROM {cxc_table} WHERE factura_id = {sales_table}.id LIMIT 1) > 0"
    
    if start_date:
        query += f" AND {f_date_col} >= %s"
        params.append(start_date)
    if end_date:
        query += f" AND {f_date_col} <= %s"
        params.append(end_date)
        
    query += f" ORDER BY {f_date_col} DESC LIMIT 50"
    return execute_query(query, params)

def get_invoice_abonos_db(client_id, factura_id):
    schema = detect_schema()
    cxc_table = schema['cxc_table']
    saldo_expr = schema['saldo_expr']
    
    resumen = execute_query(f"""
        SELECT cc.id as credito_id, cc.monto_total, 
               (cc.monto_total - {saldo_expr}) as total_abonado,
               {saldo_expr} as saldo_pendiente, cc.estado
        FROM {cxc_table} cc
        WHERE cc.factura_id = %s AND cc.cliente_id = %s
    """, (factura_id, client_id), fetch_one=True)
    
    if not resumen:
        return None, []
        
    abonos = execute_query("""
        SELECT DATE_FORMAT(fecha_pago, '%%d/%%m/%%Y %%H:%%i') as fecha,
               monto_pago, metodo_pago, referencia_pago as referencia
        FROM pagos_creditos
        WHERE credito_id = %s
        ORDER BY fecha_pago DESC
    """, (resumen['credito_id'],))
    
    return resumen, abonos

def get_client_payments_db(client_id):
    schema = detect_schema()
    sales_table = schema['sales_table']
    cxc_table = schema['cxc_table']

    ncf_expr = "f.ncf" if schema['has_ncf_col'] else "''"

    query = f"""
        SELECT DATE_FORMAT(p.fecha_pago, '%%d/%%m/%%Y %%H:%%i') as fecha,
               p.monto_pago, p.metodo_pago, p.referencia_pago as referencia,
               {ncf_expr} as factura_ncf, p.credito_id, f.id as factura_id
        FROM pagos_creditos p
        LEFT JOIN {sales_table} f ON f.id = (SELECT factura_id FROM {cxc_table} WHERE id = p.credito_id LIMIT 1)
        WHERE p.cliente_id = %s
        ORDER BY p.fecha_pago DESC LIMIT 100
    """
    return execute_query(query, (client_id,))

def get_client_by_document(documento):
    doc = documento.replace('-', '').replace(' ', '').strip()
    return execute_query("SELECT * FROM clientes WHERE cedula = %s OR rnc = %s LIMIT 1", (doc, doc), fetch_one=True)

def crear_cliente_rapido_db(nombre, rnc, telefono='', direccion=''):
    sql = """
        INSERT INTO clientes (nombre, cedula, telefono, direccion, estado, fechaRegistro)
        VALUES (%s, %s, %s, %s, 'activo', NOW())
    """
    return execute_write(sql, (nombre, rnc, telefono, direccion))
