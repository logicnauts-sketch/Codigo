"""
Next Design - Módulo Home (Dashboard)
=====================================
Dashboard principal con datos reales desde MariaDB.
"""

from flask import render_template, redirect, session, url_for
from datetime import datetime
from functools import wraps
from . . import bp


def login_required(f):
    """Decorador simple que verifica sesión activa."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login.login'))
        return f(*args, **kwargs)
    return decorated


def get_hoy_formateada():
    meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
             "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    ahora = datetime.now()
    return f"{ahora.day} de {meses[ahora.month - 1]}"


@bp.route('/home')
@login_required
def home():
    from infra.infra import is_db_configured
    
    # Inicializar datos por defecto para evitar errores si no hay DB
    dashboard = {
        'ventas_hoy': 0,
        'caja_actual': 0,
        'total_clientes': 0,
        'stock_bajo': 0,
        'ventas_por_hora': {
            'labels': ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm'],
            'data': [0.0] * 13
        },
        'gamificacion': {'nivel': 1, 'xp_actual': 0, 'xp_siguiente': 1000, 'progreso': 0},
        'misiones': []
    }
    db_connected = False

    # Intentar leer datos de la DB real
    if is_db_configured():
        try:
            from ..models.queries import get_resumen_dashboard
            dashboard = get_resumen_dashboard()
            db_connected = True
        except Exception as e:
            print(f"[HOME] Error consultando DB: {e}")
    
    # Extraer datos de gamificación del dashboard (o usar los por defecto ya inicializados)
    gamificacion_data = dashboard.get('gamificacion', dashboard['gamificacion'])
    gamificacion_data['misiones'] = dashboard.get('misiones', [])

    return render_template(
        'home/home.html',
        nombre_completo=session.get('nombre_completo', 'Administrador'),
        rol=session.get('rol', 'admin'),
        iniciales=session.get('iniciales', 'AD'),
        hoy_formateada=get_hoy_formateada(),
        gamificacion=gamificacion_data,
        dashboard=dashboard,
        db_connected=db_connected
    )

