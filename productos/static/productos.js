/* =========================================================
   LN Systems â€” productos.js (Control de Catálogo)
   ========================================================= */
'use strict';

let dataTable = null;
let modalProduct = null;
let modalCategories = null;
let modalImport = null;

const DT_LANG_ES = {
  "sProcessing": "Procesando...",
  "sLengthMenu": "Mostrar _MENU_ registros",
  "sZeroRecords": "No se encontraron resultados",
  "sEmptyTable": "Ningún dato disponible en esta tabla",
  "sInfo": "Mostrando registros del _START_ al _END_ de un total de _TOTAL_ registros",
  "sInfoEmpty": "Mostrando registros del 0 al 0 de un total de 0 registros",
  "sInfoFiltered": "(filtrado de un total de _MAX_ registros)",
  "sInfoPostFix": "",
  "sSearch": "Buscar:",
  "sUrl": "",
  "sInfoThousands": ",",
  "sLoadingRecords": "Cargando...",
  "oPaginate": {
    "sFirst": "Primero",
    "sLast": "Último",
    "sNext": "Siguiente",
    "sPrevious": "Anterior"
  },
  "oAria": {
    "sSortAscending": ": Activar para ordenar la columna de manera ascendente",
    "sSortDescending": ": Activar para ordenar la columna de manera descendente"
  }
};

let ITBIS_DEFAULT = 18; // Valor por defecto

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar Modales
  const m1 = document.getElementById('modalProduct');
  if (m1) modalProduct = new bootstrap.Modal(m1);

  const m2 = document.getElementById('modalCategories');
  if (m2) modalCategories = new bootstrap.Modal(m2);

  const m3 = document.getElementById('modalImport');
  if (m3) modalImport = new bootstrap.Modal(m3);

  initDataTable();
  loadData();
  loadCategories();
  loadUnits();
  updateKPIs();
  loadConfigITBIS(); // Cargar ITBIS desde configuración
  initFiltros(); // Inicializar filtros de búsqueda

  // Procesar búsqueda desde URL (Global Search Redirect)
  const urlParams = new URLSearchParams(window.location.search);
  const searchQ = urlParams.get('search');
  if (searchQ) {
    const filtroNombre = document.getElementById('filtroNombre');
    if (filtroNombre) {
      filtroNombre.value = searchQ;
      // Esperar a que los datos carguen antes de filtrar
      setTimeout(() => aplicarFiltros(), 500);
    }
  }

  // Auto-focus en nombre al abrir modal de producto
  if (m1) {
    m1.addEventListener('shown.bs.modal', () => {
      const inputNombre = document.getElementById('txtNombre');
      if (inputNombre) inputNombre.focus();
    });
  }
});

// Cargar ITBIS desde configuración del sistema (Mocked)
async function loadConfigITBIS() {
  ITBIS_DEFAULT = 18;
}

// Calcular margen de ganancia
function calcularGanancia() {
  const costo = parseFloat(document.getElementById('txtCosto').value) || 0;
  const venta = parseFloat(document.getElementById('txtPrecioVenta').value) || 0;
  const gananciaEl = document.getElementById('txtGanancia');
  const infoEl = document.getElementById('lblGananciaInfo');

  if (costo > 0 && venta > 0) {
    const margen = ((venta - costo) / costo) * 100;
    gananciaEl.value = margen.toFixed(1) + '%';

    // Cambiar color según el margen
    if (margen < 10) {
      gananciaEl.style.color = '#dc3545'; // Rojo - margen bajo
      gananciaEl.style.backgroundColor = '#fee2e2';
      infoEl.innerHTML = '<i class="fas fa-exclamation-triangle me-1 text-danger"></i>Margen muy bajo';
    } else if (margen < 30) {
      gananciaEl.style.color = '#f59e0b'; // Naranja - margen normal
      gananciaEl.style.backgroundColor = '#fef3c7';
      infoEl.innerHTML = '<i class="fas fa-info-circle me-1 text-warning"></i>Margen aceptable';
    } else {
      gananciaEl.style.color = '#10b981'; // Verde - buen margen
      gananciaEl.style.backgroundColor = '#d1fae5';
      infoEl.innerHTML = '<i class="fas fa-check-circle me-1 text-success"></i>Buen margen de ganancia';
    }
  } else {
    gananciaEl.value = '0%';
    gananciaEl.style.color = '#6b7280';
    gananciaEl.style.backgroundColor = '#f3f4f6';
    infoEl.innerHTML = '<i class="fas fa-info-circle me-1"></i>Ingrese costo y precio';
  }
}

