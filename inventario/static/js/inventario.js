/**
 * LN SYSTEMS - INVENTORY PREMIUM LOGIC (v1.11)
 * Managed DataTables & Soft UI Integration
 */

let stockTable = null;
let inventoryData = [];

document.addEventListener('DOMContentLoaded', () => {
    initInventoryApp();
});

async function initInventoryApp() {
    initInstitutionalNotyf();
    await loadInventoryKPIs();
    await loadInventoryList();
    await loadMovementHistory();
    bindInstitutionalFilters(); // Bind filters after data is loaded
}

function initInstitutionalNotyf() {
    window.notyf = new Notyf({
        duration: 3500,
        position: { x: 'right', y: 'top' },
        types: [{
            type: 'success',
            background: '#4f46e5',
            icon: { className: 'fas fa-check-circle', tagName: 'i', color: '#fff' }
        }]
    });
}

// --- KPI MANAGEMENT ---
async function loadInventoryKPIs() {
    try {
        const res = await fetch('/inventario/api/stats');
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        const fmt = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' });

        document.getElementById('kpi-valor-venta').textContent = fmt.format(data.stats.valor_inventario);
        document.getElementById('kpi-valor-costo').textContent = fmt.format(data.stats.valor_costo);
        document.getElementById('kpi-bajo-stock').textContent = data.stats.stock_bajo;
        document.getElementById('kpi-mov-mes').textContent = data.stats.movimientos_mes;

        // Dynamic Warning Color
        document.getElementById('kpi-bajo-stock').style.color = data.stats.stock_bajo > 0 ? '#ef4444' : '#10b981';
    } catch (e) {
        console.error("KPI Error:", e);
    }
}

// --- TAB NAVIGATION ---
function switchTab(tabId, el) {
    // UI Update
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('d-none'));

    el.classList.add('active');
    const target = document.getElementById('tab-' + tabId);
    if (target) {
        target.classList.remove('d-none');
        // Fix DataTables alignment when tab becomes visible
        if (tabId === 'existencias' && stockTable) {
            stockTable.columns.adjust().draw();
        }
    }

    // Logic Trigger
    if (tabId === 'historial') loadMovementHistory();
    if (tabId === 'auditoria') checkAuditStatus();
}

// --- MANAGED DATATABLES (STACK) ---
async function loadInventoryList() {
    try {
        const res = await fetch('/inventario/api/list');
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        inventoryData = data.items;
        renderInventoryDataTable(data.items);
        populateInstitutionalSelect(data.items);
    } catch (e) {
        console.error("List Error:", e);
        notyf.error("No se pudo sincronizar el inventario.");
    }
}

