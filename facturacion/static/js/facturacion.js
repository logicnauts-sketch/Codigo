// =========================
// CONFIG GLOBAL
// =========================
// âœ… FOCO DESACTIVADO SIEMPRE (no auto-focus, no mover focus al anchor, no enfocar inputs/botones)
const AUTO_FOCUS = false;

// Variables globales y configuración inicial
let cart = [];
let currentPaymentMethod = 'efectivo';

// âœ… MOD: currentClient ahora incluye limite_credito y saldo
let currentClient = {
  id: 'cf',
  name: 'Consumidor Final',
  rnc: '000-000000-0',
  type: 'cliente',
  limite_credito: 0,
  saldo: 0
};

let ITBIS_RATE = 0.18;
let FISCAL_CONFIG = {
  usar_impuestos: true,
  modo_aplicacion: 'preguntar',
  tasa_itbis: 18
};

let allowedPaymentMethods = []; // ['tarjeta', 'transferencia', 'dolares']

// âœ… Selección + buffer de cantidad (hotkeys)
let selectedCartItemId = null;
let qtyBuffer = '';
let qtyTimer = null;

// âœ… Flag para evitar guardados/side-effects durante restauración
let isRestoringSession = false;

// =========================
// âœ… SESIONES DE CARRITO
// =========================
const CART_SESSIONS_KEY = 'facturacion_cart_sessions_v1';
let cartSessions = [];
let activeSessionId = null;

// âœ… Modo de entidad para búsqueda RNC (cliente o proveedor)
let entitySearchMode = 'cliente';

function toggleEntityMode(forcedMode = null) {
  const btn = document.getElementById('toggle-entity-mode');
  const label = document.getElementById('entity-mode-label');
  const icon = btn ? btn.querySelector('i') : null;
  const input = document.getElementById('rnc-search-realtime');

  // Si no hay modo forzado, simplemente alternar
  if (!forcedMode) {
    forcedMode = (entitySearchMode === 'cliente') ? 'proveedor' : 'cliente';
  }

  entitySearchMode = forcedMode;

  if (entitySearchMode === 'proveedor') {
    if (label) label.textContent = 'PROV';
    if (icon) {
      icon.className = 'fas fa-truck';
    }
    if (btn) {
      btn.className = 'btn btn-primary rounded-3'; // Azul para Proveedores
      btn.title = 'Cambiar a Modo Cliente';
    }
    if (input) {
      input.placeholder = 'Buscar RNC Proveedor...';
    }
    // notyf.success('Modo: COMPRA A PROVEEDOR');
  } else {
    if (label) label.textContent = 'CLI';
    if (icon) {
      icon.className = 'fas fa-user';
    }
    if (btn) {
      btn.className = 'btn btn-success rounded-3'; // Verde para Clientes
      btn.title = 'Cambiar a Modo Proveedor';
    }
    if (input) {
      input.placeholder = 'Buscar RNC Cliente...';
    }
    // notyf.success('Modo: VENTA A CLIENTE');
  }

  // âœ… Mostrar/Ocultar campo NCF Proveedor
  const ncfContainer = document.getElementById('ncf-proveedor-container');
  if (ncfContainer) {
    ncfContainer.style.display = (entitySearchMode === 'proveedor') ? 'flex' : 'none';
  }
}

const notyf = new Notyf({
  duration: 3000,
  position: { x: 'right', y: 'top' },
  types: [{ type: 'error', background: '#ef476f' }]
});

// âœ… MODAL HELPERS (Global Scope)
async function openClientModalWithLoad(tab = 'clients') {
  const clientModal = document.getElementById('client-modal');
  if (!clientModal) return;

  const activeModal = document.querySelector('.modal.show');
  if (activeModal && activeModal !== clientModal) return;

  openModal(clientModal);

  const tabBtns = document.querySelectorAll('.tab');
  tabBtns.forEach(b => b.classList.remove('active'));

  const btn = document.querySelector(`.tab[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');

  document.querySelectorAll('.tab-content').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById(`${tab}-tab`);
  if (panel) panel.classList.remove('hidden');

  if (tab === 'clients') {
    loadPersonas('cliente', 'clients-list', '');
  } else {
    loadPersonas('proveedor', 'suppliers-list', '');
  }
}

async function toggleClientModal() {
  const cm = document.getElementById('client-modal');
  if (!cm) return;
  if (cm.classList.contains('show')) {
    closeModal(cm);
  } else {
    await openClientModalWithLoad('clients');
  }
}

async function openProductsModalWithLoad(term = '') {
  const productsModal = document.getElementById('products-modal');
  if (!productsModal) return;
  const activeModal = document.querySelector('.modal.show');
  if (activeModal && activeModal !== productsModal) return;
  openModal(productsModal);
  const products = await searchProducts(term);
  // Usar versión global de loadProductsForModal
  if (typeof window.loadProductsForModal === 'function') {
    window.loadProductsForModal(products);
  }
}

// âœ… Bootstrap Modals
let instances = {
  client: null,
  products: null,
  payment: null
};

// âœ… REVISAR SI HAY PEDIDO PENDIENTE DE COCINA
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Cargar por parámetro URL (manual/retrocompatibilidad)
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('order_id');
  if (orderId) {
    window.history.replaceState({}, document.title, window.location.pathname);
    loadOrderByID(orderId);
  }

  // 2. AUTO-POLLING: Deshabilitado (no hay módulo de cocina en Next Design)
  // El endpoint /api/pos/kitchen/orders no existe en este proyecto.
  // Si se necesita en el futuro, descomentar y ajustar la URL.
  /*
  let pollingInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/pos/kitchen/orders?status=waiting_payment');

      if (res.status === 401) {
        clearInterval(pollingInterval);
        console.error("Sesión expirada (401). Deteniendo auto-polling de cocina.");
        return;
      }

      if (res.ok) {
        const orders = await res.json();
        const pendingOrders = orders.filter(o => o.status === 'waiting_payment');

        for (const order of pendingOrders) {
          const success = await loadOrderByID(order.id);

          if (success) {
            await fetch(`/api/pos/orders/${order.id}/status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'delivered' })
            });
          }
        }
      }
    } catch (e) {
      console.warn("Error en auto-pull de pedidos:", e);
    }
  }, 3000); // 3 segundos
  */

  // âœ… Iniciar Instancias de Modales Bootstrap
  instances.client = new bootstrap.Modal(document.getElementById('client-modal'));
  instances.products = new bootstrap.Modal(document.getElementById('products-modal'));
  instances.payment = new bootstrap.Modal(document.getElementById('payment-modal'));

  // âœ… FOCO AUTOMÃTICO EN MODAL DE PAGO
  const payModalEl = document.getElementById('payment-modal');
  if (payModalEl) {
    payModalEl.addEventListener('shown.bs.modal', () => {
      const input = document.getElementById('amount-received');
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  // âœ… FOCO AUTOMÃTICO EN MODAL DE PRODUCTOS
  const prodModalEl = document.getElementById('products-modal');
  if (prodModalEl) {
    prodModalEl.addEventListener('shown.bs.modal', () => {
      const input = document.getElementById('modal-product-search');
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  hideRestrictedPaymentTiles();

  // âœ… Otras Aperturas de Modales
  const clientBtn = document.getElementById('open-client-modal-btn');
  if (clientBtn) clientBtn.addEventListener('click', () => openClientModalWithLoad('clients'));

  const searchInp = document.getElementById('product-search');
  if (searchInp) {
    searchInp.addEventListener('keydown', (e) => {
      if (e.key === 'F9') { e.preventDefault(); openProductsModal(); }
    });
  }

  // âœ… ATAJOS DE TECLADO GLOBALES se han consolidado en el escuchador único al final del archivo.


  // âœ… openPaymentModal global eliminada. Se usa la versión unificada local.



  // âœ… RNC/Cédula Real-Time Search (DGII Integration)
  const rncInput = document.getElementById('rnc-search-realtime');
  let rncDebounce = null;
  let rncSearching = false;

  // âœ… Función para formatear RNC/Cédula con patrón específico
  function formatRncCedula(value) {
    const digits = value.replace(/[^0-9]/g, '');

    // RNC (9 dígitos): Patrón XXX XXXXX X
    if (digits.length <= 9) {
      if (digits.length <= 3) return digits;
      if (digits.length <= 8) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `${digits.slice(0, 3)} ${digits.slice(3, 8)} ${digits.slice(8, 9)}`;
    }

    // Cédula (11 dígitos): Patrón XXX XXXXXXX X (ej. 402 3061599 5)
    // Limitamos a 11 dígitos
    const limited = digits.slice(0, 11);
    if (limited.length <= 3) return limited;
    if (limited.length <= 10) return `${limited.slice(0, 3)} ${limited.slice(3)}`;
    return `${limited.slice(0, 3)} ${limited.slice(3, 10)} ${limited.slice(10, 11)}`;
  }

  if (rncInput) {
    // âœ… Formateo en tiempo real mientras escribe
    rncInput.addEventListener('input', (e) => {
      clearTimeout(rncDebounce);

      // Guardar posición del cursor
      const cursorPos = e.target.selectionStart;
      const oldLen = e.target.value.length;

      // Formatear valor
      const formatted = formatRncCedula(e.target.value);
      e.target.value = formatted;

      // Ajustar posición del cursor
      const newLen = formatted.length;
      const posDiff = newLen - oldLen;
      e.target.setSelectionRange(cursorPos + posDiff, cursorPos + posDiff);

      const term = formatted.replace(/[^0-9]/g, '');

      if (term.length < 9) {
        rncInput.style.borderColor = '';
        return;
      }

      // Indicador visual de "preparando búsqueda"
      rncInput.style.borderColor = '#fbbf24';
      rncInput.placeholder = 'Esperando para buscar...';

      rncDebounce = setTimeout(async () => {
        const termClean = term.replace(/[^0-9]/g, '');
        const isCedula = termClean.length === 11; // Cédula = 11 dígitos
        const isRNC = termClean.length === 9;     // RNC = 9 dígitos

        if (!isCedula && !isRNC) {
          rncInput.style.borderColor = '#ef4444';
          notyf.error('Ingrese 9 dígitos (RNC) o 11 dígitos (Cédula)');
          return;
        }

        // Indicador de búsqueda activa
        rncSearching = true;
        rncInput.style.borderColor = '#6366f1';
        rncInput.disabled = true;

        try {
          const isProveedor = entitySearchMode === 'proveedor';
          const entityLabel = isProveedor ? 'Proveedor' : 'Cliente';
          const entityType = isProveedor ? 'proveedor' : 'cliente';

          // âœ… PASO 1: Buscar primero en la base de datos local
          rncInput.placeholder = 'ðŸ” Buscando en sistema...';
          const localSearchUrl = isProveedor
            ? `/facturacion/api/personas?tipo=proveedor&q=${encodeURIComponent(termClean)}`
            : `/facturacion/api/personas?tipo=cliente&q=${encodeURIComponent(termClean)}`;

          const localRes = await fetch(localSearchUrl);
          const personasLocales = await localRes.json();

          // Buscar coincidencia exacta por RNC/Cédula
          const existingEntity = personasLocales.find(p => {
            const rawRnc = String(p.rnc || p.cedula || p.rnc_cedula || '');
            const pRncClean = rawRnc.replace(/[^0-9]/g, '');
            return pRncClean === termClean;
          });

          if (existingEntity) {
            // âœ… YA EXISTE EN BD - Seleccionarlo directamente
            console.log('[BD Local] Â¡Encontrado!', existingEntity);
            currentClient = {
              id: existingEntity.id,
              name: existingEntity.name || existingEntity.nombre,
              rnc: existingEntity.rnc || existingEntity.cedula || existingEntity.rnc_cedula,
              type: entityType,
              limite_credito: Number(existingEntity.limite_credito || 0),
              saldo: Number(existingEntity.saldo || 0)
            };
            updateClientUI();
            updatePaymentAvailability();
            saveActiveSessionState();
            notyf.success(`âœ… ${entityLabel} seleccionado: ${currentClient.name}`);
            rncInput.value = '';
            rncInput.style.borderColor = '#10b981';
            rncSearching = false;
            rncInput.disabled = false;
            rncInput.placeholder = isProveedor ? 'Buscar RNC Proveedor...' : 'Buscar RNC/Cédula...';
            return;
          }

          // âœ… NO EXISTE EN BD LOCAL
          let entityName = '';
          let dgiiInfo = { rnc: termClean, estado: 'LOCAL' };

          // âœ… Si es CÃ‰DULA (11 dígitos): Crear directamente SIN validar DGII
          if (isCedula) {
            console.log('[Cédula] Creación directa sin DGII para:', termClean);
            rncInput.placeholder = 'ðŸ“ Registrando cédula...';

            // Pedir nombre al usuario
            const { value: inputName } = await Swal.fire({
              title: `Registro de Nuevo ${entityLabel}`,
              html: `<div class="mb-3 text-start">
                      <p><i class="fas fa-id-card text-primary me-2"></i>Cédula: <b>${formatRncCedula(termClean)}</b></p>
                      <p class="text-muted small">Este documento no existe en su base de datos. Por favor asigne un nombre:</p>
                     </div>`,
              input: 'text',
              inputPlaceholder: 'Nombre completo del cliente',
              showCancelButton: true,
              confirmButtonText: '<i class="fas fa-plus me-2"></i> Crear ' + entityLabel,
              confirmButtonColor: '#10b981',
              cancelButtonText: 'Cancelar',
              inputValidator: (value) => {
                if (!value || value.trim().length < 3) {
                  return 'El nombre es obligatorio (mín. 3 caracteres)';
                }
              }
            });

            if (!inputName) {
              rncInput.value = '';
              rncInput.style.borderColor = '';
              rncInput.disabled = false;
              rncInput.placeholder = 'Buscar RNC/Cédula...';
              rncSearching = false;
              return;
            }
            entityName = inputName.trim();
          } else {
            // âœ… Si es RNC (9 dígitos): Validar con DGII
            rncInput.placeholder = 'ðŸ” Validando en DGII...';
            const dgiiRes = await fetch(`/clientes/api/clientes/validar-rnc/${encodeURIComponent(termClean)}`);
            const dgiiData = await dgiiRes.json();

            if (!dgiiRes.ok || !dgiiData.success) {
              notyf.error('RNC no encontrado en DGII');
              rncInput.style.borderColor = '#ef4444';
              rncSearching = false;
              rncInput.disabled = false;
              rncInput.placeholder = isProveedor ? 'Buscar RNC Proveedor...' : 'Buscar RNC/Cédula...';
              return;
            }

            dgiiInfo = dgiiData.data;
            entityName = (dgiiInfo.nombre || dgiiInfo.nombre_comercial || '').trim();

            // Si el nombre viene vacío, pedir nombre real
            if (!entityName || entityName.includes('RNC ') || entityName === dgiiInfo.rnc) {
              const { value: inputName } = await Swal.fire({
                title: `Registro de Nuevo ${entityLabel}`,
                html: `<div class="mb-3 text-start">
                        <p><i class="fas fa-check-circle text-success me-2"></i>RNC validado: <b>${formatRncCedula(dgiiInfo.rnc)}</b></p>
                        <p class="text-muted small">Por favor asigne un nombre:</p>
                       </div>`,
                input: 'text',
                inputValue: entityName && !entityName.includes('RNC ') ? entityName : '',
                inputPlaceholder: 'Razón Social',
                showCancelButton: true,
                confirmButtonText: '<i class="fas fa-plus me-2"></i> Crear ' + entityLabel,
                confirmButtonColor: '#10b981',
                cancelButtonText: 'Cancelar',
                inputValidator: (value) => {
                  if (!value || value.trim().length < 3) {
                    return 'El nombre es obligatorio (mín. 3 caracteres)';
                  }
                }
              });

              if (!inputName) {
                rncInput.value = '';
                rncInput.style.borderColor = '';
                rncInput.disabled = false;
                rncInput.placeholder = 'Buscar RNC/Cédula...';
                rncSearching = false;
                return;
              }
              entityName = inputName.trim();
            }
          }

          // âœ… PASO 2: Crear entidad en la base de datos
          try {
            const createUrl = isProveedor ? '/proveedores/api/crear-rapido' : '/clientes/api/clientes/crear-rapido';
            const createRes = await fetch(createUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nombre: entityName,
                cedula: termClean,
                rnc: termClean,
                tipo_comprobante: isRNC ? 'B01' : 'B02' // B01 para RNC, B02 para Cédula
              })
            });
            const createData = await createRes.json();

            if (createData.success) {
              const entity = createData.cliente || createData.proveedor;
              currentClient = {
                id: entity.id,
                name: entity.nombre,
                rnc: entity.cedula || entity.rnc_cedula || termClean,
                type: entityType,
                limite_credito: Number(entity.limite_credito || 0),
                saldo: 0,
                dgii_estado: dgiiInfo.estado
              };
              notyf.success(`âœ… ${entityLabel} creado: ${entityName}`);
            } else if (createData.cliente_id || createData.proveedor_id) {
              const entityId = createData.cliente_id || createData.proveedor_id;
              currentClient = {
                id: entityId,
                name: createData.nombre || entityName,
                rnc: termClean,
                type: entityType,
                limite_credito: Number(createData.limite_credito || 0),
                saldo: Number(createData.saldo || 0)
              };
              notyf.success(`âœ… ${entityLabel} seleccionado: ${currentClient.name}`);
            } else {
              currentClient = {
                id: termClean,
                name: entityName,
                rnc: termClean,
                type: entityType,
                limite_credito: 0,
                saldo: 0
              };
              notyf.error(`${entityLabel} temporal: ${entityName}`);
            }
          } catch (createErr) {
            console.error('Error creando entidad:', createErr);
            currentClient = {
              id: termClean,
              name: entityName,
              rnc: termClean,
              type: entityType,
              limite_credito: 0,
              saldo: 0
            };
            notyf.error(`${entityLabel} temporal: ${entityName}`);
          }

          updateClientUI();
          updatePaymentAvailability();
          saveActiveSessionState();
          rncInput.value = '';
          rncInput.style.borderColor = '#10b981';

        } catch (err) {
          console.error('[RNC Search Error]', err);
          if (!navigator.onLine) {
            Swal.fire({
              icon: 'warning',
              title: 'Sin Conexión',
              text: 'Su equipo está desconectado de internet.',
              confirmButtonColor: '#ef4444'
            });
          } else {
            notyf.error('Error al consultar');
          }
          rncInput.style.borderColor = '#ef4444';
        } finally {
          rncSearching = false;
          rncInput.disabled = false;
          rncInput.placeholder = 'Buscar RNC/Cédula...';
        }
      }, 1500); // âœ… 1.5 segundos de espera
    });
  }
  // âœ… Inicializar Tabs de Modal de Clientes
  document.querySelectorAll('#client-modal .tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      const targetTab = tabBtn.dataset.tab;
      openClientModalWithLoad(targetTab);
    });
  });
});