// --- Filtros de Búsqueda ---
function initFiltros() {
  const filtroNombre = document.getElementById('filtroNombre');
  const filtroCategoria = document.getElementById('filtroCategoria');
  const filtroEstado = document.getElementById('filtroEstado');

  if (filtroNombre) {
    filtroNombre.addEventListener('input', aplicarFiltros);
  }
  if (filtroCategoria) {
    filtroCategoria.addEventListener('change', aplicarFiltros);
  }
  if (filtroEstado) {
    filtroEstado.addEventListener('change', aplicarFiltros);
  }
}

function aplicarFiltros() {
  const nombre = document.getElementById('filtroNombre').value.toLowerCase();
  const categoria = document.getElementById('filtroCategoria').value;
  const estado = document.getElementById('filtroEstado').value;

  // Filtro personalizado de DataTables
  $.fn.dataTable.ext.search.pop(); // Limpiar filtros anteriores
  $.fn.dataTable.ext.search.push(function (settings, data, dataIndex) {
    const rowNombre = (data[1] || '').toLowerCase(); // Columna nombre (índice 1)
    const rowCategoria = data[2] || ''; // Columna categoría (índice 2)
    const rowEstado = data[5] || ''; // Columna estado (índice 5)

    // Filtrar por nombre
    if (nombre && !rowNombre.includes(nombre)) return false;

    // Filtrar por categoría
    if (categoria && rowCategoria !== categoria) return false;

    // Filtrar por estado
    if (estado && !rowEstado.includes(estado)) return false;

    return true;
  });

  dataTable.draw();
  actualizarContador();
}

function limpiarFiltros() {
  document.getElementById('filtroNombre').value = '';
  document.getElementById('filtroCategoria').value = '';
  document.getElementById('filtroEstado').value = '';

  // Limpiar filtros de DataTables
  $.fn.dataTable.ext.search.pop();
  dataTable.draw();
  actualizarContador();
}

function actualizarContador() {
  const count = dataTable.rows({ search: 'applied' }).count();
  const badge = document.getElementById('badgeResultados');
  if (badge) {
    badge.textContent = `${count} Item${count !== 1 ? 's' : ''}`;
  }
}

// --- Carga de Datos ---
async function loadData() {
  try {
    const res = await fetch('/productos/api/list');
    const data = await res.json();
    if (data.ok) {
      dataTable.clear();
      dataTable.rows.add(data.items);
      dataTable.draw();
      actualizarContador(); // Actualizar el badge de resultados
    }
  } catch (e) { console.error(e); }
}

async function updateKPIs() {
  try {
    const res = await fetch('/productos/api/stats');
    const data = await res.json();
    if (data.ok) {
      document.getElementById('kpiTotal').textContent = data.total_items;
      document.getElementById('kpiBajo').textContent = data.stock_bajo;
      document.getElementById('kpiValor').textContent = formatMoney(data.valor_inventario);

      if (data.stock_bajo > 0) {
        document.getElementById('kpiBajo').parentElement.classList.add('pulse-warning');
      } else {
        document.getElementById('kpiBajo').parentElement.classList.remove('pulse-warning');
      }
    }
  } catch (e) { console.error(e); }
}

