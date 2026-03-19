from flask import Blueprint, render_template, jsonify, request, session
import datetime
from caja.models.queries import (
    get_caja_estado, get_ultimo_cierre, get_movimientos_caja,
    abrir_caja_db, registrar_movimiento_caja
)

bp = Blueprint('caja', __name__, template_folder='../templates', static_folder='../static')

@bp.route('/')
def caja_view():
    """Vista principal de la caja."""
    return render_template('caja/caja.html')

@bp.route('/api/estado-actual')
def api_estado_actual():
    """Endpoint para obtener el estado actual de la caja."""
    try:
        turno = get_caja_estado()
        last_closing = get_ultimo_cierre()
        movimientos = get_movimientos_caja()
        
        cajero_actual = session.get('nombre_completo', 'Cajero de Turno')
        
        return jsonify({
            'success': True,
            'data': {
                'id': turno['id'] if turno else None,
                'open': turno is not None,
                'start': turno['fecha_apertura'].isoformat() if turno and turno['fecha_apertura'] else None,
                'cashier': cajero_actual,
                'initialCash': turno['monto_inicial'] if turno else 0,
                'movements': movimientos,
                'lastClosingBalance': last_closing
            }
        })
    except Exception as e:
        import traceback
        print(f"ERROR EN ESTADO ACTUAL: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/api/abrir', methods=['POST'])
def api_abrir():
    """Endpoint para abrir la caja."""
    data = request.json or {}
    try:
        monto_inicial = float(data.get('monto_inicial', 0))
        usuario_id = session.get('user_id', 1)
        
        # Verificar si ya está abierta
        if get_caja_estado():
            return jsonify({'success': False, 'error': 'La caja ya está abierta'}), 400
            
        # Abrir caja
        turno_id = abrir_caja_db(usuario_id, monto_inicial)
        if not turno_id:
            print("ERROR FATAL: abrir_caja_db devolvió None o 0")
            return jsonify({'success': False, 'error': 'Error de base de datos al abrir caja. Contacte soporte.'}), 500
            
        print(f"Caja abierta exitosamente. ID de Turno: {turno_id}")
            
        # Registrar movimiento inicial
        registrar_movimiento_caja(
            turno_id=turno_id,
            tipo='apertura',
            monto=monto_inicial,
            descripcion='Apertura de caja',
            usuario_nombre=session.get('nombre_completo', 'Sistema')
        )
            
        return jsonify({'success': True, 'mensaje': 'Caja abierta con éxito'})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/api/movimientos', methods=['POST'])
def api_movimientos():
    """Registra un movimiento de caja (Ingreso/Egreso)."""
    data = request.json or {}
    try:
        turno = get_caja_estado()
        if not turno:
            return jsonify({'success': False, 'error': 'No hay un turno de caja abierto'}), 400
            
        tipo = data.get('tipo', 'ingreso')
        monto = float(data.get('monto', 0))
        descripcion = data.get('descripcion', '')
        metodo_pago = data.get('metodo_pago', 'efectivo')
        usuario_nombre = session.get('nombre_completo', 'Cajero')
        
        registrar_movimiento_caja(
            turno_id=turno['id'],
            tipo=tipo,
            monto=monto,
            descripcion=descripcion,
            metodo_pago=metodo_pago,
            usuario_nombre=usuario_nombre
        )
        
        return jsonify({'success': True, 'mensaje': 'Movimiento registrado con éxito'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/api/validar-conteo', methods=['POST'])
def api_validar_conteo():
    """Valida el conteo ciego de efectivo."""
    data = request.json or {}
    try:
        turno = get_caja_estado()
        if not turno:
            return jsonify({'success': False, 'error': 'No hay un turno de caja abierto'}), 400
            
        monto_contado = float(data.get('monto_contado', 0))
        
        # Calcular el esperado real
        movimientos = get_movimientos_caja()
        # Nota: Partimos de 0 y sumamos todos los movimientos (incluyendo 'apertura')
        # o partimos de monto_inicial y sumamos solo los posteriores.
        # Usaremos la lógica de sumar todos los movimientos efectivos del turno.
        esperado = 0
        for m in movimientos:
            if m['turno_id'] == turno['id'] and m['metodo_pago'] == 'efectivo':
                if m['tipo'] in ('venta', 'ingreso', 'ingreso_manual', 'apertura'):
                    esperado += m['monto']
                else:
                    esperado -= abs(m['monto'])
        
        diferencia = monto_contado - esperado
        match = abs(diferencia) < 0.01
        
        # Si no coincide, registrar el intento
        if not match:
            new_attempts = (turno.get('count_attempts') or 0) + 1
            from infra.infra import execute_write
            execute_write("UPDATE caja_estado SET count_attempts = %s WHERE id = %s", (new_attempts, turno['id']))
            
            # Si van demasiados intentos, revelamos el esperado para ayudar al usuario (Modo Guiado)
            response_data = {
                'success': True,
                'match': False,
                'attempt': new_attempts,
                'message': 'Diferencia detectada. Verifique nuevamente.'
            }
            if new_attempts >= 3:
                response_data['revealed_expected'] = esperado
                response_data['message'] = f'Diferencia detectada. El sistema espera {esperado}. Verifique sus billetes.'
            
            return jsonify(response_data)
            
        return jsonify({
            'success': True,
            'match': True,
            'revealed_expected': esperado
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/api/cerrar', methods=['POST'])
def api_cerrar():
    """Cierra el turno de caja."""
    data = request.json or {}
    try:
        turno = get_caja_estado()
        if not turno:
            return jsonify({'success': False, 'error': 'No hay un turno de caja abierto'}), 400
            
        monto_efectivo = float(data.get('monto_efectivo', 0))
        monto_tarjeta = float(data.get('monto_tarjeta', 0))
        observaciones = data.get('observaciones', '')
        supervisor_id = data.get('supervisor_id')
        supervisor_reason = data.get('supervisor_reason', '')
        
        if supervisor_reason:
            observaciones = f"{observaciones} | Autorizado: {supervisor_reason}".strip(' | ')
        
        # Calcular esperado para la diferencia final
        movimientos = get_movimientos_caja()
        esperado = 0
        for m in movimientos:
            if m['turno_id'] == turno['id'] and m['metodo_pago'] == 'efectivo':
                if m['tipo'] in ('venta', 'ingreso', 'ingreso_manual', 'apertura'):
                    esperado += m['monto']
                else:
                    esperado -= abs(m['monto'])
                    
        diferencia = monto_efectivo - esperado
        
        from caja.models.queries import cerrar_caja_db
        cerrar_caja_db(
            turno_id=turno['id'],
            monto_efectivo=monto_efectivo,
            monto_tarjeta=monto_tarjeta,
            diferencia=diferencia,
            observaciones=observaciones,
            supervisor_id=supervisor_id
        )
        
        return jsonify({
            'success': True, 
            'mensaje': 'Caja cerrada con éxito',
            'turno_id': turno['id']
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@bp.route('/api/validar-supervisor', methods=['POST'])
def api_validar_supervisor():
    """Valida el PIN de un supervisor."""
    data = request.json or {}
    pin = data.get('pin')
    try:
        from infra.infra import execute_query
        sql = "SELECT id, nombre_completo FROM usuarios WHERE pin_seguridad = %s AND rol = 'administrador' LIMIT 1"
        sup = execute_query(sql, (pin,), fetch_one=True)
        
        if sup:
            return jsonify({
                'success': True, 
                'nombre': sup['nombre_completo'],
                'supervisor_id': sup['id']
            })
        else:
            return jsonify({'success': False, 'error': 'PIN de supervisor inválido'}), 401
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
