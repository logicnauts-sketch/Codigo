const state = {
    open: false,
    start: null,
    cashier: '',
    initialCash: 0,
    monto_contado_conteo: 0,
    diferencia_conteo: 0,
    ultima_fecha_conteo: null,
    movements: [],
    loading: false,
    conteo_validado: false  // SECURITY: Finalizar disabled until count is done
};

const $ = (id) => document.getElementById(id);
const fmt = (n) => 'RD$\u00A0' + (Number(n) || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' }
});

const getExpectedCash = () => {
    if (!state.movements) return Number(state.initialCash) || 0;

    return state.movements
        .filter(m => String(m.turno_id) === String(state.id))
        .filter(m => (m.metodo_pago || '').toLowerCase() === 'efectivo')
        .reduce((sum, m) => {
            const monto = Number(m.monto) || 0;
            const tipo = (m.tipo || '').toLowerCase();
            // Apertura, venta e ingreso suman. Egreso resta.
            return sum + (['venta', 'ingreso', 'ingreso_manual', 'apertura'].includes(tipo) ? monto : -Math.abs(monto));
        }, 0);
};

const getTotalCard = () => {
    if (!state.movements) return 0;
    return state.movements
        .filter(m => String(m.turno_id) === String(state.id))
        .filter(m => (m.metodo_pago || '').toLowerCase() === 'tarjeta')
        .reduce((sum, m) => sum + (Number(m.monto) || 0), 0);
};

function syncUI() {
    const sectionCerrada = $('sectionCerrada');
    const sectionAbierta = $('sectionAbierta');
    const dot = $('statusDot');
    const text = $('statusText');
    const headerInfo = $('headerInfo');

    if (state.open) {
        sectionCerrada.style.display = 'none';
        sectionAbierta.style.display = 'block';
        dot.className = 'status-dot status-open';
        text.innerText = `Sistema Operativo · Caja Abierta`;

        const desde = state.start ? new Date(state.start).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }) : '—';
        headerInfo.innerText = `LNSystemS_${state.id || '—'} · Desde ${desde}`;

        $('valTurnoId').innerText = `LNSystemS_${state.id || '—'}`;
        $('valCajero').innerText = state.cashier;
        $('valFondo').innerText = fmt(state.initialCash);
    } else {
        sectionCerrada.style.display = 'block';
        sectionAbierta.style.display = 'none';
        dot.className = 'status-dot status-closed';
        text.innerText = 'Sistema Protegido · Caja Cerrada';
    }
    renderAuditKPIs();
    renderAuditoriaTable();
    actualizarBotonFinalizar();
}

// SECURITY: Habilitar/deshabilitar botón de cierre y conteo según si se realizó el conteo
function actualizarBotonFinalizar() {
    const btnFinalizar = $('btnFinalizar');
    const btnConteo = $('btnConteo');

    if (btnFinalizar) {
        if (state.open && !state.conteo_validado) {
            btnFinalizar.disabled = true;
            btnFinalizar.title = 'Debe completar el Conteo Ciego antes de cerrar';
            btnFinalizar.style.opacity = '0.5';
            btnFinalizar.style.cursor = 'not-allowed';
        } else {
            btnFinalizar.disabled = false;
            btnFinalizar.title = '';
            btnFinalizar.style.opacity = '';
            btnFinalizar.style.cursor = '';
        }
    }

    if (btnConteo) {
        if (state.open && state.conteo_validado) {
            btnConteo.disabled = true;
            btnConteo.title = 'El efectivo ya ha sido contado y validado';
            btnConteo.style.opacity = '0.5';
            btnConteo.style.cursor = 'not-allowed';
            btnConteo.style.pointerEvents = 'none'; // Previene clicks adicionales
        } else {
            btnConteo.disabled = false;
            btnConteo.title = '';
            btnConteo.style.opacity = '';
            btnConteo.style.cursor = '';
            btnConteo.style.pointerEvents = 'auto';
        }
    }
}

