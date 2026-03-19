from flask import render_template, session, redirect, url_for
from .. import bp

from flask import render_template, session, redirect, url_for, request, jsonify
from .. import bp
from ..models import queries

@bp.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login.login'))
    return render_template('trabajos_pendientes/index.html')

@bp.route('/api/list')
def list_trabajos():
    trabajos = queries.get_all_trabajos()
    return jsonify(trabajos)

@bp.route('/api/add', methods=['POST'])
def add_trabajo():
    data = request.get_json()
    descripcion = data.get('descripcion')
    cliente_id = data.get('cliente_id')
    fecha_entrega = data.get('fecha_entrega')
    costo_estimado = data.get('costo_estimado', 0)
    prioridad = data.get('prioridad', 'normal')
    
    res = queries.add_trabajo(descripcion, cliente_id, fecha_entrega, costo_estimado, prioridad)
    return jsonify(success=bool(res), id=res)

@bp.route('/api/status', methods=['POST'])
def update_status():
    data = request.get_json()
    trabajo_id = data.get('id')
    nuevo_estado = data.get('estado')
    res = queries.update_trabajo_status(trabajo_id, nuevo_estado)
    return jsonify(success=bool(res))

@bp.route('/api/delete/<int:id>', methods=['POST'])
def delete_trabajo(id):
    res = queries.delete_trabajo(id)
    return jsonify(success=bool(res))