async function loadOrderByID(orderId) {
  try {
    const res = await fetch(`/api/pos/orders/${orderId}`);
    if (!res.ok) {
      console.error(`Error de red al cargar pedido ${orderId}: ${res.status}`);
      return false;
    }
    const data = await res.json();

    if (data.success && data.order) {
      // 1. Verificar si ya existe este pedido cargado para no duplicar carritos
      const existing = cartSessions.find(s => s.orderId === orderId);
      if (existing) {
        loadSessionState(existing.id);
        return true;
      }

      // 2. Crear nueva sesión limpia
      createNewSession();

      const s = getActiveSession();
      const order = data.order;

      // 3. Personalizar nombre y guardar ID de pedido
      s.name = `Pedido #${order.id} - ${order.customer_name}`;
      s.autoName = false;
      s.orderId = orderId;

      // --- AUTO-SELECCION DE CLIENTE INTELIGENTE ---
      const cName = (order.customer_name || '').trim();
      const systemNames = ['mostrador', 'mesa', 'table', 'consumidor final', 'cliente mostrador', 'anonimo', 'n/a', 'cliente'];
      const isSystemName = systemNames.some(sn => cName.toLowerCase().includes(sn));

      let match = null;

      // Prioridad 1: Vincular por ID exacto si el POS lo envió (Más Seguro)
      if (order.cliente_id && order.cliente_id !== 'cf' && order.cliente_id !== 1) {
        try {
          const resClient = await fetch(`/api/personas/${order.cliente_id}`).then(r => r.json());
          if (resClient && resClient.id) match = resClient;
        } catch (e) { console.warn('Error fetching client by ID', e); }
      }

      // Prioridad 2: Buscar por nombre solo si NO es nombre de sistema y NO es un nombre común/corto
      // Evitamos auto-match de nombres como "Javier" si no estamos seguros
      const commonNames = ['javier', 'juan', 'maria', 'carlos', 'pedro', 'jose'];
      const isCommonName = commonNames.includes(cName.toLowerCase());

      if (!match && cName && !isSystemName && !isCommonName && cName.length > 3) {
        try {
          const candidates = await fetch(`/facturacion/api/personas?tipo=cliente&q=${encodeURIComponent(cName)}`).then(r => r.json());
          // Match exacto de nombre para evitar errores
          match = candidates.find(x => x.name.toLowerCase().trim() === cName.toLowerCase().trim());
        } catch (e) { console.warn('Error auto-detecting client by name', e); }
      }

      if (match) {
        currentClient = {
          id: match.id,
          name: match.name,
          rnc: match.rnc || match.cedula || '000-000000-00',
          type: 'cliente',
          limite_credito: Number(match.limite_credito || 0),
          saldo: Number(match.saldo || 0)
        };
        if (typeof notyf !== 'undefined') notyf.success(`Cliente identificado: ${match.name}`);
      } else {
        // Fallback a Consumidor Final si no hay match seguro
        currentClient = {
          id: 'cf',
          name: 'Consumidor Final',
          rnc: '000-000000-0',
          type: 'cliente',
          limite_credito: 0,
          saldo: 0
        };
        if (cName && !isSystemName) {
          console.log(`Nombre de orden "${cName}" no coincide con clientes registrados. Usando Consumidor Final.`);
        }
      }
      s.currentClient = deepClone(currentClient);

      // Actualizar UI del cliente
      updateClientUI();
      updatePaymentAvailability();

      // 4. Agregar items
      cart = order.items.map(item => ({
        id: item.id,
        codigo: item.codigo || null,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        measure: item.measure || 'Unidad',
        category: item.category || 'General',
        itbis: calculateItbis(item.price)
      }));

      // Actualizar UI
      saveActiveSessionState();
      updateCart();
      renderSessionIndicator();

      // Notificar
      if (typeof notyf !== 'undefined') {
        notyf.success(`Â¡Nuevo pedido de cocina! #${order.id} cargado.`);
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error(e);
    if (typeof notyf !== 'undefined') {
      notyf.error('Error al cargar pedido de cocina');
    }
    return false;
  }
}

// âœ… clone safe (si structuredClone no existe)
function deepClone(obj) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(obj);
  } catch (_) { }
  return JSON.parse(JSON.stringify(obj));
}

function genSessionId() {
  return 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// =========================
// âœ… CASH INPUT SOLO EN MODAL (EFECTIVO)
// =========================


function getAmountReceivedEl() {
  return document.getElementById('amount-received') || null;
}

function getAmountReceivedNumber() {
  const el = getAmountReceivedEl();
  return el ? (parseFormattedNumber(el.value) || 0) : 0;
}

function setAmountReceivedRaw(v) {
  const el = getAmountReceivedEl();
  if (el) el.value = v || '';
}

function readAmountReceivedValue() {
  const el = getAmountReceivedEl();
  return el ? (el.value || '') : '';
}

function writeAmountReceivedValue(v) {
  setAmountReceivedRaw(v || '');
}

function updatePaymentModalNumbers() {
  const totalEl = document.getElementById('total');
  const modalTotal = document.getElementById('modal-total');
  const modalChange = document.getElementById('modal-change');

  if (!totalEl || !modalTotal || !modalChange) return;

  const total = parseFormattedNumber(totalEl.textContent) || 0;
  const rec = getAmountReceivedNumber();
  const change = rec - total;

  modalTotal.textContent = totalEl.textContent;



  modalChange.textContent = `RD$ ${formatNumber(change >= 0 ? change : 0)}`;

  const changeAmount = document.getElementById('change-amount');
  if (changeAmount && currentPaymentMethod === 'efectivo') {
    changeAmount.textContent = `RD$ ${formatNumber(change >= 0 ? change : 0)}`;
  }
}

function syncConfirmPaymentState() {
  const confirmPayment = document.getElementById('confirm-payment');
  const totalEl = document.getElementById('total');
  if (!confirmPayment || !totalEl) return;

  const total = parseFormattedNumber(totalEl.textContent) || 0;
  const rec = getAmountReceivedNumber();

  confirmPayment.disabled = !(rec > 0 && rec >= total);
}

// =========================
// âœ… LISTENERS del input (una sola vez)
// =========================
function wireAmountReceivedInModal() {

  const el = getAmountReceivedEl();
  if (!el) return;

  if (el.dataset.wired === '1') return;
  el.dataset.wired = '1';

  el.addEventListener('input', () => {
    const cleaned = sanitizeMoneyInput(el.value);
    if (el.value !== cleaned) {
      const pos = el.selectionStart;
      el.value = cleaned;
      if (typeof pos === 'number') el.setSelectionRange(pos, pos);
    }

    updatePaymentModalNumbers();
    syncConfirmPaymentState();

    saveActiveSessionState();
    renderSessionIndicator();
  });

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      const btn = document.getElementById('confirm-payment');
      if (btn && !btn.disabled) {
        btn.click();
      } else {
        notyf.error('El monto recibido es insuficiente');
      }
    }
  });
}

// =========================
// âœ… ENTER EN VISTA PRINCIPAL => ABRE MODAL EFECTIVO
// =========================


// =========================
// âœ… SESIONES DE CARRITO
// =========================
function saveSessionsToStorage() {
  try {
    localStorage.setItem(CART_SESSIONS_KEY, JSON.stringify({
      activeSessionId,
      cartSessions
    }));
  } catch (e) {
    console.warn('No se pudo persistir sesiones:', e);
  }
}