function renderAuditKPIs() {
    const expCash = getExpectedCash();
    const cardDaily = getTotalCard();
    const initial = Number(state.initialCash) || 0;
    const netBalance = expCash - initial;

    $('kpiExpCash').innerText = fmt(expCash);
    $('kpiCntCash').innerText = fmt(state.monto_contado_conteo || 0);
    $('kpiDiff').innerText = fmt(netBalance);
    $('kpiCard').innerText = fmt(cardDaily);
    $('kpiTotal').innerText = fmt(expCash + cardDaily);

    const cardDiff = $('cardDiff');
    if (cardDiff) {
        cardDiff.className = 'audit-card';
        if (netBalance < 0) cardDiff.classList.add('negative');
        else if (netBalance > 0) cardDiff.classList.add('positive');
    }
}

function renderAuditoriaTable() {
    const tbody = $('tbodyAuditoria');
    if (!tbody) return;
    tbody.innerHTML = '';

    const currentMovements = state.movements.filter(m => String(m.turno_id) === String(state.id));

    if (currentMovements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state" style="text-align: center; padding: 2rem; color: #64748b;">No hay movimientos en este turno.</td></tr>';
        return;
    }

    currentMovements.slice(0, 50).forEach(m => {
        const tr = document.createElement('tr');
        const hora = m.fecha ? new Date(m.fecha).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const tipo = (m.tipo || '').toLowerCase();
        let pillClass = ['ingreso', 'venta', 'ingreso_manual'].includes(tipo) ? 'pill-ingreso' : 'pill-egreso';
        const montoNumber = Number(m.monto) || 0;
        const isPositive = ['venta', 'ingreso', 'ingreso_manual', 'apertura'].includes(tipo);
        const displayMonto = isPositive ? fmt(montoNumber) : fmt(-Math.abs(montoNumber));

        tr.innerHTML = `
            <td>${hora}</td>
            <td><span class="pill ${pillClass}">${m.tipo.toUpperCase()}</span></td>
            <td><span class="pill">${m.metodo_pago ? m.metodo_pago.toUpperCase() : '—'}</span></td>
            <td style="font-weight: 600">${displayMonto}</td>
            <td style="font-size: 0.8rem; color: #64748b">${m.referencia || m.descripcion || '—'}</td>
            <td>${m.usuario_nombre || '—'}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadState() {
    state.loading = true;
    try {
        const res = await fetch('/caja/api/estado-actual');
        const data = await res.json();
        if (data.success) {
            // El backend ya entrega los campos mapeados: open, start, initialCash, etc.
            Object.assign(state, data.data);
            syncUI();
        }
    } catch (e) {
        console.error('Error loadState:', e);
    } finally {
        state.loading = false;
        renderAuditoriaTable();
    }
}

async function abrirCaja() {
    const initial = Number($('inputInicial').value || 0);
    try {
        const res = await fetch('/caja/api/abrir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monto_inicial: initial })
        });
        const data = await res.json();
        if (data.success) {
            notyf.success('Caja abierta');
            setTimeout(() => {
                window.location.reload();
            }, 800);
        } else {
            notyf.error(data.error);
        }
    } catch (e) {
        notyf.error('Error de red al intentar abrir la caja');
    }
}

// --- PROFESIONAL ARQUEO MODULE --- 

const DENOMINACIONES = [2000, 1000, 500, 200, 100, 50, 25, 10, 5, 1];

function initDenominacionesRows() {
    const tbody = $('denominacionesBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    DENOMINACIONES.forEach(val => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="den-label">RD$ ${val}</td>
            <td>
                <input type="number" class="den-input" data-den="${val}" value="0" min="0" oninput="calculateConteo()">
            </td>
            <td class="den-subtotal" id="subtotal-${val}">RD$ 0.00</td>
        `;
        tbody.appendChild(tr);
    });
}

