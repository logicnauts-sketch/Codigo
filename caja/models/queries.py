from infra.infra import execute_query, execute_write
from decimal import Decimal
import datetime

def get_caja_estado():
    """Obtiene el estado actual de la caja (abierta/cerrada)."""
    sql = """
        SELECT id, estado, fecha_apertura, fecha_cierre, monto_inicial,
               monto_contado_arqueo, diferencia_arqueo, ultima_fecha_arqueo,
               count_attempts, security_escalated, usuario_id
        FROM caja_estado
        WHERE estado = 'abierta'
        ORDER BY fecha_apertura DESC
        LIMIT 1
    """
    res = execute_query(sql, fetch_one=True)
    if res:
        # Convertir Decimal a float
        for k in ('monto_inicial', 'monto_contado_arqueo', 'diferencia_arqueo'):
            if isinstance(res.get(k), Decimal):
                res[k] = float(res[k])
    return res

def get_ultimo_cierre():
    """Obtiene el balance del último turno cerrado."""
    sql = """
        SELECT monto_cierre 
        FROM caja_estado 
        WHERE estado = 'cerrada' 
        ORDER BY fecha_cierre DESC 
        LIMIT 1
    """
    res = execute_query(sql, fetch_one=True)
    if res and isinstance(res.get('monto_cierre'), Decimal):
        return float(res['monto_cierre'])
    return 0.0

def get_movimientos_caja(limit=50):
    """Obtiene los movimientos recientes de caja del mes actual."""
    hoy = datetime.datetime.now()
    primer_dia_mes = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    sql = """
        SELECT * FROM (
            SELECT m.id, m.turno_id, m.factura_id, m.tipo, m.metodo_pago, 
                   m.descripcion, m.monto, m.fecha, m.usuario_nombre, m.referencia,
                   ROW_NUMBER() OVER (
                       PARTITION BY m.descripcion, m.monto, m.referencia, m.tipo, m.metodo_pago, DATE(m.fecha)
                       ORDER BY m.fecha DESC, m.id DESC
                   ) as rn
            FROM movimientos_caja m
            LEFT JOIN ventas f ON m.factura_id = f.id
            WHERE m.fecha >= %s
        ) t
        WHERE rn = 1
        ORDER BY fecha DESC
        LIMIT %s
    """
    resultados = execute_query(sql, (primer_dia_mes, limit))
    if resultados:
        for r in resultados:
            if isinstance(r.get('monto'), Decimal):
                r['monto'] = float(r['monto'])
    return resultados if resultados else []

def abrir_caja_db(usuario_id, monto_inicial):
    """Registra la apertura de un nuevo turno de caja."""
    sql = """
        INSERT INTO caja_estado (estado, fecha_apertura, monto_inicial, monto_apertura, count_attempts, security_escalated, usuario_id)
        VALUES ('abierta', NOW(), %s, %s, 0, FALSE, %s)
    """
    return execute_write(sql, (monto_inicial, monto_inicial, usuario_id))

def registrar_movimiento_caja(turno_id, tipo, monto, descripcion, metodo_pago='efectivo', usuario_nombre='Sistema', factura_id=None):
    """Registra un movimiento manual o automático en caja."""
    sql = """
        INSERT INTO movimientos_caja (turno_id, tipo, monto, descripcion, metodo_pago, usuario_nombre, factura_id, fecha)
        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
    """
    return execute_write(sql, (turno_id, tipo, monto, descripcion, metodo_pago, usuario_nombre, factura_id))

def cerrar_caja_db(turno_id, monto_efectivo, monto_tarjeta, diferencia, observaciones, supervisor_id=None):
    """Cierra el turno de caja actual."""
    sql = """
        UPDATE caja_estado 
        SET estado = 'cerrada', 
            fecha_cierre = NOW(), 
            monto_cierre = %s,
            monto_tarjeta = %s,
            diferencia_arqueo = %s,
            observaciones = %s,
            usuario_id_supervisor = %s
        WHERE id = %s
    """
    return execute_write(sql, (monto_efectivo, monto_tarjeta, diferencia, observaciones, supervisor_id, turno_id))

def get_turno_por_id(turno_id):
    """Obtiene los detalles de un turno específico."""
    sql = "SELECT * FROM caja_estado WHERE id = %s"
    res = execute_query(sql, (turno_id,), fetch_one=True)
    if res:
        for k in ('monto_inicial', 'monto_cierre', 'monto_tarjeta', 'diferencia_arqueo'):
            if isinstance(res.get(k), Decimal):
                res[k] = float(res[k])
    return res

