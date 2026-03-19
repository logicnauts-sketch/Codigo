"""
Next Design - Módulo de Infraestructura (Configuración de Base de Datos)
========================================================================
Permite al usuario configurar manualmente su conexión a MariaDB/MySQL.
Las credenciales se guardan en db_config.json en la raíz del proyecto.
"""

from flask import Blueprint, render_template, request, jsonify, redirect, url_for
import pymysql
import json
import os
import sys
import threading

# Almacenamiento local de hilos para reutilizar conexiones
_conn_local = threading.local()

# Caché de configuración en memoria para evitar I/O repetitivo
_db_config_cache = None
_db_configured_cache = None
_cache_lock = threading.Lock()

# Detección de base path para el ejecutable (PyInstaller)
if getattr(sys, 'frozen', False):
    # En producción usamos Local AppData para que sea escribible
    BASE_DIR = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'Next Design')
    if not os.path.exists(BASE_DIR):
        os.makedirs(BASE_DIR, exist_ok=True)
else:
    # Desarrollo normal
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CONFIG_FILE = os.path.join(BASE_DIR, 'db_config.json')

bp = Blueprint('infra', __name__,
               url_prefix='/infra',
               template_folder='templates',
               static_folder='static',
               static_url_path='/infra/static')


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
#  Funciones de utilidad (importables)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def is_db_configured():
    """Verifica si existe un archivo de configuración de DB válido (con caché)."""
    global _db_configured_cache
    
    if _db_configured_cache is not None:
        return _db_configured_cache
        
    if not os.path.exists(CONFIG_FILE):
        _db_configured_cache = False
        return False
        
    try:
        with open(CONFIG_FILE, 'r') as f:
            cfg = json.load(f)
        is_ok = all(k in cfg for k in ('host', 'port', 'user', 'password', 'database'))
        _db_configured_cache = is_ok
        return is_ok
    except (json.JSONDecodeError, IOError):
        _db_configured_cache = False
        return False


def get_db_config():
    """Lee y retorna la configuración de DB (con caché)."""
    global _db_config_cache
    
    if _db_config_cache is not None:
        return _db_config_cache
        
    if not is_db_configured():
        return None
        
    with open(CONFIG_FILE, 'r') as f:
        config = json.load(f)
        _db_config_cache = config
        return config


def get_connection():
    """Retorna una conexión reutilizable por hilo a MariaDB/MySQL."""
    global _conn_local
    
    # Intentar recuperar conexión existente en este hilo
    conn = getattr(_conn_local, 'conn', None)
    
    if conn is not None:
        try:
            # Verificar si la conexión sigue viva
            conn.ping(reconnect=True)
            return conn
        except Exception:
            # Si falló, la cerramos para crear una nueva
            try:
                conn.close()
            except:
                pass
            _conn_local.conn = None

    # Crear nueva conexión
    cfg = get_db_config()
    if not cfg:
        raise ConnectionError("No hay configuración de base de datos. Visita /infra/db para configurar.")
    
    new_conn = pymysql.connect(
        host=cfg['host'],
        port=int(cfg['port']),
        user=cfg['user'],
        password=cfg['password'],
        database=cfg['database'],
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True
    )
    
    # Guardar en local del hilo
    _conn_local.conn = new_conn
    return new_conn


def execute_query(sql, params=None, fetch_one=False):
    """Ejecuta una consulta SQL y retorna resultados (reutiliza conexión)."""
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(sql, params or ())
            if fetch_one:
                return cursor.fetchone()
            return cursor.fetchall()
    except Exception as e:
        print(f"[DB ERROR] {e}")
        return None
    # Nota: No cerramos 'conn' aquí para permitir su reutilización en el mismo hilo.


def execute_write(sql, params=None):
    """Ejecuta un INSERT/UPDATE/DELETE y retorna el ID o filas afectadas."""
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute(sql, params or ())
            conn.commit()
            # Si es un INSERT, retornamos el ID. Si es UPDATE/DELETE, las filas afectadas.
            if sql.strip().upper().startswith('INSERT'):
                return cursor.lastrowid
            return cursor.rowcount if cursor.rowcount > 0 else True
    except Exception as e:
        print(f"[DB WRITE ERROR] {e}")
        return None
    # Nota: No cerramos 'conn' aquí para permitir su reutilización.