async function loadCategories() {
  try {
    const res = await fetch('/productos/api/categorias');
    const items = await res.json();
    const sel = document.getElementById('selCategoria');
    const list = document.getElementById('listCategories');
    const filtro = document.getElementById('filtroCategoria');

    if (Array.isArray(items)) {
      // Dropdown del formulario
      sel.innerHTML = '<option value="">Seleccionar...</option>' +
        items.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');

      // Dropdown del filtro
      if (filtro) {
        filtro.innerHTML = '<option value="">Todas las categorías</option>' +
          items.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
      }

      list.innerHTML = items.map(c => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <span>${c.nombre}</span>
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteCategory(${c.id})">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `).join('');
    }
  } catch (e) { console.error("Error cargando categorías:", e); }
}

async function loadUnits() {
  const sel = document.getElementById('selUnidad');
  if (sel) {
    sel.innerHTML = '<option value="">Sin Unidad (Unidad base)</option>';
  }
}

// --- Logic ---
function initDataTable() {
  if (dataTable) dataTable.destroy();
  dataTable = $('#tablaProductos').DataTable({
    language: DT_LANG_ES,
    responsive: false, // Usamos nuestra propia transformación CSS para móviles
    info: false,
    pageLength: 25,
    // Eliminamos 'f' porque ya tenemos filtros personalizados mejorados
    dom: '<"d-flex justify-content-center mb-3">rt<"d-flex justify-content-center mt-4"p>',
    columns: [
      {
        data: 'codigo',
        render: (data, type, row) => `
          <div class="d-flex flex-column">
            <code class="fw-bold" style="color: inherit;">${data}</code>
            ${row.codigo_barra ? `<small class="text-muted"><i class="fas fa-barcode me-1"></i>${row.codigo_barra}</small>` : ''}
          </div>
        `
      },
      {
        data: 'nombre',
        render: (data, type, row) => `<div class="fw-bold text-primary cursor-pointer" onclick="viewProfile(${row.id})">${data}</div>`
      },
      { data: 'categoria_nombre' },
      {
        data: 'stock_actual',
        className: 'text-center',
        render: (data, type, row) => {
          const color = data <= row.stock_minimo ? 'text-danger fw-bold' : '';
          return `<span class="${color}" style="color: inherit;">${data}</span>`;
        }
      },
      {
        data: 'precio_venta',
        className: 'text-end fw-bold',
        render: (data) => formatMoney(data)
      },
      {
        data: 'estado',
        className: 'text-center',
        render: (data) => `<span class="badge-estado ${data === 'Activo' ? 'bg-activo' : 'bg-inactivo'}">${data}</span>`
      },
      {
        data: null,
        className: 'text-end',
        visible: (typeof window.IS_ADMIN !== 'undefined' ? window.IS_ADMIN : false),
        render: (data, type, row) => `
                    <div class="btn-group">
                        <button class="btn btn-sm btn-light border" onclick="openModalEdit(${row.id})" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-light border" onclick="toggleStatus(${row.id})" title="Activar/Desactivar"><i class="fas fa-sync-alt"></i></button>
                    </div>
                `
      }
    ],
    createdRow: function (row, data) {
      // Inyectar etiquetas para vista móvil (Cards)
      $('td:eq(0)', row).attr('data-label', 'Código');
      $('td:eq(1)', row).attr('data-label', 'Producto');
      $('td:eq(2)', row).attr('data-label', 'Categoría');
      $('td:eq(3)', row).attr('data-label', 'Stock');
      $('td:eq(4)', row).attr('data-label', 'Precio');
      $('td:eq(5)', row).attr('data-label', 'Estado');
      $('td:eq(6)', row).attr('data-label', 'Acciones');
    }
  });
}

async function toggleStatus(id) {
  try {
    const res = await fetch(`/productos/api/toggle_status/${id}`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      Swal.fire({
        title: 'Estado Actualizado',
        text: `El producto ahora está ${data.nuevo_estado}`,
        icon: 'success',
        toast: true,
        position: 'top-end',
        timer: 3000,
        showConfirmButton: false
      });
      loadData();
    }
  } catch (e) {
    console.error(e);
    Swal.fire('Error', 'No se pudo cambiar el estado', 'error');
  }
}

// --- Modales ---
async function openModalCreate() {
  document.getElementById('formProduct').reset();
  document.getElementById('txtId').value = '';
  document.getElementById('modalProdTitle').textContent = 'Registrar Nuevo Producto';
  document.getElementById('divStockActual').style.display = 'block';
  const chkLN = document.getElementById('chkShareLN');
  if (chkLN) chkLN.checked = false;

  // Cargar código automático secuencial
  try {
    const res = await fetch('/productos/api/next-code');
    const data = await res.json();
    if (data.ok && data.codigo) {
      document.getElementById('txtCodigo').value = data.codigo;
    }
  } catch (e) {
    console.warn('No se pudo generar código automático:', e);
  }

  // Cargar ITBIS desde configuración
  document.getElementById('txtImpuesto').value = ITBIS_DEFAULT;

  // Resetear campo de ganancia
  document.getElementById('txtGanancia').value = '0%';
  document.getElementById('txtGanancia').style.color = '#6b7280';
  document.getElementById('txtGanancia').style.backgroundColor = '#f3f4f6';
  document.getElementById('lblGananciaInfo').innerHTML = '<i class="fas fa-info-circle me-1"></i>Ingrese costo y precio';

  modalProduct.show();
}

async function openModalEdit(id) {
  try {
    const res = await fetch(`/productos/api/profile/${id}`);
    const data = await res.json();
    if (data.ok) {
      const p = data.producto;
      document.getElementById('txtId').value = p.id;
      document.getElementById('txtCodigo').value = p.codigo;
      document.getElementById('txtCodigoBarra').value = p.codigo_barra || '';
      document.getElementById('txtNombre').value = p.nombre;
      document.getElementById('txtDesc').value = p.descripcion || '';
      document.getElementById('selCategoria').value = p.categoria_nombre || '';
      document.getElementById('txtPrecioVenta').value = p.precio_venta;
      document.getElementById('txtCosto').value = p.precio_compra;
      document.getElementById('txtImpuesto').value = p.impuesto;
      document.getElementById('selUnidad').value = p.unidad_medida_id || '';
      document.getElementById('chkUsaDimension').checked = !!p.usa_dimension;
      document.getElementById('txtStockMin').value = p.stock_minimo;
      document.getElementById('txtStockMax').value = p.stock_maximo;

      document.getElementById('modalProdTitle').textContent = 'Editar Producto';
      document.getElementById('divStockActual').style.display = 'none';

      // Check sharing status (Async)
      checkSharingStatus(id);

      // Calcular ganancia con los valores cargados
      calcularGanancia();

      modalProduct.show();
    }
  } catch (e) { console.error(e); }
}

async function submitProduct() {
  const id = document.getElementById('txtId').value;
  const nombre = document.getElementById('txtNombre').value;
  const codigo = document.getElementById('txtCodigo').value;

  if (!nombre) return;

  const payload = {
    codigo: codigo,
    codigo_barra: document.getElementById('txtCodigoBarra').value.trim(),
    nombre: nombre,
    descripcion: document.getElementById('txtDesc').value,
    categoria: document.getElementById('selCategoria').value,
    precio_venta: document.getElementById('txtPrecioVenta').value || 0,
    precio_compra: document.getElementById('txtCosto').value || 0,
    impuesto: document.getElementById('txtImpuesto').value || 0,
    unidad_medida_id: document.getElementById('selUnidad').value,
    usa_dimension: document.getElementById('chkUsaDimension').checked ? 1 : 0,
    stock_actual: document.getElementById('txtStockActual').value || 0,
    stock_minimo: document.getElementById('txtStockMin').value || 0,
    stock_maximo: document.getElementById('txtStockMax').value || 0
  };

  const url = id ? `/productos/api/update/${id}` : '/productos/api/create';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.ok) {
      const chkLN = document.getElementById('chkShareLN');
      const shareChecked = chkLN ? chkLN.checked : false;
      const finalId = id || result.id;

      if (finalId) {
        await handleLNSync(finalId, shareChecked);
      }

      modalProduct.hide();
      loadData();
      updateKPIs();
      Swal.fire('Guardado', 'El producto ha sido registrado correctamente.', 'success');
    } else {
      console.error("Error del servidor:", result);
      Swal.fire({
        title: 'Error al guardar',
        text: result.error || 'Ocurrió un error inesperado al procesar el producto.',
        icon: 'error'
      });
    }
  } catch (e) {
    console.error("Error de red:", e);
    Swal.fire('Error Crítico', 'No se pudo comunicar con el servidor.', 'error');
  }
}

