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
    'productos/templates/productos.html',
    'configuracion/configuracion_ui.html'
]

base_dir = r'C:/Users/Anyelis/Desktop/Jarabacoa_Proyecto/Negocios/Surti_Kids/Proyectos/Codigo'

for rel_path in files_to_update:
    filepath = os.path.join(base_dir, rel_path)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace <body> with <body class="sidebar-hidden"> (only if not already there)
        if 'class="sidebar-hidden"' not in content:
            content = content.replace('<body>', '<body class="sidebar-hidden">', 1)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {rel_path}")
        else:
            print(f"Already has sidebar-hidden: {rel_path}")
    else:
        print(f"File not found: {rel_path}")

print("Done")
