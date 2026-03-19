import sys
import re

dropdown_template = '''                    <div class="dropdown">
                        <div class="user-display" role="button" data-bs-toggle="dropdown" aria-expanded="false" style="cursor: pointer;">
                            <div class="user-avatar text-white" style="background: var(--accent);">A</div>
                            <div class="user-meta">
                                <span class="user-name">Administrador</span>
                                <span class="user-role">ADMIN</span>
                            </div>
                            <i class="fas fa-chevron-down ms-2 text-muted" style="font-size: 0.8rem;"></i>
                        </div>
                        <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0 mt-2" style="border-radius: 12px; min-width: 200px;">
                            <li><h6 class="dropdown-header">Mi Cuenta</h6></li>
                            <li><hr class="dropdown-divider"></li>
                            <li>
                                <a class="dropdown-item text-danger fw-bold d-flex align-items-center py-2" href="/logout">
                                    <i class="fas fa-sign-out-alt me-2"></i> Cerrar Sesión
                                </a>
                            </li>
                        </ul>
                    </div>
'''

def process(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Remove sidebar footer
        content = re.sub(r'<div class="sidebar-footer">\s*<a href="/logout" class="nav-item" style="color: var\(--danger\)">\s*<i class="fas fa-sign-out-alt"></i>\s*<span>Cerrar Sesión</span>\s*</a>\s*</div>', '', content)

        # Replace user display
        content = re.sub(r'<div class="user-display">\s*<div class="user-avatar text-white" style="background: var\(--accent\);">A</div>\s*<div class="user-meta">\s*<span class="user-name">Administrador</span>\s*<span class="user-role">ADMIN</span>\s*</div>\s*</div>', dropdown_template.strip('\n'), content)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Processed {filepath}")
    except Exception as e:
        print(f"Error {filepath}: {e}")

process('C:/Users/Anyelis/Desktop/Jarabacoa_Proyecto/Negocios/Surti_Kids/Proyectos/Codigo/caja/templates/operaciones/caja.html')
process('C:/Users/Anyelis/Desktop/Jarabacoa_Proyecto/Negocios/Surti_Kids/Proyectos/Codigo/facturacion/templates/facturacion.html')
