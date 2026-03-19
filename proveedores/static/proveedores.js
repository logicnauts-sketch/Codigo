/* proveedores.js (Refactored) */
let dataTable = null;
let modalCreate = null;
let modalPago = null;
let currentProviderId = null;

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('modalProvider')) {
        modalCreate = new bootstrap.Modal(document.getElementById('modalProvider'));
    }
    if (document.getElementById('modalPago')) {
        modalPago = new bootstrap.Modal(document.getElementById('modalPago'));
    }

    initDataTable();
    loadData();
});

// --- DataTable ---
function initDataTable() {
    dataTable = $('#tablaProveedores').DataTable({
        language: {
            url: '/static/js/i18n/es-ES.json',
            search: "_INPUT_",
            searchPlaceholder: "Buscar proveedores por nombre, RNC o contacto...",
            emptyTable: `
        <div class="py-5 text-center">
            <div class="mb-3 text-muted opacity-25" style="font-size: 3rem;"><i class="fas fa-users-slash"></i></div>
            <h6 class="text-secondary fw-bold text-uppercase tracking-wider mb-1">Sin Proveedores</h6>
            <p class="text-muted small mb-0">No hay registros coincidentes.</p>
        </div>
      `
        },
        responsive: true,
        dom: '<"d-flex justify-content-end mb-3"f>rt<"d-flex justify-content-end mt-3"p>',
        pageLength: 15,
        columns: [
            {
                data: 'nombre',
                render: (data, type, row) => {
                    let icon = 'fa-building';
                    if (row.tipo === 'informal') icon = 'fa-tools';
                    if (row.tipo === 'interno') icon = 'fa-user-shield';

                    return `
            <div class="d-flex align-items-center py-1">
                <div class="rounded-circle bg-light d-flex align-items-center justify-content-center me-3 text-primary shadow-sm" style="width:40px; height:40px;">
                    <i class="fas ${icon}"></i>
                </div>
                <div>
                    <div class="fw-bold text-dark mb-0">${data}</div>
                    <div class="small text-muted text-truncate" style="max-width:200px;">${row.email || row.direccion || 'Sin contacto extra'}</div>
                </div>
            </div>
           `;
                }
            },
            {
                data: 'rnc_cedula',
                render: (data) => data ? `<span class="font-monospace text-dark">${data}</span>` : '<span class="text-muted italic">--</span>'
            },
            {
                data: null,
                render: (data, type, row) => {
                    let badgeClass = 'badge-informal';
                    if (row.tipo === 'fiscal') badgeClass = 'badge-fiscal';
                    if (row.tipo === 'interno') badgeClass = 'badge-interno';

                    return `
                <div>
                    <span class="badge ${badgeClass} mb-1">${(row.tipo || 'informal').toUpperCase()}</span>
                    <div class="small text-muted">${row.categoria || 'Gral.'}</div>
                </div>
            `;
                }
            },
            {
                data: 'saldo_pendiente',
                className: 'text-end',
                render: (data) => {
                    const val = parseFloat(data || 0);
                    if (val > 0) return `<span class="fw-bold text-danger">${formatMoney(val)}</span>`;
                    return `<span class="text-muted opacity-50 font-monospace">-</span>`;
                }
            },
            {
                data: 'activo',
                className: 'text-center',
                render: (data) => data === 1
                    ? '<i class="fas fa-check-circle text-success" title="Activo"></i>'
                    : '<i class="fas fa-times-circle text-muted" title="Inactivo"></i>'
            },
            {
                data: null,
                className: 'text-end pe-4',
                orderable: false,
                render: (data, type, row) => {
                    return `
                <button class="btn btn-sm btn-light border shadow-sm fw-bold px-3" onclick="viewProfile(${row.id})">
                    Ver <i class="fas fa-arrow-right ms-1"></i>
                </button>
            `;
                }
            }
        ]
    });
}

async function loadData() {
    try {
        const res = await fetch('/proveedores/api/list');
        const data = await res.json();
        if (data.ok && data.items) {
            dataTable.clear();
            dataTable.rows.add(data.items);
            dataTable.draw();
            updateGeneralKPIs(data.items);

            // Procesar búsqueda desde URL (Global Search Redirect)
            const urlParams = new URLSearchParams(window.location.search);
            const searchQ = urlParams.get('search');
            if (searchQ && dataTable) {
                dataTable.search(searchQ).draw();
            }
        }
    } catch (e) { console.error(e); }
}

