from flask import Blueprint, render_template, jsonify, request, session, make_response
from datetime import datetime
import functools

bp = Blueprint('facturacion', __name__, template_folder='../templates', static_folder='../static')

from facturacion.models.queries import (
    search_productos_facturacion, get_all_productos_facturacion,
    search_personas_facturacion, get_all_personas_facturacion,
    procesar_factura_db, get_factura_con_detalles, get_ultima_factura_id
)

@bp.route('/')
def facturacion():
    return render_template('facturacion/facturacion.html')

@bp.route('/api/productos')
def get_productos():
    q = request.args.get('q', '').strip()
    if q:
        results = search_productos_facturacion(q)
    else:
        results = get_all_productos_facturacion()
    return jsonify(results)

@bp.route('/api/personas')
def get_personas():
    q = request.args.get('q', '').strip()
    tipo = request.args.get('tipo', 'cliente').strip()
    if q:
        results = search_personas_facturacion(q, tipo)
    else:
        results = get_all_personas_facturacion(tipo)
    return jsonify(results)

@bp.route('/api/facturas', methods=['POST'])
def crear_factura():
    data = request.json
    if not data or 'detalles' not in data:
        return jsonify({"success": False, "mensaje": "Datos de factura inválidos"}), 400
        
    try:
        factura_id = procesar_factura_db(data)
        return jsonify({
            "success": True,
            "factura_id": factura_id,
            "mensaje": "Factura procesada con éxito"
        })
    except Exception as e:
        return jsonify({"success": False, "mensaje": str(e)}), 500

@bp.route('/api/facturas/ultima', methods=['GET'])
def ultima_factura():
    """Retorna el ID de la última factura para reimpresión."""
    factura_id = get_ultima_factura_id()
    if factura_id:
        return jsonify({"success": True, "factura_id": factura_id})
    return jsonify({"success": False, "mensaje": "No hay facturas registradas"}), 404

@bp.route('/api/facturas/<int:factura_id>/pdf', methods=['GET'])
def descargar_pdf(factura_id):
    """Genera un PDF real de factura usando xhtml2pdf."""
    try:
        factura = get_factura_con_detalles(factura_id)
        if not factura:
            return jsonify({"success": False, "mensaje": "Factura no encontrada"}), 404
        
        from configuracion.configuracion import MOCK_EMPRESA
        empresa = MOCK_EMPRESA.copy()
        
        # Formateo de datos para la plantilla profesional
        factura_data = {
            'id': factura['id'],
            'ncf': factura.get('ncf'),
            'uuid': f"FAC-{factura['id']:06d}",
            'fecha_creacion': factura['fecha'].strftime('%d/%m/%Y %H:%M'),
            'fecha_vencimiento': (factura['fecha']).strftime('%d/%m/%Y'),
            'metodo_pago': factura['metodo_pago'],
            'estado': factura['estado'],
            'cliente_nombre': factura['cliente_nombre'] or 'Consumidor Final',
            'cliente_rnc': factura['cliente_rnc'] or '000-000000-0',
            'persona_nombre': factura['cliente_nombre'] or 'Consumidor Final',
            'persona_doc': factura['cliente_rnc'] or '000-000000-0',
            'persona_direccion': factura.get('cliente_direccion', ''),
            'persona_telefono': factura.get('cliente_telefono', ''),
            'subtotal': float(factura['subtotal']),
            'itbis_total': float(factura['impuesto']),
            'total': float(factura['total']),
            'tipo': 'venta'
        }
        
        detalles_data = []
        for d in factura.get('detalles', []):
            detalles_data.append({
                'nombre': d['producto_nombre'],
                'cantidad': float(d['cantidad']),
                'precio': float(d['precio'])
            })
            
        class Utils:
            @staticmethod
            def formatCurrency(value):
                return f"RD$ {float(value):,.2f}"
        
        # Renderizar el HTML
        html = render_template('facturacion/factura_impresion_pdf.html', 
                               factura=factura_data, 
                               detalles=detalles_data, 
                               empresa=empresa,
                               utils=Utils,
                               is_cotizacion=False)
        
        # Convertir HTML a PDF real usando xhtml2pdf
        import io
        from xhtml2pdf import pisa
        
        result = io.BytesIO()
        pdf = pisa.CreatePDF(io.BytesIO(html.encode("UTF-8")), dest=result)
        
        if not pdf.err:
            response = make_response(result.getvalue())
            response.headers['Content-Type'] = 'application/pdf'
            response.headers['Content-Disposition'] = f'inline; filename=Factura_{factura_id}.pdf'
            return response
        else:
            return jsonify({"success": False, "mensaje": "Error al generar archivo PDF"}), 500
        
    except Exception as e:
        print(f"Error generando PDF real: {str(e)}")
        return jsonify({"success": False, "mensaje": f"Error interno: {str(e)}"}), 500
@bp.route('/api/facturas/<int:factura_id>/ticket', methods=['GET'])
def get_ticket_data(factura_id):
    """Genera el texto plano para impresión en ticket térmico."""
    try:
        factura = get_factura_con_detalles(factura_id)
        if not factura:
            return jsonify({"success": False, "mensaje": "Factura no encontrada"}), 404
        
        from configuracion.configuracion import MOCK_EMPRESA, MOCK_CONFIG
        empresa = MOCK_EMPRESA
        
        # Generar texto del ticket
        line = "=" * 32 + "\n"
        center = lambda s: s.center(32) + "\n"
        left_right = lambda l, r: f"{l:<20}{r:>12}\n"
        
        t = ""
        t += center(empresa['nombre'].upper())
        t += center(empresa['rnc'])
        t += center(empresa['direccion'][:32])
        t += center(empresa['telefono'])
        t += line
        t += center("FACTURA DE VENTA")
        t += f"Factura: FAC-{factura['id']:06d}\n"
        if factura.get('ncf'):
            t += f"NCF: {factura['ncf']}\n"
        t += f"Fecha: {factura['fecha'].strftime('%d/%m/%Y %H:%M')}\n"
        t += f"Cliente: {(factura['cliente_nombre'] or 'Consumidor Final')[:22]}\n"
        t += line
        t += f"{'CANT' :<5}{'DESCRIPCION' :<17}{'TOTAL' :>10}\n"
        t += "-" * 32 + "\n"
        
        for d in factura.get('detalles', []):
            cant = f"{float(d['cantidad']):.0f}"
            desc = d['producto_nombre'][:16]
            precio_total = float(d['cantidad']) * float(d['precio'])
            t += f"{cant:<5}{desc:<17}{precio_total:>10.2f}\n"
            
        t += line
        t += left_right("SUBTOTAL:", f"{float(factura['subtotal']):.2f}")
        t += left_right("ITBIS (18%):", f"{float(factura['impuesto']):.2f}")
        t += left_right("TOTAL:", f"{float(factura['total']):.2f}")
        t += line
        t += center("GRACIAS POR SU COMPRA")
        t += center("Vuelva Pronto")
        t += "\n\n\n\n" # Espacio para el corte
        
        return jsonify({
            "success": True,
            "ticket_data": t,
            "agent_url": MOCK_CONFIG.get('agente_impresion_url', 'http://localhost:5001/print'),
            "agent_token": MOCK_CONFIG.get('agente_impresion_token', '')
        })
        
    except Exception as e:
        print(f"Error generando TICKET: {str(e)}")
        return jsonify({"success": False, "mensaje": str(e)}), 500
