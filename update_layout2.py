import sys
import re

dropdown_template = '''                    <div class="dropdown">
                        <div class="user-display" role="button" data-bs-toggle="dropdown" aria-expanded="false" style="cursor: pointer; margin-left: 15px;">
                            <div class="user-avatar text-white" style="background: var(--accent);">{{ session.get('nombre_completo', 'U')[0] }}</div>
                            <div class="user-meta">
                                <span class="user-name">{{ session.get('nombre_completo', 'Usuario') }}</span>
                                <span class="user-role">{{ session.get('rol', 'Cajero').title() }}</span>
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
            lines = f.readlines()

        out = []
        skip = False
        for i, line in enumerate(lines):
            if '<div class="sidebar-footer">' in line:
                skip = True
            
            if skip:
                if '</aside>' in line:
                    skip = False
                    out.append('        </aside>\n')
                continue

            if '</header>' in line and '</div>' in lines[i-1]:
                # We reached the end of the topbar, insert before </div>
                out.pop() # remove the last </div>
                out.append(dropdown_template)
                out.append(lines[i-1]) # add back the </div>
            
            if not skip:
                out.append(line)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(out)
        print(f"Processed {filepath}")
    except Exception as e:
        print(f"Error {filepath}: {e}")

process('C:/Users/Anyelis/Desktop/Jarabacoa_Proyecto/Negocios/Surti_Kids/Proyectos/Codigo/clientes/templates/clientes.html')
process('C:/Users/Anyelis/Desktop/Jarabacoa_Proyecto/Negocios/Surti_Kids/Proyectos/Codigo/proveedores/templates/proveedores.html')
process('C:/Users/Anyelis/Desktop/Jarabacoa_Proyecto/Negocios/Surti_Kids/Proyectos/Codigo/inventario/templates/inventario.html')
process('C:/Users/Anyelis/Desktop/Jarabacoa_Proyecto/Negocios/Surti_Kids/Proyectos/Codigo/productos/templates/productos.html')