function loadSessionsFromStorage() {
  try {
    const raw = localStorage.getItem(CART_SESSIONS_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.cartSessions)) {
      cartSessions = parsed.cartSessions;
      activeSessionId = parsed.activeSessionId || null;
    }
  } catch (e) {
    console.warn('No se pudo cargar sesiones:', e);
  }
}

// =========================
// âœ… AUTO-RENOMBRE (1..N)
// =========================
function isDefaultCartName(name) {
  return /^carrito\s+\d+$/i.test(String(name || '').trim());
}

function normalizeAutoNameFlags() {
  if (!Array.isArray(cartSessions)) cartSessions = [];
  cartSessions.forEach((s) => {
    if (!s) return;
    if (typeof s.autoName !== 'boolean') {
      s.autoName = isDefaultCartName(s.name) || !s.name;
    }
    if (!s.name) s.name = 'Carrito 1';
  });
}

function renumberAutoNamedSessions() {
  normalizeAutoNameFlags();
  let n = 1;
  for (const s of cartSessions) {
    if (s && s.autoName) {
      s.name = `Carrito ${n}`;
      n++;
    }
  }
}

function ensureDefaultSession() {
  if (cartSessions.length === 0) {
    const id = genSessionId();
    cartSessions.push({
      id,
      name: 'Carrito 1',
      autoName: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cart: [],
      currentClient: {
        id: 'cf',
        name: 'Consumidor Final',
        rnc: '000-000000-0',
        type: 'cliente',
        limite_credito: 0,
        saldo: 0
      },
      currentPaymentMethod: 'efectivo',
      amountReceived: ''
    });
    activeSessionId = id;
    saveSessionsToStorage();
    return;
  }

  normalizeAutoNameFlags();
  renumberAutoNamedSessions();

  const exists = cartSessions.some(s => s.id === activeSessionId);
  if (!exists) {
    activeSessionId = cartSessions[0].id;
    saveSessionsToStorage();
  } else {
    saveSessionsToStorage();
  }
}

function getActiveSession() {
  return cartSessions.find(s => s.id === activeSessionId) || null;
}

function saveActiveSessionState() {
  if (isRestoringSession) return;

  const s = getActiveSession();
  if (!s) return;

  s.updatedAt = Date.now();
  s.cart = Array.isArray(cart) ? deepClone(cart) : [];
  s.currentClient = deepClone(currentClient);
  s.currentPaymentMethod = currentPaymentMethod;
  s.amountReceived = readAmountReceivedValue();

  saveSessionsToStorage();
}

// âœ… al facturar: forzar que la sesión activa quede en Consumidor Final
function resetActiveSessionToCF() {
  const s = getActiveSession();
  if (!s) return;

  s.updatedAt = Date.now();
  s.cart = [];
  s.currentClient = {
    id: 'cf',
    name: 'Consumidor Final',
    rnc: '000-000000-0',
    type: 'cliente',
    limite_credito: 0,
    saldo: 0
  };
  s.currentPaymentMethod = 'efectivo';
  s.amountReceived = '';

  saveSessionsToStorage();
}

// âœ… loadSessionState con opción skipSave
function loadSessionState(sessionId, opts = {}) {
  const { skipSave = false } = opts;

  const s = cartSessions.find(x => x.id === sessionId);
  if (!s) return false;

  if (!skipSave) {
    saveActiveSessionState();
  }

  isRestoringSession = true;

  activeSessionId = s.id;

  cart = Array.isArray(s.cart) ? deepClone(s.cart) : [];

  currentClient = deepClone(s.currentClient || {
    id: 'cf',
    name: 'Consumidor Final',
    rnc: '000-000000-0',
    type: 'cliente',
    limite_credito: 0,
    saldo: 0
  });

  if (currentClient && typeof currentClient === 'object') {
    if (currentClient.limite_credito == null) currentClient.limite_credito = 0;
    if (currentClient.saldo == null) currentClient.saldo = 0;
  }

  currentPaymentMethod = s.currentPaymentMethod || 'efectivo';

  selectedCartItemId = null;
  qtyBuffer = '';
  clearTimeout(qtyTimer);

  updateClientUI();
  updatePaymentAvailability();
  selectPaymentMethod(currentPaymentMethod);
  writeAmountReceivedValue(s.amountReceived || '');
  updateCart();

  isRestoringSession = false;

  saveSessionsToStorage();
  saveActiveSessionState();

  renderSessionIndicator();

  return true;
}

function createNewSession() {
  saveActiveSessionState();

  renumberAutoNamedSessions();

  const id = genSessionId();
  const nextIndex = cartSessions.filter(s => s && s.autoName).length + 1;

  cartSessions.push({
    id,
    name: `Carrito ${nextIndex}`,
    autoName: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    cart: [],
    currentClient: {
      id: 'cf',
      name: 'Consumidor Final',
      rnc: '000-000000-0',
      type: 'cliente',
      limite_credito: 0,
      saldo: 0
    },
    currentPaymentMethod: 'efectivo',
    amountReceived: ''
  });

  isRestoringSession = true;

  activeSessionId = id;

  cart = [];
  currentClient = {
    id: 'cf',
    name: 'Consumidor Final',
    rnc: '000-000000-0',
    type: 'cliente',
    limite_credito: 0,
    saldo: 0
  };
  currentPaymentMethod = 'efectivo';
  selectedCartItemId = null;
  qtyBuffer = '';
  clearTimeout(qtyTimer);

  updateClientUI();
  updatePaymentAvailability();
  selectPaymentMethod('efectivo');
  writeAmountReceivedValue('');
  updateCart();

  isRestoringSession = false;

  saveSessionsToStorage();
  saveActiveSessionState();
  renderSessionIndicator();
}

async function openSessionPicker() {
  saveActiveSessionState();

  const options = {};
  cartSessions.forEach((s) => {
    const isActive = (s.id === activeSessionId);
    const count = Array.isArray(s.cart) ? s.cart.reduce((acc, it) => acc + (it.quantity || 0), 0) : 0;
    options[s.id] = `${isActive ? 'âœ… ' : ''}${s.name} (${count} items)`;
  });

  const result = await Swal.fire({
    title: 'Gestión de Carritos',
    input: 'select',
    inputOptions: options,
    inputValue: activeSessionId,
    showCancelButton: true,
    confirmButtonText: 'Cambiar',
    cancelButtonText: 'Cancelar',
    showDenyButton: true,
    denyButtonText: '<i class="fas fa-plus"></i> Nuevo Carrito',
    denyButtonColor: '#6366f1',
    allowOutsideClick: false,
    footer: '<button id="swal-create-supplier" class="swal2-styled" style="background:#10b981; padding:0.5rem 1.5rem; border-radius:8px; font-weight:600;"><i class="fas fa-truck"></i> Crear Proveedor</button>',
    didOpen: () => {
      const supplierBtn = document.getElementById('swal-create-supplier');
      if (supplierBtn) {
        supplierBtn.addEventListener('click', () => {
          Swal.close();
          openCreateSupplierModal();
        });
      }
    }
  });

  if (result.isDenied) {
    createNewSession();
    return;
  }

  if (result.isConfirmed && result.value) {
    loadSessionState(result.value, { skipSave: true });
  }
}

// âœ… Modal para crear proveedor rápidamente
async function openCreateSupplierModal() {
  const { value: formValues } = await Swal.fire({
    title: '<i class="fas fa-truck" style="color:#10b981"></i> Nuevo Proveedor',
    html: `
      <div style="text-align:left; padding: 0.5rem;">
        <label style="font-weight:600; margin-bottom:0.25rem; display:block;">RNC/Cédula *</label>
        <input id="swal-prov-rnc" class="swal2-input" placeholder="Ej: 132582594" style="margin:0 0 1rem 0; width:100%;">
        
        <label style="font-weight:600; margin-bottom:0.25rem; display:block;">Nombre / Razón Social *</label>
        <input id="swal-prov-nombre" class="swal2-input" placeholder="Nombre del proveedor" style="margin:0 0 1rem 0; width:100%;">
        
        <label style="font-weight:600; margin-bottom:0.25rem; display:block;">Teléfono</label>
        <input id="swal-prov-telefono" class="swal2-input" placeholder="809-000-0000" style="margin:0 0 1rem 0; width:100%;">
        
        <label style="font-weight:600; margin-bottom:0.25rem; display:block;">Dirección</label>
        <input id="swal-prov-direccion" class="swal2-input" placeholder="Dirección" style="margin:0; width:100%;">
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: '<i class="fas fa-save"></i> Guardar Proveedor',
    confirmButtonColor: '#10b981',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const rnc = document.getElementById('swal-prov-rnc').value.trim();
      const nombre = document.getElementById('swal-prov-nombre').value.trim();
      const telefono = document.getElementById('swal-prov-telefono').value.trim();
      const direccion = document.getElementById('swal-prov-direccion').value.trim();

      if (!rnc || rnc.length < 9) {
        Swal.showValidationMessage('RNC/Cédula debe tener mínimo 9 dígitos');
        return false;
      }
      if (!nombre || nombre.length < 3) {
        Swal.showValidationMessage('Nombre debe tener mínimo 3 caracteres');
        return false;
      }

      return { rnc, nombre, telefono, direccion };
    }
  });

  if (formValues) {
    try {
      const res = await fetch('/proveedores/api/crear-rapido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      const data = await res.json();

      if (data.success) {
        notyf.success(`âœ… Proveedor creado: ${formValues.nombre}`);

        // Seleccionar el proveedor para facturar
        currentClient = {
          id: data.proveedor.id,
          name: data.proveedor.nombre,
          rnc: data.proveedor.rnc_cedula,
          type: 'proveedor',
          limite_credito: 0,
          saldo: 0
        };
        updateClientUI();
        updatePaymentAvailability();
        saveActiveSessionState();
      } else {
        notyf.error(data.message || 'Error al crear proveedor');
      }
    } catch (err) {
      notyf.error('Error de red al crear proveedor');
    }
  }
}

// âœ… B = Cambiar carrito AUTOMÃTICO (sin modal)
//    Shift+B = anterior
function cycleSession(step = 1) {
  if (!Array.isArray(cartSessions) || cartSessions.length <= 1) return;

  saveActiveSessionState();

  const idx = cartSessions.findIndex(s => s.id === activeSessionId);
  const safeIdx = (idx >= 0) ? idx : 0;

  const nextIdx = (safeIdx + step + cartSessions.length) % cartSessions.length;
  const nextId = cartSessions[nextIdx].id;

  loadSessionState(nextId, { skipSave: true });
}

// =========================
// âœ… INDICADOR ARRIBA (Carrito X + Total)
// =========================
function calcCartTotalAmount(cartArr) {
  if (!Array.isArray(cartArr)) return 0;
  return cartArr.reduce((acc, it) => {
    const qty = Number(it.quantity || 0);
    const price = Number(it.price || 0);
    return acc + (price * qty);
  }, 0);
}

function renderSessionIndicator() {
  const bar = document.getElementById('cart-sessions-bar');
  if (!bar) return;

  if (!isRestoringSession) saveActiveSessionState();

  renumberAutoNamedSessions();

  bar.innerHTML = '';

  if (!Array.isArray(cartSessions) || cartSessions.length === 0) return;

  cartSessions.forEach((s) => {
    const total = calcCartTotalAmount(s.cart);
    const count = Array.isArray(s.cart) ? s.cart.reduce((acc, it) => acc + (it.quantity || 0), 0) : 0;
    const isKitchen = !!s.orderId;

    const pill = document.createElement('div');
    pill.className = 'cart-session-pill' + (s.id === activeSessionId ? ' active' : '') + (isKitchen ? ' is-kitchen' : '');
    pill.title = 'Click para cambiar de carrito';

    pill.innerHTML = `
      <div class="cart-session-icon">
        <i class="fas fa-${isKitchen ? 'fire-alt' : 'shopping-cart'}"></i>
      </div>
      <div class="cart-session-meta">
        <div class="cart-session-name">${s.name || 'Carrito'}</div>
        <div class="cart-session-total">RD$ ${formatNumber(total)}</div>
      </div>
      <div class="cart-session-badge">${count}</div>
      <div class="cart-session-actions">
        <button class="cart-session-btn--close" data-action="delete" title="Cerrar carrito">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    pill.addEventListener('click', () => {
      if (s.id !== activeSessionId) {
        loadSessionState(s.id);
      }
    });

    const delBtn = pill.querySelector('[data-action="delete"]');
    if (delBtn) {
      delBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteSessionById(s.id);
      });
    }

    bar.appendChild(pill);
  });
}