function calculateConteo() {
    let totalContado = 0;
    const denominacionesData = [];

    document.querySelectorAll('.den-input').forEach(input => {
        const den = parseInt(input.dataset.den);
        const cant = parseInt(input.value) || 0;
        const sub = den * cant;
        totalContado += sub;

        $(`subtotal-${den}`).innerText = fmt(sub);
        denominacionesData.push({ denominacion: den, cantidad: cant });
    });

    $('conteoTotalContado').innerText = fmt(totalContado);

    // FIX: Si el usuario modificó las denominaciones después de un intento fallido,
    // restaurar el botón para que re-valide con el servidor en vez de usar valores viejos.
    const btnGuardar = $('btnGuardarConteo');
    if (btnGuardar && btnGuardar.classList.contains('btn-warning')) {
        btnGuardar.classList.remove('btn-warning');
        btnGuardar.innerHTML = '<i class="fas fa-check-circle me-1"></i> Confirmar y Cerrar';
        btnGuardar.onclick = validarConteoServidor;
    }

    // El cálculo de diferencia ahora es ASÍNCRONO y controlado por el servidor (Modo Ciego)
    return { totalContado, denominacionesData };
}

async function validarConteoServidor() {
    const { totalContado, denominacionesData } = calculateConteo();
    const btnGuardar = $('btnGuardarConteo');

    try {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validando...';

        const res = await fetch('/caja/api/validar-conteo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                monto_contado: totalContado,
                denominaciones: denominacionesData
            })
        });

        const data = await res.json();

        if (data.success) {
            if (data.match) {
                // ÉXITO: Conteo exacto
                state.monto_contado_conteo = totalContado;
                state.denominacionesData = denominacionesData;
                state.conteo_validado = true;  // UNLOCK: Habilitar botón de cierre
                syncUI();
                closeConteoModal();
                notyf.success('Conteo validado exitosamente');

                // Mostrar confirmación final directamente
                handlePrepararCierre();
            } else {
                // UI: Mostrar intento actual
                state.count_attempts = data.attempt || 0;
                if ($('conteoIntentosBadge')) $('conteoIntentosBadge').innerText = `Intento: ${state.count_attempts}`;

                const alerta = $('conteoAlertaMensaje');
                if (alerta) {
                    alerta.style.display = 'flex';
                    alerta.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>Diferencia Detectada</span><small style="display:block; font-size: 0.6rem; margin-top:5px;">Intento ${state.count_attempts}</small>`;
                }

                calculateConteo();

                if (data.revealed_expected !== undefined && data.revealed_expected !== null) {
                    // MODO GUIADO: Revelar esperado
                    state.server_expected = data.revealed_expected; // Save server truth
                    $('conteoEsperadoContainer').style.display = 'block';
                    $('conteoTotalEsperado').innerText = fmt(data.revealed_expected);
                    if ($('conteoAlertaMensaje')) {
                        $('conteoAlertaMensaje').style.display = 'block';
                        $('conteoAlertaMensaje').innerHTML = `<i class="fas fa-exclamation-circle me-1"></i> Diferencia detectada. El sistema esperaba ${fmt(data.revealed_expected)}. Verifique de nuevo.`;
                    }
                }

                // INTENTOS: RE-CONTEO ILIMITADO
                notyf.error(data.message || `Diferencia detectada. Intento ${state.count_attempts}. Verifique nuevamente.`);

                btnGuardar.disabled = false;
                btnGuardar.innerHTML = '<i class="fas fa-check-circle me-1"></i> Guardar Conteo';
                btnGuardar.classList.remove('btn-warning');
                btnGuardar.onclick = validarConteoServidor;
            }
        } else {
            // Error de negocio o backend (400, 500, etc)
            notyf.error(data.error || 'Error al validar conteo');
        }
    } catch (e) {
        notyf.error('Error de comunicación con el servidor de seguridad');
    } finally {
        if (btnGuardar.innerHTML.includes('Validando')) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<i class="fas fa-check-circle me-1"></i> Guardar Conteo';
        }
    }
}

function showSecurityEscalationModal(totalContado, denominacionesData) {
    const alertBox = $('supervisorAlertBox');
    const alertText = $('supervisorAlertText');
    if (alertBox) {
        alertBox.style.background = '#fef2f2';
        alertBox.style.border = '1px solid #fecaca';
    }
    if (alertText) alertText.innerText = 'ALERTA DE SEGURIDAD: Límite de intentos de conteo excedido. Se requiere autorización de Gerencia para proceder con el cierre con diferencia.';

    showSupervisorModal(async (supervisorId) => {
        const reason = $('supervisorReason').value;
        if (!reason || reason.length < 15) return notyf.error('Escriba un motivo de autorización válido (mín. 15 caracteres)');

        // Proceder al cierre definitivo con la autorización
        confirmarCierreFinal(totalContado, 0, denominacionesData, supervisorId, reason);
    });
}

async function handleConteoDetallado() {
    // SECURITY LOCK (Removido por política del negocio)

    initDenominacionesRows();
    calculateConteo();

    // RESTAURAR ESTADO DE SEGURIDAD (Bug fix: persistencia de intentos)
    const attempts = state.count_attempts || 0;
    const badge = $('conteoIntentosBadge');
    const alerta = $('conteoAlertaMensaje');

    if (attempts > 0) {
        if (badge) badge.innerText = `Intento: ${attempts}`;
        if (!state.conteo_validado && alerta) {
            alerta.style.display = 'flex';
            alerta.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>Diferencia Detectada</span><small style="display:block; font-size: 0.6rem; margin-top:5px;">Intento ${attempts}</small>`;
        }
    } else {
        if (badge) badge.innerText = 'Intento: 0';
        if (alerta) alerta.style.display = 'none';
    }

    $('conteoProfesionalModal').classList.add('active');
}