// --- Categorías ---
function openCategoryModal() { modalCategories.show(); }

async function addCategory() {
  const name = document.getElementById('newCatName').value.trim();
  if (!name) return;

  try {
    const res = await fetch('/productos/api/categorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: name })
    });
    if (res.ok) {
      document.getElementById('newCatName').value = '';
      loadCategories();
    }
  } catch (e) { console.error(e); }
}

async function deleteCategory(id) {
  if (!confirm('Â¿Eliminar esta categoría?')) return;
  try {
    const res = await fetch(`/productos/api/categorias/${id}`, { method: 'DELETE' });
    if (res.ok) loadCategories();
  } catch (e) { console.error(e); }
}

// --- Import / Export ---
function exportToExcel() {
  window.location.href = '/productos/api/exportar';
}

function openImportModal() {
  document.getElementById('importFile').value = '';
  modalImport.show();
}

async function processImport() {
  const fileInput = document.getElementById('importFile');
  if (!fileInput.files.length) {
    return Swal.fire('Atención', 'Seleccione un archivo Excel (.xlsx)', 'warning');
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  Swal.fire({
    title: 'Procesando archivo...',
    text: 'Por favor espere mientras actualizamos el catálogo.',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const res = await fetch('/productos/api/importar', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();

    if (result.ok) {
      modalImport.hide();
      Swal.fire('Ã‰xito', result.msg, 'success');
      loadData();
      updateKPIs();
      loadCategories(); // Por si se crearon nuevas
    } else {
      Swal.fire('Error', result.error || 'No se pudo procesar el archivo', 'error');
    }
  } catch (e) {
    console.error(e);
    Swal.fire('Error Crítico', 'Error de conexión con el servidor', 'error');
  }
}

// --- Utils ---
function formatMoney(amount) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount);
}

function viewProfile(id) {
  openModalEdit(id);
}

// --- Keyboard Shortcuts (Navegación y Acciones Rápidas) ---
document.addEventListener('keydown', (e) => {
  // Ignorar si el usuario está escribiendo en un campo
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

  const key = e.key.toLowerCase();

  switch (key) {
    case 'f': // Facturación
      window.location.href = '/facturacion';
      break;
    case 'h': // Home / Dashboard
      window.location.href = '/home';
      break;
    case 'c': // Clientes
      window.location.href = '/clientes';
      break;
    case 'n': // Proveedores
      window.location.href = '/proveedores/';
      break;
    case 'v': // Reporte de Ventas
      window.location.href = '/reporteventas';
      break;
    case 'p': // Modal Nuevo Producto
      e.preventDefault();
      if (typeof openModalCreate === 'function') openModalCreate();
      break;
    case 'd': // Modal Nueva Categoría (Diseño/Categorías)
      e.preventDefault();
      if (typeof openCategoryModal === 'function') openCategoryModal();
      break;
  }
});
// --- LN Multi-Universe Sync Helper ---
async function checkSharingStatus(id) {
  // Mocked for Next Design
  const chk = document.getElementById('chkShareLN');
  if (chk) chk.checked = false;
}

async function handleLNSync(entityId, share) {
  // Mocked for Next Design
}

