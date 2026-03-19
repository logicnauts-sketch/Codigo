"""
Next Design - Consultas del Dashboard (Home)
=============================================
Funciones que consultan la base de datos configurada para
alimentar las tarjetas y gráficos del dashboard principal.
"""

from infra.infra import execute_query


def get_ventas_hoy():
    """Total de ventas del día actual."""
    result = execute_query(
        "SELECT COALESCE(SUM(total), 0) as total FROM ventas WHERE DATE(fecha) = CURDATE() AND estado = 'completada'",
        fetch_one=True
    )
    return float(result['total']) if result else 0.0


def get_caja_actual():
    """Monto actual de la caja abierta calculando movimientos."""
    turno = execute_query(
        "SELECT id, monto_apertura FROM caja_estado WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1",
        fetch_one=True
    )
    if not turno:
        return 0.0
    
    # Sumar movimientos del turno actual (la apertura ya está en movimientos_caja normalmente)
    res = execute_query(
        "SELECT COALESCE(SUM(CASE WHEN tipo IN ('venta', 'ingreso', 'ingreso_manual', 'apertura') THEN monto ELSE -ABS(monto) END), 0) as balance FROM movimientos_caja WHERE turno_id = %s",
        (turno['id'],),
        fetch_one=True
    )
    return float(res['balance']) if res else float(turno['monto_apertura'])


def get_total_clientes():
    """Cantidad total de clientes registrados."""
    result = execute_query(
        "SELECT COUNT(*) as total FROM clientes",
        fetch_one=True
    )
    return int(result['total']) if result else 0


def get_stock_bajo():
    """Cantidad de productos con stock por debajo del mínimo."""
    result = execute_query(
        "SELECT COUNT(*) as total FROM productos WHERE stock <= stock_minimo AND estado = 'activo'",
        fetch_one=True
    )
    return int(result['total']) if result else 0


def get_ventas_por_hora():
    """Ventas agrupadas por hora para el gráfico de barras."""
    results = execute_query("""
        SELECT HOUR(fecha) as hora, COALESCE(SUM(total), 0) as total
        FROM ventas
        WHERE DATE(fecha) = CURDATE() AND estado = 'completada'
        GROUP BY HOUR(fecha)
        ORDER BY hora
    """)
    
    # Crear estructura de 8am a 8pm
    horas_labels = ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm']
    horas_data = [0.0] * 13  # 8 to 20
    
    if results:
        for row in results:
            h = int(row['hora'])
            if 8 <= h <= 20:
                horas_data[h - 8] = float(row['total'])
    
    return {'labels': horas_labels, 'data': horas_data}


def get_gamificacion():
    """Retorna el nivel y XP actual con escalado dinámico."""
    result = execute_query(
        "SELECT nivel, xp_actual FROM gamificacion ORDER BY id DESC LIMIT 1",
        fetch_one=True
    )
    if not result:
        return {'nivel': 1, 'xp_actual': 0, 'xp_siguiente': 2500, 'progreso': 0}

    nivel = result['nivel']
    xp_actual = result['xp_actual']

    # Escalado de XP solicitado
    # Nivel 1 -> 2: 2500
    # Nivel 2 -> 3: 5000
    # Nivel 3 -> 4: 10000
    scale = {
        1: 2500,
        2: 5000,
        3: 10000
    }
    xp_siguiente = scale.get(nivel, 20000) # 20k+ para niveles superiores a 4

    # Calcular progreso para la barra
    progreso = int((xp_actual / xp_siguiente) * 100) if xp_siguiente > 0 else 100
    if progreso > 100: progreso = 100

    return {
        'nivel': nivel,
        'xp_actual': xp_actual,
        'xp_siguiente': xp_siguiente,
        'progreso': progreso
    }


def get_misiones_del_dia(nivel=1):
    """Retorna las misiones según el nivel (3 misiones en total, priorizando incompletas)."""
    tipo = 'core' if nivel >= 4 else 'demo'
    
    # Ordenar por: No completadas primero (ASC), luego por ID (para ver las más viejas primero)
    results = execute_query(
        "SELECT titulo, descripcion, xp_recompensa, completada FROM misiones WHERE tipo = %s ORDER BY completada ASC, id ASC LIMIT 3",
        (tipo,)
    )
    return results if results else []


def get_resumen_dashboard():
    """Retorna todos los datos necesaros para el dashboard en una sola llamada."""
    gamificacion = get_gamificacion()
    return {
        'ventas_hoy': get_ventas_hoy(),
        'caja_actual': get_caja_actual(),
        'total_clientes': get_total_clientes(),
        'stock_bajo': get_stock_bajo(),
        'ventas_por_hora': get_ventas_por_hora(),
        'gamificacion': gamificacion,
        'misiones': get_misiones_del_dia(gamificacion['nivel'])
    }

