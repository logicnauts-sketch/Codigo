// --- EXPOSICIÓN GLOBAL INMEDIATA ---
console.log("Iniciando script de configuración...");

window.loadSatelliteNodes = async function bootstrapLoad() {
    console.warn("loadSatelliteNodes (bootstrap) ejecutado. Re-intentando en 800ms...");
    setTimeout(() => {
        if (window.loadSatelliteNodes !== bootstrapLoad) {
            console.log("Bootstrap superado, llamando a implementación real.");
            window.loadSatelliteNodes();
        } else {
            console.warn("Bootstrap sigue activo, re-re-intentando...");
        }
    }, 800);
};

window.nodeAction = async function () {
    console.error("Acción de nodo no disponible aún (Bootstrap).");
};

// --- LÓGICA DE BACKUP (GLOBAL) ---
window.loadBackups = async function () {
    const tbody = document.getElementById('backupListBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando...</td></tr>';

    try {
        const res = await fetch('/backups/list');
        const files = await res.json();

        tbody.innerHTML = '';
        files.forEach(f => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
            <td data-label="Archivo">${f.name}</td>
            <td data-label="Tamaño">${f.size}</td>
            <td data-label="Fecha">${f.date}</td>
            <td class="text-end" data-label="Acciones">
                <div class="d-flex justify-content-end gap-2">
                    <button class="btn btn-outline-primary btn-sm btn-restore" data-file="${f.name}">
                        <i class="fas fa-undo"></i> Restaurar
                    </button>
                    <a href="/backups/download/${f.name}" class="btn btn-outline-secondary btn-sm">
                        <i class="fas fa-download"></i>
                    </a>
                </div>
            </td>
        `;
            tbody.appendChild(tr);
        });

        // Eventos de Restauración
        document.querySelectorAll('.btn-restore').forEach(btn => {
            btn.onclick = () => window.handleRestore(btn.dataset.file);
        });

    } catch (err) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-danger">Error al cargar backups.</td></tr>';
    }
};

window.handleRestore = async function (filename) {
    const res = await Swal.fire({
        title: '¿Restaurar Base de Datos?',
        text: `Se sobrescribirá toda la información actual con el respaldo: ${filename}. Esta acción NO se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, restaurar ahora',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d33'
    });

    if (!res.isConfirmed) return;

    Swal.fire({
        title: 'Restaurando...',
        text: 'Por favor no cierre la ventana.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const response = await fetch('/backups/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        const result = await response.json();
        if (result.success) {
            Swal.fire('¡Éxito!', result.message, 'success').then(() => {
                window.location.reload();
            });
        } else {
            throw new Error(result.message);
        }
    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
};

window.syncAllBackupsToMega = async function () {
    const btn = document.getElementById('btn-sync-mega');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
    }

    try {
        const res = await fetch('/backups/sync-all', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            Swal.fire('Éxito', data.message, 'success');
        } else {
            Swal.fire('Error', data.message, 'error');
        }
    } catch (err) {
        Swal.fire('Error', 'Error de conexión con el servidor.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Escanear y Sincronizar Todo';
        }
    }
};

// --- LÓGICA DE DATOS BANCARIOS (GLOBAL) ---
window.loadCuentasBancarias = async function () {
    const tbody = document.getElementById('cuentasBancariasListBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando cuentas...</td></tr>';

    try {
        const res = await fetch('/api/bancos/cuentas');
        const data = await res.json();

        tbody.innerHTML = '';
        data.forEach(c => {
            const tr = document.createElement('tr');
            const statusClass = c.sincro_activa ? 'text-success' : 'text-muted';
            const lastSync = c.ultima_sincro ? new Date(c.ultima_sincro).toLocaleString() : 'Nunca';

            tr.innerHTML = `
                <td data-label="Banco"><b>${c.banco}</b></td>
                <td data-label="Cuenta">${c.nombre_cuenta}<br><small class="text-muted">${c.numero_cuenta}</small></td>
                <td data-label="Sincro"><i class="fas fa-circle ${statusClass} me-2"></i> ${c.sincro_activa ? 'Activa' : 'Pausada'}</td>
                <td data-label="Última Sincro">${lastSync}</td>
                <td class="text-end" data-label="Acciones">
                    <div class="d-flex justify-content-end gap-2">
                        <button type="button" class="btn btn-outline-primary btn-sm" onclick="editarCuentaBancaria(${c.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger btn-sm" onclick="eliminarCuentaBancaria(${c.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No hay cuentas bancarias configuradas.</td></tr>';
        }
    } catch (err) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-danger text-center">Error al cargar cuentas bancarias.</td></tr>';
    }
};

window.abrirModalCuenta = async function () {
    const modal = new bootstrap.Modal(document.getElementById('modalCuentaBancaria'));
    const form = document.getElementById('formCuentaBancaria');
    if (form) form.reset();
    const idField = document.getElementById('cuenta_id');
    if (idField) idField.value = '';
    modal.show();
};

window.editarCuentaBancaria = async function (id) {
    try {
        const res = await fetch(`/api/bancos/cuentas/${id}`);
        const c = await res.json();

        const idField = document.getElementById('cuenta_id');
        if (idField) idField.value = c.id;
        const bancoField = document.getElementById('banco');
        if (bancoField) bancoField.value = c.banco;
        const nombreField = document.getElementById('nombre_cuenta');
        if (nombreField) nombreField.value = c.nombre_cuenta;
        const numeroField = document.getElementById('numero_cuenta');
        if (numeroField) numeroField.value = c.numero_cuenta;
        const sincroField = document.getElementById('sincro_activa_cuenta');
        if (sincroField) sincroField.checked = !!c.sincro_activa;
        const credField = document.getElementById('credencial');
        if (credField) credField.value = ''; // No se muestra por seguridad

        const modal = new bootstrap.Modal(document.getElementById('modalCuentaBancaria'));
        modal.show();
    } catch (err) {
        Swal.fire('Error', 'No se pudieron cargar los datos de la cuenta.', 'error');
    }
};

window.guardarCuentaBancaria = async function () {
    const idField = document.getElementById('cuenta_id');
    const id = idField ? idField.value : '';
    const payload = {
        banco: document.getElementById('banco').value,
        nombre_cuenta: document.getElementById('nombre_cuenta').value,
        numero_cuenta: document.getElementById('numero_cuenta').value,
        sincro_activa: document.getElementById('sincro_activa_cuenta').checked,
        credencial: document.getElementById('credencial').value
    };

    if (!payload.nombre_cuenta || !payload.numero_cuenta) {
        return Swal.fire('Atención', 'Nombre y número de cuenta son obligatorios.', 'warning');
    }

    const btn = document.getElementById('btnGuardarCuentaBancaria');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    }

    try {
        const url = id ? `/api/bancos/cuentas/${id}` : '/api/bancos/cuentas';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.success) {
            Swal.fire('¡Éxito!', 'Cuenta bancaria guardada correctamente.', 'success');
            const modalEl = document.getElementById('modalCuentaBancaria');
            if (modalEl) bootstrap.Modal.getInstance(modalEl).hide();
            window.loadCuentasBancarias();
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Guardar Cambios';
        }
    }
};

window.eliminarCuentaBancaria = async function (id) {
    const res = await Swal.fire({
        title: '¿Eliminar cuenta bancaria?',
        text: 'Se perderá el historial de sincronización asociado a esta cuenta.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar'
    });

    if (res.isConfirmed) {
        try {
            const response = await fetch(`/api/bancos/cuentas/${id}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.success) {
                Swal.fire('Eliminado', 'La cuenta ha sido removida.', 'success');
                window.loadCuentasBancarias();
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded: Iniciando inicialización...");
    try {
        // Referencias DOM
        const navItems = document.querySelectorAll('.nav-item');
        const panels = document.querySelectorAll('.panel-body');
        const panelTitle = document.getElementById('panel-title');
        const btnGuardar = document.getElementById('btnGuardarConfig');
        const btnDescartar = document.getElementById('btnDescartar');
        const form = document.getElementById('formConfig');
        let params_originales = {};
        let allSatelliteNodes = []; // Almacén para búsqueda local


        // Mapeo de Títulos
        const titles = {
            'panel-general': 'Operaciones Generales',
            'panel-license': 'Estado de Licencia y Suscripción',
            'panel-facturacion': 'Reglas de Facturación',
            'panel-caja': 'Control de Caja y Turnos',
            'panel-inventario': 'Gestión de Inventario',
            'panel-seguridad': 'Seguridad y Accesos',
            'panel-modulos': 'Gestión de Módulos del Sistema',
            'panel-unidades': 'Unidades de Medida y Dimensiones',
            'panel-backup': 'Copia de Seguridad (Local & Cloud)',
            'panel-ui': 'Configuración de Apariencia',
            'panel-automation': 'Servicios de Automatización',
            'panel-clientes-admin': 'Administración de Clientes',
            'panel-impresion': 'Impresoras y Agente de Impresión',
            'panel-impresion': 'Impresoras y Agente de Impresión',
            'panel-verifone': 'Gestión de Verifones de Red (IP)',
            'panel-bancos': 'Gestión Bancaria (Multi-Banco)'
        };

        // --- EXPOSICIONES Y TRIGGERS INICIALES ---
        // Las funciones ahora se definen globalmente abajo para máxima resiliencia.

        console.log("Configuración modular iniciada.");

        // Trigger para Bancos si ya estamos en ese panel (por URL o ID)
        if (document.getElementById('panel-bancos')) {
            console.log("Panel de bancos detectado, iniciando carga...");
            loadCuentasBancarias();
        }

        // Trigger de carga para Maestro / Satélites
        const masterTableMain = document.getElementById('satellite-nodes-list');
        if (masterTableMain) {
            console.log("Panel de satélites detectado, iniciando carga...");
            loadSatelliteNodes();
            setInterval(loadSatelliteNodes, 60000);
        }

        // Trigger para Unidades si el panel está presente
        if (document.getElementById('tablaUnidades')) {
            console.log("Panel de unidades detectado, iniciando carga...");
            loadUnidades();
        }

        // Trigger para Verifones si el panel está presente
        if (document.getElementById('verifonesListBody')) {
            console.log("Panel de verifones detectado, iniciando carga...");
            loadVerifones();
        }

        // Detectar cambios de panel para cargar datos específicos
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.target;
                if (target === 'panel-bancos') loadCuentasBancarias();
                if (target === 'panel-unidades') loadUnidades();
                if (target === 'panel-verifone') loadVerifones();
                if (target === 'panel-backup') loadBackups();
            });
        });

        // --- NAVEGACIÓN BASADA EN RUTAS ---
        // Ya no usamos switchPanel manual. Los enlaces <a> en config_base.html manejan la navegación.
        // Solo marcamos el item activo basándonos en la URL actual si fuera necesario (aunque ya lo hace Jinja en el servidor)

        // Cargar Datos Iniciales
        cargarDatos();

        // Auto-check agent status if on configuration page (SILENT MODE)
        setTimeout(() => {
            if (window.refreshAgentDiagnostics) window.refreshAgentDiagnostics(true);
        }, 800);

        async function cargarDatos() {
            try {
                const res = await fetch('/configuracion/datos');
                const data = await res.json();
                if (data.error) throw new Error(data.error);

                const params = data.params;
                const empresa = data.empresa;
                const license = data.license;
                params_originales = params;

                // 0. Poblar Licencia
                if (license) {
                    if (document.getElementById('license-msg')) document.getElementById('license-msg').textContent = license.msg;
                    if (document.getElementById('lbl-plan')) document.getElementById('lbl-plan').textContent = (license.plan || 'START').toUpperCase();

                    const expiresEl = document.getElementById('lbl-expires');
                    if (expiresEl) {
                        if (license.status === 'EXPIRED') {
                            expiresEl.textContent = 'SUSCRIPCIÓN EXPIRADA';
                            expiresEl.className = 'text-danger fw-bold';
                        } else {
                            // Si no hay fecha de expiración, asumimos trial pendiente o inicio basado en factura
                            expiresEl.textContent = license.expires ? new Date(license.expires).toLocaleDateString() : 'Pendiente de Inicio';
                        }
                    }

                    // Color de alerta
                    const alertBox = document.getElementById('license-alert');
                    if (alertBox) {
                        alertBox.className = 'config-alert'; // Reset
                        if (license.status === 'ACTIVE' || license.status === 'TRIAL') alertBox.classList.add('alert-success');
                        else if (license.status === 'GRACE') alertBox.classList.add('alert-warning');
                        else alertBox.classList.add('alert-danger');
                    }
                }

                // 1. Poblar General (Tabla Empresa)
                if (document.getElementById('cfg-moneda')) document.getElementById('cfg-moneda').value = empresa.moneda || 'DOP';
                if (document.getElementById('cfg-fmt-fecha')) document.getElementById('cfg-fmt-fecha').value = empresa.formato_fecha || 'DD/MM/YYYY';
                if (document.getElementById('cfg-zona')) document.getElementById('cfg-zona').value = empresa.zona_horaria || 'America/Santo_Domingo';
                if (document.getElementById('cfg-empresa-email')) document.getElementById('cfg-empresa-email').value = empresa.email || '';

                // 1.5. Poblar Bancos
                const bancos = data.bancos || {};
                if (document.getElementById('cfg-banco-principal')) document.getElementById('cfg-banco-principal').value = bancos.banco_principal || 'Generico';
                if (document.getElementById('cfg-frecuencia-cierre')) document.getElementById('cfg-frecuencia-cierre').value = bancos.frecuencia_cierre || 'diario';

                // 1.8. Configuración Multimoneda (Dinámica)
                const useMultiCurrency = document.getElementById('cfg-use-multicurrency');
                const rowTasa = document.getElementById('row-tasa-cambio');

                if (useMultiCurrency) {
                    // Estado inicial
                    configurarSwitch('cfg-use-multicurrency', params.uso_multimoneda);
                    if (rowTasa) rowTasa.style.display = (params.uso_multimoneda == '1') ? 'flex' : 'none';

                    // Listener de cambio
                    useMultiCurrency.addEventListener('change', (e) => {
                        if (rowTasa) rowTasa.style.display = e.target.checked ? 'flex' : 'none';
                    });
                }

                if (document.getElementById('cfg-tasa-usd')) document.getElementById('cfg-tasa-usd').value = params.tasa_dolar || 58.50;

                // 2. Poblar Switches y Inputs (Tabla Configuracion)
                // Solo poblamos si el elemento existe en el DOM (para soportar carga modular)

                // Facturacion
                configurarSwitch('cfg-inv-tax', params.inv_usar_impuestos);
                if (document.getElementById('cfg-fact-modo-tax')) document.getElementById('cfg-fact-modo-tax').value = params.fact_modo_impuestos || 'preguntar';
                if (document.getElementById('cfg-fact-itbis-tasa')) document.getElementById('cfg-fact-itbis-tasa').value = params.fact_itbis_tasa || 18;
                configurarSwitch('cfg-fact-anon', params.fact_permite_sin_cliente);
                configurarSwitch('cfg-fact-edit', params.fact_edicion_post);
                configurarSwitch('cfg-printer-bridge', params.agente_bridge_mode);
                configurarSwitch('cfg-validar-banco', params.validar_banco_documento);

                // Métodos de Pago Secundarios
                if (params.fact_metodos_adicionales) {
                    const metodos = params.fact_metodos_adicionales.split(',');
                    document.querySelectorAll('.payment-method-toggle').forEach(chk => {
                        chk.checked = metodos.includes(chk.value);
                    });
                }

                // Enforce 2-max limit
                document.querySelectorAll('.payment-method-toggle').forEach(chk => {
                    chk.addEventListener('change', () => {
                        const checked = document.querySelectorAll('.payment-method-toggle:checked');
                        if (checked.length > 2) {
                            chk.checked = false;
                            Swal.fire('Atención', 'Solo puede seleccionar un máximo de 2 métodos adicionales.', 'warning');
                        }
                    });
                });

                // Caja
                configurarSwitch('cfg-caja-req', params.caja_requerida_fact);
                configurarSwitch('cfg-caja-parcial', params.caja_permite_arqueo_parcial);

                // Inventario
                configurarSwitch('cfg-inv-neg', params.inv_stock_negativo);
                configurarSwitch('cfg-inv-alerta', params.inv_alerta_stock_bajo);
                if (document.getElementById('cfg-inv-min')) document.getElementById('cfg-inv-min').value = params.inv_stock_minimo_defecto || 0;
                // Módulos
                if (params.modulos_activos) {
                    try {
                        const modulos = JSON.parse(params.modulos_activos);
                        Object.keys(modulos).forEach(key => {
                            const input = document.querySelector(`input[data-module="${key}"]`);
                            if (input) input.checked = modulos[key];
                        });
                    } catch (e) { }
                }

                // Maestro
                if (document.getElementById('cfg-master-url')) document.getElementById('cfg-master-url').value = params.master_url || '';
                if (document.getElementById('cfg-satellite-id')) document.getElementById('cfg-satellite-id').value = params.satellite_id || '';
                configurarSwitch('cfg-sys-autolock', params.sys_auto_lock);

                // Impresion
                if (document.getElementById('cfg-printer-url')) document.getElementById('cfg-printer-url').value = params.agente_impresion_url || '';
                if (document.getElementById('cfg-printer-token')) document.getElementById('cfg-printer-token').value = params.agente_token || '';

                // Clientes Admin
                configurarSwitch('cfg-cli-credit-en', params.cli_credit_default);
                if (document.getElementById('cfg-cli-limit')) document.getElementById('cfg-cli-limit').value = params.cli_limit_default || 5000;
                configurarSwitch('cfg-cli-points-en', params.cli_points_enabled);
                configurarSwitch('cfg-cli-birthday-en', params.cli_birthday_alerts);

                // Automatización y MEGA
                const megaSwitch = document.getElementById('cfg-bkp-mega-en-auto');
                const megaBox = document.getElementById('mega-credentials-box');

                if (megaSwitch) {
                    const isEnabled = params.bkp_mega_enabled == '1' || params.bkp_mega_enabled === true;
                    configurarSwitch('cfg-bkp-mega-en-auto', isEnabled);
                    if (megaBox) megaBox.style.display = isEnabled ? 'block' : 'none';

                    megaSwitch.addEventListener('change', (e) => {
                        if (megaBox) megaBox.style.display = e.target.checked ? 'block' : 'none';
                    });
                }

                if (document.getElementById('cfg-bkp-mega-mail')) document.getElementById('cfg-bkp-mega-mail').value = params.bkp_mega_email || '';
                if (document.getElementById('cfg-bkp-mega-pass')) document.getElementById('cfg-bkp-mega-pass').value = params.bkp_mega_password || '';
                if (document.getElementById('cfg-bkp-retention')) document.getElementById('cfg-bkp-retention').value = params.bkp_retention_days || 7;

                configurarSwitch('cfg-webhook-en', params.webhook_enabled);
                if (document.getElementById('cfg-external-key')) document.getElementById('cfg-external-key').value = params.external_api_key || '';
                if (document.getElementById('cfg-wa-test-phone')) document.getElementById('cfg-wa-test-phone').value = params.whatsapp_test_phone || '';
                if (document.getElementById('cfg-n8n-url')) document.getElementById('cfg-n8n-url').value = params.n8n_webhook_url || '';
                if (document.getElementById('cfg-webhook-url')) document.getElementById('cfg-webhook-url').value = params.webhook_url_n8n || '';
                if (document.getElementById('cfg-webhook-secret')) document.getElementById('cfg-webhook-secret').value = params.webhook_secret || '';
                configurarSwitch('cfg-wa-en', params.integration_whatsapp_enabled);

                // Impresión
                if (document.getElementById('cfg-printer-url')) document.getElementById('cfg-printer-url').value = params.agente_impresion_url || 'http://localhost:5001/print';
                if (document.getElementById('cfg-printer-token')) document.getElementById('cfg-printer-token').value = params.agente_token || 'november';
                if (document.getElementById('cfg-printer-width')) document.getElementById('cfg-printer-width').value = params.printer_paper_width || '80mm';
                if (document.getElementById('cfg-global-print-format')) document.getElementById('cfg-global-print-format').value = params.global_print_format || 'default';
                configurarSwitch('cfg-ui-shortcuts', params.ui_shortcuts_enabled);

                // Seguridad
                configurarSwitch('cfg-sec-pwd', params.sec_cambio_contra_periodico);
                if (document.getElementById('cfg-sec-intentos')) document.getElementById('cfg-sec-intentos').value = params.sec_intentos_bloqueo || 5;
                if (document.getElementById('cfg-sec-timeout')) document.getElementById('cfg-sec-timeout').value = params.sec_timeout_sesion || 30;

            } catch (err) {
                console.error("Error detallado al cargar configuración:", err);
                Swal.fire('Error de Carga', `No se pudieron obtener los parámetros. Detalle: ${err.message}`, 'error');
            }
        }

        function configurarSwitch(id, valor) {
            const el = document.getElementById(id);
            if (el) el.checked = valor == '1' || valor === true;
        }

        // Guardar Configuración
        if (btnGuardar) {
            btnGuardar.onclick = async () => {
                const res = await Swal.fire({
                    title: '¿Confirmar cambios operativos?',
                    text: 'Ciertos parámetros pueden afectar el flujo legal y contable de la empresa de forma inmediata.',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, aplicar cambios',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#1c7ed6'
                });

                if (!res.isConfirmed) return;

                btnGuardar.disabled = true;
                btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

                // Recolectar datos dinámicamente según lo que esté presente en el DOM
                const params = {};
                const empresa = {};

                // Mapeo selectivo para Configuracion
                const mapConfig = {
                    'cfg-inv-tax': 'inv_usar_impuestos',
                    'cfg-fact-modo-tax': 'fact_modo_impuestos',
                    'cfg-fact-itbis-tasa': 'fact_itbis_tasa',
                    'cfg-fact-anon': 'fact_permite_sin_cliente',
                    'cfg-fact-edit': 'fact_edicion_post',
                    'cfg-caja-req': 'caja_requerida_fact',
                    'cfg-caja-parcial': 'caja_permite_arqueo_parcial',
                    'cfg-validar-banco': 'validar_banco_documento',
                    'cfg-inv-neg': 'inv_stock_negativo',
                    'cfg-inv-alerta': 'inv_alerta_stock_bajo',
                    'cfg-inv-min': 'inv_stock_minimo_defecto',
                    'cfg-sec-pwd': 'sec_cambio_contra_periodico',
                    'cfg-sec-intentos': 'sec_intentos_bloqueo',
                    'cfg-sec-timeout': 'sec_timeout_sesion',
                    'cfg-ui-allow-dark': 'ui_allow_dark_mode',
                    'cfg-webhook-en': 'webhook_enabled',
                    'cfg-webhook-url': 'webhook_url_n8n',
                    'cfg-n8n-url': 'n8n_webhook_url',
                    'cfg-webhook-secret': 'webhook_secret',
                    'cfg-wa-en': 'integration_whatsapp_enabled',
                    'cfg-external-key': 'external_api_key',
                    'cfg-wa-test-phone': 'whatsapp_test_phone',
                    'cfg-printer-url': 'agente_impresion_url',
                    'cfg-printer-token': 'agente_token',
                    'cfg-printer-width': 'printer_paper_width',
                    'cfg-printer-bridge': 'agente_bridge_mode',
                    'cfg-use-multicurrency': 'uso_multimoneda',
                    'cfg-tasa-usd': 'tasa_dolar',
                    'cfg-bkp-mega-en-auto': 'bkp_mega_enabled',
                    'cfg-bkp-mega-mail': 'bkp_mega_email',
                    'cfg-bkp-mega-pass': 'bkp_mega_password',
                    'cfg-bkp-retention': 'bkp_retention_days',
                    'cfg-master-url': 'master_url',
                    'cfg-sys-autolock': 'sys_auto_lock',
                    'cfg-caja-req': 'caja_requerida_fact',
                    'cfg-caja-parcial': 'caja_permite_arqueo_parcial',
                    'cfg-inv-neg': 'inv_stock_negativo',
                    'cfg-inv-alerta': 'inv_alerta_stock_bajo',
                    'cfg-inv-min': 'inv_stock_minimo_defecto',
                    'cfg-global-print-format': 'global_print_format',
                    'cfg-ui-shortcuts': 'ui_shortcuts_enabled'
                };

                Object.keys(mapConfig).forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        if (el.type === 'checkbox') params[mapConfig[id]] = el.checked ? '1' : '0';
                        else params[mapConfig[id]] = el.value;
                    }
                });

                // Mapeo selectivo para Empresa
                const mapEmpresa = {
                    'cfg-moneda': 'moneda',
                    'cfg-fmt-fecha': 'formato_fecha',
                    'cfg-zona': 'zona_horaria',
                    'cfg-empresa-email': 'email'
                };

                Object.keys(mapEmpresa).forEach(id => {
                    const el = document.getElementById(id);
                    if (el) empresa[mapEmpresa[id]] = el.value;
                });

                // Módulos (siempre se extraen si existen inputs de módulo)
                const modulos = extraerModulos();
                if (Object.keys(modulos).length > 0) params.modulos_activos = JSON.stringify(modulos);

                // Métodos de Pago Secundarios
                const metodosSel = Array.from(document.querySelectorAll('.payment-method-toggle:checked')).map(c => c.value);
                params.fact_metodos_adicionales = metodosSel.join(',');

                // Bancos
                const bancos = {};
                if (document.getElementById('cfg-banco-principal')) bancos.banco_principal = document.getElementById('cfg-banco-principal').value;
                if (document.getElementById('cfg-frecuencia-cierre')) bancos.frecuencia_cierre = document.getElementById('cfg-frecuencia-cierre').value;

                const payload = { params, empresa, bancos };

                try {
                    const response = await fetch('/configuracion/guardar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const result = await response.json();
                    if (result.success) {
                        Swal.fire('¡Éxito!', result.message, 'success');
                        params_originales = payload.params;

                        // Feedback visual de guardado por fila
                        const inputs = document.querySelectorAll('.config-input, .config-select, .switch input');
                        inputs.forEach(input => {
                            const row = input.closest('.config-row');
                            if (!row) return;
                            row.classList.add('save-success');
                            setTimeout(() => row.classList.remove('save-success'), 2000);
                        });
                    } else {
                        throw new Error(result.error);
                    }
                } catch (err) {
                    Swal.fire('Error', err.message, 'error');
                } finally {
                    btnGuardar.disabled = false;
                    btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Configuración Operativa';
                }
            };
        }

        // --- VALIDACIÓN DE MEGA ---
        window.validateMegaCredentials = async () => {
            const email = document.getElementById('cfg-bkp-mega-mail')?.value.trim();
            const pass = document.getElementById('cfg-bkp-mega-pass')?.value.trim();

            if (!email || !pass) {
                Swal.fire('Atención', 'Por favor, ingrese email y contraseña de MEGA.', 'warning');
                return;
            }

            Swal.fire({
                title: 'Validando...',
                text: 'Conectando a MEGA e inicializando carpetas...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            try {
                const res = await fetch('/configuracion/validate-mega', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password: pass })
                });
                const data = await res.json();

                if (data.success) {
                    Swal.fire('¡Éxito!', data.message, 'success');
                } else {
                    Swal.fire('Fallo de Validación', data.error, 'error');
                }
            } catch (e) {
                Swal.fire('Error Critico', 'No se pudo contactar con el servidor.', 'error');
            }
        };

        // Manejar Enter en campos de MEGA
        ['cfg-bkp-mega-mail', 'cfg-bkp-mega-pass'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        validateMegaCredentials();
                    }
                });
            }
        });



        function extraerModulos() {
            const modulos = {};
            document.querySelectorAll('input[data-module]').forEach(input => {
                modulos[input.dataset.module] = input.checked;
            });
            return modulos;
        }

        if (btnDescartar) {
            btnDescartar.onclick = () => window.location.reload();
        }

        // Initial load of backups is triggered by config_backup.html DOMContentLoaded

        const btnRunBackup = document.getElementById('btnRunBackup');
        if (btnRunBackup) {
            btnRunBackup.onclick = async () => {
                btnRunBackup.disabled = true;
                btnRunBackup.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ejecutando...';

                try {
                    const res = await fetch('/backups/manual', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                        Swal.fire('Éxito', data.message, 'success');
                        loadBackups();
                    } else {
                        Swal.fire('Error', data.message, 'error');
                    }
                } catch (err) {
                    Swal.fire('Error', 'Error de conexión.', 'error');
                } finally {
                    btnRunBackup.disabled = false;
                    btnRunBackup.innerHTML = '<i class="fas fa-play"></i> Ejecutar Backup Ahora';
                }
            };
        }





        // --- LÓGICA DE LICENCIA ---
        const btnInstall = document.getElementById('btnInstallLicense');
        if (btnInstall) {
            btnInstall.onclick = async () => {
                const token = document.getElementById('txt-license-token').value.trim();
                if (!token) return Swal.fire('Atención', 'Ingrese el token de licencia.', 'warning');

                btnInstall.disabled = true;
                btnInstall.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validando...';

                try {
                    const res = await fetch('/api/license/install', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token })
                    });
                    const data = await res.json();

                    if (data.success) {
                        await Swal.fire('Licencia Instalada', data.msg, 'success');
                        window.location.reload();
                    } else {
                        Swal.fire('Error de Validación', data.error || 'Licencia inválida', 'error');
                    }
                } catch (err) {
                    Swal.fire('Error', 'Error de comunicación con el servidor.', 'error');
                } finally {
                    btnInstall.disabled = false;
                    btnInstall.innerHTML = '<i class="fas fa-key"></i> Validar e Instalar';
                }
            };
        }

        // --- LÓGICA DE UNIDADES DE MEDIDA ---
        async function loadUnidades() {
            const tbody = document.getElementById('unidadesListBody');
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Cargando unidades...</td></tr>';

            try {
                const res = await fetch('/configuracion/unidades/listar');
                const data = await res.json();

                tbody.innerHTML = '';
                data.forEach(u => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                    <td data-label="Nombre"><b>${u.nombre}</b></td>
                    <td data-label="Abrevia.">${u.abreviatura || '-'}</td>
                    <td data-label="Fórmula">
                        <span class="badge ${u.usa_formula_dimension ? 'bg-info' : 'bg-secondary'}">
                            ${u.usa_formula_dimension ? 'SÍ (Fórmula)' : 'NO'}
                        </span>
                    </td>
                    <td class="text-end" data-label="Acciones">
                        <div class="d-flex justify-content-end gap-2">
                            <button class="btn btn-outline-primary btn-sm" onclick="abrirModalUnidad(${u.id}, '${u.nombre.replace(/'/g, "\\'")}', '${(u.abreviatura || '').replace(/'/g, "\\'")}', ${u.usa_formula_dimension})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="eliminarUnidad(${u.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                    tbody.appendChild(tr);
                });
            } catch (err) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-danger text-center">Error al cargar unidades.</td></tr>';
            }
        }

        window.abrirModalUnidad = async (id = null, nombre = '', abreviatura = '', usaFormula = 0) => {
            const { value: formValues } = await Swal.fire({
                title: id ? 'Editar Unidad' : 'Nueva Unidad de Medida',
                html: `
                <div class="text-start">
                    <label class="form-label small fw-bold">Nombre de la Unidad</label>
                    <input id="swal-u-nombre" class="form-control mb-3" value="${nombre}" placeholder="Ej: Metro, Libra, Cristal">
                    
                    <label class="form-label small fw-bold">Abreviatura</label>
                    <input id="swal-u-abrev" class="form-control mb-3" value="${abreviatura}" placeholder="Ej: m, lb, p2">
                    
                    <div class="form-check form-switch mt-2">
                        <input class="form-check-input" type="checkbox" id="swal-u-formula" ${usaFormula ? 'checked' : ''}>
                        <label class="form-check-label small fw-bold">¿Usar Fórmula Proporcional?</label>
                        <p class="text-muted" style="font-size: 0.7rem;">Activa cálculo (Tamaño x Precio) en facturación.</p>
                    </div>
                </div>
            `,
                showCancelButton: true,
                confirmButtonText: 'Guardar Unidad',
                preConfirm: () => {
                    const n = document.getElementById('swal-u-nombre').value.trim();
                    if (!n) return Swal.showValidationMessage('El nombre es obligatorio');
                    return {
                        id: id,
                        nombre: n,
                        abreviatura: document.getElementById('swal-u-abrev').value.trim(),
                        usa_formula_dimension: document.getElementById('swal-u-formula').checked
                    };
                }
            });

            if (formValues) {
                try {
                    const res = await fetch('/configuracion/unidades/guardar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(formValues)
                    });
                    if (res.ok) {
                        Swal.fire('Guardado', '', 'success');
                        loadUnidades();
                    }
                } catch (e) {
                    Swal.fire('Error', 'No se pudo guardar la unidad', 'error');
                }
            }
        };

        window.eliminarUnidad = async (id) => {
            const res = await Swal.fire({
                title: '¿Eliminar unidad?',
                text: 'Esta acción desactivará la unidad para nuevos productos.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33'
            });

            if (res.isConfirmed) {
                try {
                    await fetch(`/configuracion/unidades/eliminar/${id}`, { method: 'DELETE' });
                    loadUnidades();
                    Swal.fire('Eliminado', '', 'success');
                } catch (e) {
                    Swal.fire('Error', 'No se pudo eliminar', 'error');
                }
            }
        };

        // --- PRUEBA WHATSAPP ---
        const btnTestWA = document.getElementById('btnTestWA');
        if (btnTestWA) {
            btnTestWA.onclick = async () => {
                const phone = document.getElementById('cfg-wa-test-phone').value.trim();
                if (!phone) return Swal.fire('Atención', 'Ingrese un número para la prueba.', 'warning');

                btnTestWA.disabled = true;
                btnTestWA.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

                try {
                    const res = await fetch('/configuracion/automation/test-wa', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone })
                    });
                    const data = await res.json();
                    if (data.ok) {
                        Swal.fire('Evento Enviado', 'Se ha disparado el catálogo de prueba a n8n. Verifique su WhatsApp en unos segundos.', 'success');
                    } else {
                        Swal.fire('Error', data.error || 'No se pudo conectar con n8n', 'error');
                    }
                } catch (e) {
                    Swal.fire('Error Crítico', 'Error de red con el servidor core.', 'error');
                } finally {
                    btnTestWA.disabled = false;
                    btnTestWA.innerHTML = '<i class="fas fa-paper-plane"></i> Probar Enlace';
                }
            };
        }

        // --- INTEGRACIÓN AGENTE LOCAL ---
        // --- INTEGRACIÓN AGENTE LOCAL (CENTRO DE CONTROL) ---
        window.checkAgentConnection = async () => {
            let url = document.getElementById('cfg-printer-url').value.trim();
            const token = document.getElementById('cfg-printer-token').value.trim();

            if (!url) return Swal.fire('Atención', 'Configure la URL del agente primero.', 'warning');

            // Autocorrección de URL si solo ponen la IP
            if (!url.startsWith('http')) {
                url = 'http://' + (url.includes(':') ? url : url + ':5001/print');
                document.getElementById('cfg-printer-url').value = url;
            }

            // Advertencia de Seguridad (Mixed Content)
            if (window.location.protocol === 'https:' && (url.startsWith('http:') || url.includes('localhost') || url.includes('127.0.0.1'))) {
                const confirm = await Swal.fire({
                    title: 'Detección en Modo Bridge',
                    html: `Al usar <b>HTTPS</b>, el navegador prohibe el acceso directo a <b>localhost</b>.<br><br>
                       El sistema verificará si el agente ha reportado su estado al servidor recientemente.`,
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonText: 'Verificar vía Nube'
                });

                if (!confirm.isConfirmed) return;

                actualizarEstadoAgent('sync', 'Consultando servidor...');
                try {
                    const resp = await fetch('/configuracion/agente/status');
                    const data = await resp.json();
                    if (data.online) {
                        actualizarEstadoAgent('online', `Conectado vía Nube (${data.last_seen})`);
                        Swal.fire('Agente Detectado', 'El agente está reportando datos al servidor correctamente.', 'success');
                    } else {
                        actualizarEstadoAgent('offline', 'Agente no reporta al servidor.');
                        Swal.fire('Sin conexión', 'El agente local no ha reportado actividad recientemente.', 'error');
                    }
                } catch (e) {
                    actualizarEstadoAgent('offline', 'Error de red en servidor.');
                }
                return;
            }

            Swal.fire({
                title: 'Verificando Agente...',
                text: `Intentando conectar a ${url}`,
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            try {
                const res = await fetch(url.replace('/print', '/'), {
                    method: 'GET',
                    mode: 'cors',
                    headers: { 'X-Api-Token': token }
                });

                if (res.ok || res.status === 404) {
                    Swal.fire('Conectado', 'El agente de impresión está respondiendo correctamente.', 'success');
                    actualizarEstadoAgent('online');
                    refreshAgentDiagnostics(); // Cargar detalles extra automáticamente
                } else {
                    throw new Error('El agente respondió con error ' + res.status);
                }
            } catch (e) {
                actualizarEstadoAgent('offline');
                Swal.fire({
                    title: 'Agente no detectado',
                    html: `<p class="text-start">No se pudo conectar con <b>${url}</b>.</p>`,
                    icon: 'error'
                });
            }
        };

        window.toggleAjustesAvanzados = () => {
            const el = document.getElementById('ajustes-avanzados-agente');
            el.style.display = el.style.display === 'none' ? 'block' : 'none';
        };

        window.lanzarAgenteLocal = async () => {
            const btn = event ? event.currentTarget : null;
            if (btn) btn.disabled = true;

            try {
                const resp = await fetch('/configuracion/agente/lanzar');
                const data = await resp.json();

                if (data.success) {
                    Swal.fire({
                        title: 'Iniciando Agente...',
                        text: data.msg || 'El comando fue enviado. Esperando confirmación de arranque...',
                        icon: 'info',
                        showConfirmButton: false,
                        timer: 3000
                    });

                    if (data.path) {
                        console.log("Agente lanzado desde:", data.path);
                    }

                    // Polling para verificar si levantó
                    let attempts = 0;
                    const maxBuscando = 10;
                    const interval = setInterval(async () => {
                        attempts++;
                        try {
                            // 1. Intento Directo (127.0.0.1 preferido)
                            const directCheck = await fetchWithTimeout('http://127.0.0.1:5001/', { method: 'GET', timeout: 2000 });
                            if (directCheck.ok) {
                                agentReady(interval);
                                return;
                            }
                        } catch (e) { /* Fallo silencioso directo */ }

                        try {
                            // 2. Intento Proxy (Backend)
                            const proxyCheck = await fetchWithTimeout('/configuracion/agente/proxy/diag', { timeout: 4000 });
                            if (proxyCheck.ok) {
                                agentReady(interval, 'Detectado vía Puente');
                                return;
                            }
                        } catch (e) { /* Fallo silencioso proxy */ }

                        console.log("Esperando agente...", attempts);

                        if (attempts >= maxBuscando) {
                            clearInterval(interval);
                            Swal.fire({
                                title: 'Iniciado, pero no detectado',
                                html: `
                                    <p>El comando se envió, pero la interfaz no logra confirmar la conexión.</p>
                                    <ul class="text-start small">
                                        <li>Es posible que el Agente ya esté corriendo.</li>
                                        <li>Intente recargar la página manualmente.</li>
                                    </ul>
                                `,
                                icon: 'warning'
                            });
                        }
                    }, 2000); // Polling cada 2s

                    function agentReady(interval, msg = '') {
                        clearInterval(interval);
                        Swal.fire({
                            title: '¡Agente Activo!',
                            text: msg || 'El agente de impresión se ha iniciado correctamente.',
                            icon: 'success',
                            timer: 2000,
                            showConfirmButton: false
                        });
                        // Auto-vincular para reflejarlo en la UI
                        if (window.autoVincularAgente) window.autoVincularAgente();

                        // Forzar actualización inmediata del estado
                        actualizarEstadoAgent('online', 'Agente: En Línea');
                    }

                } else {
                    Swal.fire('Error al iniciar', data.error || 'No se pudo abrir el agente.', 'error');
                }
            } catch (e) {
                notyf.error('Error de conexión con el servidor');
            } finally {
                if (btn) btn.disabled = false;
            }
        };

        window.autoVincularAgente = async () => {
            const btn = document.getElementById('btn-auto-vincular');
            const statusLabel = document.getElementById('vincular-status');
            const originalText = btn.innerHTML;

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Buscando...';
            statusLabel.innerText = 'Escaneando hardware local...';

            const localIPElement = document.getElementById('server-local-ip');
            const localIP = localIPElement ? localIPElement.value : '127.0.0.1';

            const candidates = [
                'http://localhost:5001/print',
                'http://127.0.0.1:5001/print',
                `http://${localIP}:5001/print`
            ];
            let found = false;
            for (let url of candidates) {
                try {
                    statusLabel.innerText = `Probando canal ${url.includes('localhost') ? 'Primario' : 'Secundario'}...`;

                    // Construir URL base
                    const baseUrl = url.replace('/print', '');

                    // Intentar /diag primero
                    let resp = await fetch(`${baseUrl}/diag`, { signal: AbortSignal.timeout(2000) });

                    // Si /diag da 404, intentar raíz /
                    if (!resp.ok) {
                        resp = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(2000) });
                    }

                    if (resp.ok) {
                        document.getElementById('cfg-printer-url').value = url;
                        statusLabel.innerText = '¡Vínculo establecido con éxito!';
                        statusLabel.style.color = 'var(--success)';
                        actualizarEstadoAgent('online', 'Agente vinculado automáticamente.');
                        refreshAgentDiagnostics();
                        found = true;
                        break;
                    }
                } catch (e) { continue; }
            }

            if (!found) {
                statusLabel.innerText = 'No se encontró el agente. Ábralo en su computadora.';
                statusLabel.style.color = 'var(--danger)';
                Swal.fire({
                    title: 'Agente no detectado',
                    text: 'Asegúrese de que el Agente de Impresión esté abierto en su computador antes de vincular.',
                    icon: 'warning',
                    confirmButtonText: 'Entendido'
                });
            } else {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Impresora vinculada correctamente',
                    showConfirmButton: false,
                    timer: 3000
                });
            }

            btn.disabled = false;
            btn.innerHTML = originalText;
        };

        function actualizarEstadoAgent(estado, texto) {
            // 1. Actualizar Orb (UI Local)
            const orb = document.getElementById('agent-orb');
            const dot = orb ? orb.querySelector('.status-dot') : null;
            const title = document.getElementById('agent-status-title');
            const desc = document.getElementById('agent-status-desc');

            if (orb && dot) {
                dot.className = 'status-dot';
                orb.style.animation = 'none';

                if (estado === 'online') {
                    dot.classList.add('status-online');
                    if (desc) {
                        desc.innerText = texto || 'Hardware listo para facturar.';
                        desc.style.color = 'var(--success)';
                    }
                } else if (estado === 'offline') {
                    dot.classList.add('status-offline');
                    if (desc) {
                        desc.innerText = texto || 'El agente local no responde.';
                        desc.style.color = 'var(--danger)';
                    }
                } else if (estado === 'sync') {
                    dot.classList.add('status-sync');
                    if (desc) {
                        desc.innerText = texto || 'Sincronizando con hardware...';
                    }
                    orb.style.animation = 'pulse 1.5s infinite';
                }
            }

            // 2. Actualizar Topbar (Global UI) - Config page overrides global check
            const pill = document.getElementById('agentStatusPill');
            const pillText = document.getElementById('agentStatusText');

            if (pill && pillText) {
                // Reset estilos inline para evitar conflictos
                pill.style.backgroundColor = '';
                pill.style.color = '';
                pill.style.border = '';

                if (estado === 'online') {
                    pill.className = 'status-pill online';
                    pillText.innerText = 'Agente: Online';
                    pill.title = texto || 'Conectado';
                    sessionStorage.setItem('ln_agent_status', 'online');
                } else if (estado === 'offline') {
                    pill.className = 'status-pill offline';
                    pillText.innerText = 'Agente: Offline';
                    sessionStorage.setItem('ln_agent_status', 'offline');
                } else if (estado === 'sync') {
                    pill.className = 'status-pill sync'; // Asegurar que coincida con CSS si existe, o usar base
                    pillText.innerText = 'Conectando...';
                }
            }
        }

        // Helper para timeout compatible
        const fetchWithTimeout = async (resource, options = {}) => {
            const { timeout = 5000 } = options;
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(resource, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(id);
            return response;
        };

        window.refreshAgentDiagnostics = async (silent = false) => {
            console.log("AGENTE: Iniciando diagnóstico v2.1...");
            const urlElement = document.getElementById('cfg-printer-url');
            if (!urlElement) return;
            let url = urlElement.value.trim();
            if (!url) return;

            if (typeof window.hasAutoLaunched === 'undefined') window.hasAutoLaunched = false;

            // Evitar parpadeo: Solo poner "Conectando" si el estado actual es offline o desconocido
            const currentStatus = sessionStorage.getItem('ln_agent_status');
            if (!currentStatus || currentStatus === 'offline') {
                actualizarEstadoAgent('sync', 'Conectando...');
            }

            try {
                // 1. Intento Directo (Local)
                let baseUrl = url.includes('/print') ? url.replace('/print', '') : url;
                if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

                console.log("AGENTE: Intentando directo a", baseUrl);

                let resp;
                try {
                    resp = await fetchWithTimeout(`${baseUrl}/diag`, { timeout: 2000 });
                    if (resp.status === 404) {
                        resp = await fetchWithTimeout(`${baseUrl}/`, { timeout: 2000 });
                    }
                } catch (directErr) {
                    throw new Error("Conexión directa fallida");
                }

                if (resp && resp.ok) {
                    const data = await resp.json();
                    actualizarEstadoAgent('online', 'Agente: Local OK');
                    // Save for global usage
                    localStorage.setItem('ln_agent_url', url);
                    if (document.getElementById('cfg-printer-token')) {
                        localStorage.setItem('ln_agent_token', document.getElementById('cfg-printer-token').value.trim());
                    }
                    return;
                } else {
                    throw new Error("Respuesta directa no válida: " + (resp ? resp.status : 'Sin respuesta'));
                }

            } catch (e) {
                console.warn("AGENTE: Fallo local, intentando Proxy...", e);
                actualizarEstadoAgent('sync', 'Probando Puente...');

                // 2. Intento vía Proxy (Backend)
                try {
                    const proxyResp = await fetchWithTimeout('/configuracion/agente/proxy/diag', { timeout: 5000 });
                    if (proxyResp.ok) {
                        const proxyData = await proxyResp.json();
                        actualizarEstadoAgent('online', 'Agente: En Línea (Modo Puente)');
                        // Save proxy mode preference
                        localStorage.setItem('ln_agent_mode', 'proxy');
                        return;
                    } else {
                        const errText = await proxyResp.text();
                        console.error("AGENTE: Proxy Error", proxyResp.status, errText);
                        throw new Error(`Proxy respondió ${proxyResp.status}`);
                    }
                } catch (proxyErr) {
                    console.error("AGENTE: Fallo total", proxyErr);
                    // Solo si falla todo, mostramos error
                    actualizarEstadoAgent('offline', `Error: ${proxyErr.message}`);

                    // Alerta visual para debug (Solo si no es silencioso)
                    if (!silent) {
                        Swal.fire({
                            title: 'Diagnóstico de Conexión',
                            html: `
                                <p class="text-start text-danger">Fallo Local: ${e.message}</p>
                                <p class="text-start text-warning">Fallo Puente: ${proxyErr.message}</p>
                                <p class="small text-muted">Verifique que el Agente esté corriendo.</p>
                            `,
                            icon: 'error'
                        });
                    }
                }
            }
        };

        window.runPrinterTest = async () => {
            const url = document.getElementById('cfg-printer-url').value.trim();
            const token = document.getElementById('cfg-printer-token').value.trim();
            actualizarEstadoAgent('sync', 'Imprimiendo...');

            const payload = { action: 'test', token: token, text: "LN SYSTEMS - HARDWARE OK" };

            try {
                // 1. Intento Directo
                const resp = await fetchWithTimeout(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    timeout: 3000
                });

                if (!resp.ok) throw new Error("Direct print failed");
                const data = await resp.json();

                if (data.success) {
                    Swal.fire('Éxito', 'Ticket de prueba emitido.', 'success');
                    actualizarEstadoAgent('online', 'Agente: Local OK');
                    return;
                } else { throw new Error(data.error); }

            } catch (e) {
                console.warn("Impresión directa falló, intentando Proxy...", e);
                // 2. Intento Proxy
                try {
                    const proxyResp = await fetchWithTimeout('/configuracion/agente/proxy/print', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        timeout: 8000
                    });

                    const proxyData = await proxyResp.json();
                    if (proxyData.success || proxyResp.ok) {
                        Swal.fire('Éxito', 'Ticket enviado vía Puente.', 'success');
                        actualizarEstadoAgent('online', 'Agente: En Línea (Modo Puente)');
                        return;
                    }
                } catch (pe) { console.error("Fallo proxy print", pe); }

                Swal.fire('Error', 'Fallo de impresión (Directa y Puente).', 'error');
                actualizarEstadoAgent('offline', 'Error de Impresión');
            }
        };

        window.checkAgentUpdates = async () => {
            const btn = event ? event.target : null;
            if (btn) btn.disabled = true;
            try {
                const resp = await fetch('/configuracion/agente/check-updates');
                const data = await resp.json();
                if (document.getElementById('update-last')) document.getElementById('update-last').innerText = new Date().toLocaleTimeString();
                notyf.success(data.new_version ? 'Nueva versión disponible' : 'Sistema actualizado');
            } catch (e) { notyf.error('Error de red'); }
            finally { if (btn) btn.disabled = false; }
        };

        window.fetchAgentLogs = async () => {
            const btn = event ? event.currentTarget : null;
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
            }

            const url = document.getElementById('cfg-printer-url').value.trim();

            // Normalizar URL base para evitar errores con replace
            let baseUrl = url.includes('/print') ? url.replace('/print', '') : url;
            if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

            const directUrl = `${baseUrl}/logs`;

            try {
                // Intento 1: Directo (Local Network)
                const resp = await fetch(directUrl, { signal: AbortSignal.timeout(5000) });
                if (!resp.ok) throw new Error("Direct fetch failed");
                const data = await resp.json();
                if (data.logs) {
                    showLogModal(data.logs, "Logs del Agente (Local)");
                } else {
                    throw new Error("No logs in response");
                }
            } catch (e) {
                console.warn("Fallo acceso directo a logs, intentando vía Bridge...", e);
                // Intento 2: Vía Servidor (Bridge)
                try {
                    const bridgeResp = await fetch('/configuracion/agente/logs-bridge');
                    const bridgeData = await bridgeResp.json();
                    if (bridgeData.success) {
                        showLogModal(bridgeData.logs, "Logs del Agente (Vía Nube)");
                    } else {
                        throw new Error(bridgeData.error || "No se pudieron obtener logs ni local ni remotamente.");
                    }
                } catch (bridgeErr) {
                    Swal.fire({
                        title: 'Error de Conexión',
                        text: 'No se pudieron descargar los logs del agente. Verifique que el agente esté ejecutándose.',
                        icon: 'error',
                        footer: '<a href="#">¿Por qué sucede esto?</a>'
                    });
                }
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-file-alt"></i> Ver Logs';
                }
            }
        };

        function showLogModal(content, title) {
            Swal.fire({
                title: title,
                html: `<pre id="log-content-pre" style="text-align:left;font-size:0.75rem;max-height:400px;overflow:auto;background:#f8f9fa;padding:10px;border-radius:5px;border:1px solid #ddd;">${content}</pre>`,
                width: '800px',
                showCloseButton: true,
                showConfirmButton: false,
                showDenyButton: true,
                showCancelButton: true,
                denyButtonText: '<i class="fas fa-trash"></i> Limpiar Logs',
                cancelButtonText: '<i class="fas fa-copy"></i> Copiar',
                cancelButtonColor: '#3085d6',
                denyButtonColor: '#d33',
                footer: '<small class="text-muted">Desplácese para ver más detalles</small>'
            }).then((result) => {
                if (result.dismiss === Swal.DismissReason.cancel) {
                    // Acción Copiar
                    navigator.clipboard.writeText(content).then(() => {
                        const Toast = Swal.mixin({
                            toast: true,
                            position: 'top-end',
                            showConfirmButton: false,
                            timer: 2000,
                            timerProgressBar: true
                        });
                        Toast.fire({ icon: 'success', title: 'Logs copiados al portapapeles' });
                    });
                } else if (result.isDenied) {
                    // Acción Limpiar
                    confirmClearLogs();
                }
            });
        }

        async function confirmClearLogs() {
            const res = await Swal.fire({
                title: '¿Limpiar historial de logs?',
                text: 'Esto vaciará el archivo de logs del servidor. No se puede deshacer.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'Sí, vaciar',
                cancelButtonText: 'Cancelar'
            });

            if (res.isConfirmed) {
                try {
                    const resp = await fetch('/configuracion/agente/logs-clear', { method: 'POST' });
                    const data = await resp.json();
                    if (data.success) {
                        Swal.fire('Limpiado', 'Los logs han sido vaciados.', 'success');
                    } else {
                        Swal.fire('Error', data.error || 'No se pudo limpiar el log.', 'error');
                    }
                } catch (e) {
                    Swal.fire('Error', 'Error de conexión', 'error');
                }
            }
        }


        // --- LÓGICA DE VERIFONES ---
        async function loadVerifones() {
            const tbody = document.getElementById('verifonesListBody');
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando verifones...</td></tr>';

            try {
                const res = await fetch('/configuracion/verifones/listar');
                const data = await res.json();

                tbody.innerHTML = '';
                data.forEach(v => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                    <td data-label="Nombre"><b>${v.nombre}</b></td>
                    <td data-label="IP"><code>${v.ip}</code></td>
                    <td data-label="Puerto">${v.puerto}</td>
                    <td data-label="Modelo"><span class="badge bg-secondary">${v.modelo || 'N/A'}</span></td>
                    <td class="text-end" data-label="Acciones">
                        <div class="d-flex justify-content-end gap-2">
                            <button class="btn btn-outline-primary btn-sm" onclick="abrirModalVerifone(${v.id}, '${v.nombre}', '${v.ip}', ${v.puerto}, '${v.modelo || ''}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="eliminarVerifone(${v.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                    tbody.appendChild(tr);
                });
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay verifones registrados.</td></tr>';
                }
            } catch (err) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-danger text-center">Error al cargar verifones.</td></tr>';
            }
        }

        window.abrirModalVerifone = async (id = null, nombre = '', ip = '', puerto = 5001, modelo = '') => {
            const { value: formValues } = await Swal.fire({
                title: id ? 'Editar Verifone' : 'Nuevo Verifone de Red',
                html: `
                <div class="text-start">
                    <label class="form-label small fw-bold">Nombre / Ubicación</label>
                    <input id="swal-v-nombre" class="form-control mb-3" value="${nombre}" placeholder="Ej: Caja Principal">
                    
                    <label class="form-label small fw-bold">Dirección IP</label>
                    <input id="swal-v-ip" class="form-control mb-3" value="${ip}" placeholder="Ej: 192.168.1.100">
                    
                    <div class="row">
                        <div class="col-6">
                            <label class="form-label small fw-bold">Puerto</label>
                            <input id="swal-v-puerto" type="number" class="form-control mb-3" value="${puerto}">
                        </div>
                        <div class="col-6">
                            <label class="form-label small fw-bold">Modelo</label>
                            <input id="swal-v-modelo" class="form-control mb-3" value="${modelo}" placeholder="Ej: VX520">
                        </div>
                    </div>
                </div>
            `,
                showCancelButton: true,
                confirmButtonText: 'Guardar dispositivo',
                preConfirm: () => {
                    const n = document.getElementById('swal-v-nombre').value.trim();
                    const i = document.getElementById('swal-v-ip').value.trim();
                    if (!n || !i) return Swal.showValidationMessage('Nombre e IP son obligatorios');
                    return {
                        id: id,
                        nombre: n,
                        ip: i,
                        puerto: document.getElementById('swal-v-puerto').value || 5001,
                        modelo: document.getElementById('swal-v-modelo').value.trim()
                    };
                }
            });

            if (formValues) {
                try {
                    const res = await fetch('/configuracion/verifones/guardar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(formValues)
                    });
                    if (res.ok) {
                        Swal.fire('Guardado', '', 'success');
                        loadVerifones();
                    }
                } catch (e) {
                    Swal.fire('Error', 'No se pudo guardar el verifone', 'error');
                }
            }
        };

        window.eliminarVerifone = async (id) => {
            const res = await Swal.fire({
                title: '¿Eliminar Verifone?',
                text: 'Se desconectará esta terminal del punto de venta.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33'
            });

            if (res.isConfirmed) {
                try {
                    await fetch(`/configuracion/verifones/eliminar/${id}`, { method: 'DELETE' });
                    loadVerifones();
                    Swal.fire('Eliminado', '', 'success');
                } catch (e) {
                    Swal.fire('Error', 'No se pudo eliminar', 'error');
                }
            }
        };

        window.checkCloudConnectivity = async function () {
            const btn = document.getElementById('btn-check-cloud');
            const orb = document.getElementById('cloud-status-orb');

            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
            }
            if (orb) {
                orb.className = 'status-dot offline';
                orb.style.animation = 'pulse 1s infinite';
            }

            try {
                const res = await fetch('/configuracion/maestro/ping');
                const data = await res.json();

                if (orb) {
                    orb.style.animation = 'none';
                    if (data.online) {
                        orb.className = 'status-dot online';
                        orb.title = `Conectado al Maestro: ${data.url}`;
                    } else {
                        orb.className = 'status-dot offline';
                        orb.title = `Sin conexión al Maestro. Error: ${data.error || 'Status ' + data.status}`;
                    }
                }

                if (data.online) {
                    notyf.success('Conexión con el Maestro establecida');
                } else {
                    notyf.error('No se pudo contactar al Servidor Maestro');
                }
            } catch (e) {
                if (orb) {
                    orb.style.animation = 'none';
                    orb.className = 'status-dot offline';
                }
                notyf.error('Error de red al verificar conexión con la nube');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-satellite-dish"></i> Probar Conexión';
                }
            }
        };

        // Auto-check cloud on load if panel exists
        if (document.getElementById('cloud-status-orb')) {
            setTimeout(window.checkCloudConnectivity, 2000);
        }

        // --- MÓDULO MAESTRO: CONTROL DE NODOS SATÉLITE ---

        async function loadSatelliteNodes() {
            console.log("loadSatelliteNodes: Iniciando ciclo de carga...");
            const tbody = document.getElementById('satellite-nodes-list');
            if (!tbody) {
                console.warn("loadSatelliteNodes: No se encontró 'satellite-nodes-list' en el DOM.");
                return;
            }

            // Feedback visual de inicio
            const syncToast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });

            syncToast.fire({
                icon: 'info',
                title: 'Sincronizando con nodos...'
            });

            try {
                console.log("loadSatelliteNodes: Fetching /configuracion/api/master/nodes ...");
                const res = await fetch('/configuracion/api/master/nodes');
                console.log("loadSatelliteNodes: Respuesta recibida, status:", res.status);

                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

                const data = await res.json();
                console.log("loadSatelliteNodes: JSON parseado con éxito. Success:", data.success);

                if (data.success) {
                    allSatelliteNodes = data.nodes;
                    console.log(`loadSatelliteNodes: ${data.nodes.length} nodos recibidos.`);
                    filterSatelliteNodes(); // Usar filtro al cargar
                    updateMasterKPIs(data.nodes);

                    syncToast.fire({
                        icon: 'success',
                        title: 'Nodos sincronizados correctamente'
                    });
                } else {
                    console.error("loadSatelliteNodes: El servidor retornó error:", data.error);
                    throw new Error(data.error || 'Error del servidor');
                }
            } catch (e) {
                console.error("loadSatelliteNodes: EXCEPCIÓN durante la carga:", e);
                syncToast.fire({
                    icon: 'error',
                    title: 'Error al sincronizar datos'
                });
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger"><i class="fas fa-wifi"></i> Error de conexión con el maestro.</td></tr>`;
            }
            console.log("loadSatelliteNodes: Fin de ciclo.");
        }

        function filterSatelliteNodes() {
            const query = document.getElementById('searchSatelliteNodes').value.toLowerCase().trim();
            if (!query) {
                renderNodeList(allSatelliteNodes);
                return;
            }

            const filtered = allSatelliteNodes.filter(n =>
                (n.empresa_nombre || '').toLowerCase().includes(query) ||
                (n.ip_publica || '').toLowerCase().includes(query) ||
                (n.ip_local || '').toLowerCase().includes(query) ||
                (n.token_secreto || '').toLowerCase().includes(query)
            );
            renderNodeList(filtered);
        }

        // Evento de búsqueda
        const searchInput = document.getElementById('searchSatelliteNodes');
        if (searchInput) {
            searchInput.addEventListener('keyup', filterSatelliteNodes);
        }

        function renderNodeList(nodes) {
            console.log("renderNodeList: Dibujando lista de nodos...");
            const tbody = document.getElementById('satellite-nodes-list');
            if (nodes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No hay nodos reportados aún.</td></tr>';
                return;
            }

            tbody.innerHTML = nodes.map(n => {
                // Lógica de "En línea" (últimos 5 minutos)
                let isOnline = false;
                let timeAgo = 'Nunca';
                if (n.ultima_conexion) {
                    const last = new Date(n.ultima_conexion);
                    const diff = (new Date() - last) / 1000 / 60; // Minutos
                    isOnline = diff <= 5;
                    timeAgo = formatTimeAgo(last);
                }

                const statusConfig = {
                    'TRIAL': { class: 'bg-info', icon: 'fa-clock', label: 'PRUEBA' },
                    'ACTIVE': { class: 'bg-success', icon: 'fa-check-circle', label: 'ACTIVO' },
                    'BLOCKED': { class: 'bg-danger', icon: 'fa-ban', label: 'BLOQUEADO' },
                    'SECURITY_RISK': { class: 'bg-warning text-dark', icon: 'fa-exclamation-triangle', label: 'RIESGO' },
                    'EXPIRED': { class: 'bg-secondary', icon: 'fa-hourglass-end', label: 'EXPIRADO' }
                }[n.estado] || { class: 'bg-secondary', icon: 'fa-question', label: n.estado };

                const planReported = (n.plan_reported || 'core').toUpperCase();
                const planAuthorized = (n.plan_authorized || 'core').toUpperCase();
                const planMismatch = planReported !== planAuthorized;

                return `
                <tr class="node-row ${isOnline ? 'online-pulse' : ''}">
                    <td>
                        <div class="d-flex align-items-center gap-3">
                            <div class="status-dot ${isOnline ? 'online' : 'offline'}" title="${isOnline ? 'En línea' : 'Desconectado'}"></div>
                            <div>
                                <div class="fw-bold mb-0 text-main">${n.empresa_nombre}</div>
                                <div class="text-muted" style="font-size: 0.75rem;">ID: <code class="text-muted">${n.token_secreto || 'No asignado'}</code></div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="d-flex flex-column" style="font-size: 0.8rem;">
                            <span title="IP Pública"><i class="fas fa-globe-americas opacity-50 me-1"></i> ${n.ip_publica || 'N/A'}</span>
                            <span class="text-muted" title="IP Local"><i class="fas fa-network-wired opacity-50 me-1"></i> ${n.ip_local || 'N/A'}</span>
                        </div>
                    </td>
                    <td>
                        <div class="d-flex flex-column gap-1">
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge border border-info text-info" style="font-size: 0.65rem;" title="Plan reportado por el cliente">
                                    <i class="fas fa-satellite"></i> ${planReported}
                                </span>
                            </div>
                            ${planMismatch ? `
                                <div class="d-flex align-items-center gap-2" style="margin-top: 2px;">
                                    <i class="fas fa-arrow-right text-muted" style="font-size: 0.7rem;"></i>
                                    <span class="badge bg-primary" style="font-size: 0.7rem; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.3);" title="Plan autorizado desde el Maestro">
                                        <i class="fas fa-certificate"></i> ${planAuthorized}
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                    </td>
                    <td>
                        <span class="badge ${statusConfig.class} d-inline-flex align-items-center gap-1">
                            <i class="fas ${statusConfig.icon}"></i> ${statusConfig.label}
                        </span>
                    </td>
                    <td>
                        <div class="d-flex flex-column">
                            <span class="text-main" style="font-size: 0.82rem; font-weight: 500;">${timeAgo}</span>
                            <span class="text-muted" style="font-size: 0.65rem;">${n.ultima_conexion || ''}</span>
                        </div>
                    </td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm rounded-pill overflow-hidden border border-secondary border-opacity-10 p-1 bg-secondary bg-opacity-10">
                            <button class="btn btn-ghost text-warning p-2" onclick="nodeAction('${n.id}', 'RENAME')" title="Renombrar Instalación">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-ghost text-success p-2" onclick="nodeAction('${n.id}', 'ACTIVATE')" title="Gestionar Plan / Activar">
                                <i class="fas fa-crown"></i>
                            </button>
                            <button class="btn btn-ghost text-info p-2" onclick="nodeAction('${n.id}', 'TRIAL')" title="Poner en Prueba">
                                <i class="fas fa-vial"></i>
                            </button>
                            <button class="btn btn-ghost text-danger p-2" onclick="nodeAction('${n.id}', 'BLOCK')" title="Bloquear Acceso">
                                <i class="fas fa-user-slash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            }).join('');
        }

        // Helper: Formatear tiempo transcurrido
        function formatTimeAgo(date) {
            const seconds = Math.floor((new Date() - date) / 1000);
            if (seconds < 60) return "Justo ahora";
            let interval = Math.floor(seconds / 31536000);
            if (interval >= 1) return `hace ${interval} año${interval > 1 ? 's' : ''}`;
            interval = Math.floor(seconds / 2592000);
            if (interval >= 1) return `hace ${interval} mes${interval > 1 ? 'es' : ''}`;
            interval = Math.floor(seconds / 86400);
            if (interval >= 1) return `hace ${interval} día${interval > 1 ? 's' : ''}`;
            interval = Math.floor(seconds / 3600);
            if (interval >= 1) return `hace ${interval} hora${interval > 1 ? 's' : ''}`;
            interval = Math.floor(seconds / 60);
            if (interval >= 1) return `hace ${interval} min`;
            return "hace unos segundos";
        }

        function updateMasterKPIs(nodes) {
            const total = document.getElementById('master-total-nodes');
            const trial = document.getElementById('master-trial-nodes');
            const security = document.getElementById('master-security-alerts');

            if (total) total.innerText = nodes.length;
            if (trial) trial.innerText = nodes.filter(n => n.estado === 'TRIAL').length;
            if (security) security.innerText = nodes.filter(n => n.estado === 'SECURITY_RISK' || n.estado === 'BLOCKED').length;
        }

        async function nodeAction(id, action) {
            let reason = null;
            let plan = 'enterprise';

            // Buscar datos del nodo actual para pre-seleccionar plan si existe
            const currentNode = allSatelliteNodes.find(n => n.id == id);
            const currentPlan = currentNode ? (currentNode.plan_authorized || 'core').toLowerCase() : 'enterprise';

            if (action === 'BLOCK') {
                const { value: text } = await Swal.fire({
                    title: 'Indique motivo del bloqueo',
                    input: 'textarea',
                    inputPlaceholder: 'Escriba la razón aquí...',
                    showCancelButton: true,
                    confirmButtonText: 'Confirmar Bloqueo',
                    confirmButtonColor: '#d33'
                });
                if (!text) return;
                reason = text;
            } else if (action === 'RENAME') {
                const { value: newName } = await Swal.fire({
                    title: 'Renombrar Instalación',
                    input: 'text',
                    inputValue: currentNode ? currentNode.empresa_nombre : '',
                    inputPlaceholder: 'Ingrese el nuevo nombre...',
                    showCancelButton: true,
                    confirmButtonText: 'Guardar Nombre',
                    inputValidator: (value) => {
                        if (!value) return '¡El nombre no puede estar vacío!';
                    }
                });
                if (!newName) return;
                reason = newName; // Usamos el campo reason para enviar el nuevo nombre en este caso
            } else if (action === 'ACTIVATE') {
                const { value: selectedPlan } = await Swal.fire({
                    title: 'Autorizar Nivel de Plan',
                    html: `
                        <style>
                            .plan-selection-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; min-width: 350px; }
                            .plan-tile { border: 2px solid #ddd; border-radius: 10px; padding: 12px; cursor: pointer; display: flex; flex-direction: column; align-items: center; background: #f9f9f9; transition: all 0.2s; }
                            .plan-tile.selected { border-color: #4f46e5; background: #eef2ff; }
                            .plan-tile i { font-size: 1.2rem; margin-bottom: 5px; }
                            .plan-tile span { font-weight: bold; font-size: 0.9rem; }
                            .plan-tile small { font-size: 0.7rem; color: #666; }
                        </style>
                        <div class="plan-selection-grid">
                            <div class="plan-tile ${currentPlan === 'core' ? 'selected' : ''}" data-plan="core">
                                <i class="fas fa-cube"></i>
                                <span>CORE</span>
                                <small>Básico e Inventario</small>
                            </div>
                            <div class="plan-tile ${currentPlan === 'premium' ? 'selected' : ''}" data-plan="premium">
                                <i class="fas fa-star"></i>
                                <span>PREMIUM</span>
                                <small>Fidelización + Reportes</small>
                            </div>
                            <div class="plan-tile ${currentPlan === 'pro' ? 'selected' : ''}" data-plan="pro">
                                <i class="fas fa-rocket"></i>
                                <span>PRO</span>
                                <small>Automatización + API</small>
                            </div>
                            <div class="plan-tile ${currentPlan === 'enterprise' ? 'selected' : ''}" data-plan="enterprise">
                                <i class="fas fa-crown"></i>
                                <span>ENTERPRISE</span>
                                <small>Control Maestro Total</small>
                            </div>
                        </div>
                        <input type="hidden" id="swal-selected-plan" value="${currentPlan}">
                    `,
                    showCancelButton: true,
                    confirmButtonText: 'Autorizar Plan',
                    didOpen: () => {
                        const tiles = Swal.getHtmlContainer().querySelectorAll('.plan-tile');
                        tiles.forEach(tile => {
                            tile.onclick = () => {
                                tiles.forEach(t => t.classList.remove('selected'));
                                tile.classList.add('selected');
                                document.getElementById('swal-selected-plan').value = tile.dataset.plan;
                            };
                        });
                    },
                    preConfirm: () => {
                        return document.getElementById('swal-selected-plan').value;
                    }
                });

                if (!selectedPlan) return;
                plan = selectedPlan;
            }

            // Mostrar estado de carga
            Swal.fire({
                title: 'Procesando...',
                text: 'Sincronizando con el nodo satélite',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            try {
                const res = await fetch('/configuracion/api/master/node-action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, action, reason, plan })
                });
                const data = await res.json();

                if (data.success) {
                    Swal.fire('¡Éxito!', 'Acción procesada y sincronizada', 'success');
                    loadSatelliteNodes();
                } else {
                    throw new Error(data.error || 'Error desconocido');
                }
            } catch (e) {
                console.error(e);
                Swal.fire('Error', e.message || 'No se pudo ejecutar la acción', 'error');
            }
        }

        // --- MEGA Cloud Tools ---
        async function syncAllBackupsToMega() {
            Swal.fire({
                title: 'Sincronizando con MEGA...',
                text: 'Escaneando archivos locales y organizando en carpetas ln_systems/',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            try {
                const res = await fetch('/configuracion/sync-mega', { method: 'POST' });
                const data = await res.json();

                if (data.success) {
                    Swal.fire('Sincronización Exitosa', data.message, 'success');
                } else {
                    Swal.fire('Atención', data.error, 'warning');
                }
            } catch (e) {
                console.error(e);
                Swal.fire('Error Critico', 'No se pudo comunicar con el servidor de respaldo.', 'error');
            }
        }

        // Global bank functions handled at top level

        const btnGuardarCuentaBancaria = document.getElementById('btnGuardarCuentaBancaria');
        if (btnGuardarCuentaBancaria) {
            btnGuardarCuentaBancaria.onclick = window.guardarCuentaBancaria;
        }

        // Las exportaciones a window se realizan ahora al inicio del bloque para mayor resiliencia.

        window.testAgentConnection = async () => {
            Swal.fire({
                title: 'Probando Conexión',
                text: 'Verificando acceso al Agente Local...',
                didOpen: () => { Swal.showLoading(); }
            });

            const urlElement = document.getElementById('cfg-printer-url');
            let url = urlElement ? urlElement.value.trim() : 'http://127.0.0.1:5001';
            let baseUrl = url.includes('/print') ? url.replace('/print', '') : url;
            if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

            let report = `<ul class="text-start small">`;

            try {
                // 1. Prueba Local
                const t0 = performance.now();
                report += `<li>🌍 Probando <b>${baseUrl}/diag</b>... `;
                try {
                    const resp = await fetchWithTimeout(`${baseUrl}/diag`, { timeout: 3000 });
                    const t1 = performance.now();
                    if (resp.ok) {
                        report += `<span class="text-success">OK (${Math.round(t1 - t0)}ms)</span></li>`;
                        Swal.fire({ title: '¡Éxito Local!', html: report + '</ul>', icon: 'success' });
                        actualizarEstadoAgent('online', 'Conexión Local Exitosa');
                        return;
                    } else {
                        report += `<span class="text-danger">Error ${resp.status}</span></li>`;
                    }
                } catch (e) {
                    report += `<span class="text-danger">Fallo (${e.message})</span></li>`;
                }

                // 2. Prueba Proxy
                report += `<li>🌉 Probando <b>Puente Proxy</b>... `;
                const t2 = performance.now();
                try {
                    const resp = await fetchWithTimeout('/configuracion/agente/proxy/diag', { timeout: 5000 });
                    const t3 = performance.now();
                    if (resp.ok) {
                        report += `<span class="text-success">OK (${Math.round(t3 - t2)}ms)</span></li>`;
                        Swal.fire({ title: '¡Éxito Vía Puente!', html: report + '</ul>', icon: 'success' });
                        actualizarEstadoAgent('online', 'En Línea (Puente)');
                        return;
                    } else {
                        const txt = await resp.text();
                        report += `<span class="text-danger">Error ${resp.status}: ${txt.substring(0, 50)}</span></li>`;
                    }
                } catch (e) {
                    report += `<span class="text-danger">Fallo (${e.message})</span></li>`;
                }

                report += `</ul>`;
                Swal.fire({
                    title: 'Conexión Fallida',
                    html: `<p>No se pudo contactar al agente.</p>${report}`,
                    icon: 'error'
                });
                actualizarEstadoAgent('offline', 'Prueba Fallida');

            } catch (fatal) {
                Swal.fire('Error Crítico', fatal.message, 'error');
            }
        };

    } catch (criticalError) {
        console.error("!!! ERROR CRÍTICO EN INICIALIZACIÓN DE CONFIGURACIÓN !!!", criticalError);
        Swal.fire({
            title: 'Error de Script',
            html: `Se detectó un error al cargar los componentes de configuración.<br><br><code>${criticalError.message}</code><br><br>Por favor, reporte este error al administrador.`,
            icon: 'error'
        });
    }

    // Auto-check agent status (delayed)
    setTimeout(() => {
        if (window.refreshAgentDiagnostics) window.refreshAgentDiagnostics();
    }, 1000);

    console.log("DOMContentLoaded: Fin de bloque (Configuraciones registradas).");
});
