from flask import Blueprint, render_template, request, jsonify
from ln_engine.services.licensing.client import LicenseService
import socket

from ln_engine.utils import login_required, solo_admin_required

bp = Blueprint('licencia', __name__)

@bp.route('/admin/licencia')
@login_required
def index():
    # 1. Obtener estado unificado (Agente -> Local -> Trial -> Master)
    status = LicenseService.get_license_status()
    
    # 2. Obtener dominio completo para detalle de capacidades
    domain = LicenseService.get_current_domain()
    
    # Detección de IP para ayuda al usuario
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        local_ip = s.getsockname()[0]
        s.close()
    except:
        local_ip = "127.0.0.1"

    status_map = {
        "ACTIVE": "✅ Sistema Protegido",
        "EXPIRED": "⚠️ Suscripción Vencida",
        "GRACE": "⏳ Periodo de Gracia",
        "TRIAL": "🛡️ Evaluación Institucional",
        "BLOCKED": "🚫 Sistema Bloqueado",
        "MISSING": "🆓 Modo Gratuito"
    }

    # Preparar datos para el template
    lic_info = {
        'plan': status.get('plan', 'FREE'),
        'status': status.get('status', 'MISSING').lower(),
        'expires_at': domain.expiry_date.strftime('%d/%m/%Y') if domain else 'N/A',
        'customer': domain.customer_id if domain else 'Público',
        'capabilities': [c.value for c in domain.features_override] if domain else []
    }

    return render_template('admin/licencia.html', 
                           lic=lic_info, 
                           local_ip=local_ip,
                           status_text=status_map.get(status.get('status'), "Estado Desconocido"),
                           domain=domain)
