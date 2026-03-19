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

# Check if the correct link is already there
# It might already be <a href="/configuracion" class="nav-item">

for rel_path in files_to_update:
    filepath = os.path.join(base_dir, rel_path)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        print(f"Checking {rel_path}:")
        if '/configuracion' in content:
            print("  - Includes /configuracion link")
        else:
            print("  - MISSING /configuracion link")
            
print("Check done.")
