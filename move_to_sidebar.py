import os
import re

files_to_update = [
    'usuarios/usuarios.html',
    'reporte_ventas/templates/reporteventas.html',
    'caja/templates/operaciones/caja.html',
    'facturacion/templates/facturacion.html',
    'home/home.html',
    'clientes/templates/clientes.html',
    'proveedores/templates/proveedores.html',
    'inventario/templates/inventario.html',
    'productos/templates/productos.html'
]

base_dir = r'C:/Users/Anyelis/Desktop/Jarabacoa_Proyecto/Negocios/Surti_Kids/Proyectos/Codigo'

dropdown_wrong = """                        <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0 mt-2" style="border-radius: 12px; min-width: 220px;">
                            <li><h6 class="dropdown-header">Mi Perfil</h6></li>
                            <li>
                                <a class="dropdown-item d-flex align-items-center py-2" href="#">
                                    <i class="fas fa-id-badge text-primary me-2"></i> Licencia
                                </a>
                            </li>
                            <li>
                                <a class="dropdown-item d-flex align-items-center py-2" href="#">
                                    <i class="fas fa-trophy text-warning me-2"></i> Logros
                                </a>
                            </li>
                            <li><hr class="dropdown-divider"></li>
                            <li><h6 class="dropdown-header">Herramientas</h6></li>
                            <li>
                                <a class="dropdown-item d-flex align-items-center py-2" href="#">
                                    <i class="fas fa-calculator text-success me-2"></i> Calculadora
                                </a>
                            </li>
                            <li>
                                <a class="dropdown-item d-flex align-items-center py-2" href="#">
                                    <i class="fas fa-store-slash text-secondary me-2"></i> Informalidad
                                </a>
                            </li>
                            <li><hr class="dropdown-divider"></li>
                            <li>
                                <a class="dropdown-item text-danger fw-bold d-flex align-items-center py-2" href="/logout">
                                    <i class="fas fa-sign-out-alt me-2"></i> Cerrar Sesión
                                </a>
                            </li>
                        </ul>"""

dropdown_correct = """                        <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0 mt-2" style="border-radius: 12px; min-width: 200px;">
                            <li><h6 class="dropdown-header">Mi Cuenta</h6></li>
                            <li><hr class="dropdown-divider"></li>
                            <li>
                                <a class="dropdown-item text-danger fw-bold d-flex align-items-center py-2" href="/logout">
                                    <i class="fas fa-sign-out-alt me-2"></i> Cerrar Sesión
                                </a>
                            </li>
                        </ul>"""

sidebar_addition = """
                <div class="sidebar-heading px-3 mt-4 mb-2 text-muted text-uppercase" style="font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px;">Extras</div>
                <a href="#" class="nav-item">
                    <i class="fas fa-id-badge"></i>
                    <span>Licencia</span>
                </a>
                <a href="#" class="nav-item">
                    <i class="fas fa-trophy"></i>
                    <span>Logros</span>
                </a>
                <a href="#" class="nav-item">
                    <i class="fas fa-calculator"></i>
                    <span>Calculadora</span>
                </a>
                <a href="#" class="nav-item">
                    <i class="fas fa-store-slash"></i>
                    <span>Informalidad</span>
                </a>"""

print("Starting replacement...")

for rel_path in files_to_update:
    filepath = os.path.join(base_dir, rel_path)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # 1. Revert dropdown
        if dropdown_wrong in content:
            content = content.replace(dropdown_wrong, dropdown_correct)
            
        # 2. Add to sidebar
        configuracion_html = '''<a href="/configuracion" class="nav-item">
                    <i class="fas fa-cog"></i>
                    <span>Configuración</span>
                </a>'''
        if configuracion_html in content and sidebar_addition not in content:
            content = content.replace(configuracion_html, configuracion_html + sidebar_addition)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {rel_path}")
    else:
        print(f"File not found: {rel_path}")

print("Done")