async function handlePrepararCierre() {
    // FIX: Usar server_expected si existe (provisto por validar-conteo), 
    // sino calcular localmente (fallback)
    const esperado = (state.server_expected !== undefined && state.server_expected !== null)
        ? Number(state.server_expected)
        : getExpectedCash();

    const contado = state.monto_contado_conteo || 0;
    const diferencia = contado - esperado;

    $('cierreFinalContado').innerText = fmt(contado);
    $('cierreFinalEsperado').innerText = fmt(esperado);
    $('cierreFinalDiff').innerText = fmt(diferencia);

    // Label dinámico según resultado
    const diffLabel = $('cierreFinalDiffLabel');
    const container = $('cierreFinalDiffContenedor');
    container.classList.remove('state-exacto', 'state-faltante', 'state-sobrante');
    if (Math.abs(diferencia) < 0.01) {
        container.classList.add('state-exacto');
        if (diffLabel) diffLabel.innerText = 'Balance Exacto ✓';
        $('cierreFinalDiff').style.color = 'var(--ln-success, #22c55e)';
    } else if (diferencia < 0) {
        container.classList.add('state-faltante');
        if (diffLabel) diffLabel.innerText = 'Faltante Detectado ⚠';
        $('cierreFinalDiff').style.color = 'var(--caja-danger, #ef4444)';
    } else {
        container.classList.add('state-sobrante');
        if (diffLabel) diffLabel.innerText = 'Sobrante Detectado ↑';
        $('cierreFinalDiff').style.color = 'var(--caja-warning, #f59e0b)';
    }

    $('cierreFinalModal').classList.add('active');
}

// --- Modal Control Functions ---
function closeConteoModal() {
    $('conteoProfesionalModal').classList.remove('active');
}

function closeSupervisorModal() {
    $('supervisorModal').classList.remove('active');
}

// Cierra cualquier modal si se hace clic en el fondo oscuro (fuera del contenido)
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};

function showSupervisorModal(onAuth) {
    if ($('supervisorReason')) $('supervisorReason').value = '';
    $('supervisorModal').classList.add('active');
    $('supervisorPin').value = '';
    $('supervisorPin').focus();

    $('btnConfirmarSupervisor').onclick = async () => {
        const pin = $('supervisorPin').value;
        const reason = $('supervisorReason').value;

        // VALIDACIÓN: El motivo es OBLIGATORIO antes de intentar validar el PIN
        if (!reason || reason.trim().length < 15) {
            return notyf.error('Debe escribir un motivo válido antes de firmar (mín. 15 caracteres)');
        }

        if (!pin) return notyf.error('Ingrese su PIN de supervisor');

        try {
            const res = await fetch('/caja/api/validar-supervisor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
            });
            const data = await res.json();

            if (data.success) {
                notyf.success(`Autorizado por ${data.nombre}`);
                $('supervisorModal').classList.remove('active');
                onAuth(data.supervisor_id);
            } else {
                notyf.error(data.error || 'PIN incorrecto');
            }
        } catch (e) {
            notyf.error('Error validando credenciales');
        }
    };
}

