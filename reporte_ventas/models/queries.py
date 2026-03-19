from infra.infra import execute_query
from datetime import datetime, timedelta

def get_sales_kpis_db(period='hoy', start_date=None, end_date=None):
    """Calcula KPIs de ventas (Total, Cantidad, Variación)."""
    where_clause, params = _build_date_filter(period, start_date, end_date)
    
    # 1. Totales del periodo actual
    sql = f"""
        SELECT 
            SUM(total) as ventas, 
            COUNT(*) as cantidad,
            AVG(total) as ticket_promedio,
            SUM(impuesto) as impuesto_total
        FROM ventas 
        WHERE estado = 'completada' {where_clause}
    """
    current = execute_query(sql, params, fetch_one=True) or {'ventas': 0, 'cantidad': 0, 'ticket_promedio': 0}
    
    # 2. Calcular Variación (vs periodo anterior equivalente)
    prev_where, prev_params = _build_previous_period_filter(period, start_date, end_date)
    sql_prev = f"SELECT SUM(total) as ventas FROM ventas WHERE estado = 'completada' {prev_where}"
    previous = execute_query(sql_prev, prev_params, fetch_one=True) or {'ventas': 0}
    
    current_val = float(current['ventas'] or 0)
    prev_val = float(previous['ventas'] or 0)
    
    variacion = 0
    if prev_val > 0:
        variacion = round(((current_val - prev_val) / prev_val) * 100, 1)
    elif current_val > 0:
        variacion = 100

    # 3. Insights Diarios (Mejor, Peor, Promedio)
    sql_insights = f"""
        SELECT DATE(fecha) as dia, SUM(total) as total
        FROM ventas
        WHERE estado = 'completada' {where_clause}
        GROUP BY DATE(fecha)
        ORDER BY total DESC
    """
    days = execute_query(sql_insights, params)
    
    insight_data = {"mejor": {"dia": "N/A", "total": 0}, "peor": {"dia": "N/A", "total": 0}, "promedio": 0}
    if days:
        insight_data["mejor"] = {"dia": days[0]['dia'].strftime('%d/%m/%Y'), "total": float(days[0]['total'] or 0)}
        insight_data["peor"] = {"dia": days[-1]['dia'].strftime('%d/%m/%Y'), "total": float(days[-1]['total'] or 0)}
        insight_data["promedio"] = round(sum(float(d['total'] or 0) for d in days) / len(days), 2)

    # 4. Desglose por método de pago
    sql_metodo = f"""
        SELECT metodo_pago as metodo, SUM(total) as total, COUNT(*) as cantidad
        FROM ventas
        WHERE estado = 'completada' {where_clause}
        GROUP BY metodo_pago
    """
    metodos = execute_query(sql_metodo, params)
    
    # 3. Ventas anuladas
    sql_anuladas = f"""
        SELECT COUNT(*) as cantidad, SUM(total) as total
        FROM ventas
        WHERE estado = 'anulada' {where_clause}
    """
    anuladas = execute_query(sql_anuladas, params, fetch_one=True) or {'cantidad': 0, 'total': 0}

    return {
        "ok": True,
        "totales": {
            "ventas": current_val,
            "cantidad": current['cantidad'] or 0,
            "ticket_promedio": float(current['ticket_promedio'] or 0),
            "impuesto": float(current.get('impuesto_total') or 0),
            "margen_estimado": current_val * 0.25, # Margen mock
            "margen_porcentaje": 25.0
        },
        "variacion": {
            "porcentaje": variacion,
            "direccion": "up" if variacion >= 0 else "down"
        },
        "por_metodo": { (m['metodo'].lower() if m['metodo'] else 'otros'): {"total": float(m['total'] or 0), "cantidad": m['cantidad']} for m in metodos},
        "anuladas": {"cantidad": if_null(anuladas['cantidad'], 0), "total": float(anuladas['total'] or 0)},
        "insights": insight_data
    }

def get_top_productos_db(period='hoy', start_date=None, end_date=None, limit=10):
    """Obtiene el ranking de productos más vendidos."""
    where_clause, params = _build_date_filter(period, start_date, end_date)
    sql = f"""
        SELECT p.nombre, SUM(vd.cantidad) as cantidad, SUM(vd.precio * vd.cantidad) as total
        FROM venta_detalles vd
        JOIN ventas v ON vd.venta_id = v.id
        JOIN productos p ON vd.producto_id = p.id
        WHERE v.estado = 'completada' {where_clause}
        GROUP BY p.id, p.nombre
        ORDER BY total DESC
        LIMIT %s
    """
    q_params = list(params) + [limit]
    return execute_query(sql, q_params)