async function deleteSessionById(sessionId) {
  if (!sessionId) return;

  const s = cartSessions.find(x => x.id === sessionId);
  const name = s?.name || 'Carrito';

  if (cartSessions.length <= 1) {
    notyf.error('No puedes eliminar el último carrito');
    return;
  }

  const res = await Swal.fire({
    title: 'Eliminar carrito local',
    text: `Â¿Seguro que deseas eliminar "${name}"? El registro en la base de datos de Cocina NO se verá afectado.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!res.isConfirmed) return;

  const wasActive = (sessionId === activeSessionId);

  cartSessions = cartSessions.filter(x => x.id !== sessionId);
  renumberAutoNamedSessions();
  saveSessionsToStorage();

  if (wasActive) {
    activeSessionId = cartSessions[0]?.id || null;
    if (activeSessionId) loadSessionState(activeSessionId, { skipSave: true });
  }

  renderSessionIndicator();
  notyf.error('Carrito local eliminado');
}

async function deleteActiveSession() {
  if (activeSessionId) {
    await deleteSessionById(activeSessionId);
  }
}

// =========================
// âœ… HOTKEYS POS PRO
// =========================
async function renameActiveSession() {
  const s = getActiveSession();
  if (!s) return;

  const result = await Swal.fire({
    title: 'Renombrar carrito',
    input: 'text',
    inputValue: s.name || '',
    inputPlaceholder: 'Ej: Carrito Juan / Mesa 3 / Mostrador...',
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',
    allowOutsideClick: false,
    inputValidator: (v) => {
      const name = String(v || '').trim();
      if (!name) return 'El nombre no puede estar vacío';
      if (name.length > 30) return 'Máximo 30 caracteres';
      return null;
    }
  });

  if (!result.isConfirmed) return;

  s.name = String(result.value || '').trim();
  s.autoName = false;
  s.updatedAt = Date.now();

  saveSessionsToStorage();
  renderSessionIndicator();
}

async function deleteActiveSession() {
  await deleteSessionById(activeSessionId);
}

// =========================
// UTILIDADES UI
// =========================
function openModal(modal) {
  if (!modal) return;
  console.log('[UI] Abriendo modal:', modal.id);
  const inst = bootstrap.Modal.getOrCreateInstance(modal);
  if (inst) inst.show();
}

function closeModal(modal) {
  if (!modal) return;
  console.log('[UI] Cerrando modal:', modal.id);
  const inst = bootstrap.Modal.getInstance(modal);
  if (inst) inst.hide();
}

function formatNumber(num) {
  if (isNaN(num)) return '0.00';
  return Number(num).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseFormattedNumber(str) {
  return parseFloat(String(str || '').replace(/[^\d.]/g, ''));
}

function calculateItbis(price) {
  const base = price / (1 + ITBIS_RATE);
  return price - base;
}

// =========================
// âœ… FECHAS LOCALES (evita bug UTC con toISOString)
// =========================
function pad2(n) { return String(n).padStart(2, '0'); }

// YYYY-MM-DD usando hora local (NO UTC)
function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// suma días a una fecha local y devuelve YYYY-MM-DD
function addDaysLocalISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// =========================
// âœ… REGLAS: CONSUMIDOR FINAL NO PUEDE CREDITO
// =========================
function isConsumidorFinal() {
  if (!currentClient || !currentClient.id) return true;
  const cid = String(currentClient.id).toLowerCase();
  const name = String(currentClient.name || '').toLowerCase();
  return cid === 'cf' || name.includes('consumidor final');
}

function updatePaymentAvailability() {
  const tiles = {
    efectivo: document.querySelector('[data-method="efectivo"]'),
    tarjeta: document.querySelector('[data-method="tarjeta"]'),
    transferencia: document.querySelector('[data-method="transferencia"]'),
    credito: document.querySelector('[data-method="credito"]'),
    dolares: document.querySelector('[data-method="dolares"]')
  };
  const invoiceBtn = document.getElementById('invoice-btn');
  if (!tiles.efectivo) return;

  const isProv = currentClient.type === 'proveedor';
  const isCF = isConsumidorFinal();

  // console.log('[PaymentRules] Entity:', currentClient?.type, 'isCF:', isCF);

  // Visibility Rules
  if (tiles.tarjeta) tiles.tarjeta.style.display = (isProv || !allowedPaymentMethods.includes('tarjeta')) ? 'none' : 'flex';
  if (tiles.dolares) tiles.dolares.style.display = (isProv || !allowedPaymentMethods.includes('dolares')) ? 'none' : 'flex';
  if (tiles.transferencia) tiles.transferencia.style.display = (!allowedPaymentMethods.includes('transferencia')) ? 'none' : 'flex';
  if (tiles.credito) tiles.credito.style.display = 'flex'; // Always visible in grid, but maybe disabled
  if (tiles.efectivo) tiles.efectivo.style.display = 'flex';

  // Disabled Rules (Crédito only for non-CF)
  if (tiles.credito) {
    tiles.credito.classList.toggle('disabled', isCF);
    tiles.credito.setAttribute('aria-disabled', isCF ? 'true' : 'false');
    tiles.credito.style.pointerEvents = isCF ? 'none' : '';
    tiles.credito.style.opacity = isCF ? '0.45' : '';
  }

  // Update button text
  if (invoiceBtn) {
    if (isProv) {
      invoiceBtn.innerHTML = '<i class="fas fa-truck-loading"></i> Registrar Compra';
    } else {
      invoiceBtn.innerHTML = '<i class="fas fa-bolt"></i> Procesar Venta';
    }
  }

  // Auto-switch if current method is now invalid/hidden
  let needsSwitch = false;
  if (isCF && currentPaymentMethod === 'credito') needsSwitch = true;
  if (isProv && (currentPaymentMethod === 'tarjeta' || currentPaymentMethod === 'dolares')) needsSwitch = true;

  if (needsSwitch) {
    selectPaymentMethod('efectivo');
    validateInvoiceButton();
  }
}

// âœ… Ya no ocultamos permanentemente
function hideRestrictedPaymentTiles() {
  updatePaymentAvailability();
}

// âœ… Solo números y 1 punto decimal en monto recibido
function sanitizeMoneyInput(raw) {
  if (raw == null) return '';

  let s = String(raw).replace(/,/g, '.');
  s = s.replace(/[^\d.]/g, '');

  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    const before = s.slice(0, firstDot + 1);
    const after = s.slice(firstDot + 1).replace(/\./g, '');
    s = before + after;
  }

  const parts = s.split('.');
  if (parts.length === 2) {
    parts[1] = parts[1].slice(0, 2);
    s = parts[0] + '.' + parts[1];
  }

  return s;
}

// =========================
// âœ… MEDIDA NUMÃ‰RICA EN FACTURACIÃ“N (editable por categoría)
// =========================
const MEASURE_EDITABLE_CATEGORIES = new Set([
  'materiales',
  'Granel',
  'Alambre'
]);

function normalizeCategoryName(v) {
  return String(v || '').trim().toLowerCase();
}

// âœ… Solo números + 1 punto decimal (máx 2 decimales)
function sanitizeNumericMeasureInput(raw) {
  if (raw == null) return '';
  let s = String(raw).replace(/,/g, '.');
  s = s.replace(/[^\d.]/g, '');

  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    const before = s.slice(0, firstDot + 1);
    const after = s.slice(firstDot + 1).replace(/\./g, '');
    s = before + after;
  }

  const parts = s.split('.');
  if (parts.length === 2) {
    parts[1] = parts[1].slice(0, 2);
    s = parts[0] + '.' + parts[1];
  }

  return s;
}

function isMeasureEditableByCategory(category) {
  const catNorm = normalizeCategoryName(category);
  for (const c of MEASURE_EDITABLE_CATEGORIES) {
    if (normalizeCategoryName(c) === catNorm) return true;
  }
  return false;
}

function recalcItemUnitPrice(item) {
  const base = Number(item.base_price ?? item.price ?? 0) || 0;
  const mv = Number(item.measure_value ?? 1) || 1;

  item.price = Math.round((base * mv) * 100) / 100;

  if (item.base_price == null) item.base_price = base;
}

function updateMeasure(id, value) {
  const item = cart.find(x => String(x.id) === String(id));
  if (!item) return;

  if (!item.measure_editable) return;

  item.measure_value = value;
  recalcItemUnitPrice(item);

  updateCart();
  saveActiveSessionState();
  renderSessionIndicator();
}

// =========================
// DATOS
// =========================
async function searchProducts(term) {
  try {
    const response = await fetch(`/facturacion/api/productos?q=${encodeURIComponent(term || '')}`);
    if (!response.ok) throw new Error('Error en la respuesta del servidor');

    const data = await response.json();
    const rows = Array.isArray(data) ? data : (Array.isArray(data.rows) ? data.rows : []);

    return rows.map(product => {
      const id = String(product.id ?? '');
      const name = String(product.name ?? product.nombre ?? '').trim();
      const price = Number(product.price ?? product.precio ?? 0) || 0;

      const category = String(product.category ?? '').trim();

      let stock = Number(product.stock ?? product.stock_actual ?? 0);
      if (!Number.isFinite(stock) || stock < 0) stock = 0;

      return {
        id,
        name: name || `Producto ${id}`,
        price,
        itbis: Boolean(product.itbis),
        category,
        stock,
        code: product.code ?? product.codigo ?? null,
        barcode: product.barcode ?? product.codigo_barra ?? null,
        usa_dimension: !!product.usa_dimension,
        measure: product.measure || 'und',
        description: product.description ?? product.descripcion ?? ''
      };
    });

  } catch (error) {
    notyf.error('Error al buscar productos');
    console.error('Error en searchProducts:', error);
    return [];
  }
}

async function loadPersonas(tipo, containerId, term = '') {
  try {
    const url = `/facturacion/api/personas?tipo=${encodeURIComponent(tipo)}&q=${encodeURIComponent(term || '')}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error en la respuesta del servidor');
    const data = await response.json();
    renderPersonas(data, containerId);
  } catch (error) {
    notyf.error('Error al cargar registros');
    console.error('Error en loadPersonas:', error);
  }
}

// =========================
// UI CLIENTES
// =========================
function renderPersonas(personas, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  if (Array.isArray(personas) && personas.length > 0) {
    personas.forEach(persona => {
      const item = document.createElement('div');
      item.className = 'col-md-6';
      
      const typeLower = String(persona.type || 'cliente').toLowerCase();
      const isCliente = typeLower === 'cliente';
      const isProveedor = typeLower === 'proveedor';

      // âœ… Usar campos estandarizados del backend
      const pName = persona.name || 'Sin Nombre';
      const pRNC = persona.rnc || '---';
      const pId = persona.id;

      if (pId === currentClient.id) item.classList.add('active');

      const iconType = (String(pId) === 'cf') ? 'user' : (isCliente ? 'user' : 'truck');
      const docLabel = isProveedor ? 'RNC' : 'Cédula';

      const limite = Number(persona.limite_credito ?? 0);
      const saldo = Number(persona.saldo ?? 0);
      const disponible = limite - saldo;

      item.innerHTML = `
        <div class="client-card-elite ${pId === currentClient.id ? 'active' : ''}">
            <div class="d-flex align-items-center gap-3">
                <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style="width:40px; height:40px;">
                    <i class="fas fa-${iconType}"></i>
                </div>
                <div style="flex:1; min-width:0;">
                    <div class="fw-bold text-truncate">${pName}</div>
                    <div class="text-muted small">${docLabel}: ${pRNC}</div>
                </div>
            </div>
            ${isCliente && String(pId) !== 'cf' ? `
            <div class="mt-2 pt-2 border-top d-flex justify-content-between">
                <span class="text-muted small">Disponible:</span>
                <span class="fw-bold text-success small">RD$ ${formatNumber(disponible)}</span>
            </div>
            ` : ''}
        </div>
      `;

      item.addEventListener('click', () => {
        const limiteSel = Number(persona.limite_credito ?? 0);
        const saldoSel = Number(persona.saldo ?? 0);

        currentClient = {
          id: pId,
          name: pName,
          rnc: pRNC,
          type: typeLower,
          limite_credito: limiteSel,
          saldo: saldoSel
        };

        // Sincronizar el modo de búsqueda/UI con el tipo de entidad seleccionada
        toggleEntityMode(typeLower);

        updateClientUI();
        updatePaymentAvailability();
        closeModal(document.getElementById('client-modal'));
        saveActiveSessionState();
      });

      container.appendChild(item);
    });
  } else {
    container.innerHTML = '<div class="text-center p-4">No se encontraron registros</div>';
  }
}

function updateClientUI() {
  const elName = document.getElementById('active-client-name');
  const elAction = document.querySelector('.client-pill-elite span:last-child');
  if (!elName) return;

  const isProv = currentClient.type === 'proveedor';
  elName.textContent = currentClient.name || (isProv ? 'Proveedor Nuevo' : 'Consumidor Final');

  if (elAction) {
    elAction.textContent = isProv ? 'Comprar a' : 'Facturar a';
  }

  // Feedback visual basado en tipo (CLI=Verde, PROV=Azul)
  const parent = elName.closest('.client-pill-elite');
  if (parent) {
    if (isProv) {
      // Azul para Proveedor
      parent.style.background = 'rgba(99, 102, 241, 0.1)';
      parent.style.borderColor = 'var(--pos-primary)';
      elName.style.color = 'var(--pos-primary)';
    } else {
      // Verde para Cliente
      parent.style.background = 'rgba(16, 185, 129, 0.1)';
      parent.style.borderColor = 'var(--pos-success)';
      elName.style.color = 'var(--pos-success)';
    }
  }
}

// =========================
// CARRITO: SELECCIÃ“N + HOTKEYS CANTIDAD
// =========================
function setSelectedCartItem(id) {
  selectedCartItemId = id;

  document.querySelectorAll('#cart-items tr').forEach(tr => {
    tr.classList.toggle('row-selected', String(tr.dataset.id) === String(id));
  });
}

function getActiveCartItemId() {
  return selectedCartItemId || (cart.length ? cart[cart.length - 1].id : null);
}

function getCartItemById(id) {
  return cart.find(x => x.id === id);
}

async function applyQtyBuffer() {
  if (!qtyBuffer) return;
  const bufferValue = qtyBuffer;
  qtyBuffer = '';

  const id = getActiveCartItemId();

  // âœ… Lógica Inteligente: Si el buffer es largo (>5) o el carrito está vacío, tratar como Barcode/SKU
  if (bufferValue.length > 5 || !id) {
    console.log('[SmartCapture] Intentando auto-agregar:', bufferValue);
    const products = await searchProducts(bufferValue);
    if (products && products.length > 0) {
      const exactMatch = products.find(p =>
        (p.barcode && String(p.barcode).trim() === bufferValue) ||
        (p.code && String(p.code).trim() === bufferValue) ||
        (p.codigo_barra && String(p.codigo_barra).trim() === bufferValue) ||
        (p.codigo && String(p.codigo).trim() === bufferValue)
      );

      const matchToUse = exactMatch || (products.length === 1 ? products[0] : null);
      if (matchToUse) {
        addToCart(matchToUse);
        notyf.success(`Agregado: ${matchToUse.name}`);
        return;
      }
    }
  }

  // Si no fue barcode o no hubo match, tratar como actualización de cantidad (si hay ítem)
  if (!id) return;
  const q = parseInt(bufferValue, 10);
  if (!Number.isFinite(q) || q < 1) return;
  updateQuantity(id, q);
}

function bumpQty(delta) {
  const id = getActiveCartItemId();
  if (!id) return;

  const item = getCartItemById(id);
  if (!item) return;

  const next = (item.quantity || 1) + delta;
  updateQuantity(id, next);
}

function bumpQtyById(id, delta) {
  const item = cart.find(x => String(x.id) === String(id));
  if (!item) return;
  const next = (item.quantity || 1) + delta;
  if (next >= 1) updateQuantity(String(id), next);
}

// =========================
// CARRITO
// =========================
function addToCart(product) {
  const existingItem = cart.find(item => item.id === product.id);

  if (existingItem) {
    existingItem.quantity++;
  } else {
    const editable = isMeasureEditableByCategory(product.category || product.categoria || '') || !!product.usa_dimension;
    const base = Number(product.price) || 0;

    cart.push({
      id: product.id,
      name: product.name,
      base_price: base,
      price: base,
      itbis: product.itbis,
      quantity: 1,
      measure_value: 1,
      measure_editable: editable,
      usa_dimension: !!product.usa_dimension,
      measure: product.measure || 'und',
      category: product.category || ''
    });
  }

  updateCart();
}

function updateCart() {
  const cartItems = document.getElementById('cart-items');
  const emptyCart = document.getElementById('empty-cart');
  const cartTable = document.getElementById('cart-table');
  const invoiceBtn = document.getElementById('invoice-btn');

  if (!cartItems || !emptyCart || !invoiceBtn) return;

  if (cart.length === 0) {
    cartItems.innerHTML = '';
    if (cartTable) cartTable.style.display = 'none';
    emptyCart.style.display = 'block';
    invoiceBtn.disabled = true;
    selectedCartItemId = null;
  } else {
    if (cartTable) cartTable.style.display = 'table';
    emptyCart.style.display = 'none';
    invoiceBtn.disabled = false;
    cartItems.innerHTML = '';

    cart.forEach(item => {
      item.category = (item.category || '').toString().trim();
      // Aseguramos que measure exista para el renderizado
      item.measure = item.measure || 'und';

      // Ahora habilitamos medida si la categoría lo permite O si el producto tiene el flag usa_dimension
      item.measure_editable = isMeasureEditableByCategory(item.category) || !!item.usa_dimension;

      if (item.measure_value == null) item.measure_value = 1;
      if (item.base_price == null) item.base_price = Number(item.price || 0) || 0;

      recalcItemUnitPrice(item);

      const lineTotal = item.price * item.quantity;

      const row = document.createElement('tr');
      row.dataset.id = item.id;
      row.className = 'cart-row-new';
      row.classList.toggle('row-selected', String(item.id) === String(selectedCartItemId));

      row.innerHTML = `
        <td>
           <div class="d-flex align-items-center gap-3">
              <div class="bg-light text-primary rounded-3 d-flex align-items-center justify-content-center fw-bold" style="width:40px; height:40px; font-size:0.9rem;">
                ${item.name.charAt(0)}
              </div>
              <div style="display:flex; flex-direction:column;">
                <span class="item-name">${item.name}</span>
                <span class="item-meta">${item.category || 'General'} Â· ${item.measure || 'Unidad'}</span>
              </div>
           </div>
        </td>
        <td>
            <div class="qty-control mx-auto">
                <button class="qty-btn" onclick="bumpQtyById('${item.id}', -1)"><i class="fas fa-minus"></i></button>
                <input type="number" value="${item.quantity}" class="quantity-input border-0 text-center fw-bold" style="width:40px; background:transparent; font-size:0.9rem;" data-id="${item.id}">
                <button class="qty-btn" onclick="bumpQtyById('${item.id}', 1)"><i class="fas fa-plus"></i></button>
            </div>
        </td>
        <td>
            <div class="measure-control mx-auto">
                <input type="text" 
                       value="${item.measure_value ?? 1}" 
                       class="measure-input border-1 text-center fw-bold ${item.measure_editable ? 'border-primary' : 'border-0'}" 
                       style="width:50px; background:transparent; font-size:0.9rem; border-radius:4px;" 
                       data-id="${item.id}"
                       ${!item.measure_editable ? 'disabled' : ''}>
            </div>
        </td>
        <td style="text-align:right;">
            <div class="fw-bold text-muted editable-price" style="font-size:0.9rem; cursor:pointer;" data-id="${item.id}" title="Doble clic para editar precio">RD$ ${formatNumber(item.price)}</div>
        </td>
        <td style="text-align:right;">
            <div class="fw-black text-primary" style="font-size:1rem;">RD$ ${formatNumber(lineTotal)}</div>
        </td>
        <td style="text-align:center;">
          <button class="btn btn-link text-danger delete-item p-0" data-id="${item.id}" title="Eliminar ArtÃ¯culo">
            <i class="fas fa-times-circle fs-5"></i>
          </button>
        </td>
      `;

      row.addEventListener('click', () => setSelectedCartItem(item.id));
      cartItems.appendChild(row);
    });

    document.querySelectorAll('.quantity-input').forEach(input => {
      input.addEventListener('change', (e) => {
        let v = parseInt(e.target.value, 10);
        if (!Number.isFinite(v) || v < 1) v = 1;
        e.target.value = v;
        updateQuantity(e.target.dataset.id, v);
      });
    });

    document.querySelectorAll('.measure-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const item = cart.find(x => String(x.id) === String(id));
        if (!item) return;

        if (!item.measure_editable) {
          e.target.value = String(item.measure_value ?? 1);
          return;
        }

        const cleaned = sanitizeNumericMeasureInput(e.target.value);
        if (e.target.value !== cleaned) {
          const pos = e.target.selectionStart;
          e.target.value = cleaned;
          if (typeof pos === 'number') e.target.setSelectionRange(pos, pos);
        }
      });

      input.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const item = cart.find(x => String(x.id) === String(id));
        if (!item) return;

        if (!item.measure_editable) {
          e.target.value = String(item.measure_value ?? 1);
          return;
        }

        const raw = String(e.target.value || '').trim().replace(',', '.');
        let v = parseFloat(raw);

        if (!Number.isFinite(v)) v = 1;
        if (v < 0) v = 0;

        v = Math.round(v * 100) / 100;

        e.target.value = String(v);
        updateMeasure(id, v);
      });
    });

    // Event listeners para eliminación
    document.querySelectorAll('.delete-item').forEach(button => {
      button.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn && btn.dataset.id) {
          removeItem(btn.dataset.id);
        }
      });
    });

    if (selectedCartItemId && !cart.some(x => String(x.id) === String(selectedCartItemId))) {
      selectedCartItemId = cart.length ? cart[cart.length - 1].id : null;
    }

    // Listener para edición de precio por doble clic (Solo Admin/Gerente)
    document.querySelectorAll('.editable-price').forEach(div => {
      div.addEventListener('dblclick', async (e) => {
        const role = document.getElementById('appBody')?.dataset.rol || '';
        if (role === 'empleado') {
          notyf.error('No tiene permisos para modificar precios');
          return;
        }

        const id = e.currentTarget.dataset.id;
        const item = cart.find(x => String(x.id) === String(id));
        if (!item) return;

        const { value: newPrice } = await Swal.fire({
          title: 'Ajustar Precio',
          html: `<p class="mb-2">Producto: <b>${item.name}</b></p>`,
          input: 'number',
          inputValue: item.price,
          inputLabel: 'Ingrese el nuevo precio unitario',
          inputAttributes: {
            step: '0.01',
            min: '0.01'
          },
          showCancelButton: true,
          confirmButtonText: 'Actualizar',
          cancelButtonText: 'Cancelar',
          confirmButtonColor: '#6366f1',
          inputValidator: (value) => {
            if (!value || parseFloat(value) <= 0) {
              return 'Por favor ingrese un precio válido mayor a 0';
            }
          }
        });

        if (newPrice) {
          updateItemPrice(id, parseFloat(newPrice));
          notyf.success('Precio actualizado');
        }
      });
    });
  }

  updateSummary();
  saveActiveSessionState();
  renderSessionIndicator();
}