function renderInventoryDataTable(items) {
    if ($.fn.DataTable.isDataTable('#tabla-stock')) {
        $('#tabla-stock').DataTable().destroy();
    }

    const fmt = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' });

    stockTable = $('#tabla-stock').DataTable({
        data: items,
        info: false,
        autoWidth: false,
        columns: [
            { data: 'codigo', render: d => `<span class="fw-bold">${d}</span>` },
            { data: 'nombre', render: d => `<span class="fw-500" style="color: inherit;">${d}</span>` },
            { data: 'categoria', render: d => `<span class="badge badge-category">${d || 'N/A'}</span>` },
            {
                data: 'precio',
                className: 'text-end',
                render: d => `<span class="fw-bold text-primary">${fmt.format(d)}</span>`
            },
            {
                data: null,
                className: 'text-center',
                render: (row) => {
                    let status = 'badge-stable';
                    if (row.stock <= 0) status = 'badge-critical';
                    else if (row.stock <= row.stock_min) status = 'badge-warning';
                    return `<span class="badge-stock ${status}">${row.stock}</span>`;
                }
            },
            {
                data: null,
                className: 'text-center',
                render: (row) => {
                    const text = row.stock <= row.stock_min ? 'REABASTECER' : 'NORMAL';
                    const color = row.stock <= row.stock_min ? 'text-danger' : 'text-success';
                    return `<small class="fw-800 ${color}">${text}</small>`;
                }
            },
            {
                data: null,
                className: 'text-end',
                orderable: false,
                render: (row) => `
                    <button class="btn btn-sm btn-light border" onclick="window.location.href='/productos'" title="Ver Ficha">
                        <i class="fas fa-boxes text-muted"></i>
                    </button>
                    <button class="btn btn-sm btn-primary-soft ms-1" onclick="abrirModalMovimiento(${row.id})" title="Ajuste Rápido">
                        <i class="fas fa-plus"></i>
                    </button>
                `
            }
        ],
        dom: '<"d-none"f>rt<"d-flex justify-content-center mt-4"p>',
        language: { url: '/static/js/i18n/es-ES.json' },
        pageLength: 10,
        drawCallback: function () {
            $('.dataTables_paginate > .pagination').addClass('pagination-sm');
        },
        createdRow: function (row, data) {
            // Mobile Data Labels
            $('td:eq(0)', row).attr('data-label', 'CÓDIGO');
            $('td:eq(1)', row).attr('data-label', 'PRODUCTO');
            $('td:eq(2)', row).attr('data-label', 'CATEGORÍA');
            $('td:eq(3)', row).attr('data-label', 'PRECIO');
            $('td:eq(4)', row).attr('data-label', 'STOCK');
            $('td:eq(5)', row).attr('data-label', 'ESTADO');
            $('td:eq(6)', row).attr('data-label', 'ACCIONES');
        }
    });

    // Ensure alignment if we are currently looking at the tab
    if ($('#tab-existencias').is(':visible')) {
        setTimeout(() => stockTable.columns.adjust(), 100);
    }
}