function updateGeneralKPIs(items) {
    if (!items || !items.length) return;
    let saldo = 0;
    let activos = 0;
    items.forEach(i => {
        saldo += parseFloat(i.saldo_pendiente || 0);
        if (i.activo === 1) activos++;
    });
    document.getElementById('kpiSaldoTotal').textContent = formatMoney(saldo);
    document.getElementById('kpiActivos').textContent = activos;
    // Pagos hoy se carga aparte si hay API, o lo simulamos
}

// --- Modales ---
function openModalCreate() {
    document.getElementById('formProvider').reset();
    document.getElementById('txtId').value = '';
    document.getElementById('modalProvTitle').textContent = 'Nuevo Proveedor';
    // Reset types styling
    // Event Listeners for Type Change
    document.querySelectorAll('input[name="provTipo"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const rncInput = document.getElementById('txtRnc');
            if (e.target.value === 'fiscal') {
                rncInput.placeholder = 'Obligatorio (RNC/Cédula)';
            } else {
                rncInput.placeholder = 'Opcional';
            }
        });
    });

    modalCreate.show();
}

function openModalEdit() {
    // Populate form with current loaded provider (stored in profile view logic usually, or fetch)
    if (!currentProviderId) return;
    fetch(`/proveedores/api/profile/${currentProviderId}`)
        .then(res => res.json())
        .then(data => {
            if (data.ok) {
                const p = data.proveedor;
                document.getElementById('txtId').value = p.id;
                document.getElementById('modalProvTitle').textContent = 'Editar Proveedor';
                document.getElementById('txtNombre').value = p.nombre;
                document.getElementById('txtRnc').value = p.rnc_cedula || '';
                document.getElementById('txtTel').value = p.telefono || '';
                document.getElementById('txtEmail').value = p.email || '';
                document.getElementById('txtDir').value = p.direccion || '';
                document.getElementById('txtObs').value = p.observaciones || '';
                document.getElementById('selCategoria').value = p.categoria || '';

                // Radio buttons
                const radio = document.querySelector(`input[name="provTipo"][value="${p.tipo}"]`);
                if (radio) radio.checked = true;

                modalCreate.show();
            }
        });
}

async function submitProvider() {
    const id = document.getElementById('txtId').value;
    const nombre = document.getElementById('txtNombre').value;
    if (!nombre) return Swal.fire('Error', 'El nombre es obligatorio', 'warning');

    const tipo = document.querySelector('input[name="provTipo"]:checked').value;

    const payload = {
        nombre,
        tipo,
        rnc_cedula: document.getElementById('txtRnc').value,
        telefono: document.getElementById('txtTel').value,
        email: document.getElementById('txtEmail').value,
        direccion: document.getElementById('txtDir').value,
        categoria: document.getElementById('selCategoria').value,
        observaciones: document.getElementById('txtObs').value
    };

    const url = id ? `/proveedores/api/update/${id}` : '/proveedores/api/create';

    try {
        const res = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();

        if (data.ok) {
            modalCreate.hide();
            Swal.fire('Guardado', 'Proveedor registrado correctamente', 'success');
            loadData();
            if (id && currentProviderId == id) viewProfile(id); // Reload profile if editing current
        } else {
            Swal.fire('Error', data.error, 'error');
        }
    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'Error de conexión', 'error');
    }
}

