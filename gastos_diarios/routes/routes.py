from flask import render_template, session, redirect, url_for
from .. import bp

from flask import render_template, session, redirect, url_for, request, jsonify
from .. import bp
from ..models import queries

@bp.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login.login'))
    return render_template('gastos_diarios/index.html')

@bp.route('/api/list')
def list_gastos():
    gastos = queries.get_all_gastos()
    return jsonify(gastos)

@bp.route('/api/add', methods=['POST'])
def add_gasto():
    data = request.get_json()
    tipo = data.get('tipo', 'Otros')
    descripcion = data.get('descripcion')
    monto = data.get('monto', 0)
    usuario_id = session.get('user_id')
    
    res = queries.add_gasto(tipo, descripcion, monto, usuario_id)
    return jsonify(success=bool(res), id=res)

@bp.route('/api/delete/<int:id>', methods=['POST'])
def delete_gasto(id):
    res = queries.delete_gasto(id)
    return jsonify(success=bool(res))