function closeAuditModal() {
    $('auditModal').classList.remove('active');
}

async function confirmarCierreFinal(cash, diff, dens, supervisorId, supervisorReason = '') {
    const cardVal = getTotalCard();
    const obs = $('conteoObservaciones').value;

    // Cerrar modales antes de mostrar proceso
    if ($('cierreFinalModal')) $('cierreFinalModal').classList.remove('active');
    if ($('supervisorModal')) $('supervisorModal').classList.remove('active');

    try {
        Swal.fire({
            title: 'Procesando Cierre...',
            text: 'Generando reportes y asegurando integridad...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const res = await fetch('/caja/api/cerrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                monto_efectivo: cash,
                monto_tarjeta: Number(cardVal),
                denominaciones: dens,
                observaciones: obs,
                supervisor_id: supervisorId,
                supervisor_reason: supervisorReason
            })
        });

        const data = await res.json();

        if (data.success) {
            notyf.success('Turno cerrado exitosamente');
            if (data.turno_id) {
                // Descargar PDF ANTES de hacer logout (fetch blob para evitar race condition)
                try {
                    const pdfRes = await fetch(`/api/caja/reporte-pdf/${data.turno_id}`);
                    if (pdfRes.ok) {
                        const blob = await pdfRes.blob();
                        const url = window.URL.createObjectURL(blob);
                        const downloadLink = document.createElement('a');
                        downloadLink.href = url;
                        downloadLink.download = `Cierre_${data.turno_id}.pdf`;
                        document.body.appendChild(downloadLink);
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                        window.URL.revokeObjectURL(url);
                    }
                } catch (pdfErr) {
                    console.warn('PDF download failed:', pdfErr);
                }
            }

            setTimeout(() => window.location.href = '/logout', 2000);
        } else {
            // DETECCIÓN DE BLOQUEO DE SEGURIDAD
            // Alerta de seguridad removida

            Swal.fire('Error', data.error, 'error');
        }
    } catch (e) {
        Swal.fire('Error Critico', 'No se pudo completar el cierre', 'error');
    }
}