function updateQuantity(id, quantity) {
  if (quantity < 1) {
    removeItem(id);
    return;
  }

  const item = cart.find(item => String(item.id) === String(id));
  if (item) {
    item.quantity = quantity;
    updateCart();
  }
}

function updateItemPrice(id, newPrice) {
  const item = cart.find(item => String(item.id) === String(id));
  if (item) {
    item.price = newPrice;
    item.base_price = newPrice;
    updateCart();
  }
}

function removeItem(id) {
  cart = cart.filter(item => String(item.id) !== String(id));

  if (selectedCartItemId === id) {
    selectedCartItemId = cart.length ? cart[cart.length - 1].id : null;
  }

  updateCart();
  notyf.error('Producto eliminado');
}

function updateSummary() {
  const subtotalEl = document.getElementById('subtotal');
  const itbisTotalEl = document.getElementById('itbis-total');
  const totalEl = document.getElementById('total');
  const invoiceBtn = document.getElementById('invoice-btn');

  if (!subtotalEl || !itbisTotalEl || !totalEl || !invoiceBtn) return;

  let subtotal = 0;
  let itbisTotal = 0;

  const applyTaxToggle = document.getElementById('pos-apply-tax');
  const isFiscalToggle = document.getElementById('pos-is-fiscal');

  // Solo aplicamos impuestos si es factura FISCAL y el toggle de impuestos está activo
  const isFiscal = (!isFiscalToggle || isFiscalToggle.checked);
  const shouldApplyTax = (FISCAL_CONFIG.usar_impuestos && isFiscal && (!applyTaxToggle || applyTaxToggle.checked));

  cart.forEach(item => {
    const itemTotal = item.price * item.quantity;
    if (item.itbis && shouldApplyTax) {
      const base = itemTotal / (1 + ITBIS_RATE);
      subtotal += base;
      itbisTotal += itemTotal - base;
    } else {
      subtotal += itemTotal;
    }
  });

  // Ocultar/Mostrar fila de impuestos en UI
  const itbisRow = document.getElementById('itbis-row');
  if (itbisRow) {
    itbisRow.style.display = (shouldApplyTax && itbisTotal > 0) ? 'flex' : 'none';
  }

  const total = subtotal + itbisTotal;

  subtotalEl.textContent = `RD$ ${formatNumber(subtotal)}`;
  itbisTotalEl.textContent = `RD$ ${formatNumber(itbisTotal)}`;
  totalEl.textContent = `RD$ ${formatNumber(total)}`;

  updatePaymentModalNumbers();
  syncConfirmPaymentState();

  validateInvoiceButton();
}

function validateInvoiceButton() {
  const totalEl = document.getElementById('total');
  const invoiceBtn = document.getElementById('invoice-btn');
  if (!totalEl || !invoiceBtn) return;

  const total = parseFormattedNumber(totalEl.textContent) || 0;
  invoiceBtn.disabled = total <= 0;
}

