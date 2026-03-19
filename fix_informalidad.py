import os

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

target = """                <a href="#" class="nav-item">
                    <i class="fas fa-calculator"></i>
                    <span>Calculadora</span>
                </a>
                <a href="#" class="nav-item">
                    <i class="fas fa-store-slash"></i>
                    <span>Informalidad</span>
                </a>"""

replacement = """                <a href="#" class="nav-item">
                    <i class="fas fa-calculator"></i>
                    <span>Calculadora de Inf.</span>
                </a>"""

for rel_path in files_to_update:
    filepath = os.path.join(base_dir, rel_path)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if target in content:
            content = content.replace(target, replacement)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {rel_path}")
        else:
            print(f"Target not found in {rel_path}")
    else:
        print(f"File not found: {rel_path}")
print("Done")