def init_tables():
    """Crea las tablas necesarias si no existen."""
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ventas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                    total DECIMAL(12,2) DEFAULT 0,
                    subtotal DECIMAL(12,2) DEFAULT 0,
                    impuesto DECIMAL(12,2) DEFAULT 0,
                    descuento DECIMAL(12,2) DEFAULT 0,
                    metodo_pago VARCHAR(20) DEFAULT 'efectivo',
                    cajero_id INT,
                    cliente_id INT,
                    estado VARCHAR(20) DEFAULT 'completada',
                    INDEX idx_fecha (fecha),
                    INDEX idx_estado (estado)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS venta_detalles (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    venta_id INT,
                    producto_id INT,
                    cantidad DECIMAL(12,2) DEFAULT 1,
                    precio DECIMAL(12,2) DEFAULT 0,
                    itbis DECIMAL(12,2) DEFAULT 0,
                    medida_valor DECIMAL(12,2) DEFAULT 1,
                    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
                    INDEX idx_venta (venta_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS clientes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nombre VARCHAR(150) NOT NULL,
                    telefono VARCHAR(20),
                    email VARCHAR(100),
                    rnc VARCHAR(20),
                    direccion TEXT,
                    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_nombre (nombre)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS productos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nombre VARCHAR(200) NOT NULL,
                    descripcion TEXT,
                    codigo VARCHAR(50),
                    codigo_barra VARCHAR(100),
                    stock INT DEFAULT 0,
                    stock_minimo INT DEFAULT 5,
                    stock_maximo INT DEFAULT 100,
                    precio DECIMAL(10,2) DEFAULT 0,
                    costo DECIMAL(10,2) DEFAULT 0,
                    impuesto DECIMAL(10,2) DEFAULT 18,
                    unidad_medida_id INT,
                    usa_dimension BOOLEAN DEFAULT FALSE,
                    categoria VARCHAR(100),
                    estado VARCHAR(20) DEFAULT 'activo',
                    INDEX idx_stock (stock, stock_minimo),
                    INDEX idx_estado (estado),
                    INDEX idx_barras (codigo_barra)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS categorias (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nombre VARCHAR(100) NOT NULL UNIQUE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # Migraciones: Asegurar que la tabla productos tenga todas las columnas necesarias
            columnas_migracion = [
                ("descripcion", "TEXT"),
                ("codigo_barra", "VARCHAR(100)"),
                ("impuesto", "DECIMAL(10,2) DEFAULT 18"),
                ("unidad_medida_id", "INT"),
                ("usa_dimension", "BOOLEAN DEFAULT FALSE"),
                ("stock_maximo", "INT DEFAULT 100")
            ]
            
            for col_name, col_def in columnas_migracion:
                try:
                    cursor.execute(f"ALTER TABLE productos ADD COLUMN {col_name} {col_def}")
                    if col_name == "codigo_barra":
                        cursor.execute("CREATE INDEX idx_barras ON productos (codigo_barra)")
                except:
                    pass # La columna ya existe

            # Migraciones: Asegurar que la tabla caja_estado tenga todas las columnas necesarias
            columnas_caja = [
                ("monto_tarjeta", "DECIMAL(12,2) DEFAULT 0"),
                ("observaciones", "TEXT"),
                ("usuario_id_supervisor", "INT")
            ]
            for col_name, col_def in columnas_caja:
                try:
                    cursor.execute(f"ALTER TABLE caja_estado ADD COLUMN {col_name} {col_def}")
                except:
                    pass

            # Migraciones: Asegurar que la tabla clientes tenga todas las columnas necesarias
            columnas_clientes = [
                ("cedula", "VARCHAR(20)"),
                ("rnc", "VARCHAR(20)"),
                ("tipo", "VARCHAR(50) DEFAULT 'Normal'"),
                ("estado", "VARCHAR(20) DEFAULT 'activo'"),
                ("limite_credito", "DECIMAL(12,2) DEFAULT 0"),
                ("saldo_actual", "DECIMAL(12,2) DEFAULT 0"),
                ("dias_credito", "INT DEFAULT 30"),
                ("fechaRegistro", "DATETIME")
            ]
            for col_name, col_def in columnas_clientes:
                try:
                    cursor.execute(f"ALTER TABLE clientes ADD COLUMN {col_name} {col_def}")
                except:
                    pass
            # Migraciones: Asegurar que la tabla trabajos_pendientes tenga fecha_finalizado
            try:
                cursor.execute("ALTER TABLE trabajos_pendientes ADD COLUMN fecha_finalizado DATETIME")
            except:
                pass

            # Poblar productos si está vacía (Deshabilitado para Next Design)
            # cursor.execute("SELECT COUNT(*) FROM productos")
            # ... seeding logic removed ...
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS caja_estado (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
                    fecha_cierre DATETIME,
                    monto_inicial DECIMAL(12,2) DEFAULT 0,
                    monto_apertura DECIMAL(12,2) DEFAULT 0,
                    monto_cierre DECIMAL(12,2),
                    monto_contado_arqueo DECIMAL(12,2),
                    diferencia_arqueo DECIMAL(12,2),
                    ultima_fecha_arqueo DATETIME,
                    count_attempts INT DEFAULT 0,
                    security_escalated BOOLEAN DEFAULT FALSE,
                    usuario_id INT,
                    usuario_id_supervisor INT,
                    observaciones TEXT,
                    monto_tarjeta DECIMAL(12,2) DEFAULT 0,
                    estado VARCHAR(20) DEFAULT 'abierta',
                    INDEX idx_estado (estado)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS movimientos_caja (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    turno_id INT,
                    factura_id INT,
                    tipo VARCHAR(50), 
                    metodo_pago VARCHAR(50) DEFAULT 'efectivo',
                    descripcion VARCHAR(255),
                    referencia VARCHAR(255),
                    monto DECIMAL(12,2),
                    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                    usuario_nombre VARCHAR(150),
                    INDEX idx_turno (turno_id),
                    INDEX idx_fecha (fecha),
                    FOREIGN KEY (turno_id) REFERENCES caja_estado(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS gamificacion (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nivel INT DEFAULT 1,
                    xp_actual INT DEFAULT 0,
                    xp_siguiente INT DEFAULT 2500,
                    usuario_id INT DEFAULT 1
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # Insertar datos por defecto si están vacías
            cursor.execute("SELECT COUNT(*) FROM gamificacion")
            if cursor.fetchone()['COUNT(*)'] == 0:
                cursor.execute("INSERT INTO gamificacion (nivel, xp_actual, xp_siguiente) VALUES (1, 0, 2500)")

            # Migración: Asegurar que la tabla misiones tenga la columna 'tipo'
            try:
                cursor.execute("ALTER TABLE misiones ADD COLUMN tipo VARCHAR(20) DEFAULT 'demo'")
                cursor.execute("CREATE INDEX idx_tipo ON misiones (tipo)")
            except:
                pass # La columna o el índice ya existen

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS misiones (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    titulo VARCHAR(100) NOT NULL,
                    descripcion VARCHAR(200),
                    xp_recompensa INT DEFAULT 150,
                    completada BOOLEAN DEFAULT FALSE,
                    fecha_mision DATE,
                    tipo VARCHAR(20) DEFAULT 'demo',
                    INDEX idx_fecha (fecha_mision),
                    INDEX idx_tipo (tipo)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # Poblar misiones si está vacía o faltan las Core
            cursor.execute("SELECT COUNT(*) FROM misiones")
            if cursor.fetchone()['COUNT(*)'] < 6:
                # Limpiar para re-sembrar con los tipos correctos si faltan datos
                cursor.execute("DELETE FROM misiones WHERE tipo IS NULL OR tipo = ''")
                misiones_demo = [
                    ('Primera Venta', 'Realiza tu primera venta del día', 150, False, 'demo'),
                    ('Control de Inventario', 'Revisa el stock de 5 productos', 150, False, 'demo'),
                    ('Fidelización', 'Registra un nuevo cliente', 150, False, 'demo'),
                    ('Operación Maestro', 'Completa 10 ventas en una hora', 500, False, 'core'),
                    ('Auditoría Total', 'Verifica el cierre de todas las cajas', 300, False, 'core'),
                    ('Expansión Kids', 'Alcanza los 100 clientes registrados', 1000, False, 'core')
                ]
                for m in misiones_demo:
                    # Usar INSERT IGNORE o verificar existencia por título para no duplicar
                    cursor.execute("""
                        INSERT INTO misiones (titulo, descripcion, xp_recompensa, completada, tipo) 
                        SELECT %s, %s, %s, %s, %s FROM DUAL 
                        WHERE NOT EXISTS (SELECT 1 FROM misiones WHERE titulo = %s)
                    """, (m[0], m[1], m[2], m[3], m[4], m[0]))
            
            # Tabla de Movimientos de Inventario
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS inventario_movimientos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                    tipo VARCHAR(50), -- Entrada, Salida, Ajuste, Auditoría
                    producto_id INT,
                    cantidad DECIMAL(12,2),
                    responsable VARCHAR(150),
                    motivo TEXT,
                    INDEX idx_fecha (fecha),
                    INDEX idx_producto (producto_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # Tablas de Auditoría / Conteo de Mercancía
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS inventario_auditorias (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    fecha_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
                    fecha_fin DATETIME,
                    usuario_id INT,
                    estado VARCHAR(20) DEFAULT 'en_progreso', -- en_progreso, finalizada, cancelada
                    INDEX idx_estado (estado)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS inventario_auditoria_detalles (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    auditoria_id INT,
                    producto_id INT,
                    stock_teorico DECIMAL(12,2),
                    stock_fisico DECIMAL(12,2) DEFAULT 0,
                    FOREIGN KEY (auditoria_id) REFERENCES inventario_auditorias(id) ON DELETE CASCADE,
                    INDEX idx_auditoria (auditoria_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # Tablas de Créditos y Cobros
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS creditos_clientes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    cliente_id INT,
                    factura_id INT,
                    monto_total DECIMAL(12,2),
                    saldo_pendiente DECIMAL(12,2),
                    fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
                    fecha_vencimiento DATETIME,
                    estado VARCHAR(20) DEFAULT 'pendiente',
                    INDEX idx_cliente (cliente_id),
                    INDEX idx_factura (factura_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pagos_creditos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    credito_id INT,
                    cliente_id INT,
                    fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
                    monto_pago DECIMAL(12,2),
                    metodo_pago VARCHAR(50),
                    referencia_pago VARCHAR(255),
                    INDEX idx_credito (credito_id),
                    INDEX idx_cliente (cliente_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS usuarios (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nombre_completo VARCHAR(150),
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(100),
                    password_hash VARCHAR(255) NOT NULL,
                    rol VARCHAR(20) DEFAULT 'empleado',
                    activo BOOLEAN DEFAULT TRUE,
                    bloqueado BOOLEAN DEFAULT FALSE,
                    forzar_cambio_pwd BOOLEAN DEFAULT TRUE,
                    ultimo_acceso DATETIME,
                    dias_libres VARCHAR(100) DEFAULT '',
                    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_username (username)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS usuarios_auditoria (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                    accion VARCHAR(50),
                    descripcion TEXT,
                    ejecutor_id INT,
                    ejecutor_nombre VARCHAR(150),
                    target_id INT,
                    target_nombre VARCHAR(150),
                    tabla VARCHAR(50),
                    registro_id INT,
                    INDEX idx_fecha (fecha),
                    INDEX idx_target (target_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # Tablas para Trabajos Pendientes y Gastos Diarios
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS trabajos_pendientes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    cliente_id INT,
                    descripcion TEXT NOT NULL,
                    fecha_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
                    fecha_entrega DATETIME,
                    costo_estimado DECIMAL(12,2) DEFAULT 0,
                    prioridad VARCHAR(20) DEFAULT 'normal',
                    estado VARCHAR(20) DEFAULT 'pendiente',
                    fecha_finalizado DATETIME,
                    INDEX idx_estado (estado),
                    INDEX idx_cliente (cliente_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS gastos_diarios (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tipo VARCHAR(50) DEFAULT 'Otros',
                    descripcion TEXT NOT NULL,
                    monto DECIMAL(12,2) NOT NULL,
                    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                    usuario_id INT,
                    INDEX idx_fecha (fecha),
                    INDEX idx_tipo (tipo)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            # Seed admin user if empty
            cursor.execute("SELECT COUNT(*) as count FROM usuarios")
            if cursor.fetchone()['count'] == 0:
                # Default password: 'admin' (hashed later or kept simple for init)
                # Using a basic hash for compatibility if werkzeug isn't ready
                from werkzeug.security import generate_password_hash
                pwd_hash = generate_password_hash('admin')
                cursor.execute("""
                    INSERT INTO usuarios (nombre_completo, username, email, password_hash, rol, forzar_cambio_pwd)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, ("Administrador", "admin", "admin@Next Design.com", pwd_hash, "admin", False))

            conn.commit()
            print("[INFRA] âœ“ Tablas creadas/verificadas correctamente")
            return True
    except Exception as e:
        print(f"[INFRA] âœ— Error creando tablas: {e}")
        return False
    finally:
        if conn:
            conn.close()


def ensure_db_exists(host, port, user, password, db_name):
    """Conecta al servidor y crea la base de datos si no existe."""
    conn = None
    try:
        # Conectar sin base de datos
        conn = pymysql.connect(
            host=host,
            port=int(port),
            user=user,
            password=password,
            charset='utf8mb4',
            connect_timeout=5
        )
        with conn.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        return True, "Base de datos creada o ya existía."
    except Exception as e:
        return False, str(e)
    finally:
        if conn:
            conn.close()


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
#  Rutas del Blueprint
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@bp.route('/db')
def db_config_page():
    """Página de configuración de base de datos."""
    current_config = get_db_config() or {
        'host': 'localhost',
        'port': 3306,
        'user': 'root',
        'password': '',
        'database': 'Next Design'
    }
    configured = is_db_configured()
    return render_template('db_config.html', config=current_config, is_configured=configured)


@bp.route('/db/test', methods=['POST'])
def db_test_connection():
    """Prueba la conexión con las credenciales proporcionadas."""
    try:
        data = request.get_json()
        host = data.get('host', 'localhost')
        port = int(data.get('port', 3306))
        user = data.get('user', 'root')
        password = data.get('password', '')
        database = data.get('database', 'Next Design')

        conn = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
            charset='utf8mb4',
            connect_timeout=5
        )
        
        # Obtener info del servidor
        with conn.cursor() as cursor:
            cursor.execute("SELECT VERSION()")
            version = cursor.fetchone()[0]
        conn.close()
        
        return jsonify({
            'ok': True,
            'msg': f'Conexión exitosa. Servidor: {version}'
        })
    except pymysql.err.OperationalError as e:
        code, msg = e.args
        # Error 1049: Unknown database (La base de datos no existe)
        if code == 1049:
            # Probar si al menos el servidor responde
            try:
                server_conn = pymysql.connect(
                    host=host, port=port, user=user, password=password, connect_timeout=5
                )
                server_conn.close()
                return jsonify({
                    'ok': True,
                    'msg': f'Servidor detectado. La base de datos "{database}" no existe pero se creará automáticamente al guardar.'
                })
            except Exception:
                return jsonify({'ok': False, 'error': f'La base de datos "{database}" no existe y no se pudo conectar al servidor.'})
        
        error_map = {
            1045: 'Acceso denegado: usuario o contraseña incorrectos.',
            2003: 'No se pudo conectar al servidor. Asegúrate de que el servicio MariaDB esté iniciado en Windows.',
            2006: 'El servidor MySQL se ha ido. Intenta reconectar.',
        }
        
        err_msg = error_map.get(code)
        if not err_msg:
            if "10061" in str(msg):
                err_msg = "Conexión rechazada (10061). El servidor MariaDB podría estar apagado o el puerto es incorrecto."
            else:
                err_msg = f'Error ({code}): {msg}'
                
        return jsonify({'ok': False, 'error': err_msg})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)})


@bp.route('/db/save', methods=['POST'])
def db_save_config():
    """Guarda las credenciales en db_config.json y crea las tablas."""
    try:
        data = request.get_json()
        config = {
            'host': data.get('host', 'localhost'),
            'port': int(data.get('port', 3306)),
            'user': data.get('user', 'root'),
            'password': data.get('password', ''),
            'database': data.get('database', 'Next Design')
        }
        
        # 1. Asegurar que la DB existe (Crearla si no existe)
        db_ok, db_msg = ensure_db_exists(
            config['host'], config['port'], 
            config['user'], config['password'], 
            config['database']
        )
        
        if not db_ok:
            return jsonify({'ok': False, 'error': f'No se pudo crear/acceder a la DB: {db_msg}'})

        # 2. Probar conexión final
        conn = pymysql.connect(
            host=config['host'],
            port=config['port'],
            user=config['user'],
            password=config['password'],
            database=config['database'],
            charset='utf8mb4',
            connect_timeout=5
        )
        conn.close()
        
        # 3. Guardar config
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        
        # 4. Limpiar caché para que las funciones lo relean del archivo
        global _db_config_cache, _db_configured_cache
        _db_config_cache = None
        _db_configured_cache = None
        
        # 5. Crear tablas
        tables_ok = init_tables()
        
        # 6. Marcar en la app que las tablas ya se inicializaron
        from flask import current_app
        try:
            current_app.tables_initialized = tables_ok
        except:
            pass

        return jsonify({
            'ok': True,
            'msg': 'Configuración guardada exitosamente.' + (' Tablas verificadas.' if tables_ok else ' Advertencia: error al verificar tablas.'),
            'tables_created': tables_ok
        })
    except Exception as e:
        return jsonify({'ok': False, 'error': f'Error al guardar: {str(e)}'})