// =========================
// PAGOS
// =========================
function selectPaymentMethod(method) {
  if (method === 'credito' && isConsumidorFinal()) {
    notyf.error('Consumidor Final no puede usar crédito. Seleccione un cliente.');
    method = 'efectivo';
  }

  currentPaymentMethod = method;

  document.querySelectorAll('.payment-tile').forEach(m => {
    m.classList.toggle('active', m.dataset.method === method);
  });

  if (method === 'efectivo') {
    wireAmountReceivedInModal();
  }

  saveActiveSessionState();
}
function openPaymentModal() {
  updatePaymentModalNumbers();
  syncConfirmPaymentState();
  resetConfirmButton();
  openModal(document.getElementById('payment-modal'));
}

function openCardValidationModal() {
  openModal(document.getElementById('card-validation-modal'));
  generateInvoice();
}

function openTransferModal() {
  const totalEl = document.getElementById('total');
  const transferTotal = document.getElementById('transfer-total');
  if (totalEl && transferTotal) transferTotal.textContent = totalEl.textContent;
  openModal(document.getElementById('transfer-modal'));
}

// âœ… ACCIÃ“N PRINCIPAL DE FACTURACIÃ“N (Unificada)
function triggerMainInvoiceAction() {
  const invoiceBtn = document.getElementById('invoice-btn');
  if (!invoiceBtn || invoiceBtn.disabled) return;

  // Sincronizar con el estado VISUAL para máxima fiabilidad
  const activeTile = document.querySelector('.payment-tile.active');
  if (activeTile && activeTile.dataset.method) {
    currentPaymentMethod = activeTile.dataset.method;
  }

  console.log('[InvoiceTrigger] Iniciando acción con método:', currentPaymentMethod);

  switch (currentPaymentMethod) {
    case 'efectivo':
    case 'dolares':
      openPaymentModal();
      break;
    case 'tarjeta':
      openCardValidationModal();
      break;
    case 'transferencia':
      openTransferModal();
      break;
    case 'credito':
      openCreditModal();
      break;
    default:
      notyf.error('Método de pago no reconocido');
  }
}

async function openCreditModal() {
  if (isConsumidorFinal()) {
    notyf.error('Para usar crédito debe seleccionar un cliente (no Consumidor Final).');
    return;
  }

  // Obtener configuración de días de vencimiento
  let vencDays = 30;
  try {
    const configRes = await fetch('/configuracion/datos');
    const configData = await configRes.json();
    const config = configData.params || {};
    vencDays = parseInt(config.dias_vencimiento_factura || 30);
  } catch (e) {
    console.warn("No se pudo cargar la configuración de días de crédito, usando 30 por defecto.");
  }

  const totalEl = document.getElementById('total');
  const creditTotal = document.getElementById('credit-total');
  const dueDate = document.getElementById('due-date');

  if (totalEl && creditTotal) creditTotal.textContent = totalEl.textContent;

  if (dueDate) {
    dueDate.min = addDaysLocalISO(1);
    dueDate.value = addDaysLocalISO(vencDays);
  }

  resetCreditButton();
  openModal(document.getElementById('credit-modal'));
}

// =========================
// PDF
// =========================
function descargarFacturaPDF(factura_id) {
  return new Promise((resolve, reject) => {
    fetch(`/facturacion/api/facturas/${factura_id}/pdf`)
      .then(response => {
        if (response.status === 404) {
          Swal.fire('Error', 'Factura no encontrada', 'error');
          resolve(false); // Resolvemos false para no romper cadena
          return null;
        }
        if (!response.ok) throw new Error('Error al descargar PDF');
        return response.blob();
      })
      .then(blob => {
        if (!blob) return;

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LNSystemS_${factura_id}.pdf`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          a.remove();
          window.URL.revokeObjectURL(url);
          resolve(true); // Confirmamos éxito
        }, 1000); // Damos un segundo de margen seguro
      })
      .catch(error => {
        Swal.fire('Error', 'Error al descargar el PDF: ' + error.message, 'error');
        resolve(false); // Resolvemos aunque falle para permitir flujo
      });
  });
}

// =========================
// FACTURACIÃ“N
// =========================
async function generateInvoice() {
  const subtotalEl = document.getElementById('subtotal');
  const itbisTotalEl = document.getElementById('itbis-total');
  const invoiceBtn = document.getElementById('invoice-btn');
  const dueDateElement = document.getElementById('due-date');

  if (currentPaymentMethod === 'credito' && isConsumidorFinal()) {
    notyf.error('Consumidor Final no puede generar facturas a crédito.');
    resetInvoiceButton();
    resetCreditButton();
    return;
  }

  if (!subtotalEl || !itbisTotalEl || !invoiceBtn) return;

  const subtotal = parseFormattedNumber(subtotalEl.textContent) || 0;
  const itbis = parseFormattedNumber(itbisTotalEl.textContent) || 0;
  const total = subtotal + itbis;

  if (currentPaymentMethod === 'efectivo') {
    const rec = getAmountReceivedNumber();

    if (!rec || rec <= 0) {
      // âœ… Abrir modal de pago si no hay monto
      const payModal = document.getElementById('payment-modal');
      if (payModal) {
        openModal(payModal);
        updatePaymentModalNumbers();
        // Foco al input
        setTimeout(() => {
          const inp = document.getElementById('amount-received');
          if (inp) {
            inp.focus();
            inp.select();
          }
        }, 300);
      }
      return;
    }
    if (rec < total) {
      notyf.error('El monto recibido es insuficiente');
      resetInvoiceButton();
      resetConfirmButton();
      return;
    }
  }

  const cajaAbierta = await verificarEstadoCaja();
  if (!cajaAbierta) {
    notyf.error('No se puede facturar: Caja cerrada');
    closeModal(document.getElementById('payment-modal'));
    closeModal(document.getElementById('card-validation-modal'));
    closeModal(document.getElementById('transfer-modal'));
    closeModal(document.getElementById('credit-modal'));
    return;
  }

  const facturaData = {
    cliente_id: currentClient.id,
    cliente_nombre: currentClient.name,
    total: total,
    itbis_total: itbis,
    metodo_pago: currentPaymentMethod,
    detalles: cart.map(item => ({
      producto_id: item.codigo || item.id,
      cantidad: item.quantity,
      precio: item.price,
      itbis: item.itbis,
      medida_valor: item.measure_value || 1.00
    })),
    es_proveedor: currentClient.type === 'proveedor',
    tipo: currentClient.type === 'proveedor' ? 'compra' : 'venta',
    es_fiscal: document.getElementById('pos-is-fiscal') ? document.getElementById('pos-is-fiscal').checked : true,
    ncf: (currentClient.type === 'proveedor') ? (document.getElementById('ncf-proveedor-input')?.value || '').trim() : null
  };

  const fechaEmision = todayLocalISO();
  // TODO: Leer de configuración global si existe dias_vencimiento_factura
  const VENC_DEFAULT_DAYS = 30;
  const fechaVencDefault = addDaysLocalISO(VENC_DEFAULT_DAYS);

  facturaData.fecha_emision = fechaEmision;
  facturaData.fecha_vencimiento = fechaVencDefault;

  if (currentPaymentMethod === 'efectivo') {
    facturaData.monto_recibido = getAmountReceivedNumber();
  }

  if (currentPaymentMethod === 'credito') {
    if (dueDateElement && dueDateElement.value) {
      facturaData.fecha_vencimiento = dueDateElement.value;
    } else {
      openCreditModal();
      return;
    }
  }

  // =========================
  // âœ… ENFORCEMENT DE CONFIGURACIÃ“N GLOBAL
  // =========================
  try {
    const configRes = await fetch('/configuracion/datos');
    const configData = await configRes.json();
    const config = configData.params || {};

    // 1. Validar Caja Requerida
    if (config.caja_requerida_fact === '1') {
      const isCajaOpen = await verificarEstadoCaja();
      if (!isCajaOpen) {
        notyf.error('No se puede facturar sin un turno de caja abierto.');
        resetInvoiceButton();
        return;
      }
    }

    // 2. Validar Cliente Anónimo
    if (currentClient.id === 'cf' && config.fact_permite_sin_cliente === '0') {
      notyf.error('La facturación a Consumidor Final está desactivada.');
      resetInvoiceButton();
      return;
    }

    // 3. Validar Stock Negativo
    if (config.inv_stock_negativo === '0') {
      for (const item of cart) {
        // El objeto item debería tener el stock cargado desde la búsqueda
        if (item.stock !== undefined && item.quantity > item.stock) {
          notyf.error(`Stock insuficiente para ${item.name}. Disponible: ${item.stock}`);
          resetInvoiceButton();
          return;
        }
      }
    }
  } catch (e) {
    console.warn("No se pudo verificar la configuración global, procediendo con validación de backend:", e);
  }

  invoiceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
  invoiceBtn.disabled = true;

  try {
    const response = await fetch('/facturacion/api/facturas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(facturaData)
    });

    const data = await response.json();

    if (data.success) {
      // âœ… MOD: Marcar pedido de cocina como completado si existe vinculación
      const currentSession = getActiveSession();
      if (currentSession && currentSession.orderId) {
        try {
          await fetch(`/api/pos/orders/${currentSession.orderId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
          });
          console.log(`Pedido #${currentSession.orderId} marcado como completado.`);
        } catch (e) {
          console.error("Error al completar pedido en DB:", e);
        }
      }

      closeModal(document.getElementById('payment-modal'));
      closeModal(document.getElementById('card-validation-modal'));
      closeModal(document.getElementById('transfer-modal'));
      closeModal(document.getElementById('credit-modal'));

      const esCompra = currentClient.type === 'proveedor';
      const esCredito = currentPaymentMethod === 'credito';

      // 1. Obtener preferencia global de impresión para la decisión del frontend
      let printFormat = 'default';
      try {
        const configRes = await fetch('/configuracion/datos');
        const configData = await configRes.json();
        printFormat = configData.params?.global_print_format || 'default';
      } catch (e) {
        console.warn("Error obteniendo config de impresión, usando lógica local:", e);
      }

      // âœ… DECISIÃ“N DE IMPRESIÃ“N DINÃMICA
      let wantPDF = false;

      if (printFormat === 'a4') {
        wantPDF = true;
      } else if (printFormat === 'ticket') {
        wantPDF = false;
      } else {
        // Lógica default
        wantPDF = esCompra || esCredito;
      }

      if (wantPDF) {
        // Formato A4 PDF - Descarga Automática
        notyf.success('Documento Guardado - Descargando PDF...');
        descargarFacturaPDF(data.factura_id).then(() => {
          setTimeout(() => resetSystem(), 1500);
        });
      } else {
        // Formato TICKET (Térmico) - El backend ya lo puso en cola
        notyf.success({
          message: 'Completado - Imprimiendo Ticket...',
          duration: 4000,
          ripple: true,
          background: '#10b981'
        });
        setTimeout(() => resetSystem(), 800);
      }
    } else {
      notyf.error(data.error || 'Error al generar factura');
      resetInvoiceButton();
    }
  } catch (error) {
    notyf.error('Error de conexión con el servidor');
    console.error(error);
    resetInvoiceButton();

    if (currentPaymentMethod === 'credito') {
      resetCreditButton();
    }
  } finally {
    if (currentPaymentMethod === 'tarjeta') {
      closeModal(document.getElementById('card-validation-modal'));
    }

    if (currentPaymentMethod === 'credito') {
      resetCreditButton();
    }
  }
}

async function verificarEstadoCaja() {
  try {
    const response = await fetch('/caja/api/estado-actual');
    if (!response.ok) throw new Error('Error en la respuesta del servidor');

    const data = await response.json();

    if (data && data.success && data.data) {
      return data.data.open;
    } else {
      notyf.error('Respuesta inesperada del servidor');
      return false;
    }
  } catch (error) {
    notyf.error('Error al verificar estado de caja');
    console.error('Error en verificarEstadoCaja:', error);
    return false;
  }
}

// =========================
// RESET
// =========================
function resetSystem() {
  cart = [];
  selectedCartItemId = null;
  qtyBuffer = '';
  clearTimeout(qtyTimer);

  writeAmountReceivedValue('');

  selectPaymentMethod('efectivo');

  currentClient = {
    id: 'cf',
    name: 'Consumidor Final',
    rnc: '000-000000-0',
    type: 'cliente',
    limite_credito: 0,
    saldo: 0
  };

  const activeS = getActiveSession();
  if (activeS && cartSessions.length > 1) {
    // Si hay más de un carrito, eliminamos la sesión actual (limpieza tras facturar)
    const sid = activeS.id;
    cartSessions = cartSessions.filter(x => x.id !== sid);
    activeSessionId = cartSessions[0]?.id || null;
    if (activeSessionId) {
      loadSessionState(activeSessionId, { skipSave: true });
    } else {
      ensureDefaultSession();
    }
  } else {
    // Si solo queda un carrito o no hay activa, solo limpiamos el estado
    resetActiveSessionToCF();
  }

  saveSessionsToStorage();
  updateClientUI();
  updatePaymentAvailability();
  updateCart();
  window.location.reload();
}

function resetInvoiceButton() {
  const invoiceBtn = document.getElementById('invoice-btn');
  if (invoiceBtn) {
    invoiceBtn.innerHTML = '<i class="fas fa-file-invoice"></i> Facturar y Pagar';
    invoiceBtn.disabled = false;
  }
  resetConfirmButton();
}

