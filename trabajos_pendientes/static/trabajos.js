document.addEventListener('DOMContentLoaded', function() {
    const listContainer = document.getElementById('listaTrabajos');
    const modalTrabajo = new bootstrap.Modal(document.getElementById('modalTrabajo'));
    
    // Sidebar Toggle
    document.getElementById('menuToggle').addEventListener('click', () => {
        document.body.classList.toggle('sidebar-hidden');
    });

    let allTrabajos = [];
    let verTerminados = false;

    const chkVerTerminados = document.getElementById('chkVerTerminados');
    if (chkVerTerminados) {
        chkVerTerminados.addEventListener('change', (e) => {
            verTerminados = e.target.checked;
            renderTrabajos(allTrabajos);
        });
    }

    // Cargar Trabajos al Iniciar
    loadTrabajos();

    function loadTrabajos() {
        fetch('/trabajos_pendientes/api/list')
            .then(res => res.json())
            .then(data => {
                allTrabajos = data;
                renderTrabajos(data);
            });
    }

    function renderTrabajos(trabajos) {
        const filtered = verTerminados ? trabajos : trabajos.filter(t => t.estado !== 'terminado');

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div class="col-12 text-center py-5 empty-state">
                    <i class="fas fa-clipboard-list mb-3"></i>
                    <h2>${verTerminados ? 'No hay trabajos' : 'No hay trabajos pendientes'}</h2>
                    <p class="text-muted small">¡Excelente trabajo! Todo está al día.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = filtered.map(t => {
            const formatShortDate = (dateStr) => {
                if (!dateStr) return '';
                const d = new Date(dateStr);
                return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
            };

            const formatCost = (val) => {
                return `$${parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
            };

            let actionBtn = '';
            if (t.estado === 'pendiente') {
                actionBtn = `
                    <button class="btn btn-sm btn-outline-warning w-100 mt-2" onclick="cambiarEstado(${t.id}, 'en_progreso')">
                        <i class="fas fa-play me-2"></i> Iniciar
                    </button>
                `;
            } else if (t.estado === 'en_progreso') {
                actionBtn = `
                    <button class="btn btn-sm btn-outline-success w-100 mt-2" onclick="cambiarEstado(${t.id}, 'terminado')">
                        <i class="fas fa-check me-2"></i> Finalizar
                    </button>
                `;
            } else if (t.estado === 'terminado') {
                actionBtn = `
                    <button class="btn btn-sm btn-light w-100 mt-2" onclick="cambiarEstado(${t.id}, 'en_progreso')">
                        <i class="fas fa-undo me-2"></i> Reabrir
                    </button>
                `;
            }

            return `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="task-card priority-${t.prioridad} ${t.estado === 'terminado' ? 'opacity-75' : ''}">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="status-badge status-${t.estado}">${t.estado.replace('_', ' ')}</span>
                            <div class="dropdown">
                                <button class="btn btn-sm border-0 bg-transparent text-muted p-0" data-bs-toggle="dropdown">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <ul class="dropdown-menu shadow-sm border-0">
                                    <li><a class="dropdown-item" href="#" onclick="cambiarEstado(${t.id}, 'pendiente')">Marcar Pendiente</a></li>
                                    <li><a class="dropdown-item" href="#" onclick="cambiarEstado(${t.id}, 'en_progreso')">Marcar En Progreso</a></li>
                                    <li><a class="dropdown-item text-success" href="#" onclick="cambiarEstado(${t.id}, 'terminado')">Marcar Terminado</a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item text-danger" href="#" onclick="eliminarTrabajo(${t.id})">Eliminar</a></li>
                                </ul>
                            </div>
                        </div>
                        <h5 class="fw-bold mb-2 ${t.estado === 'terminado' ? 'text-decoration-line-through text-muted' : ''}">${t.descripcion}</h5>
                        <div class="d-flex flex-column gap-1 text-muted small">
                            <span><i class="far fa-calendar-alt me-2"></i><b>Inicio:</b> ${formatShortDate(t.fecha_inicio)}</span>
                            ${t.fecha_finalizado ? `<span><i class="fas fa-check-double me-2 text-success"></i><b>Finalizado:</b> ${formatShortDate(t.fecha_finalizado)}</span>` : ''}
                            ${t.fecha_entrega ? `<span><i class="far fa-clock me-2"></i><b>Entrega:</b> ${formatShortDate(t.fecha_entrega)}</span>` : ''}
                            <span class="mt-1 fw-bold text-dark fs-6"><i class="fas fa-tag me-2"></i>${formatCost(t.costo_estimado)}</span>
                        </div>
                        ${actionBtn}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Guardar Nuevo Trabajo
    document.getElementById('btnNuevoTrabajo').onclick = () => modalTrabajo.show();
    
    document.getElementById('btnGuardarTrabajo').onclick = function() {
        const formData = {
            descripcion: document.getElementById('txtDescripcion').value,
            costo_estimado: document.getElementById('txtCosto').value,
            prioridad: document.getElementById('selPrioridad').value,
            fecha_entrega: document.getElementById('txtFechaEntrega').value || null
        };

        if (!formData.descripcion) {
            Swal.fire('Error', 'La descripción es obligatoria', 'error');
            return;
        }

        fetch('/trabajos_pendientes/api/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                modalTrabajo.hide();
                document.getElementById('formTrabajo').reset();
                loadTrabajos();
                Swal.fire({
                    title: '¡Listo!',
                    text: 'Trabajo agregado con éxito',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    };

    // Funciones Globales para los onclick
    window.cambiarEstado = function(id, estado) {
        if (estado === 'terminado') {
            Swal.fire({
                title: '¿Finalizar trabajo?',
                text: "El trabajo se marcará como completado con la fecha de hoy.",
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                confirmButtonText: 'Sí, finalizar',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    ejecutarCambioEstado(id, estado);
                }
            });
        } else {
            ejecutarCambioEstado(id, estado);
        }
    };

    function ejecutarCambioEstado(id, estado) {
        fetch('/trabajos_pendientes/api/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, estado })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                loadTrabajos();
                if (estado === 'terminado') {
                    Swal.fire({
                        title: '¡Completado!',
                        icon: 'success',
                        timer: 1000,
                        showConfirmButton: false
                    });
                }
            } else {
                Swal.fire('Error', 'No se pudo actualizar el estado. Intenta reiniciar el programa.', 'error');
                console.error("Error actualizando estado:", data);
            }
        })
        .catch(err => {
            console.error("Fetch error:", err);
            Swal.fire('Error de Conexión', 'No se pudo comunicar con el servidor', 'error');
        });
    }

    window.eliminarTrabajo = function(id) {
        Swal.fire({
            title: '¿Estás seguro?',
            text: "No podrás revertir esta acción.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                fetch(`/trabajos_pendientes/api/delete/${id}`, { method: 'POST' })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            loadTrabajos();
                            Swal.fire('Eliminado', 'El trabajo ha sido borrado.', 'success');
                        }
                    });
            }
        });
    };
});