def get_ventas_por_hora_db(period='hoy', start_date=None, end_date=None):
    """Distribución de ventas por hora."""
    where_clause, params = _build_date_filter(period, start_date, end_date)
    sql = f"""
        SELECT HOUR(fecha) as hora, SUM(total) as total
        FROM ventas
        WHERE estado = 'completada' {where_clause}
        GROUP BY HOUR(fecha)
        ORDER BY hora ASC
    """
    rows = execute_query(sql, params) or []
    # Rellenar horas faltantes
    dataset = {f"{h:02d}:00": 0 for h in range(8, 21)} # De 8am a 8pm
    for r in rows:
        h_str = f"{r['hora']:02d}:00"
        if h_str in dataset:
            dataset[h_str] = float(r['total'] or 0)
    
    return [{"label": h, "total": t} for h, t in dataset.items()]

def get_lista_ventas_db(period='hoy', start_date=None, end_date=None, estado=None, limit=200):
    """Obtiene el listado detallado de ventas con filtros."""
    where, params = _build_date_filter(period, start_date, end_date)
    
    if estado:
        where += " AND estado = %s"
        params = list(params) + [estado]

    sql = f"""
        SELECT v.id, v.fecha as fecha_display, v.total, v.metodo_pago, v.estado,
               c.nombre as cliente, 'SISTEMA' as usuario
        FROM ventas v
        LEFT JOIN clientes c ON v.cliente_id = c.id
        WHERE 1=1 {where}
        ORDER BY v.fecha DESC
        LIMIT %s
    """
    q_params = list(params) + [limit]
    return execute_query(sql, q_params)

def get_alertas_db(period='hoy', start_date=None, end_date=None):
    """Genera alertas reales basadas en datos de ventas."""
    alertas = []
    
    # 1. Verificar ventas anuladas recientes
    sql_anuladas = """
        SELECT COUNT(*) as cantidad 
        FROM ventas 
        WHERE estado = 'anulada' AND DATE(fecha) = CURDATE()
    """
    result = execute_query(sql_anuladas, fetch_one=True)
    cant_anuladas = result['cantidad'] if result and result.get('cantidad') else 0
    if cant_anuladas > 0:
        alertas.append({
            "tipo": "warning",
            "icon": "exclamation-triangle",
            "mensaje": f"{cant_anuladas} venta(s) anulada(s) registrada(s) hoy."
        })
    
    return alertas

def get_tendencia_semanal_db(period='semana', start_date=None, end_date=None):
    """Obtiene la tendencia de ventas con filtros y relleno de ceros."""
    where, params = _build_date_filter(period, start_date, end_date)
    
    sql = f"""
        SELECT DATE(fecha) as dia, SUM(total) as ventas
        FROM ventas
        WHERE estado = 'completada' {where}
        GROUP BY DATE(fecha)
        ORDER BY DATE(fecha) ASC
    """
    rows = execute_query(sql, params)
    
    # Mapeo de días de la semana
    dias_semana_map = {0: 'Lun', 1: 'Mar', 2: 'Mié', 3: 'Jue', 4: 'Vie', 5: 'Sáb', 6: 'Dom'}
    
    # Determinar rango de fechas para rellenar ceros
    if period == 'personalizado' and start_date and end_date:
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')
    else:
        end_dt = datetime.now()
        start_dt = end_dt - timedelta(days=6)
    
    # Crear diccionario de base con ceros para cada día en el rango
    full_dataset = {}
    curr = start_dt
    while curr <= end_dt:
        dia_key = curr.date()
        dia_nombre = dias_semana_map.get(curr.weekday(), str(dia_key))
        full_dataset[dia_key] = {
            "dia": f"{dia_nombre} {curr.day}",
            "label": f"{dia_nombre} {curr.day}",
            "ventas": 0.0,
            "total": 0.0
        }
        curr += timedelta(days=1)
    
    # Sobrescribir con datos reales de la DB
    for r in (rows or []):
        dia_db = r['dia']
        if isinstance(dia_db, datetime):
            dia_db = dia_db.date()
            
        if dia_db in full_dataset:
            full_dataset[dia_db]["ventas"] = float(r['ventas'] or 0)
            full_dataset[dia_db]["total"] = float(r['ventas'] or 0)
    
    # Retornar lista ordenada por fecha
    return [full_dataset[d] for d in sorted(full_dataset.keys())]