function resetConfirmButton() {
  const btns = ['confirm-payment', 'confirm-card-invoice', 'confirm-transfer-invoice'];
  btns.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('processing');
      const icon = id === 'confirm-payment' ? 'fa-check-circle' : 'fa-check-circle';
      const text = id === 'confirm-payment' ? 'Finalizar y Emitir Comprobante' :
        id === 'confirm-card-invoice' ? 'Transacción Aprobada' : 'Transferencia Verificada';
      btn.innerHTML = `<i class="fas ${icon} me-2"></i> ${text}`;
    }
  });
}

function resetCreditButton() {
  const confirmCredit = document.getElementById('confirm-credit');
  if (confirmCredit) {
    confirmCredit.disabled = false;
    confirmCredit.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Crédito';
  }
}

// =========================
// INICIALIZACIÃ“N
// =========================
document.addEventListener('DOMContentLoaded', () => {
  // âœ… Ocultar métodos SIEMPRE
  hideRestrictedPaymentTiles();

  // âœ… listeners de entrada de pago
  wireAmountReceivedInModal();

  // âœ… cargar sesiones primero
  loadSessionsFromStorage();
  ensureDefaultSession();

  const dueDate = document.getElementById('due-date');
  if (dueDate) dueDate.min = addDaysLocalISO(1);

  // âœ… restaurar sesión activa (sin guardar antes)
  loadSessionState(activeSessionId, { skipSave: true });

  // âœ… aplicar reglas de crédito según cliente actual
  updatePaymentAvailability();

  // Elementos del DOM
  const productSearch = document.getElementById('product-search');
  const searchBtn = document.getElementById('search-btn');
  const clientInfo = document.getElementById('client-info');
  const closeClientModal = document.getElementById('close-client-modal');
  const tabBtns = document.querySelectorAll('.tab');
  const clientSearchBtn = document.getElementById('client-search-btn');
  const modalProductSearch = document.getElementById('modal-product-search');
  const modalSearchBtn = document.getElementById('modal-search-btn');
  const paymentMethods = document.querySelectorAll('.payment-tile');
  const invoiceBtn = document.getElementById('invoice-btn');
  const confirmPayment = document.getElementById('confirm-payment');
  const cancelPayment = document.getElementById('cancel-payment');
  const cancelPayment2 = document.getElementById('cancel-payment-2');
  const confirmCredit = document.getElementById('confirm-credit');
  const cancelCredit1 = document.getElementById('cancel-credit');
  const cancelCredit2 = document.getElementById('cancel-credit-2');
  const quoteBtn = document.getElementById('quote-btn');

  // âœ… Listener Cotización
  if (quoteBtn) {
    quoteBtn.addEventListener('click', () => {
      generateQuotation();
    });
  }

  // âœ… Listener Reimprimir Ãšltima
  const reprintBtn = document.getElementById('reprint-btn');
  if (reprintBtn) {
    reprintBtn.addEventListener('click', () => {
      reprintLastInvoice();
    });
  }

  // âœ… New Modals Listeners
  const confirmCard = document.getElementById('confirm-card-invoice');
  if (confirmCard) {
    confirmCard.addEventListener('click', function () {
      if (this.disabled) return;
      this.disabled = true;
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
      generateInvoice().catch(() => resetConfirmButton());
    });
  }

  const confirmTransfer = document.getElementById('confirm-transfer-invoice');
  if (confirmTransfer) {
    confirmTransfer.addEventListener('click', function () {
      if (this.disabled) return;
      this.disabled = true;
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
      generateInvoice().catch(() => resetConfirmButton());
    });
  }

  // âœ… Listener Confirmar Crédito
  if (confirmCredit) {
    confirmCredit.addEventListener('click', function () {
      if (this.disabled) return;
      this.disabled = true;
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
      generateInvoice().catch(() => {
        // Si falla, reactivar
        resetCreditButton();
      });
    });
  }

  // âœ… Los listeners de confirmación y factura están más abajo en bloques especializados

  // Render indicador al cargar
  renderSessionIndicator();

  // âœ… Cerrar sugerencias al hacer click fuera del campo de búsqueda
  document.addEventListener('click', (e) => {
    const searchSuggestions = document.getElementById('search-suggestions');
    const productSearchEl = document.getElementById('product-search');

    if (searchSuggestions && !searchSuggestions.classList.contains('hidden')) {
      // Verificar si el click fue fuera del input y fuera del dropdown
      const searchFieldContainer = productSearchEl ? productSearchEl.closest('.search-field') : null;
      const clickedInsideSearch = searchFieldContainer && searchFieldContainer.contains(e.target);
      const clickedInsideSuggestions = searchSuggestions.contains(e.target);

      if (!clickedInsideSearch && !clickedInsideSuggestions) {
        searchSuggestions.classList.add('hidden');
      }
    }
  });

  // =========================
  // Listeners existentes UI
  // =========================
  if (productSearch) {
    productSearch.addEventListener('input', async () => {
      const term = productSearch.value.trim();
      if (term.length > 1) {
        const products = await searchProducts(term);
        loadProductSuggestions(products);
      } else {
        const searchSuggestions = document.getElementById('search-suggestions');
        if (searchSuggestions) searchSuggestions.classList.add('hidden');
      }
    });

    productSearch.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        const term = productSearch.value.trim();

        // Limpiar buffer global si se presiona Enter en un input para evitar colisiones
        qtyBuffer = '';
        clearTimeout(qtyTimer);

        // Si el buscador está vacío y hay algo en el carrito, abrimos el modal de pago
        if (!term) {
          const invoiceBtn = document.getElementById('invoice-btn');
          if (invoiceBtn && !invoiceBtn.disabled) {
            e.preventDefault();
            triggerMainInvoiceAction();
            return;
          }
        }

        // De lo contrario, abrimos el buscador de productos normal
        const products = await searchProducts(term);

        // âœ… Lógica de Código de Barras: Si hay un match exacto, agregar directo
        if (products.length > 0) {
          const exactMatch = products.find(p =>
            (p.barcode && String(p.barcode).trim() === term) ||
            (p.code && String(p.code).trim() === term)
          );

          if (exactMatch) {
            console.log('[Barcode] Match exacto encontrado:', exactMatch.name);
            addToCart(exactMatch);
            productSearch.value = '';

            // Ocultar sugerencias si estuvieran abiertas
            const suggestions = document.getElementById('search-suggestions');
            if (suggestions) suggestions.classList.add('hidden');
            return;
          }
        }

        openModal(document.getElementById('products-modal'));
        loadProductsForModal(products);
      }
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', async () => {
      openModal(document.getElementById('products-modal'));
      const products = await searchProducts('');
      loadProductsForModal(products);
    });
  }

  if (paymentMethods) {
    paymentMethods.forEach(m => {
      m.addEventListener('click', () => {
        const method = m.dataset.method;
        console.log('[PaymentSelection] Intentando seleccionar:', method);
        selectPaymentMethod(method);
        validateInvoiceButton();
      });
    });
  }

  if (invoiceBtn) {
    invoiceBtn.addEventListener('click', () => {
      triggerMainInvoiceAction();
    });
  }

  if (confirmPayment) {
    confirmPayment.addEventListener('click', function () {
      if (this.disabled) return;

      const totalEl = document.getElementById('total');
      const total = totalEl ? (parseFormattedNumber(totalEl.textContent) || 0) : 0;
      const rec = getAmountReceivedNumber();

      if (!rec || rec <= 0) {
        notyf.error('Primero debes ingresar el monto recibido');
        resetConfirmButton();
        return;
      }
      if (rec < total) {
        notyf.error('El monto recibido es insuficiente');
        resetConfirmButton();
        return;
      }

      this.disabled = true;
      this.classList.add('processing');
      this.innerHTML = '<i class="fas fa-spinner"></i> Procesando...';
      generateInvoice().catch(() => {
        resetConfirmButton();
      });
    });
  }

  // âœ… cerrar pago: ambos botones
  const closePay = () => {
    closeModal(document.getElementById('payment-modal'));
    resetConfirmButton();
  };

  if (cancelPayment) cancelPayment.addEventListener('click', closePay);
  if (cancelPayment2) cancelPayment2.addEventListener('click', closePay);

  // âœ… click en cliente => abrir modal clientes
  if (clientInfo) {
    clientInfo.addEventListener('click', () => {
      openModal(document.getElementById('client-modal'));
      loadPersonas('cliente', 'clients-list', '');
    });
  }

  if (closeClientModal) {
    closeClientModal.addEventListener('click', () => closeModal(document.getElementById('client-modal')));
  }

  if (tabBtns) {
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('tab-active'));
        btn.classList.add('tab-active');

        document.querySelectorAll('.tab-content').forEach(p => p.classList.add('hidden'));
        const panel = document.getElementById(`${btn.dataset.tab}-tab`);
        if (panel) panel.classList.remove('hidden');

        if (btn.dataset.tab === 'clients') {
          loadPersonas('cliente', 'clients-list', '');
        } else {
          loadPersonas('proveedor', 'suppliers-list', '');
        }
      });
    });
  }

  if (clientSearchBtn) {
    clientSearchBtn.addEventListener('click', () => {
      const clientSearch = document.getElementById('client-search');
      const activeTab = document.querySelector('.tab-active');
      if (clientSearch && activeTab) {
        const term = clientSearch.value.trim();
        const type = activeTab.dataset.tab === 'clients' ? 'cliente' : 'proveedor';
        loadPersonas(type, `${activeTab.dataset.tab}-list`, term);
      }
    });
  }

  if (modalProductSearch) {
    modalProductSearch.addEventListener('input', async () => {
      const term = modalProductSearch.value.trim();
      const products = await searchProducts(term);
      loadProductsForModal(products);
    });
  }

  if (modalSearchBtn) {
    modalSearchBtn.addEventListener('click', async () => {
      const term = modalProductSearch.value.trim();
      const products = await searchProducts(term);
      loadProductsForModal(products);
    });
  }



  [cancelCredit1, cancelCredit2].forEach(btn => {
    if (btn) btn.addEventListener('click', () => {
      closeModal(document.getElementById('credit-modal'));
      resetCreditButton();
    });
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
        if (modal.id === 'payment-modal') resetConfirmButton();
        if (modal.id === 'credit-modal') resetCreditButton();
      }
    });
  });

  // âœ… Escuchador de Escape redundante eliminado (manejado en el unificado).


  // =========================
  // Funciones auxiliares de UI
  // =========================
  function loadProductSuggestions(products) {
    const searchSuggestions = document.getElementById('search-suggestions');
    if (!searchSuggestions) return;

    searchSuggestions.innerHTML = '';

    if (products.length > 0) {
      products.forEach(product => {
        const suggestion = document.createElement('div');
        suggestion.className = 'suggestion-item';
        suggestion.innerHTML = `
          <div class="suggestion-icon"><i class="fas fa-box"></i></div>
          <div class="suggestion-text">
            <div style="font-weight:800;">${product.name} (${product.id})</div>
            <div style="font-size:.85rem; opacity:.75;">
              Cat: ${product.category || '-'} | Stock: ${Number(product.stock ?? 0)}
            </div>
          </div>
          <div class="suggestion-price">RD$ ${formatNumber(product.price)}</div>
        `;

        suggestion.addEventListener('click', (e) => {
          e.stopPropagation(); // Evitar que se propague el click
          addToCart(product);
          // Limpiar input y cerrar dropdown
          const productSearchInput = document.getElementById('product-search');
          if (productSearchInput) productSearchInput.value = '';
          searchSuggestions.classList.add('hidden');
        });
        searchSuggestions.appendChild(suggestion);
      });
      searchSuggestions.classList.remove('hidden');
    } else {
      searchSuggestions.classList.add('hidden');
    }
  }

  // âœ… GLOBAL SCOPE: loadProductsForModal necesita estar accesible globalmente
  window.loadProductsForModal = function (products) {
    const productsList = document.getElementById('products-list');
    if (!productsList) return;

    productsList.innerHTML = '';

    if (products.length > 0) {
      products.forEach(product => {
        const row = document.createElement('tr');
        row.dataset.id = product.id;

        row.innerHTML = `
          <td>${product.id}</td>
          <td>${product.name}</td>
          <td>${product.category || '-'}</td>
          <td>${Number(product.stock ?? 0)}</td>
          <td>RD$ ${formatNumber(product.price)}</td>
        `;

        productsList.appendChild(row);
      });

      document.querySelectorAll('#products-list tr').forEach(row => {
        row.addEventListener('click', (e) => {
          const id = e.currentTarget.dataset.id;
          const product = products.find(p => p.id === id);
          if (product) {
            addToCart(product);
            closeModal(document.getElementById('products-modal'));
          }
        });
      });
    } else {
      productsList.innerHTML = '<tr><td colspan="5" class="text-center">No se encontraron productos</td></tr>';
    }
  };

  // Alias local para mantener compatibilidad
  function loadProductsForModal(products) {
    window.loadProductsForModal(products);
  }

  // =========================
  // HOTKEYS: Productos modal + carrito + sesiones (+ POS F-keys)
  // =========================
  const productsModal = document.getElementById('products-modal');
  const closeProductsModalBtn = document.getElementById('close-products-modal');

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.isContentEditable;
  }

  function isInsideProductsModal(el) {
    return !!(productsModal && el && productsModal.contains(el));
  }

  function isInsideClientModal(el) {
    const cm = document.getElementById('client-modal');
    return !!(cm && el && cm.contains(el));
  }

  document.addEventListener('keydown', async (e) => {
    const rawKey = e.key || '';
    const key = rawKey.toLowerCase();

    const anyModalOpen = !!document.querySelector('.modal.show');
    const swalOpen = !!document.querySelector('.swal2-container');

    const clientModal = document.getElementById('client-modal');
    const productsOpen = !!(productsModal && productsModal.classList.contains('show'));

    // âœ… si products modal está abierto: solo Delete / Escape cierran (YA NO 'o')
    if (productsOpen && (key === 'delete' || key === 'escape')) {
      e.preventDefault();
      closeProductsModal();
      return;
    }

    // =========================
    // âœ… HOTKEY: O => navegar a /caja (reemplaza el viejo "O cierra productos")
    // Solo cuando NO hay modales, NO swal y NO typing
    // =========================
    if (key === 'o' && !e.ctrlKey && !e.metaKey) {
      if (swalOpen) return;
      if (isTypingTarget(e.target)) return;
      if (anyModalOpen) return;

      e.preventDefault();
      window.location.href = '/caja';
      return;
    }


    // =========================
    // âœ… HOTKEY: R => Abre modal clientes y enfoca el campo RNC/Cédula
    // =========================
    if (key === 'r' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      if (swalOpen) return;
      if (isTypingTarget(e.target) && !isInsideClientModal(e.target)) return;

      // si hay un modal activo y NO es el de clientes, no tocar nada
      const activeModal = document.querySelector('.modal.show');
      if (activeModal && activeModal !== clientModal) return;

      e.preventDefault();

      // Si el modal no está abierto, abrirlo primero
      const clientModalOpen = clientModal && clientModal.classList.contains('show');
      if (!clientModalOpen) {
        openModal(clientModal);
        loadPersonas('cliente', 'clients-list', '');
      }

      // Enfocar el campo de búsqueda RNC/Cédula
      setTimeout(() => {
        const clientSearchInput = document.getElementById('client-search');
        if (clientSearchInput) {
          clientSearchInput.focus();
          clientSearchInput.select();
        }
      }, clientModalOpen ? 0 : 150);
      return;
    }

    // =========================
    // âœ… ENTER: Lógica Unificada (independiente de anyModalOpen)
    // =========================
    if (rawKey === 'Enter') {
      // 1. Caso Buffer de cantidad
      if (qtyBuffer) {
        e.preventDefault();
        clearTimeout(qtyTimer);
        applyQtyBuffer();
        return;
      }

      // 2. Caso Modal de Pago Abierto
      const paymentModal = document.getElementById('payment-modal');
      if (paymentModal && paymentModal.classList.contains('show')) {
        const confirmBtn = document.getElementById('confirm-payment');
        if (confirmBtn && !confirmBtn.disabled) {
          e.preventDefault();
          confirmBtn.click();
          return;
        }
      }

      // 3. Caso Abrir Acción Principal (fuera de modales)
      if (!anyModalOpen && !swalOpen && !isTypingTarget(e.target)) {
        triggerMainInvoiceAction();
        return;
      }
    }

    // Hotkeys que solo aplican cuando NO hay modales, NO swal y NO typing
    if (!anyModalOpen && !swalOpen && !isTypingTarget(e.target)) {
      // âœ… SPACE = eliminar carrito activo (con confirmación)
      if (rawKey === ' ' || e.code === 'Space') {
        e.preventDefault();
        qtyBuffer = ''; // Limpiar buffer al usar atajos
        await deleteActiveSession();
        return;
      }

      if (rawKey === 'F2') { e.preventDefault(); await renameActiveSession(); return; }
      if (rawKey === 'F3') { e.preventDefault(); await toggleClientModal(); return; }
      if (rawKey === 'F4') { e.preventDefault(); createNewSession(); return; }
      if (rawKey === 'F6') { e.preventDefault(); await deleteActiveSession(); return; }

      if (key === 'n' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        createNewSession();
        return;
      }

      if (key === 'b' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        cycleSession(e.shiftKey ? -1 : 1);
        return;
      }

      if (key === 'delete' || key === 'backspace') {
        const id = getActiveCartItemId();
        if (id) {
          e.preventDefault();
          removeItem(id);
        }
        return;
      }

      if (rawKey === '+' || (key === '=' && e.shiftKey)) {
        const id = getActiveCartItemId();
        if (id) {
          e.preventDefault();
          bumpQty(+1);
        }
        return;
      }

      if (rawKey === '-') {
        const id = getActiveCartItemId();
        if (id) {
          e.preventDefault();
          bumpQty(-1);
        }
        return;
      }

      const isDigit = /^[0-9]$/.test(rawKey);
      if (isDigit) {
        e.preventDefault();
        qtyBuffer += rawKey;

        clearTimeout(qtyTimer);
        qtyTimer = setTimeout(() => applyQtyBuffer(), 700);
        return;
      }

      // âœ… P / F10 = TOGGLE modal productos (tu lógica)
      if (key === 'p' || key === 'f10') {
        if (e.ctrlKey || e.metaKey) return;
        if (isTypingTarget(e.target) && !isInsideProductsModal(e.target)) return;

        e.preventDefault();

        const openNow = productsModal && productsModal.classList.contains('show');
        if (openNow) {
          closeProductsModal();
        } else {
          await openProductsModalWithLoad('');
        }
        return;
      }

      // âœ… S = TOGGLE sidebar (solicitud usuario)
      if (key === 's' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (anyModalOpen || swalOpen || isTypingTarget(e.target)) return;
        e.preventDefault();
        if (typeof window.toggleSidebar === 'function') {
          window.toggleSidebar();
        }
        return;
      }
    }
  });

  // âœ… Cargar configuración fiscal inicial
  loadFiscalConfig();
});

