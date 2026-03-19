from infra.infra import execute_query, execute_write

def get_productos_lista(include_inactive=False):
    """Retorna la lista completa de productos desde la DB."""
    where_clause = "WHERE estado = 'Activo'" if not include_inactive else ""
    sql = f"""
        SELECT id, codigo, codigo_barra, nombre, precio as precio_venta, 
               stock as stock_actual, stock_minimo, estado, categoria as categoria_nombre
        FROM productos
        {where_clause}
        ORDER BY nombre ASC
    """
    return execute_query(sql)

def get_producto_por_id(producto_id):
    """Retorna los detalles de un producto específico."""
    sql = "SELECT * FROM productos WHERE id = %s"
    return execute_query(sql, (producto_id,), fetch_one=True)

def get_producto_por_codigo(codigo):
    """Busca un producto por su código interno."""
    sql = "SELECT id, estado FROM productos WHERE codigo = %s"
    return execute_query(sql, (codigo,), fetch_one=True)

def get_producto_por_barcode(barcode):
    """Busca un producto por su código de barras."""
    if not barcode: return None
    sql = "SELECT id, estado FROM productos WHERE codigo_barra = %s"
    return execute_query(sql, (barcode,), fetch_one=True)

def get_stats_productos():
    """Calcula estadísticas rápidas de inventario."""
    sql = """
        SELECT 
            COUNT(*) as total_items,
            SUM(CASE WHEN stock <= stock_minimo THEN 1 ELSE 0 END) as stock_bajo,
            SUM(stock * costo) as valor_inventario
        FROM productos
        WHERE estado = 'Activo'
    """
    return execute_query(sql, fetch_one=True)

def update_producto_estado(producto_id, nuevo_estado):
    """Cambia el estado de un producto (Activo/Inactivo)."""
    sql = "UPDATE productos SET estado = %s WHERE id = %s"
    return execute_write(sql, (nuevo_estado, producto_id))

def get_categorias_lista():
    """Retorna todas las categorías."""
    return execute_query("SELECT id, nombre FROM categorias ORDER BY nombre ASC")

def create_categoria(nombre):
    """Crea una nueva categoría."""
    return execute_write("INSERT INTO categorias (nombre) VALUES (%s)", (nombre,))

def delete_categoria(cat_id):
    """Elimina una categoría."""
    return execute_write("DELETE FROM categorias WHERE id = %s", (cat_id,))

def get_next_product_code():
    """Genera el siguiente código secuencial."""
    res = execute_query("SELECT MAX(id) as max_id FROM productos", fetch_one=True)
    next_id = (res['max_id'] or 0) + 1
    return f"PROD-{next_id:04d}"

def create_producto(data):
    """Inserta un nuevo producto en la DB."""
    sql = """
        INSERT INTO productos (codigo, codigo_barra, nombre, descripcion, categoria, 
                              precio, costo, impuesto, unidad_medida_id, 
                              usa_dimension, stock, stock_minimo, stock_maximo, estado)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Activo')
    """
    unidad_medida = data.get('unidad_medida_id')
    if unidad_medida == '': unidad_medida = None

    params = (
        data.get('codigo'), data.get('codigo_barra'), data.get('nombre'),
        data.get('descripcion'), data.get('categoria'), data.get('precio_venta'),
        data.get('precio_compra'), data.get('impuesto'), unidad_medida,
        data.get('usa_dimension'), data.get('stock_actual'), data.get('stock_minimo'),
        data.get('stock_maximo')
    )
    return execute_write(sql, params)

def update_producto(pid, data):
    """Actualiza un producto existente."""
    sql = """
        UPDATE productos SET 
            codigo_barra = %s, nombre = %s, descripcion = %s, categoria = %s, 
            precio = %s, costo = %s, impuesto = %s, unidad_medida_id = %s, 
            usa_dimension = %s, stock_minimo = %s, stock_maximo = %s
        WHERE id = %s
    """
    unidad_medida = data.get('unidad_medida_id')
    if unidad_medida == '': unidad_medida = None

    params = (
        data.get('codigo_barra'), data.get('nombre'), data.get('descripcion'),
        data.get('categoria'), data.get('precio_venta'), data.get('precio_compra'),
        data.get('impuesto'), unidad_medida, data.get('usa_dimension'),
        data.get('stock_minimo'), data.get('stock_maximo'), pid
    )
    return execute_write(sql, params)
