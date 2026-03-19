document.addEventListener('DOMContentLoaded', function () {
    // --- Referencias UI ---
    const elements = {
        body: document.getElementById('usuariosBody'),
        modal: new bootstrap.Modal(document.getElementById('modalUsuario')),
        form: document.getElementById('formUsuario'),

        // KPIs
        kTotal: document.getElementById('kpi-total'),
        kAct: document.getElementById('kpi-activos'),
        kAcc: document.getElementById('kpi-accesos'),
        kBloq: document.getElementById('kpi-bloqueados'),

        // Modal Fields
        uId: document.getElementById('usr-id'),
        uNom: document.getElementById('usr-nombre'),
        uRol: document.getElementById('usr-rol'),
        uUsr: document.getElementById('usr-username'),
        uMail: document.getElementById('usr-email'),
        uPwd: document.getElementById('usr-password'),
        uForz: document.getElementById('usr-forzar'),

        secPwd: document.getElementById('sec-password'),
        secAud: document.getElementById('sec-auditoria-ficha'),
        tBloq: document.getElementById('btnToggleBloqueo'),
        tActi: document.getElementById('btnToggleActivo'),

        title: document.getElementById('modalUsuarioTitle'),
        subtitle: document.getElementById('modalUsuarioSubtitle'),
        avatar: document.getElementById('view-avatar'),
        audContainer: document.getElementById('auditoria-container')
    };

    let dataTable = null;
    let currentUser = null;

    const DT_LANG_ES = {
        "sProcessing": "Procesando...",
        "sLengthMenu": "Mostrar _MENU_ registros",
        "sZeroRecords": "No se encontraron resultados",
        "sEmptyTable": "Ningún dato disponible en esta tabla",
        "sInfo": "Mostrando _START_ al _END_ de _TOTAL_ registros",
        "sInfoEmpty": "Mostrando 0 al 0 de 0 registros",
        "sInfoFiltered": "(filtrado de un total de _MAX_ registros)",
        "sSearch": "Buscar:",
        "oPaginate": { "sFirst": "Primero", "sLast": "Último", "sNext": "Siguiente", "sPrevious": "Anterior" }
    };

    // --- DataTable Initialization ---

    function initDataTable() {
        if (dataTable) return;

        // Búsqueda Personalizada
        $('#customSearch').on('keyup', function () {
            dataTable.search(this.value).draw();
        });

        dataTable = $('#tablaUsuarios').DataTable({
            language: DT_LANG_ES,
            info: false,
            responsive: true,
            pageLength: 100,
            dom: 'rt', // Solo tabla (r) y procesamiento (t). Buscador y paginación fuera.
            columns: [
                {
                    data: 'nombre_completo',
                    render: (data, type, row) => `
                        <div class="usr-id-wrapper">
                            <div class="usr-avatar">${data.charAt(0)}</div>
                            <div class="usr-info-text">
                                <div class="usr-name">${data}</div>
                                <div class="usr-subtext" style="color:var(--text-muted); font-size:0.8rem;">${row.email || row.username}</div>
                            </div>
                        </div>
                    `
                },
                {
                    data: 'rol',
                    render: (data, type, row) => {
                        const roles = { 'admin': 'ADMINISTRADOR', 'gerente': 'GERENTE', 'empleado': 'EMPLEADO' };
                        return `
                            <div class="usr-info-text">
                                <span class="role-tag">${roles[data] || data.toUpperCase()}</span>
                                <div class="usr-username-sub" style="margin-top:4px; font-weight:600; font-size:0.75rem;">@${row.username}</div>
                            </div>
                        `;
                    }
                },
                {
                    data: 'activo',
                    render: (data, type, row) => `
                        <span class="badge-usr ${row.bloqueado ? 'badge-blocked' : (row.activo ? 'badge-active' : 'badge-inactive')}">
                            <i class="fas ${row.bloqueado ? 'fa-user-slash' : (row.activo ? 'fa-check-circle' : 'fa-times-circle')} me-1"></i>
                            ${row.bloqueado ? 'BLOQUEADO' : (row.activo ? 'ACTIVO' : 'INACTIVO')}
                        </span>
                    `
                },
                {
                    data: 'ultimo_acceso',
                    render: (data) => `<span style="font-weight:600; font-size:0.85rem; color:var(--text-muted);"><i class="far fa-clock me-1"></i> ${data || 'Sin datos'}</span>`
                },
                {
                    data: null,
                    className: 'action-cell',
                    orderable: false,
                    render: (data, type, row) => `
                        <div class="action-group d-flex gap-2">
                            <button class="btn btn-light btn-sm rounded-3 shadow-sm" onclick="verAuditoria(${row.id})" title="Trazabilidad">
                                <i class="fas fa-fingerprint text-primary"></i>
                            </button>
                            <button class="btn btn-primary btn-sm rounded-3 shadow-sm border-0" onclick="editarUsuario(${row.id})" style="background:var(--accent-gradient);">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    `
                }
            ],
            createdRow: function (row, data) {
                // Atributos para el CSS de Mobile Cards
                $('td:eq(0)', row).attr('data-label', 'Colaborador');
                $('td:eq(1)', row).attr('data-label', 'Identidad');
                $('td:eq(2)', row).attr('data-label', 'Estado');
                $('td:eq(3)', row).attr('data-label', 'Acceso');
                $('td:eq(4)', row).attr('data-label', 'Gestión');
            }
        });
    }

    // --- Carga de Datos (Optimized) ---

    async function fetchWithTimeout(resource, options = {}) {
        const { timeout = 8000 } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(resource, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    }

    async function loadData() {
        try {
            initDataTable();

            // Stats (Timeout: 5s - Fail silent/log)
            try {
                const rStats = await fetchWithTimeout('/usuarios/api/stats', { timeout: 5000 });
                const s = await rStats.json();
                if (s.ok) {
                    elements.kTotal.textContent = s.stats.total;
                    elements.kAct.textContent = s.stats.activos;
                    elements.kAcc.textContent = s.stats.accesos_hoy;
                    elements.kBloq.textContent = s.stats.bloqueados;
                }
            } catch (e) { console.warn("Stats load slow/failed:", e); }

            // Listado (Timeout: 8s - Fail Critical -> System Lock)
            try {
                const rUsers = await fetchWithTimeout('/usuarios/data', { timeout: 8000 });
                if (!rUsers.ok) throw new Error(`HTTP Error ${rUsers.status}`);
                const users = await rUsers.json();

                dataTable.clear();
                dataTable.rows.add(users);
                dataTable.draw();
            } catch (e) {
                console.error("Critical User Load Error:", e);
                // Redirigir a System Lock con metadatos
                window.location.href = `/system-lock?reason=timeout_usuarios&msg=${encodeURIComponent(e.message)}`;
            }

        } catch (e) { console.error(e); }
    }

    // --- Usuario CRUD ---

    window.abrirModalUsuario = function () {
        elements.form.reset();
        elements.uId.value = '';
        elements.title.textContent = 'Nuevo Colaborador';
        elements.subtitle.textContent = 'Ingrese los datos básicos para crear un nuevo perfil de acceso.';
        elements.avatar.textContent = '+';
        elements.secPwd.style.display = 'block';
        elements.secAud.style.display = 'none';

        // Reset dias libres
        document.querySelectorAll('#dias-libres-container input[type="checkbox"]').forEach(c => c.checked = false);

        // FILTRO DE ROLES: SI EL USUARIO ES GERENTE, SOLO PUEDE CREAR EMPLEADOS
        const rolActual = document.querySelector('.users-app').dataset.rolActual;
        if (rolActual === 'gerente') {
            Array.from(elements.uRol.options).forEach(opt => {
                if (opt.value !== 'empleado') opt.style.display = 'none';
                else opt.selected = true;
            });
        } else {
            Array.from(elements.uRol.options).forEach(opt => opt.style.display = 'block');
        }

        elements.modal.show();
    };

    window.editarUsuario = async function (id) {
        try {
            const r = await fetch(`/usuarios/${id}`);
            const data = await r.json();
            if (data.ok) {
                currentUser = data.user;
                elements.uId.value = currentUser.id;
                elements.uNom.value = currentUser.nombre_completo;
                elements.uUsr.value = currentUser.username;
                if (elements.uMail) elements.uMail.value = currentUser.email || '';
                elements.uRol.value = currentUser.rol;
                elements.uForz.checked = currentUser.forzar_cambio_pwd;

                elements.title.textContent = currentUser.username; // Design shows username "gerente" as title
                elements.subtitle.textContent = `Gestión institucional de ${currentUser.rol.toUpperCase()}`;
                elements.avatar.textContent = currentUser.nombre_completo.charAt(0);

                elements.secPwd.style.display = 'none';
                elements.secAud.style.display = 'block';

                // Dias libres load
                document.querySelectorAll('#dias-libres-container input[type="checkbox"]').forEach(c => c.checked = false);
                if (currentUser.dias_libres) {
                    const dias = currentUser.dias_libres.split(',');
                    dias.forEach(d => {
                        const check = document.getElementById(`dia-${d}`);
                        if (check) check.checked = true;
                    });
                }

                updateStatusButtons();
                elements.modal.show();
            }
        } catch (e) { console.error(e); }
    };

    function updateStatusButtons() {
        const isBloq = currentUser.bloqueado;
        elements.tBloq.innerHTML = isBloq ? '<i class="fas fa-unlock-alt"></i> Desbloquear' : '<i class="fas fa-user-lock"></i> Bloquear';
        elements.tBloq.className = isBloq ? 'btn-action-admin text-success' : 'btn-action-admin text-danger';

        const isAct = currentUser.activo;
        elements.tActi.innerHTML = isAct ? '<i class="fas fa-trash-alt"></i> Eliminar' : '<i class="fas fa-user-plus"></i> Reactivar';
        elements.tActi.className = isAct ? 'btn-action-admin text-danger' : 'btn-action-admin text-primary';
    }

    window.guardarUsuario = async function () {
        const id = elements.uId.value;
        const payload = {
            nombre: elements.uNom.value,
            username: elements.uUsr.value,
            email: elements.uMail ? elements.uMail.value : '',
            rol: elements.uRol.value,
            rol: elements.uRol.value,
            forzar_cambio: elements.uForz.checked,
            dias_libres: Array.from(document.querySelectorAll('#dias-libres-container input[type="checkbox"]:checked')).map(c => c.value).join(',')
        };
        if (!id) {
            if (!elements.uPwd.value) {
                Swal.fire('Atención', 'La contraseña es obligatoria para nuevos usuarios', 'warning');
                return;
            }
            payload.password = elements.uPwd.value;
        }

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/usuarios/${id}` : '/usuarios';

        try {
            const r = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const res = await r.json();
            if (res.ok) {
                elements.modal.hide();
                Swal.fire({
                    title: '¡Éxito!',
                    text: id ? 'Perfil institucional actualizado' : 'Usuario creado correctamente',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false,
                    borderRadius: 15
                });
                loadData();
            } else {
                Swal.fire('Error', res.error, 'error');
            }
        } catch (e) { Swal.fire('Error', 'Fallo de conexión', 'error'); }
    };

    // --- Acciones Seguridad ---

    window.toggleBloqueo = async function () {
        const res = await fetch(`/usuarios/api/toggle-status/${currentUser.id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field: 'bloqueado' })
        });
        const data = await res.json();
        if (data.ok) {
            currentUser.bloqueado = data.nuevo_valor;
            updateStatusButtons();
            loadData();
        }
    };

    window.toggleActivo = async function () {
        const isEliminar = currentUser.activo;

        if (isEliminar) {
            const result = await Swal.fire({
                title: '¿Eliminar colaborador?',
                text: 'Esta acción desactivará el acceso del usuario, pero liberará un cupo en su límite de empleados para que pueda crear uno nuevo.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, Eliminar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#e74c3c'
            });
            if (!result.isConfirmed) return;
        }

        const res = await fetch(`/usuarios/api/toggle-status/${currentUser.id}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field: 'activo' })
        });
        const data = await res.json();
        if (data.ok) {
            currentUser.activo = data.nuevo_valor;
            updateStatusButtons();
            loadData();

            if (isEliminar) {
                const rolActual = document.querySelector('.users-app').dataset.rolActual;
                if (rolActual === 'gerente') {
                    elements.modal.hide();
                }

                Swal.fire({
                    title: 'Usuario Eliminado',
                    text: 'El colaborador ha sido desactivado y su cupo ha sido liberado.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        }
    };

    window.resetPassword = async function () {
        const { value: pass } = await Swal.fire({
            title: 'Reseteo de Seguridad',
            text: 'Asigne una contraseña temporal para este colaborador.',
            input: 'text',
            inputPlaceholder: 'Ingrese clave temporal...',
            showCancelButton: true,
            confirmButtonText: 'Asignar Clave',
            confirmButtonColor: 'var(--accent-primary)',
            cancelButtonText: 'Cancelar'
        });
        if (pass) {
            const r = await fetch(`/usuarios/api/reset-password/${currentUser.id}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pass })
            });
            if ((await r.json()).ok) Swal.fire('Hecho', 'Nueva clave asignada. El usuario deberá cambiarla al ingresar.', 'success');
        }
    };

    // --- Tabs ---
    window.switchTab = function (tabId, el) {
        document.querySelectorAll('.users-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        el.classList.add('active');
        document.getElementById(tabId).classList.add('active');

        // Ocultar búsqueda en Historial
        const searchWrapper = document.querySelector('.users-search-wrapper');
        if (tabId === 'tab-auditoria') {
            if (searchWrapper) {
                searchWrapper.style.opacity = '0';
                setTimeout(() => { if (el.classList.contains('active')) searchWrapper.style.display = 'none'; }, 300);
            }
            loadGlobalSecurityLog();
        } else {
            if (searchWrapper) {
                searchWrapper.style.display = 'block';
                setTimeout(() => { searchWrapper.style.opacity = '1'; }, 10);
            }
        }
    };

    async function loadGlobalSecurityLog() {
        const placeholder = document.getElementById('auditoria-placeholder');
        const container = document.getElementById('global-security-log');

        placeholder.innerHTML = `
            <div style="padding:40px;">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-2" style="font-weight:600; color:var(--text-muted);">Consultando Bitácora de Seguridad...</p>
            </div>
        `;

        try {
            const r = await fetch('/usuarios/api/security-log');
            const logs = await r.json();

            if (logs.length === 0) {
                placeholder.innerHTML = `
                    <div style="padding:60px 40px; color:var(--text-muted);">
                        <i class="fas fa-shield-alt" style="font-size: 3rem; opacity: 0.1; margin-bottom: 20px;"></i>
                        <p style="font-weight:700;">Sin incidentes de seguridad detectados recientemente.</p>
                    </div>
                `;
                return;
            }

            placeholder.style.display = 'none';
            container.style.display = 'block';
            container.innerHTML = `
                <div class="audit-history-wrapper">
                    <h3 class="form-card-title mt-0"><i class="fas fa-history me-2"></i>Historial de Acceso</h3>
                    <div class="table-responsive">
                        <table class="users-table audit-table">
                            <thead><tr><th>Fecha / Hora</th><th>Acción</th><th>Descripción</th><th>Contexto</th></tr></thead>
                            <tbody>
                                ${logs.map(l => `
                                    <tr>
                                        <td><span class="audit-date" style="font-weight:600;"><i class="far fa-calendar-alt me-1 opacity-50"></i> ${l.fecha}</span></td>
                                        <td><span class="badge-usr audit-badge" style="background:var(--accent-soft); color:var(--accent-primary); border:none;">${l.accion}</span></td>
                                        <td><span class="audit-desc" style="font-size:0.85rem; color:var(--text-main); font-weight:500;">${l.descripcion}</span></td>
                                        <td><span class="audit-exec" style="color:var(--accent-primary); font-size:0.8rem;">
                                            <i class="fas fa-user-shield me-1"></i> ${l.ejecutor_nombre || 'SISTEMA'} 
                                            ${l.target_nombre ? `<br><small class="text-muted">Sobre: ${l.target_nombre}</small>` : ''}
                                        </span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (e) { placeholder.innerHTML = 'Error de carga.'; }
    }

    window.verAuditoria = async function (id) {
        switchTab('tab-auditoria', document.querySelectorAll('.users-tab')[1]);
        const placeholder = document.getElementById('auditoria-placeholder');
        const container = document.getElementById('global-security-log');

        placeholder.style.display = 'block';
        container.style.display = 'none';

        placeholder.innerHTML = `
            <div style="padding:40px;">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-2" style="font-weight:600; color:var(--text-muted);">Filtrando historial de colaborador...</p>
            </div>
        `;

        try {
            const r = await fetch(`/usuarios/api/auditoria/${id}`);
            const logs = await r.json();

            if (logs.length === 0) {
                placeholder.innerHTML = `
                    <div style="padding:60px 40px; color:var(--text-muted);">
                        <i class="fas fa-shield-alt" style="font-size: 3rem; opacity: 0.1; margin-bottom: 20px;"></i>
                        <p style="font-weight:700;">Sin actividad registrada para este colaborador.</p>
                    </div>
                `;
                return;
            }

            placeholder.style.display = 'none';
            container.style.display = 'block';
            container.innerHTML = `
                <div class="audit-history-wrapper">
                    <h3 class="form-card-title mt-0"><i class="fas fa-history me-2"></i>Historial de Acceso (Filtrado)</h3>
                    <div class="table-responsive">
                        <table class="users-table audit-table">
                            <thead><tr><th>Fecha / Hora</th><th>Acción</th><th>Detalle</th><th>Administrador</th></tr></thead>
                            <tbody>
                                ${logs.map(l => `
                                    <tr>
                                        <td><span class="audit-date" style="font-weight:600;">${l.fecha}</span></td>
                                        <td><span class="badge-usr audit-badge" style="background:var(--accent-soft); color:var(--accent-primary); border:none;">${l.accion}</span></td>
                                        <td><span class="audit-desc" style="font-size:0.85rem; color:var(--text-main);">${l.descripcion}</span></td>
                                        <td><span class="audit-exec" style="color:var(--accent-primary); font-size:0.8rem;"><i class="fas fa-user-shield me-1"></i> ${l.ejecutor_nombre || 'SISTEMA'}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (e) { placeholder.innerHTML = 'Error de carga.'; }
    };

    loadData();
});