async function loadFiscalConfig() {
  try {
    const res = await fetch('/configuracion/datos');
    const data = await res.json();
    const p = data.params || {};

    FISCAL_CONFIG.usar_impuestos = p.inv_usar_impuestos === '1';
    FISCAL_CONFIG.modo_aplicacion = p.fact_modo_impuestos || 'preguntar';
    FISCAL_CONFIG.tasa_itbis = parseInt(p.fact_itbis_tasa || 18);
    ITBIS_RATE = FISCAL_CONFIG.tasa_itbis / 100;

    // Métodos configurados
    allowedPaymentMethods = (p.fact_metodos_adicionales || '').split(',').filter(x => x);

    const license = data.license || { plan: 'core' };
    const isPremium = license.plan === 'premium' || license.plan === 'enterprise';

    // REGLA DEL USUARIO: 
    // "si no es premium permitir facturar con impuestos" (Tax Core check)
    // "si no [es premium] permitir facturacion normal" (Simple check)

    const canUseTax = isPremium || p.fact_allow_tax_core === '1';
    const canUseSimple = isPremium || p.fact_allow_simple === '1';

    // Actualizar labels en UI
    const rateLabel = document.getElementById('itbis-rate-label');
    if (rateLabel) rateLabel.textContent = FISCAL_CONFIG.tasa_itbis;

    const toggleTaxContainer = document.getElementById('tax-toggle-container');
    const toggleFiscalContainer = document.getElementById('fiscal-mode-container');

    const taxToggle = document.getElementById('pos-apply-tax');
    const fiscalToggle = document.getElementById('pos-is-fiscal');

    // 1. Visibilidad del selector Fiscal (NCF)
    if (toggleFiscalContainer) {
      toggleFiscalContainer.style.display = canUseSimple ? 'flex' : 'none';
    }

    // 2. Comportamiento de Impuestos
    if (!FISCAL_CONFIG.usar_impuestos || !canUseTax) {
      if (toggleTaxContainer) toggleTaxContainer.style.display = 'none';
      if (taxToggle) taxToggle.checked = false;
    } else {
      if (FISCAL_CONFIG.modo_aplicacion === 'preguntar') {
        if (toggleTaxContainer) toggleTaxContainer.style.display = 'flex';
      } else if (FISCAL_CONFIG.modo_aplicacion === 'siempre') {
        if (toggleTaxContainer) toggleTaxContainer.style.display = 'none';
        if (taxToggle) taxToggle.checked = true;
      } else {
        if (toggleTaxContainer) toggleTaxContainer.style.display = 'none';
        if (taxToggle) taxToggle.checked = false;
      }
    }

    updateSummary();
  } catch (e) {
    console.error('Error cargando config fiscal:', e);
  }
}

function toggleFiscalMode() {
  const fiscalToggle = document.getElementById('pos-is-fiscal');
  const taxToggleContainer = document.getElementById('tax-toggle-container');

  if (fiscalToggle && !fiscalToggle.checked) {
    // Si desactivan NCF, ocultamos toggle de impuestos (normalmente venta simple no lleva tax desglosado)
    if (taxToggleContainer) taxToggleContainer.style.display = 'none';
  } else {
    // Si activan NCF, restauramos visibilidad según config
    loadFiscalConfig();
  }

  updateSummary();
}


async function generateQuotation() {
  if (cart.length === 0) {
    notyf.error('El carrito esta vacío');
    return;
  }

  const quoteBtn = document.getElementById('quote-btn');
  if (quoteBtn) {
    quoteBtn.disabled = true;
    quoteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
  }

  const subtotalEl = document.getElementById('subtotal');
  const itbisTotalEl = document.getElementById('itbis-total');
  const totalEl = document.getElementById('total');

  const subtotal = parseFormattedNumber(subtotalEl.textContent) || 0;
  const itbis = parseFormattedNumber(itbisTotalEl.textContent) || 0;
  const total = parseFormattedNumber(totalEl.textContent) || 0;

  const payload = {
    cart: cart.map(it => ({
      id: it.id,
      name: it.name,
      price: it.price,
      quantity: it.quantity,
      itbis: it.itbis
    })),
    client: currentClient,
    totals: { subtotal, itbis, total },
    metodo_pago: currentPaymentMethod // âœ… Incluir método seleccionado
  };

  try {
    const res = await fetch('/api/cotizacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LNSystemS_Cotizacion_${currentClient.name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      notyf.success('Cotización generada correctamente');
    } else {
      const err = await res.json();
      notyf.error('Error al generar cotización: ' + (err.error || 'Desconocido'));
    }
  } catch (e) {
    notyf.error('Error de red al generar cotización');
    console.error(e);
  } finally {
    if (quoteBtn) {
      quoteBtn.disabled = false;
      quoteBtn.innerHTML = '<i class="fas fa-file-pdf"></i> Generar Cotización';
    }
  }
}
function openCardValidationModal() {
  const modal = document.getElementById('card-validation-modal');
  if (modal) openModal(modal);
}

function openTransferModal() {
  const modal = document.getElementById('transfer-modal');
  if (modal) openModal(modal);
}

async function reprintLastInvoice() {
  const btn = document.getElementById('reprint-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
  }

  try {
    // 1. Obtener ID de la última factura
    const resId = await fetch('/facturacion/api/facturas/ultima');
    const dataId = await resId.json();

    if (!dataId.success || !dataId.factura_id) {
      notyf.error(dataId.mensaje || 'No se encontró ninguna factura para reimprimir');
      return;
    }

    const facturaId = dataId.factura_id;

    // 2. Determinar formato de impresión (Consultando config global)
    const resConfig = await fetch('/configuracion/datos');
    const dataConfig = await resConfig.json();
    const printFormat = dataConfig.params?.global_print_format || 'a4';

    if (printFormat === 'ticket') {
      // Flujo TICKET TERMICO
      notyf.success('Generando ticket térmico...');
      const resTicket = await fetch(`/facturacion/api/facturas/${facturaId}/ticket`);
      const dataTicket = await resTicket.json();

      if (dataTicket.success && dataTicket.ticket_data) {
        // Enviar al Agente de Impresión Local
        try {
          const respAgent = await fetch(dataTicket.agent_url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Token': dataTicket.agent_token || ''
            },
            body: JSON.stringify({
              content: dataTicket.ticket_data,
              printer: 'default'
            })
          });

          if (respAgent.ok) {
            notyf.success('Ticket enviado a la impresora local');
          } else {
            throw new Error('El agente de impresión respondió con error: ' + respAgent.status);
          }
        } catch (errAgent) {
          console.error("Error Agente:", errAgent);
          notyf.error('Error: Asegúrese de que el Agente de Impresión esté abierto.');
        }
      } else {
        notyf.error('No se pudo generar el contenido del ticket.');
      }
    } else {
      // Flujo PDF (A4 por defecto)
      notyf.success('Generando PDF para reimpresión...');
      await descargarFacturaPDF(facturaId);
    }

  } catch (e) {
    notyf.error('Error de red al intentar reimprimir');
    console.error(e);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-print"></i> Reimprimir Ãšltima';
    }
  }
}

