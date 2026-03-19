document.addEventListener('DOMContentLoaded', function() {
    const tablaGastos = document.getElementById('tablaGastos');
    const modalGasto = new bootstrap.Modal(document.getElementById('modalGasto'));
    
    // Sidebar Toggle
    document.getElementById('menuToggle').addEventListener('click', () => {
        document.body.classList.toggle('sidebar-hidden');
    });

    // Cargar Gastos
    loadGastos();

    function loadGastos() {
        fetch('/gastos_diarios/api/list')
            .then(res => res.json())
            .then(data => renderGastos(data));
    }

    function renderGastos(gastos) {
        if (gastos.length === 0) {
            tablaGastos.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No se han registrado gastos hoy.</td></tr>';
            return;
        }

        tablaGastos.innerHTML = gastos.map(g => `
            <tr class="expense-row">
                <td><span class="text-muted small">${g.fecha}</span></td>
                <td><span class="badge bg-light text-dark">${g.tipo}</span></td>
                <td><span class="fw-500">${g.descripcion}</span></td>
                <td class="text-end"><span class="monto-gasto">$${parseFloat(g.monto).toLocaleString()}</span></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarGasto(${g.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Guardar Gasto
    document.getElementById('btnNuevoGasto').onclick = () => modalGasto.show();

    document.getElementById('btnGuardarGasto').onclick = function() {
        const formData = {
            tipo: document.getElementById('selTipo').value,
            descripcion: document.getElementById('txtDescripcion').value,
            monto: document.getElementById('txtMonto').value
        };

        if (!formData.descripcion || !formData.monto) {
            Swal.fire('Error', 'Todos los campos son obligatorios', 'error');
            return;
        }

        fetch('/gastos_diarios/api/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                modalGasto.hide();
                document.getElementById('formGasto').reset();
                loadGastos();
                Swal.fire({
                    title: 'Registrado',
                    icon: 'success',
                    timer: 1000,
                    showConfirmButton: false
                });
            }
        });
    };

    window.eliminarGasto = function(id) {
        Swal.fire({
            title: '¿Eliminar registro?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Eliminar'
        }).then((result) => {
            if (result.isConfirmed) {
                fetch(`/gastos_diarios/api/delete/${id}`, { method: 'POST' })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            loadGastos();
                            Swal.fire('Eliminado', '', 'success');
                        }
                    });
            }
        });
    };
});