// --- Profile View ---
async function viewProfile(id) {
    currentProviderId = id;
    try {
        const res = await fetch(`/proveedores/api/profile/${id}`);
        const data = await res.json();
        if (data.ok) {
            const p = data.proveedor;
            const s = data.stats;

            // Header
            document.getElementById('profNombre').textContent = p.nombre;
            document.getElementById('profRnc').textContent = p.rnc_cedula || '-';
            document.getElementById('profTel').textContent = p.telefono || '-';
            document.getElementById('profEmail').textContent = p.email || '-';
            document.getElementById('profDir').textContent = p.direccion || '-';

            document.getElementById('profTipoBadge').textContent = p.tipo.toUpperCase();

            // Stats
            document.getElementById('profTotalComprado').textContent = formatMoney(s.total_compras);
            document.getElementById('profSaldoActual').textContent = formatMoney(s.saldo_pendiente);

            // Status Button
            const btnSt = document.getElementById('btnStatusText');
            if (p.activo === 1) {
                btnSt.textContent = 'Desactivar';
                btnSt.closest('button').classList.remove('btn-outline-success');
                btnSt.closest('button').classList.add('btn-outline-secondary');
            } else {
                btnSt.textContent = 'Reactivar';
                btnSt.closest('button').classList.remove('btn-outline-secondary');
                btnSt.closest('button').classList.add('btn-outline-success');
            }

            // Timeline
            const list = document.getElementById('listaMovimientos');
            list.innerHTML = '';
            if (data.movimientos.length === 0) {
                list.innerHTML = '<div class="text-center text-muted py-4 small">Sin historial reciente</div>';
            } else {
                data.movimientos.forEach(m => {
                    const isFactura = m.tipo === 'factura';
                    const icon = isFactura ? 'fa-file-invoice' : 'fa-hand-holding-usd';
                    const colorClass = isFactura ? 'text-danger' : 'text-success';
                    const typeClass = isFactura ? 'type-factura' : 'type-pago';

                    const div = document.createElement('div');
                    div.className = `timeline-item ${typeClass}`;
                    div.innerHTML = `
                        <div class="d-flex justify-content-between">
                            <div>
                                <span class="fw-bold ${colorClass}">${isFactura ? 'Factura de Compra' : 'Pago Realizado'}</span>
                                <div class="small text-muted">${m.ref || 'S/Ref'}</div>
                            </div>
                            <div class="text-end">
                                <div class="fw-bold">${formatMoney(m.monto)}</div>
                                <div class="small text-muted">${new Date(m.fecha).toLocaleDateString()}</div>
                            </div>
                        </div>
                    `;
                    list.appendChild(div);
                });
            }

            // Switch Views
            document.getElementById('viewList').classList.add('d-none');
            document.getElementById('viewProfile').classList.remove('d-none');
        }
    } catch (e) { console.error(e); }
}

function showList() {
    document.getElementById('viewProfile').classList.add('d-none');
    document.getElementById('viewList').classList.remove('d-none');
    currentProviderId = null;
    loadData(); // Refresh
}

async function toggleStatus() {
    if (!currentProviderId) return;
    try {
        const res = await fetch(`/proveedores/api/toggle_status/${currentProviderId}`, { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
            viewProfile(currentProviderId); // Reload to flush button state
            Swal.fire('Estado actualizado', '', 'success');
        }
    } catch (e) { console.error(e); }
}

// --- Utils ---
function formatMoney(amount) {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount);
}

function formatDocument(value) {
    if (!value) return '';
    const clean = value.replace(/\D/g, '');
    
    // Cédula: ### ####### # (11 digits)
    if (clean.length > 9) {
        const part1 = clean.substring(0, 3);
        const part2 = clean.substring(3, 10);
        const part3 = clean.substring(10, 11);
        
        let res = part1;
        if (part2) res += ' ' + part2;
        if (part3) res += ' ' + part3;
        return res;
    } 
    
    // RNC: ### ### ### (9 digits)
    const part1 = clean.substring(0, 3);
    const part2 = clean.substring(3, 6);
    const part3 = clean.substring(6, 9);
    
    let res = part1;
    if (part2) res += ' ' + part2;
    if (part3) res += ' ' + part3;
    return res;
}

// Event listener for RNC formatting
document.addEventListener('DOMContentLoaded', () => {
    const rncInput = document.getElementById('txtRnc');
    if (rncInput) {
        rncInput.addEventListener('input', (e) => {
            const start = e.target.selectionStart;
            const formatted = formatDocument(e.target.value);
            e.target.value = formatted;
            try { e.target.setSelectionRange(start, start); } catch(err) {}
        });
    }
});

function openModalPago() { modalPago.show(); }