// --- BOOTSTRAP: EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Caja module initializing...");
    try {
        loadState();

        // Core Actions
        const bind = (id, fn) => {
            const el = $(id);
            if (el) {
                el.onclick = fn;
                console.log(`Bound ${id} click`);
            } else {
                console.warn(`Element ${id} not found for binding`);
            }
        };

        bind('btnAbrir', abrirCaja);
        
        if ($('inputInicial')) {
            $('inputInicial').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') abrirCaja();
            });
            console.log("Bound inputInicial Enter key");
        }

        bind('btnConteo', handleConteoDetallado);
        bind('btnFinalizar', handlePrepararCierre);

        // Conteo Modal
        if ($('btnConteoCancel')) $('btnConteoCancel').onclick = closeConteoModal;
        if ($('btnCloseConteo')) $('btnCloseConteo').onclick = closeConteoModal;
        if ($('btnGuardarConteo')) {
            $('btnGuardarConteo').onclick = validarConteoServidor;
        }

        // Close Confirmation
        if ($('btnConfirmarCierreDefinitivo')) {
            $('btnConfirmarCierreDefinitivo').onclick = async () => {
                const totalContado = state.monto_contado_conteo || 0;
                const esperado = (state.server_expected !== undefined && state.server_expected !== null)
                    ? Number(state.server_expected)
                    : getExpectedCash();
                const diferencia = totalContado - esperado;
                const dens = state.denominacionesData || [];
                const UMBRAL = 500;

                if (Math.abs(diferencia) > UMBRAL) {
                    showSupervisorModal(sid => confirmarCierreFinal(totalContado, diferencia, dens, sid));
                } else {
                    confirmarCierreFinal(totalContado, diferencia, dens, null);
                }
            };
        }

        // Conciliación
        const btnConciliar = $('btnConciliar');
        if (btnConciliar) btnConciliar.onclick = () => $('conciliacionModal').classList.add('active');

        // Supervisor Modal
        if ($('btnSupervisorCancel')) $('btnSupervisorCancel').onclick = closeSupervisorModal;
        if ($('btnCloseSupervisor')) $('btnCloseSupervisor').onclick = closeSupervisorModal;

        // Audit Modal Cancel
        if ($('btnAuditCancel')) $('btnAuditCancel').onclick = closeAuditModal;
        
        // Report/Conciliacion/Cierre (General close buttons)
        document.querySelectorAll('.modal-close, .bg-light').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) modal.classList.remove('active');
            });
        });

        // Audit Modal (Ingreso/Egreso)
        const btnIngreso = $('btnIngreso');
        if (btnIngreso) {
            btnIngreso.onclick = () => {
                const body = `
                    <div class="input-group">
                        <label>Monto de Ingreso</label>
                        <input class="input" id="auditValue" type="number" step="0.01" placeholder="0.00" autofocus />
                    </div>
                    <div class="input-group">
                        <label>Concepto</label>
                        <input class="input" id="auditRef" type="text" placeholder="Ej: Cambio" />
                    </div>
                `;
                showAuditModal('Ingreso de Efectivo', body, 'Registrar', async () => {
                    const val = Number($('auditValue').value || 0);
                    const ref = $('auditRef').value.trim();
                    if (val <= 0 || !ref) return notyf.error('Datos incompletos');
                    const res = await registrarMovimiento('ingreso', val, ref);
                    if (res.success) { closeAuditModal(); loadState(); }
                });
            };
            console.log("Bound btnIngreso click");
        }

        const btnEgreso = $('btnEgreso');
        if (btnEgreso) {
            btnEgreso.onclick = () => {
                const body = `
                    <div class="input-group">
                        <label>Monto de Egreso</label>
                        <input class="input" id="auditValue" type="number" step="0.01" placeholder="0.00" autofocus />
                    </div>
                    <div class="input-group">
                        <label>Concepto / Factura</label>
                        <input class="input" id="auditRef" type="text" placeholder="Ej: Pago de Luz" />
                    </div>
                `;
                showAuditModal('Salida de Efectivo', body, 'Registrar', async () => {
                    const val = Number($('auditValue').value || 0);
                    const ref = $('auditRef').value.trim();
                    if (val <= 0 || !ref) return notyf.error('Datos incompletos');
                    const res = await registrarMovimiento('egreso', val, ref);
                    if (res.success) { closeAuditModal(); loadState(); }
                });
            };
            console.log("Bound btnEgreso click");
        }
        
        console.log("Caja module initialization complete.");

    } catch (err) {
        console.error("FATAL: Error during Caja init:", err);
    }
});

async function registrarMovimiento(tipo, monto, desc) {
    try {
        const res = await fetch('/caja/api/movimientos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo, metodo_pago: 'efectivo', monto, descripcion: desc })
        });
        const data = await res.json();
        if (data.success) notyf.success('Movimiento registrado');
        else notyf.error(data.error);
        return data;
    } catch (e) {
        notyf.error('Error de red');
        return { success: false };
    }
}

function showAuditModal(title, bodyHTML, confirmLabel, onConfirm) {
    const modal = $('auditModal');
    if (!modal) return;
    $('auditModalTitle').innerText = title;
    $('auditModalBody').innerHTML = bodyHTML;
    $('btnAuditConfirm').innerText = confirmLabel;
    $('btnAuditConfirm').onclick = onConfirm;

    // UX: Soporte para tecla Enter
    const inputVal = $('auditValue');
    if (inputVal) {
        inputVal.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') onConfirm();
        });
    }

    modal.classList.add('active');
}

function closeAuditModal() {
    $('auditModal').classList.remove('active');
}