// --- MOVEMENT HISTORY ---
async function loadMovementHistory() {
    try {
        const tbody = document.querySelector('#tabla-movimientos tbody');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><i class="fas fa-spinner fa-spin me-2"></i>Cargando historial...</td></tr>';

        const res = await fetch('/inventario/api/movimientos?limit=30');
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        tbody.innerHTML = '';
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            data.items.forEach(mov => {
                const tr = document.createElement('tr');
                const typeClass = mov.tipo === 'Entrada' ? 'text-success' : (mov.tipo === 'Salida' ? 'text-danger' : 'text-primary');
                const icon = mov.tipo === 'Entrada' ? 'fa-arrow-down' : (mov.tipo === 'Salida' ? 'fa-arrow-up' : 'fa-sync');

                tr.innerHTML = `
                    <td data-label="FECHA"><span class="small fw-bold" style="color: var(--ln-text-muted);">${mov.fecha}</span></td>
                    <td data-label="TIPO"><span class="fw-800 ${typeClass} small"><i class="fas ${icon} me-2"></i>${mov.tipo.toUpperCase()}</span></td>
                    <td data-label="PRODUCTO"><span class="fw-600" style="color: inherit;">${mov.producto}</span></td>
                    <td data-label="CANTIDAD" class="text-center fw-bold">${mov.cantidad}</td>
                    <td data-label="RESPONSABLE"><small style="color: inherit;">${mov.responsable}</small></td>
                    <td data-label="DETALLE"><p class="mb-0 small" style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ln-text-muted);" title="${mov.motivo || ''}">${mov.motivo || '-'}</p></td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted"><div class="opacity-50"><i class="fas fa-history fa-3x mb-3 d-block"></i><span class="fw-600">Aún no se registran movimientos</span></div></td></tr>';
        }
    } catch (e) {
        console.error("Movements Error:", e);
    }
}

// --- MODAL & OPERATIONS ---
function populateInstitutionalSelect(items) {
    const select = document.getElementById('select-producto');
    select.innerHTML = '<option value="">Escriba nombre o código...</option>';
    items.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nombre.toUpperCase()} (${p.codigo}) - STOCK: ${p.stock} `;
        select.appendChild(opt);
    });
}

function abrirModalMovimiento(prodId = null) {
    const modal = new bootstrap.Modal(document.getElementById('modalMovimiento'));
    const select = document.getElementById('select-producto');

    if (prodId) select.value = prodId;
    else document.getElementById('formMovimiento').reset();

    modal.show();
}

async function guardarMovimiento() {
    const form = document.getElementById('formMovimiento');
    if (!form.checkValidity()) { return form.reportValidity(); }

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';

    const payload = {
        producto_id: document.getElementById('select-producto').value,
        tipo: document.getElementById('mov-tipo').value,
        cantidad: parseInt(document.getElementById('mov-cantidad').value),
        motivo: document.getElementById('mov-motivo').value
    };

    try {
        const res = await fetch('/inventario/api/registrar-movimiento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.ok) {
            notyf.success("Operación de inventario registrada y auditada.");
            bootstrap.Modal.getInstance(document.getElementById('modalMovimiento')).hide();
            form.reset();
            await initInventoryApp(); // Reload everything
        } else {
            Swal.fire({ title: 'Error Operativo', text: data.error, icon: 'error', borderRadius: '15px' });
        }
    } catch (e) {
        Swal.fire('Error', "Falla de comunicación con el servidor.", 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function exportarInventario() {
    notyf.success("Sincronizando con motor de reportes...");
    window.location.href = '/inventario/api/exportar-excel'; // Placeholder endpoint
}

// --- PHYSICAL AUDIT SYSTEM ---

async function checkAuditStatus() {
    try {
        const res = await fetch('/inventario/api/audit/status');
        const data = await res.json();

        const idleView = document.getElementById('audit-idle-view');
        const activeView = document.getElementById('audit-active-view');

        if (data.ok && data.active) {
            idleView.classList.add('d-none');
            activeView.classList.remove('d-none');
            loadAuditSessionData();
        } else {
            idleView.classList.remove('d-none');
            activeView.classList.add('d-none');
        }
    } catch (e) {
        console.error("Audit Status Error:", e);
    }
}

async function iniciarCorteInventario() {
    const result = await Swal.fire({
        title: 'Iniciar Conteo de Mercancía',
        text: '¿Desea iniciar un nuevo proceso de conciliación? El stock del sistema se comparará con el conteo físico.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, iniciar conteo',
        confirmButtonColor: '#4f46e5'
    });

    if (result.isConfirmed) {
        try {
            const res = await fetch('/inventario/api/audit/iniciar', { method: 'POST' });
            const data = await res.json();
            if (data.ok) {
                notyf.success(data.msg);
                checkAuditStatus();
            } else {
                Swal.fire('Error', data.error, 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'Falla de comunicación.', 'error');
        }
    }
}

async function loadAuditSessionData() {
    const tbody = document.querySelector('#tabla-audit-conteo tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><i class="fas fa-spinner fa-spin me-2"></i>Cargando sesión...</td></tr>';

    try {
        const res = await fetch('/inventario/api/audit/session-data');
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        tbody.innerHTML = '';
        data.items.forEach(item => {
            const tr = document.createElement('tr');
            const diff = item.stock_fisico - item.stock_teorico;
            const diffClass = diff == 0 ? 'text-muted' : (diff > 0 ? 'text-success' : 'text-danger');
            const statusIcon = diff == 0 ? 'fa-check-circle text-success' : 'fa-exclamation-circle text-warning';

            tr.innerHTML = `
                <td data-label="CÓDIGO"><small class="fw-bold">${item.codigo}</small></td>
                <td data-label="PRODUCTO"><span class="fw-600">${item.nombre}</span></td>
                <td data-label="TEÓRICO" class="text-center fw-bold" style="background: rgba(79, 70, 229, 0.05);">${item.stock_teorico}</td>
                <td data-label="FÍSICO (CONTEO)" class="text-center p-2">
                    <input type="number" class="form-control form-control-sm text-center fw-bold border-primary" 
                           value="${item.stock_fisico}" 
                           onchange="actualizarConteoFisico(${item.detail_id}, this)"
                           style="max-width: 100px; margin: 0 auto; border-radius: 8px;">
                </td>
                <td data-label="DISCREPANCIA" class="text-center fw-800 ${diffClass}">${diff > 0 ? '+' : ''}${diff}</td>
                <td data-label="ESTADO" class="text-end"><i class="fas ${statusIcon}"></i></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Audit Data Error:", e);
    }
}

async function actualizarConteoFisico(detailId, input) {
    const cantidad = parseFloat(input.value) || 0;
    const row = input.closest('tr');
    const theoretical = parseFloat(row.cells[2].textContent) || 0;
    const diffCell = row.cells[4];
    const statusCell = row.cells[5];

    // Local Logic: Immediate Feedback
    const diff = cantidad - theoretical;
    diffCell.textContent = (diff > 0 ? '+' : '') + diff;
    diffCell.className = `text-center fw-800 ${diff == 0 ? 'text-muted' : (diff > 0 ? 'text-success' : 'text-danger')}`;
    statusCell.innerHTML = '<i class="fas fa-spinner fa-spin text-primary"></i>';

    try {
        const res = await fetch('/inventario/api/audit/cargar-conteo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ detail_id: detailId, cantidad: cantidad })
        });
        const data = await res.json();
        if (data.ok) {
            const statusIcon = diff == 0 ? 'fa-check-circle text-success' : 'fa-exclamation-circle text-warning';
            statusCell.innerHTML = `<i class="fas ${statusIcon}"></i>`;
        } else {
            statusCell.innerHTML = '<i class="fas fa-times-circle text-danger" title="Error al guardar"></i>';
            notyf.error("No se pudo guardar el cambio.");
        }
    } catch (e) {
        statusCell.innerHTML = '<i class="fas fa-times-circle text-danger"></i>';
        notyf.error("Error de conexión.");
    }
}

async function confirmarFinalizarAudit() {
    const result = await Swal.fire({
        title: '¿Finalizar Conteo?',
        text: 'Se aplicarán ajustes automáticos al stock real según las discrepancias detectadas.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, aplicar ajustes',
        confirmButtonColor: '#10b981'
    });

    if (result.isConfirmed) {
        try {
            const res = await fetch('/inventario/api/audit/finalizar', { method: 'POST' });
            const data = await res.json();
            if (data.ok) {
                Swal.fire('Éxito', data.msg, 'success');
                checkAuditStatus();
                initInventoryApp(); // Recargar KPIs y Stock general
            } else {
                Swal.fire('Error', data.error, 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'Error al procesar conciliación.', 'error');
        }
    }
}

async function cancelarAuditoria() {
    const result = await Swal.fire({
        title: '¿Cancelar Conteo?',
        text: 'Se perderán todos los datos cargados en esta sesión y no se aplicará ningún ajuste.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, cancelar todo',
        confirmButtonColor: '#ef4444'
    });

    if (result.isConfirmed) {
        try {
            const res = await fetch('/inventario/api/audit/cancelar', { method: 'POST' });
            const data = await res.json();
            if (data.ok) {
                notyf.success(data.msg);
                checkAuditStatus();
            } else {
                Swal.fire('Error', data.error, 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'Error al cancelar.', 'error');
        }
    }
}

// --- CROSS-TAB FILTERING LOGIC ---

function bindInstitutionalFilters() {
    // 1. Stock List Filter
    const stockSearch = document.getElementById('busqueda-stock');
    if (stockSearch) {
        stockSearch.addEventListener('input', (e) => {
            if (stockTable) stockTable.search(e.target.value).draw();
        });
    }

    // 2. Historial Filter
    const histSearch = document.getElementById('busqueda-historial');
    if (histSearch) {
        histSearch.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#tabla-movimientos tbody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(val) ? '' : 'none';
            });
        });
    }

    // 3. Audit Grid Filter
    const auditSearch = document.getElementById('busqueda-audit');
    if (auditSearch) {
        auditSearch.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#tabla-audit-conteo tbody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(val) ? '' : 'none';
            });
        });
    }
}

// Inicializar chequeo al cargar
document.addEventListener('DOMContentLoaded', () => {
    checkAuditStatus();
    bindInstitutionalFilters();
});
