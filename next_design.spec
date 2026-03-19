# -*- mode: python ; coding: utf-8 -*-
import os
import sys

block_cipher = None

# Lista de carpetas que deben incluirse (módulos con sus templates y static)
modules = [
    'caja', 'calculadora', 'clientes', 'configuracion', 'facturacion', 
    'home', 'infra', 'inventario', 'licencia', 'login', 'mis_logros', 
    'productos', 'proveedores', 'reporte_ventas', 'usuarios'
]

added_files = [
    ('static', 'static'),
    ('db_config.json', '.'),
]

# Agregar automáticamente carpetas templates y static de cada módulo
for mod in modules:
    # Templates
    if os.path.isdir(os.path.join(mod, 'templates')):
        added_files.append((os.path.join(mod, 'templates'), os.path.join(mod, 'templates')))
    # Static
    if os.path.isdir(os.path.join(mod, 'static')):
        added_files.append((os.path.join(mod, 'static'), os.path.join(mod, 'static')))

a = Analysis(
    ['run_app.py'],
    pathex=[],
    binaries=[],
    datas=added_files,
    hiddenimports=[
        'pymysql', 
        'pystray',
        'PIL',
        'olefile',
        'cryptography',
        'werkzeug.security',
        'reportlab', 
        'reportlab.graphics.barcode',
        'reportlab.graphics.barcode.common',
        'reportlab.graphics.barcode.code128',
        'reportlab.graphics.barcode.qr',
        'jinja2.ext'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='NextDesignApp',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # Ocultamos la consola para correr en segundo plano
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['static/favicon.ico'] if os.path.exists('static/favicon.ico') else None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='NextDesignApp',
)
