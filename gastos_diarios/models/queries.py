from infra.infra import execute_query, execute_write

def get_all_gastos():
    """Retorna todos los gastos diarios ordenados por fecha descendente."""
    sql = "SELECT * FROM gastos_diarios ORDER BY fecha DESC"
    return execute_query(sql)

def add_gasto(tipo, descripcion, monto, usuario_id=None):
    """Registra un nuevo gasto."""
    sql = """
        INSERT INTO gastos_diarios (tipo, descripcion, monto, usuario_id)
        VALUES (%s, %s, %s, %s)
    """
    return execute_write(sql, (tipo, descripcion, monto, usuario_id))

def delete_gasto(gasto_id):
    """Elimina un registro de gasto."""
    sql = "DELETE FROM gastos_diarios WHERE id = %s"
    return execute_write(sql, (gasto_id,))