def get_analisis_dias_db(period='semana', start_date=None, end_date=None):
    """Analiza ventas por día de la semana (Lunes-Domingo)."""
    where, params = _build_date_filter(period, start_date, end_date)
    
    sql = f"""
        SELECT WEEKDAY(fecha) as dia_index, SUM(total) as ventas
        FROM ventas
        WHERE estado = 'completada' {where}
        GROUP BY WEEKDAY(fecha)
        ORDER BY dia_index ASC
    """
    rows = execute_query(sql, params) or []
    
    dias_semana = {0: 'Lunes', 1: 'Martes', 2: 'Miércoles', 3: 'Jueves', 4: 'Viernes', 5: 'Sábado', 6: 'Domingo'}
    # Inicializar todos los días en 0
    dataset = {name: 0 for name in dias_semana.values()}
    
    for r in rows:
        name = dias_semana.get(r['dia_index'])
        if name:
            dataset[name] = float(r['ventas'] or 0)
            
    return [{"label": d, "total": t, "ventas": t} for d, t in dataset.items()]

def get_tendencia_mensual_db():
    """Obtiene la tendencia de ventas de los últimos 12 meses."""
    sql = """
        SELECT DATE_FORMAT(fecha, '%Y-%m') as mes_id, 
               DATE_FORMAT(fecha, '%M %Y') as mes_nombre,
               SUM(total) as ventas
        FROM ventas
        WHERE estado = 'completada'
          AND fecha >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(fecha, '%Y-%m'), DATE_FORMAT(fecha, '%M %Y')
        ORDER BY mes_id ASC
    """
    rows = execute_query(sql)
    
    # Mapeo de meses en inglés a español
    meses_es = {
        'January': 'Enero', 'February': 'Febrero', 'March': 'Marzo', 'April': 'Abril',
        'May': 'Mayo', 'June': 'Junio', 'July': 'Julio', 'August': 'Agosto',
        'September': 'Septiembre', 'October': 'Octubre', 'November': 'Noviembre', 'December': 'Diciembre'
    }
    
    result = []
    for r in (rows or []):
        nombre_original = r['mes_nombre'].split(' ')[0]
        anio = r['mes_nombre'].split(' ')[1]
        nombre_es = meses_es.get(nombre_original, nombre_original)
        
        result.append({
            "mes": f"{nombre_es} {anio}",
            "label": f"{nombre_es} {anio}",
            "ventas": float(r['ventas'] or 0),
            "total": float(r['ventas'] or 0)
        })
    
    return result

def _build_date_filter(period, start_str=None, end_str=None):
    """Utilidad para construir la cláusula WHERE de fecha."""
    where = ""
    params = []
    
    if period == 'hoy':
        where = " AND DATE(fecha) = CURDATE()"
    elif period == 'ayer':
        where = " AND DATE(fecha) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)"
    elif period == 'semana':
        where = " AND fecha >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
    elif period == 'mes':
        where = " AND MONTH(fecha) = MONTH(CURDATE()) AND YEAR(fecha) = YEAR(CURDATE())"
    elif period == 'personalizado' and start_str:
        where = " AND DATE(fecha) BETWEEN %s AND %s"
        params = [start_str, end_str or start_str]
        
    return where, params

def _build_previous_period_filter(period, start_str=None, end_str=None):
    """Construye el filtro del periodo anterior para comparar."""
    where = ""
    params = []
    
    if period == 'hoy':
        where = " AND DATE(fecha) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)"
    elif period == 'ayer':
        where = " AND DATE(fecha) = DATE_SUB(CURDATE(), INTERVAL 2 DAY)"
    elif period == 'semana':
        where = " AND fecha >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND fecha < DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
    elif period == 'mes':
        where = " AND MONTH(fecha) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(fecha) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))"
    elif period == 'personalizado' and start_str:
        try:
            start = datetime.strptime(start_str, '%Y-%m-%d')
            end = datetime.strptime(end_str or start_str, '%Y-%m-%d')
            diff = (end - start).days + 1
            prev_start = (start - timedelta(days=diff)).strftime('%Y-%m-%d')
            prev_end = (start - timedelta(days=1)).strftime('%Y-%m-%d')
            where = " AND DATE(fecha) BETWEEN %s AND %s"
            params = [prev_start, prev_end]
        except:
            where = " AND 1=0"
        
    return where, params

def if_null(val, default):
    return val if val is not None else default
