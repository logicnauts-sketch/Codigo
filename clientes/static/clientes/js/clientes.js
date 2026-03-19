/* =========================================================
   LN Systems — clientes.js (Refactorizado)
   Control profesional de clientes
   ========================================================= */

'use strict';

// =========================================================
// Estado Global
// =========================================================
const state = {
  clients: [],
  filteredClients: [],
  currentClient: null,
  filters: {
    search: '',
    status: '',
    debt: ''
  }
};

// =========================================================
// Elementos del DOM
// =========================================================
const DOM = {
  // Botones principales
  newClientBtn: document.getElementById('newClientBtn'),
  exportPDFBtn: document.getElementById('exportPDFBtn'),
  exportExcelBtn: document.getElementById('exportExcelBtn'),

  // KPIs
  kpiTotalClients: document.getElementById('kpiTotalClients'),
  kpiActiveClients: document.getElementById('kpiActiveClients'),
  kpiInactiveClients: document.getElementById('kpiInactiveClients'),
  kpiClientsWithDebt: document.getElementById('kpiClientsWithDebt'),
  kpiTotalDebt: document.getElementById('kpiTotalDebt'),

  // Filtros
  searchInput: document.getElementById('searchInput'),
  filterStatus: document.getElementById('filterStatus'),
  filterDebt: document.getElementById('filterDebt'),

  // Tabla
  clientsTableBody: document.getElementById('clientsTableBody'),

  // Modales
  clientProfileModal: document.getElementById('clientProfileModal'),
  closeProfileModal: document.getElementById('closeProfileModal'),
  clientFormModal: document.getElementById('clientFormModal'),
  closeFormModal: document.getElementById('closeFormModal'),

  // Formulario
  clientForm: document.getElementById('clientForm'),
  formModalTitle: document.getElementById('formModalTitle'),
  clientId: document.getElementById('clientId'),
  clientName: document.getElementById('clientName'),
  clientDocument: document.getElementById('clientDocument'),
  clientPhone: document.getElementById('clientPhone'),
  clientAddress: document.getElementById('clientAddress'),
  cancelFormBtn: document.getElementById('cancelFormBtn'),
  saveClientBtn: document.getElementById('saveClientBtn'),
  documentGroup: document.getElementById('documentGroup'),
  docReqStar: document.getElementById('docReqStar'),

  // Nuevos elementos de validación RNC
  clientType: document.getElementById('clientType'),
  clientCreditLimit: document.getElementById('clientCreditLimit'),
  creditLimitGroup: document.getElementById('creditLimitGroup'),
  docSpinner: document.getElementById('docSpinner'),
  docValid: document.getElementById('docValid'),
  docInvalid: document.getElementById('docInvalid'),
  docWarning: document.getElementById('docWarning'),
  documentError: document.getElementById('documentError'),
  documentHint: document.getElementById('documentHint'),
  clientFoundAlert: document.getElementById('clientFoundAlert'),
  clientFoundMessage: document.getElementById('clientFoundMessage'),
  btnSelectExisting: document.getElementById('btnSelectExisting'),

  // Perfil
  profileName: document.getElementById('profileName'),
  profileDocument: document.getElementById('profileDocument'),
  profileStatus: document.getElementById('profileStatus'),
  profileAddress: document.getElementById('profileAddress'),
  profilePhone: document.getElementById('profilePhone'),
  profileEmail: document.getElementById('profileEmail'),
  profileRegistered: document.getElementById('profileRegistered'),
  profileTotalBilled: document.getElementById('profileTotalBilled'),
  profileTotalPaid: document.getElementById('profileTotalPaid'),
  profileDebt: document.getElementById('profileDebt'),
  profileLastInvoice: document.getElementById('profileLastInvoice'),
  profileLastPayment: document.getElementById('profileLastPayment'),
  profileInvoiceCount: document.getElementById('profileInvoiceCount'),
  profilePurchases: document.getElementById('profilePurchases'),
  profileAverage: document.getElementById('profileAverage'),
  profileInvoicesBody: document.getElementById('profileInvoicesBody'),
  btnCreateInvoice: document.getElementById('btnCreateInvoice'),
  btnViewHistory: document.getElementById('btnViewHistory'),
  btnRegisterPayment: document.getElementById('btnRegisterPayment'),
  // Filtros de Historial en Perfil
  profileDateStart: document.getElementById('profileDateStart'),
  profileDateEnd: document.getElementById('profileDateEnd'),
  btnFilterProfileInvoices: document.getElementById('btnFilterProfileInvoices'),

  // Modal Pago (Nuevo)
  paymentModal: document.getElementById('paymentModal'),
  closePaymentModal: document.getElementById('closePaymentModal'),
  paymentForm: document.getElementById('paymentForm'),
  payClientName: document.getElementById('payClientName'),
  payClientDebt: document.getElementById('payClientDebt'),
  payInvoiceId: document.getElementById('payInvoiceId'),
  payAmount: document.getElementById('payAmount'),
  payMethod: document.getElementById('payMethod'),
  payReference: document.getElementById('payReference'),
  cancelPaymentBtn: document.getElementById('cancelPaymentBtn'),
  savePaymentBtn: document.getElementById('savePaymentBtn'),
  // Abonos
  payTypeGroup: document.getElementById('payTypeGroup'),
  payTypeFull: document.getElementById('payTypeFull'),
  payTypeAbono: document.getElementById('payTypeAbono'),
  payTypeHint: document.getElementById('payTypeHint')
};

// =========================================================
// Sistema de Notificaciones
// =========================================================
const notyf = new Notyf({
  duration: 4000,
  position: { x: 'right', y: 'top' },
  types: [
    {
      type: 'success',
      background: '#10b981',
      icon: { className: 'fas fa-check-circle', tagName: 'i' }
    },
    {
      type: 'error',
      background: '#ef4444',
      icon: { className: 'fas fa-exclamation-circle', tagName: 'i' }
    },
    {
      type: 'warning',
      background: '#f59e0b',
      icon: { className: 'fas fa-exclamation-triangle', tagName: 'i' }
    },
    {
      type: 'info',
      background: '#3b82f6',
      icon: { className: 'fas fa-info-circle', tagName: 'i' }
    }
  ]
});

// =========================================================
// Utilidades
// =========================================================
const utils = {
  formatCurrency(amount) {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP'
    }).format(amount || 0);
  },

  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  formatDateShort(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-DO');
  },

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  formatDocument(value) {
    if (!value) return '';
    const clean = value.replace(/\D/g, '');
    
    // Cédula: ### ####### # (11)
    if (clean.length > 9) {
      const part1 = clean.substring(0, 3);
      const part2 = clean.substring(3, 10);
      const part3 = clean.substring(10, 11);
      
      let res = part1;
      if (part2) res += ' ' + part2;
      if (part3) res += ' ' + part3;
      return res;
    } 
    
    // RNC: ### ### ### (9)
    const part1 = clean.substring(0, 3);
    const part2 = clean.substring(3, 6);
    const part3 = clean.substring(6, 9);
    
    let res = part1;
    if (part2) res += ' ' + part2;
    if (part3) res += ' ' + part3;
    return res;
  }
};

// =========================================================
// API Calls
// =========================================================
const API = {
  async getClients() {
    try {
      // Obtener todos los clientes (sin paginación en frontend por ahora)
      const response = await fetch('/clientes/api/clientes?per_page=1000');
      const data = await response.json();

      if (data.success && data.clients) {
        // Mapear campos del backend a los que espera el frontend
        return {
          success: true,
          clients: data.clients.map(c => ({
            id: c.id,
            nombre: c.nombre,
            documento: c.cedula || c.documento,
            telefono: c.telefono,
            email: c.correo || c.email,
            direccion: c.direccion,
            estado: c.estado || 'activo',
            deuda_actual: c.saldo_actual || c.deuda_actual || 0,
            ultima_factura: c.last_invoice_date || c.ultima_factura || null,
            ultima_factura_id: c.last_invoice_id || null,
            fecha_registro: c.fechaRegistro || c.fecha_registro || null,
            total_facturado: c.total_facturado || 0,
            total_pagado: c.total_pagado || 0,
            facturas_count: c.facturas_count || 0
          }))
        };
      }

      return data;
    } catch (error) {
      console.error('Error fetching clients:', error);
      throw error;
    }
  },

  async getClient(id) {
    try {
      const response = await fetch(`/clientes/api/clientes/${id}`);
      const data = await response.json();

      if (data.success && data.client) {
        // Mapear campos
        const c = data.client;
        return {
          success: true,
          client: {
            id: c.id,
            nombre: c.nombre,
            documento: c.cedula || c.documento,
            telefono: c.telefono,
            email: c.correo || c.email,
            direccion: c.direccion,
            estado: c.estado || 'activo',
            deuda_actual: c.saldo_actual || c.deuda_actual || 0,
            fecha_registro: c.fechaRegistro || c.fecha_registro || null,
            total_facturado: c.total_facturado || 0,
            total_pagado: c.total_pagado || 0,
            ultima_factura: c.ultima_factura || null,
            ultimo_pago: c.ultimo_pago || null,
            facturas_count: c.facturas_count || 0
          }
        };
      }

      return data;
    } catch (error) {
      console.error('Error fetching client:', error);
      throw error;
    }
  },

  async createClient(clientData) {
    try {
      const response = await fetch('/clientes/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  },

  async updateClient(id, clientData) {
    try {
      const response = await fetch(`/clientes/api/clientes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating client:', error);
      throw error;
    }
  },

  async toggleClientStatus(id) {
    try {
      const response = await fetch(`/clientes/api/clientes/${id}/toggle-status`, {
        method: 'PATCH'
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error toggling client status:', error);
      throw error;
    }
  }
};

// =========================================================
// Renderizado
// =========================================================
const Render = {
  updateKPIs() {
    const total = state.clients.length;
    const active = state.clients.filter(c => c.estado === 'activo').length;
    const inactive = total - active;
    const withDebt = state.clients.filter(c => parseFloat(c.deuda_actual || 0) > 0).length;
    const totalDebt = state.clients.reduce((sum, c) => sum + parseFloat(c.deuda_actual || 0), 0);

    if (DOM.kpiTotalClients) DOM.kpiTotalClients.textContent = total;
    if (DOM.kpiActiveClients) DOM.kpiActiveClients.textContent = active;
    if (DOM.kpiInactiveClients) DOM.kpiInactiveClients.textContent = inactive;
    if (DOM.kpiClientsWithDebt) DOM.kpiClientsWithDebt.textContent = withDebt;
    if (DOM.kpiTotalDebt) DOM.kpiTotalDebt.textContent = utils.formatCurrency(totalDebt);
  },

  renderClientsTable() {
    if (!DOM.clientsTableBody) return;

    if (state.filteredClients.length === 0) {
      DOM.clientsTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <i class="fas fa-users"></i>
            <p>No se encontraron clientes</p>
          </td>
        </tr>
      `;
      return;
    }

    DOM.clientsTableBody.innerHTML = state.filteredClients.map(client => {
      const debtAmount = parseFloat(client.deuda_actual || 0);
      const hasDebt = debtAmount > 0;
      const statusBadge = client.estado === 'activo'
        ? '<span class="badge badge-active">Activo</span>'
        : '<span class="badge badge-inactive">Inactivo</span>';

      return `
        <tr>
          <td>
            <div class="client-name">${utils.sanitize(client.nombre)}</div>
          </td>
          <td>
            <div class="client-document">${utils.sanitize(client.documento)}</div>
          </td>
          <td>
            <div class="client-contact">
              <span class="client-phone">${utils.sanitize(client.telefono || '-')}</span>
              <span class="client-email">${utils.sanitize(client.email || '-')}</span>
            </div>
          </td>
          <td>${statusBadge}</td>
          <td>
            <div class="debt-amount ${hasDebt ? 'has-debt' : 'no-debt'}">
              ${utils.formatCurrency(debtAmount)}
            </div>
          </td>
          <td>
            <div class="last-invoice">
              ${client.ultima_factura_id ?
          `<a href="/facturacion/api/facturas/${client.ultima_factura_id}/pdf" target="_blank" class="text-primary fw-bold" style="text-decoration:none;" title="Descargar Factura">
                   <i class="fas fa-file-pdf me-1"></i> LNSystemS_${client.ultima_factura_id}
                 </a>`
          : '-'}
            </div>
          </td>
          <td>
            <div class="client-actions">
              <button class="btn-icon view" onclick="clientActions.viewProfile(${client.id})" title="Ver Perfil">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn-icon edit" onclick="clientActions.editClient(${client.id})" title="Editar">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-icon toggle-status" onclick="clientActions.toggleStatus(${client.id})" title="${client.estado === 'activo' ? 'Inactivar' : 'Activar'}">
                <i class="fas fa-${client.estado === 'activo' ? 'ban' : 'check'}"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
};

// =========================================================
// Filtrado
// =========================================================
const Filters = {
  apply() {
    state.filteredClients = state.clients.filter(client => {
      // Búsqueda
      if (state.filters.search) {
        const search = state.filters.search.toLowerCase();
        const matchName = (client.nombre || '').toLowerCase().includes(search);
        const matchDocument = (client.documento || '').toLowerCase().includes(search);
        if (!matchName && !matchDocument) return false;
      }

      // Estado
      if (state.filters.status) {
        if (client.estado !== state.filters.status) return false;
      }

      // Deuda
      if (state.filters.debt) {
        const hasDebt = parseFloat(client.deuda_actual || 0) > 0;
        if (state.filters.debt === 'con-deuda' && !hasDebt) return false;
        if (state.filters.debt === 'sin-deuda' && hasDebt) return false;
      }

      return true;
    });

    if (typeof Render.renderClientsTable === 'function') {
      Render.renderClientsTable();
    }
  },

  setupListeners() {
    if (DOM.searchInput) {
      DOM.searchInput.addEventListener('input', utils.debounce(() => {
        state.filters.search = DOM.searchInput.value;
        Filters.apply();
      }, 300));
    }

    if (DOM.filterStatus) {
      DOM.filterStatus.addEventListener('change', () => {
        state.filters.status = DOM.filterStatus.value;
        Filters.apply();
      });
    }

    if (DOM.filterDebt) {
      DOM.filterDebt.addEventListener('change', () => {
        state.filters.debt = DOM.filterDebt.value;
        Filters.apply();
      });
    }
  }
};

// =========================================================
// Acciones de Cliente
// =========================================================
const clientActions = {
  async viewProfile(clientId) {
    try {
      const response = await API.getClient(clientId);
      if (response.success) {
        state.currentClient = response.client;
        this.renderProfile(response.client);
        if (DOM.clientProfileModal) {
          DOM.clientProfileModal.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
      } else {
        notyf.error(response.message || 'Error al cargar el perfil');
      }
    } catch (error) {
      console.error('Error:', error);
      notyf.error('Error de conexión con el servidor');
    }
  },

  async renderProfile(client) {
    // Header
    if (DOM.profileName) DOM.profileName.textContent = client.nombre;
    if (DOM.profileDocument) DOM.profileDocument.textContent = client.documento;
    if (DOM.profileStatus) {
      DOM.profileStatus.className = `badge ${client.estado === 'activo' ? 'badge-active' : 'badge-inactive'}`;
      DOM.profileStatus.textContent = client.estado === 'activo' ? 'Activo' : 'Inactivo';
    }

    // Identificación
    if (DOM.profileAddress) DOM.profileAddress.textContent = client.direccion || '-';
    if (DOM.profilePhone) DOM.profilePhone.textContent = client.telefono || '-';
    if (DOM.profileEmail) DOM.profileEmail.textContent = client.email || '-';
    if (DOM.profileRegistered) DOM.profileRegistered.textContent = utils.formatDate(client.fecha_registro);

    // Estado Financiero
    if (DOM.profileTotalBilled) DOM.profileTotalBilled.textContent = utils.formatCurrency(client.total_facturado);
    if (DOM.profileTotalPaid) DOM.profileTotalPaid.textContent = utils.formatCurrency(client.total_pagado);
    if (DOM.profileDebt) DOM.profileDebt.textContent = utils.formatCurrency(client.deuda_actual);
    if (DOM.profileLastInvoice) {
      if (client.ultima_factura) {
        DOM.profileLastInvoice.textContent = utils.formatDateShort(client.ultima_factura);
      } else {
        DOM.profileLastInvoice.textContent = '-';
      }
    }
    if (DOM.profileLastPayment) DOM.profileLastPayment.textContent = client.ultimo_pago ? utils.formatDateShort(client.ultimo_pago) : '-';

    // Actividad
    const invoiceCount = client.facturas_count || 0;
    const totalPurchases = parseFloat(client.total_facturado || 0);
    const average = invoiceCount > 0 ? totalPurchases / invoiceCount : 0;

    if (DOM.profileInvoiceCount) DOM.profileInvoiceCount.textContent = invoiceCount;
    if (DOM.profilePurchases) DOM.profilePurchases.textContent = utils.formatCurrency(totalPurchases);
    if (DOM.profileAverage) DOM.profileAverage.textContent = utils.formatCurrency(average);

    // Cargar facturas recientes REALES desde la API
    await this.loadClientInvoices(client.id);

    // Configurar botones
    if (DOM.btnCreateInvoice) {
      DOM.btnCreateInvoice.onclick = () => {
        window.location.href = `/facturacion?cliente=${client.id}`;
      };
    }

    // Configurar botón de registrar pago
    if (DOM.btnRegisterPayment) {
      DOM.btnRegisterPayment.onclick = () => {
        this.openPaymentModal(client);
      };
    }

    // Configurar botón de ver historial
    if (DOM.btnViewHistory) {
      DOM.btnViewHistory.onclick = () => {
        this.viewPaymentHistory(client.id, client.nombre);
      };
    }
  },

  async loadClientInvoices(clientId, filters = {}) {
    if (!DOM.profileInvoicesBody) return;

    // Mostrar loading
    DOM.profileInvoicesBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Cargando facturas...</p>
        </td>
      </tr>
    `;

    try {
      let url = `/clientes/api/clientes/${clientId}/facturas`;
      const params = new URLSearchParams();
      if (filters.start) params.append('start_date', filters.start);
      if (filters.end) params.append('end_date', filters.end);
      params.append('_t', new Date().getTime());
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.facturas && data.facturas.length > 0) {
        const invoices = data.facturas;

        DOM.profileInvoicesBody.innerHTML = invoices.map(invoice => {
          const statusClass = invoice.estado_ui === 'pagada' ? 'badge-active' : 'badge-warning';
          const statusText = invoice.estado_ui === 'pagada' ? 'Pagada' : 'Pendiente';

          // Botón de abonos: solo si tiene crédito asociado
          const abonosBtn = invoice.credito_id && invoice.credito_id > 0
            ? `<button class="btn-sm btn-outline-primary view-abonos" 
                       data-factura-id="${invoice.factura_id}" 
                       data-client-id="${clientId}"
                       data-ncf="${utils.sanitize(invoice.ncf || 'S/N')}"
                       title="Ver Abonos">
                <i class="fas fa-coins"></i>
              </button>`
            : `<span style="color: var(--text-muted); font-size: 0.75rem;">\u2014</span>`;

          return `
            <tr>
              <td style="display: table-cell;">
                <span style="font-family: 'SF Mono', Monaco, monospace; font-size: 0.825rem; color: var(--slate-700); font-weight: 500; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">
                  ${invoice.ncf && invoice.ncf.trim() ? utils.sanitize(invoice.ncf) : `<span style="opacity: 0.6; font-size: 0.75rem;">ID: ${invoice.factura_id}</span>`}
                </span>
              </td>
              <td>${invoice.fecha || '-'}</td>
              <td class="text-right" style="font-weight: 600;">
                ${utils.formatCurrency(invoice.total || 0)}
              </td>
              <td>
                <span class="badge ${statusClass}">${statusText}</span>
              </td>
              <td class="text-center">
                ${abonosBtn}
              </td>
              <td class="text-center">
                <button class="btn-sm btn-outline-primary download-invoice" 
                        data-id="${invoice.factura_id}" 
                        title="Descargar PDF">
                  <i class="fas fa-download"></i>
                </button>
              </td>
            </tr>
          `;
        }).join('');

        // Configurar clicks de descarga
        document.querySelectorAll('.download-invoice').forEach(btn => {
          btn.onclick = (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            window.open(`/facturacion/api/facturas/${id}/pdf`, '_blank');
          };
        });

        // Configurar clicks de ver abonos
        document.querySelectorAll('.view-abonos').forEach(btn => {
          btn.onclick = (e) => {
            const facturaId = e.currentTarget.getAttribute('data-factura-id');
            const cId = e.currentTarget.getAttribute('data-client-id');
            const ncf = e.currentTarget.getAttribute('data-ncf');
            clientActions.viewAbonos(cId, facturaId, ncf);
          };
        });
      } else {
        DOM.profileInvoicesBody.innerHTML = `
          <tr>
            <td colspan="6" class="empty-state">
              <i class="fas fa-file-invoice" style="font-size: 1.5rem; opacity: 0.5; margin-bottom: 0.5rem; display: block;"></i>
              <p>${filters.start || filters.end ? 'No se encontraron facturas en este rango' : 'No hay facturas registradas'}</p>
            </td>
          </tr>
        `;
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      if (DOM.profileInvoicesBody) {
        DOM.profileInvoicesBody.innerHTML = `
          <tr>
            <td colspan="6" class="empty-state">
              <i class="fas fa-exclamation-circle" style="color: var(--danger); font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
              <p>Error al cargar el historial de facturas</p>
            </td>
          </tr>
        `;
      }
    }
  },

  // =========================================================
  // Ver Abonos de una Factura
  // =========================================================
  async viewAbonos(clientId, facturaId, ncf) {
    try {
      Swal.fire({
        title: 'Cargando abonos...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const timestamp = new Date().getTime();
      const response = await fetch(`/clientes/api/clientes/${clientId}/facturas/${facturaId}/abonos?_t=${timestamp}`);
      const data = await response.json();

      if (!data.success) {
        Swal.fire('Error', data.message || 'No se pudieron cargar los abonos', 'error');
        return;
      }

      const resumen = data.resumen;
      const abonos = data.abonos;

      // Construir tabla de abonos
      let abonosTableHtml = '';
      if (abonos.length === 0) {
        abonosTableHtml = `
          <div style="text-align: center; padding: 24px; color: #94a3b8;">
            <i class="fas fa-coins" style="font-size: 2rem; margin-bottom: 8px; display: block;"></i>
            <p>No se han registrado abonos para esta factura</p>
          </div>
        `;
      } else {
        abonosTableHtml = `
          <div style="max-height: 300px; overflow-y: auto; border-radius: 8px; border: 1px solid #e2e8f0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
              <thead>
                <tr style="background: #f8fafc; position: sticky; top: 0;">
                  <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0;">Fecha</th>
                  <th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0;">Monto</th>
                  <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0;">Método</th>
                  <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0;">Referencia</th>
                </tr>
              </thead>
              <tbody>
                ${abonos.map((a, i) => `
                  <tr style="${i % 2 === 0 ? 'background: #ffffff;' : 'background: #f8fafc;'}">
                    <td style="padding: 10px 12px; color: #334155;">${a.fecha}</td>
                    <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #10b981;">${utils.formatCurrency(a.monto_pago)}</td>
                    <td style="padding: 10px 12px; text-transform: capitalize; color: #64748b;">${a.metodo_pago || '-'}</td>
                    <td style="padding: 10px 12px; color: #94a3b8; font-style: ${a.referencia ? 'normal' : 'italic'};">${a.referencia || 'Sin ref.'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      // Estado badge
      const estadoColor = resumen.estado === 'pagado' ? '#10b981' : (resumen.estado === 'parcial' ? '#f59e0b' : '#ef4444');
      const estadoLabel = resumen.estado === 'pagado' ? 'Pagado' : (resumen.estado === 'parcial' ? 'Parcial' : 'Pendiente');

      Swal.fire({
        title: `<i class="fas fa-coins" style="color: #f59e0b; margin-right: 8px;"></i> Abonos \u2014 ${ncf}`,
        html: `
          <div style="text-align: left;">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px;">
              <div style="background: #f0fdf4; border-radius: 10px; padding: 12px; text-align: center;">
                <div style="font-size: 0.7rem; color: #16a34a; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Abonado</div>
                <div style="font-size: 1.15rem; font-weight: 800; color: #15803d; margin-top: 4px;">${utils.formatCurrency(resumen.total_abonado)}</div>
              </div>
              <div style="background: #fef2f2; border-radius: 10px; padding: 12px; text-align: center;">
                <div style="font-size: 0.7rem; color: #dc2626; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Saldo Pendiente</div>
                <div style="font-size: 1.15rem; font-weight: 800; color: #b91c1c; margin-top: 4px;">${utils.formatCurrency(resumen.saldo_pendiente)}</div>
              </div>
              <div style="background: #f8fafc; border-radius: 10px; padding: 12px; text-align: center;">
                <div style="font-size: 0.7rem; color: #475569; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Estado</div>
                <div style="margin-top: 6px;">
                  <span style="background: ${estadoColor}; color: white; padding: 3px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">${estadoLabel}</span>
                </div>
              </div>
            </div>
            ${abonosTableHtml}
          </div>
        `,
        width: 640,
        showCloseButton: true,
        showConfirmButton: false,
        customClass: { popup: 'swal-wide-popup' }
      });

    } catch (error) {
      console.error('Error viewing abonos:', error);
      Swal.fire('Error', 'No se pudieron cargar los abonos', 'error');
    }
  },

  async viewPaymentHistory(clientId, clientName) {
    try {
      Swal.fire({
        title: 'Cargando historial...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const timestamp = new Date().getTime();
      const response = await fetch(`/clientes/api/clientes/${clientId}/pagos?_t=${timestamp}`);
      const data = await response.json();

      if (!data.success) {
        Swal.close();
        notyf.error(data.message || 'Error al cargar el historial');
        return;
      }

      const pagos = data.pagos;

      if (pagos.length === 0) {
        Swal.fire({
          title: 'Historial de Pagos',
          text: 'Este cliente aún no registra pagos.',
          icon: 'info'
        });
        return;
      }

      // Render de tabla premium
      const tableHtml = `
        <div style="max-height: 400px; overflow-y: auto; border-radius: 12px; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
            <thead>
              <tr style="background: #f8fafc; position: sticky; top: 0; z-index: 10;">
                <th style="padding: 12px; text-align: left; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0;">Fecha</th>
                <th style="padding: 12px; text-align: left; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0;">Factura</th>
                <th style="padding: 12px; text-align: left; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0;">Referencia</th>
                <th style="padding: 12px; text-align: right; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0;">Monto</th>
                <th style="padding: 12px; text-align: left; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0;">Método</th>
              </tr>
            </thead>
            <tbody>
              ${pagos.map((p, i) => {
                let methodIcon = 'university';
                if (p.metodo_pago === 'efectivo') methodIcon = 'money-bill';
                if (p.metodo_pago === 'tarjeta') methodIcon = 'credit-card';
                if (p.metodo_pago === 'abono') methodIcon = 'coins';

                return `
                <tr style="${i % 2 === 0 ? 'background: #ffffff;' : 'background: #f8fafc;'} transition: background 0.2s ease;">
                  <td style="padding: 12px; color: #1e293b; font-weight: 500;">${p.fecha || p.fecha_pago}</td>
                  <td style="padding: 12px; color: #475569; font-weight: 600;">
                    ${p.factura_ncf && p.factura_ncf.trim() && p.factura_ncf !== '—' 
                      ? `<span style="color: var(--primary-color);">${p.factura_ncf}</span>` 
                      : (p.factura_id ? `<span style="color: #64748b; font-size: 0.8rem;">ID: ${p.factura_id}</span>` : '<span style="color: #94a3b8;">General</span>')}
                  </td>
                  <td style="padding: 12px; color: #64748b;">
                    ${p.referencia || p.referencia_pago ? `<span>${p.referencia || p.referencia_pago}</span>` : `<span style="color: #94a3b8; font-style: italic;">Sin ref.</span>`}
                  </td>
                  <td style="padding: 12px; text-align: right; font-weight: 800; color: #10b981;">
                    ${utils.formatCurrency(p.monto_pago)}
                  </td>
                  <td style="padding: 12px; text-transform: capitalize; color: #475569;">
                    <span style="display: flex; align-items: center; gap: 6px;">
                      <i class="fas fa-${methodIcon}" style="font-size: 0.75rem; opacity: 0.6;"></i>
                      ${p.metodo_pago}
                    </span>
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      Swal.fire({
        title: `<div style="display: flex; align-items: center; gap: 12px;">
                  <i class="fas fa-history" style="color: var(--primary-color);"></i>
                  <span>Historial de Pagos \u2014 ${clientName}</span>
                </div>`,
        html: tableHtml,
        width: 750,
        showCloseButton: true,
        showConfirmButton: false,
        customClass: {
          popup: 'swal-premium-popup',
          title: 'swal-premium-title'
        }
      });

    } catch (error) {
      console.error('Error viewing payment history:', error);
      Swal.fire('Error', 'No se pudo cargar el historial de pagos', 'error');
    }
  },

  openPaymentModal(client) {
    PaymentHandler.open(client);
  },

  async editClient(clientId) {
    try {
      const response = await API.getClient(clientId);
      if (response.success) {
        this.openForm('edit', response.client);
      } else {
        notyf.error(response.message || 'Error al cargar el cliente');
      }
    } catch (error) {
      console.error('Error:', error);
      notyf.error('Error de conexión con el servidor');
    }
  },

  openForm(mode = 'new', client = null) {
    if (!DOM.clientFormModal) return;

    // Título
    if (DOM.formModalTitle) {
      DOM.formModalTitle.textContent = mode === 'new' ? 'Nuevo Cliente' : 'Editar Cliente';
    }

    // Reset form
    if (DOM.clientForm) DOM.clientForm.reset();

    // Populate si es edición
    if (mode === 'edit' && client) {
      if (DOM.clientId) DOM.clientId.value = client.id;
      if (DOM.clientName) DOM.clientName.value = client.nombre;
      if (DOM.clientDocument) DOM.clientDocument.value = client.documento;
      if (DOM.clientPhone) DOM.clientPhone.value = client.telefono;
      if (DOM.clientAddress) DOM.clientAddress.value = client.direccion;
      if (DOM.clientType) DOM.clientType.value = client.tipo || 'Normal';
    }

    // Refresh visibility
    RNCValidator.handleTypeChange();

    DOM.clientFormModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  async toggleStatus(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    const action = client.estado === 'activo' ? 'inactivar' : 'activar';
    const result = await Swal.fire({
      title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} cliente?`,
      text: `Está a punto de ${action} a ${client.nombre}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Sí, ${action}`,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#64748b'
    });

    if (result.isConfirmed) {
      try {
        const response = await API.toggleClientStatus(clientId);
        if (response.success) {
          notyf.success(`Cliente ${action}do correctamente`);
          await loadClients();
        } else {
          notyf.error(response.message || `Error al ${action} el cliente`);
        }
      } catch (error) {
        console.error('Error:', error);
        notyf.error('Error de conexión con el servidor');
      }
    }
  }
};

// =========================================================
// Gestion de Pagos (Nuevo)
// =========================================================
const PaymentHandler = {
  pendingInvoices: [],

  async open(client) {
    if (!DOM.paymentModal) return;

    state.currentClient = client;

    // Poblar encabezado
    if (DOM.payClientName) DOM.payClientName.textContent = client.nombre;
    if (DOM.payClientDebt) DOM.payClientDebt.textContent = utils.formatCurrency(client.deuda_actual);

    // Reiniciar form
    if (DOM.paymentForm) DOM.paymentForm.reset();
    if (DOM.payAmount) DOM.payAmount.value = '0.00';

    // Abrir modal
    DOM.paymentModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Cargar facturas pendientes
    await this.loadPendingInvoices(client.id);
  },

  close() {
    if (DOM.paymentModal) {
      DOM.paymentModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  async loadPendingInvoices(clientId) {
    if (!DOM.payInvoiceId) return;

    DOM.payInvoiceId.innerHTML = '<option value="">Cargando facturas...</option>';

    try {
      const response = await fetch(`/clientes/api/clientes/${clientId}/facturas?only_pending=true&_t=${new Date().getTime()}`);
      const data = await response.json();

      if (data.success && data.facturas) {
        this.pendingInvoices = data.facturas;

        if (this.pendingInvoices.length === 0) {
          DOM.payInvoiceId.innerHTML = '<option value="">No hay facturas pendientes</option>';
          return;
        }

        let html = '<option value="">-- Pago General (Abono a Cuenta) --</option>';
        html += this.pendingInvoices.map(inv => {
          return `
            <option value="${inv.credito_id}" data-saldo="${inv.saldo_pendiente}">
              Factura: ${inv.ncf && inv.ncf.trim() ? inv.ncf : `ID #${inv.factura_id}`} (${utils.formatCurrency(inv.saldo_pendiente)} pendiente)
            </option>
          `;
        }).join('');

        DOM.payInvoiceId.innerHTML = html;

        // Auto-seleccionar la primera factura (la más reciente por el ORDER BY f_date_col DESC)
        if (this.pendingInvoices.length > 0) {
          DOM.payInvoiceId.selectedIndex = 1; 
          this.handleInvoiceChange();
        }
      } else {
        DOM.payInvoiceId.innerHTML = '<option value="">Error al cargar facturas</option>';
      }
    } catch (error) {
      console.error('Error:', error);
      DOM.payInvoiceId.innerHTML = '<option value="">Error de conexión</option>';
    }
  },

  handleInvoiceChange() {
    const selectedOption = DOM.payInvoiceId.options[DOM.payInvoiceId.selectedIndex];
    const payTypeGroup = document.getElementById('payTypeGroup');

    if (selectedOption && selectedOption.value) {
      // Mostrar selector de tipo de pago
      if (payTypeGroup) payTypeGroup.style.display = 'block';

      const saldo = selectedOption.getAttribute('data-saldo');
      if (DOM.payAmount) {
        DOM.payAmount.value = parseFloat(saldo).toFixed(2);
        DOM.payAmount.focus();
        DOM.payAmount.select();
      }
      // Default: Pago Total
      this.setPayType('full');
    } else {
      // Pago general: ocultar tipo de pago
      if (payTypeGroup) payTypeGroup.style.display = 'none';
      if (DOM.payAmount) DOM.payAmount.value = '0.00';
    }
  },

  setPayType(type) {
    const btnFull = document.getElementById('payTypeFull');
    const btnAbono = document.getElementById('payTypeAbono');
    const hint = document.getElementById('payTypeHint');
    const selectedOption = DOM.payInvoiceId?.options[DOM.payInvoiceId.selectedIndex];

    if (type === 'full') {
      // Visual
      if (btnFull) btnFull.classList.add('active');
      if (btnAbono) btnAbono.classList.remove('active');
      if (hint) hint.style.display = 'none';

      // Llenar monto total
      if (selectedOption && selectedOption.value) {
        const saldo = selectedOption.getAttribute('data-saldo');
        if (DOM.payAmount) DOM.payAmount.value = parseFloat(saldo).toFixed(2);
      }
    } else {
      // Abono parcial
      if (btnAbono) btnAbono.classList.add('active');
      if (btnFull) btnFull.classList.remove('active');
      if (hint) hint.style.display = 'block';

      // Limpiar monto para que el usuario ingrese
      if (DOM.payAmount) {
        DOM.payAmount.value = '';
        DOM.payAmount.focus();
      }
    }
  },

  async submit(e) {
    e.preventDefault();

    const amount = parseFloat(DOM.payAmount.value);
    const method = DOM.payMethod.value;
    const reference = DOM.payReference.value.trim();
    const creditoId = DOM.payInvoiceId.value;

    if (!amount || amount <= 0) {
      notyf.error('Ingrese un monto válido');
      return;
    }

    // Botón de guardado con feedback
    if (DOM.savePaymentBtn) {
      DOM.savePaymentBtn.disabled = true;
      DOM.savePaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';
    }

    try {
      const payload = {
        monto_pago: amount,
        metodo_pago: method,
        referencia_pago: reference
      };

      if (creditoId) {
        payload.credito_id = creditoId;
      }

      const response = await fetch(`/clientes/api/clientes/${state.currentClient.id}/pagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        notyf.success('Pago registrado correctamente');
        this.close();

        // Actualizar UI
        const updated = await API.getClient(state.currentClient.id);
        if (updated.success) {
          clientActions.renderProfile(updated.client);
        }
        loadClients();
      } else {
        notyf.error(data.message || 'Error al registrar pago');
      }
    } catch (error) {
      console.error('Error:', error);
      notyf.error('Error de conexión');
    } finally {
      if (DOM.savePaymentBtn) {
        DOM.savePaymentBtn.disabled = false;
        DOM.savePaymentBtn.innerHTML = '<i class="fas fa-check-circle"></i> Registrar Pago';
      }
    }
  }
};

// =========================================================
// Formulario
// =========================================================
const FormHandler = {
  // Estado de validación del documento
  documentValidationState: {
    valid: false,
    checked: false,
    existingClientId: null
  },

  validate() {
    let isValid = true;
    const tipo = DOM.clientType?.value || 'Normal';

    // Nombre
    if (!DOM.clientName || !DOM.clientName.value.trim()) {
      document.getElementById('nameError')?.classList.add('active');
      isValid = false;
    } else {
      document.getElementById('nameError')?.classList.remove('active');
    }

    // Documento - Solo obligatorio si es Crédito o Crédito Fiscal
    if (tipo !== 'Normal') {
      if (!DOM.clientDocument || !DOM.clientDocument.value.trim()) {
        DOM.documentError?.classList.add('active');
        isValid = false;
      } else {
        DOM.documentError?.classList.remove('active');
      }
    } else {
      DOM.documentError?.classList.remove('active');
    }

    // Teléfono y Dirección NO son obligatorios
    document.getElementById('phoneError')?.classList.remove('active');
    document.getElementById('addressError')?.classList.remove('active');

    return isValid;
  },

  async submit(e) {
    e.preventDefault();

    if (!FormHandler.validate()) {
      notyf.error('Por favor complete todos los campos requeridos');
      return;
    }

    // Obtener tipo y límite de crédito
    const tipo = DOM.clientType?.value || 'Normal';
    let limiteCredito = 0;
    let diasCredito = 30;

    if (tipo === 'Credito' || tipo === 'credito_fiscal') {
      limiteCredito = parseFloat(DOM.clientCreditLimit?.value) || 10000;
    }

    const clientData = {
      nombre: DOM.clientName.value.trim(),
      cedula: DOM.clientDocument.value.replace(/[-\s]/g, '').trim(),
      telefono: DOM.clientPhone.value.trim(),
      direccion: DOM.clientAddress.value.trim(),
      tipo: tipo,
      limite_credito: limiteCredito,
      dias_credito: diasCredito
    };

    const isEdit = DOM.clientId && DOM.clientId.value;

    try {
      let response;
      if (isEdit) {
        response = await API.updateClient(parseInt(DOM.clientId.value), clientData);
      } else {
        response = await API.createClient(clientData);
      }

      if (response.success) {
        notyf.success(`Cliente ${isEdit ? 'actualizado' : 'registrado'} correctamente`);
        FormHandler.close();
        await loadClients();
      } else {
        notyf.error(response.message || 'Error al guardar el cliente');
      }
    } catch (error) {
      console.error('Error:', error);
      notyf.error('Error de conexión con el servidor');
    }
  },

  close() {
    if (DOM.clientFormModal) {
      DOM.clientFormModal.classList.remove('active');
      document.body.style.overflow = '';
    }
    if (DOM.clientForm) DOM.clientForm.reset();
    document.querySelectorAll('.error-message').forEach(el => el.classList.remove('active'));

    // Reset validation state
    FormHandler.documentValidationState = { valid: false, checked: false, existingClientId: null };
    RNCValidator.resetUI();
  }
};

// =========================================================
// Validador de RNC/Cédula (DGII)
// =========================================================
const RNCValidator = {
  debounceTimer: null,

  init() {
    if (!DOM.clientDocument) return;

    // Evento de input con debounce
    DOM.clientDocument.addEventListener('input', (e) => {
      clearTimeout(RNCValidator.debounceTimer);
      RNCValidator.debounceTimer = setTimeout(() => {
        RNCValidator.validate(e.target.value);
      }, 600);
    });

    // Evento blur para validación inmediata
    DOM.clientDocument.addEventListener('blur', (e) => {
      clearTimeout(RNCValidator.debounceTimer);
      RNCValidator.validate(e.target.value);
    });

    // Tipo de cliente - mostrar/ocultar límite de crédito
    if (DOM.clientType) {
      DOM.clientType.addEventListener('change', RNCValidator.handleTypeChange);
    }

    // Botón seleccionar cliente existente
    if (DOM.btnSelectExisting) {
      DOM.btnSelectExisting.addEventListener('click', RNCValidator.selectExistingClient);
    }
  },

  async validate(documento) {
    // Limpiar formato
    const docClean = documento.replace(/[-\s]/g, '');

    // Si está vacío, reset
    if (!docClean) {
      RNCValidator.resetUI();
      return;
    }

    // Validación de longitud
    if (docClean.length < 9) {
      RNCValidator.showHint(`Faltan ${9 - docClean.length} dígitos para RNC`, 'default');
      return;
    }

    if (docClean.length > 9 && docClean.length < 11) {
      RNCValidator.showHint(`Faltan ${11 - docClean.length} dígitos para Cédula`, 'default');
      return;
    }

    if (docClean.length > 11) {
      RNCValidator.showError('Documento muy largo (máx. 11 dígitos)');
      return;
    }

    // Mostrar spinner
    RNCValidator.showSpinner();

    try {
      const response = await fetch(`/clientes/api/clientes/validar-rnc/${docClean}`);
      const data = await response.json();

      if (data.success) {
        if (data.valido) {
          if (data.existe_en_bd) {
            // Cliente ya existe
            RNCValidator.showExistingClient(data.cliente);
            FormHandler.documentValidationState = {
              valid: true,
              checked: true,
              existingClientId: data.cliente.id
            };
          } else {
            // Documento válido, cliente nuevo
            RNCValidator.showValid(data.message || `${data.tipo} válido`);
            FormHandler.documentValidationState = { valid: true, checked: true, existingClientId: null };

            // Auto-completar nombre si viene de DGII
            if (data.data && data.data.nombre && DOM.clientName) {
              DOM.clientName.value = data.data.nombre;
              notyf.success(`Nombre obtenido de DGII: ${data.data.nombre}`);
            }

            // Si es RNC (empresa), sugerir tipo crédito fiscal
            if (data.tipo === 'RNC' && DOM.clientType) {
              DOM.clientType.value = 'credito_fiscal';
              RNCValidator.handleTypeChange();
            }
          }

          // Mostrar warning si hay
          if (data.warning) {
            notyf.open({ type: 'warning', message: data.warning });
          }
        } else {
          RNCValidator.showInvalid(data.error || 'Documento inválido');
          FormHandler.documentValidationState = { valid: false, checked: true, existingClientId: null };
        }
      } else {
        RNCValidator.showInvalid(data.error || 'Error al validar');
        FormHandler.documentValidationState = { valid: false, checked: true, existingClientId: null };
      }
    } catch (error) {
      console.error('Error validando RNC:', error);
      RNCValidator.showWarning('Error de conexión - Validación local');
      FormHandler.documentValidationState = { valid: true, checked: true, existingClientId: null };
    }
  },

  showSpinner() {
    DOM.docSpinner?.style.setProperty('display', 'inline-block');
    DOM.docValid?.style.setProperty('display', 'none');
    DOM.docInvalid?.style.setProperty('display', 'none');
    DOM.docWarning?.style.setProperty('display', 'none');
    DOM.clientDocument?.classList.remove('is-valid', 'is-invalid', 'is-warning');
    DOM.clientFoundAlert?.style.setProperty('display', 'none');
  },

  showValid(message) {
    DOM.docSpinner?.style.setProperty('display', 'none');
    DOM.docValid?.style.setProperty('display', 'inline-block');
    DOM.docInvalid?.style.setProperty('display', 'none');
    DOM.docWarning?.style.setProperty('display', 'none');
    DOM.clientDocument?.classList.remove('is-invalid', 'is-warning');
    DOM.clientDocument?.classList.add('is-valid');
    DOM.documentError?.classList.remove('active');
    RNCValidator.showHint(message, 'success');
    DOM.clientFoundAlert?.style.setProperty('display', 'none');
  },

  showInvalid(message) {
    DOM.docSpinner?.style.setProperty('display', 'none');
    DOM.docValid?.style.setProperty('display', 'none');
    DOM.docInvalid?.style.setProperty('display', 'inline-block');
    DOM.docWarning?.style.setProperty('display', 'none');
    DOM.clientDocument?.classList.remove('is-valid', 'is-warning');
    DOM.clientDocument?.classList.add('is-invalid');
    RNCValidator.showHint(message, 'error');
    DOM.clientFoundAlert?.style.setProperty('display', 'none');
  },

  showWarning(message) {
    DOM.docSpinner?.style.setProperty('display', 'none');
    DOM.docValid?.style.setProperty('display', 'none');
    DOM.docInvalid?.style.setProperty('display', 'none');
    DOM.docWarning?.style.setProperty('display', 'inline-block');
    DOM.clientDocument?.classList.remove('is-valid', 'is-invalid');
    DOM.clientDocument?.classList.add('is-warning');
    RNCValidator.showHint(message, 'default');
  },

  showError(message) {
    RNCValidator.showInvalid(message);
    FormHandler.documentValidationState = { valid: false, checked: true, existingClientId: null };
  },

  showExistingClient(cliente) {
    DOM.docSpinner?.style.setProperty('display', 'none');
    DOM.docValid?.style.setProperty('display', 'inline-block');
    DOM.docInvalid?.style.setProperty('display', 'none');
    DOM.docWarning?.style.setProperty('display', 'none');
    DOM.clientDocument?.classList.remove('is-invalid', 'is-warning');
    DOM.clientDocument?.classList.add('is-valid');

    if (DOM.clientFoundAlert && DOM.clientFoundMessage) {
      DOM.clientFoundMessage.textContent = `Cliente existente: ${cliente.nombre} (${cliente.estado})`;
      DOM.clientFoundAlert.style.display = 'block';
    }

    RNCValidator.showHint('Este RNC/Cédula ya está registrado', 'success');
  },

  showHint(message, type = 'default') {
    if (DOM.documentHint) {
      DOM.documentHint.textContent = message;
      DOM.documentHint.classList.remove('success', 'error');
      if (type === 'success') DOM.documentHint.classList.add('success');
      if (type === 'error') DOM.documentHint.classList.add('error');
    }
  },

  resetUI() {
    DOM.docSpinner?.style.setProperty('display', 'none');
    DOM.docValid?.style.setProperty('display', 'none');
    DOM.docInvalid?.style.setProperty('display', 'none');
    DOM.docWarning?.style.setProperty('display', 'none');
    DOM.clientDocument?.classList.remove('is-valid', 'is-invalid', 'is-warning');
    DOM.documentError?.classList.remove('active');
    DOM.clientFoundAlert?.style.setProperty('display', 'none');
    RNCValidator.showHint('9 dígitos para RNC, 11 para Cédula', 'default');

    // Reset tipo y límite
    if (DOM.clientType) DOM.clientType.value = 'Normal';
    this.handleTypeChange();
  },

  handleTypeChange() {
    const tipo = DOM.clientType?.value;
    
    // Toggle Document Group (RNC/Cédula)
    if (DOM.documentGroup) {
      if (tipo === 'Normal') {
        DOM.documentGroup.style.display = 'none';
      } else {
        DOM.documentGroup.style.display = 'block';
      }
    }

    // Toggle Credit Limit Group
    if (DOM.creditLimitGroup) {
      if (tipo === 'Credito' || tipo === 'credito_fiscal') {
        DOM.creditLimitGroup.style.display = 'block';
      } else {
        DOM.creditLimitGroup.style.display = 'none';
      }
    }
  },

  selectExistingClient() {
    if (FormHandler.documentValidationState.existingClientId) {
      // Cerrar modal de formulario y abrir perfil del cliente existente
      FormHandler.close();
      clientActions.viewProfile(FormHandler.documentValidationState.existingClientId);
    }
  }
};

// =========================================================
// Load Clients
// =========================================================
async function loadClients() {
  try {
    if (DOM.clientsTableBody) {
      DOM.clientsTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Cargando clientes...</p>
          </td>
        </tr>
      `;
    }

    const response = await API.getClients();

    if (response.success) {
      state.clients = response.clients || [];
      state.filteredClients = [...state.clients];
      Render.updateKPIs();
      Render.renderClientsTable();

      // Procesar búsqueda desde URL (Global Search Redirect)
      const urlParams = new URLSearchParams(window.location.search);
      const searchQ = urlParams.get('search');
      if (searchQ && DOM.searchInput) {
        DOM.searchInput.value = searchQ;
        state.filters.search = searchQ;
        Filters.apply();
      }
    } else {
      notyf.error('Error al cargar los clientes');
    }
  } catch (error) {
    console.error('Error:', error);
    notyf.error('Error de conexión con el servidor');
  }
}

// =========================================================
// Event Listeners
// =========================================================
function setupEventListeners() {
  // Botón nuevo cliente
  if (DOM.newClientBtn) {
    DOM.newClientBtn.addEventListener('click', () => {
      clientActions.openForm('new');
    });
  }

  // Exportación
  if (DOM.exportPDFBtn) {
    DOM.exportPDFBtn.addEventListener('click', async () => {
      try {
        const response = await fetch('/clientes/api/clientes/reporte/pdf');
        const data = await response.json();
        
        if (!data.success) {
          Swal.fire({
            title: 'Exportación a PDF',
            text: data.message || 'La exportación no está disponible.',
            icon: 'info',
            footer: data.info || ''
          });
        }
      } catch (error) {
        console.error('Error exportando PDF:', error);
        notyf.error('Error al conectar con el servidor para exportar PDF');
      }
    });
  }

  // Listener para formateo de RNC en tiempo real (clientes.js)
  if (DOM.clientDocument) {
    DOM.clientDocument.addEventListener('input', (e) => {
      const start = e.target.selectionStart;
      const formatted = utils.formatDocument(e.target.value);
      e.target.value = formatted;
      
      // Mantener posición del cursor (aproximada)
      try {
        e.target.setSelectionRange(start, start);
      } catch(err) {}
    });
  }

  if (DOM.exportExcelBtn) DOM.exportExcelBtn.addEventListener('click', Export.toExcel);

  if (DOM.closeFormModal) {
    DOM.closeFormModal.addEventListener('click', FormHandler.close);
  }

  if (DOM.cancelFormBtn) {
    DOM.cancelFormBtn.addEventListener('click', FormHandler.close);
  }

  // Submit formulario
  if (DOM.clientForm) {
    DOM.clientForm.addEventListener('submit', FormHandler.submit);
  }

  // listeners de perfil (Nuevos filtros y cierre)
  setupProfileListeners();

  // Listeners de Pago (Movidos a setupProfileListeners para soporte multi-página)

  // Filtros
  Filters.setupListeners();
}

/**
 * Solo inicializa los listeners del modal de perfil
 * Útil para cuando el script se carga en otras páginas (ej: Reportes)
 */
function setupProfileListeners() {
  if (DOM.closeProfileModal) {
    DOM.closeProfileModal.addEventListener('click', () => {
      DOM.clientProfileModal.classList.remove('active');
      document.body.style.overflow = '';

      // Limpiar filtros al cerrar
      if (DOM.profileDateStart) DOM.profileDateStart.value = '';
      if (DOM.profileDateEnd) DOM.profileDateEnd.value = '';
    });
  }

  // Listener para filtros de historial
  if (DOM.btnFilterProfileInvoices) {
    DOM.btnFilterProfileInvoices.addEventListener('click', () => {
      if (state.currentClient) {
        const start = DOM.profileDateStart.value;
        const end = DOM.profileDateEnd.value;
        clientActions.loadClientInvoices(state.currentClient.id, { start, end });
      }
    });
  }

  // Permitir filtrar al presionar Enter en las fechas
  [DOM.profileDateStart, DOM.profileDateEnd].forEach(el => {
    if (el) {
      el.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') DOM.btnFilterProfileInvoices.click();
      });
    }
  });

  window.addEventListener('click', (e) => {
    if (e.target === DOM.clientProfileModal) {
      DOM.closeProfileModal.click();
    }
    if (e.target === DOM.paymentModal) {
      PaymentHandler.close();
    }
    if (e.target === DOM.clientFormModal) {
      FormHandler.close();
    }
  });

  // Listeners de Pago (Disponibles en todas las vistas con Perfil)
  if (DOM.closePaymentModal) DOM.closePaymentModal.addEventListener('click', () => PaymentHandler.close());
  if (DOM.cancelPaymentBtn) DOM.cancelPaymentBtn.addEventListener('click', () => PaymentHandler.close());
  if (DOM.paymentForm) DOM.paymentForm.addEventListener('submit', (e) => PaymentHandler.submit(e));
  if (DOM.payInvoiceId) DOM.payInvoiceId.addEventListener('change', () => PaymentHandler.handleInvoiceChange());

  // Listeners de tipo de pago (Abonos)
  if (DOM.payTypeFull) DOM.payTypeFull.addEventListener('click', () => PaymentHandler.setPayType('full'));
  if (DOM.payTypeAbono) DOM.payTypeAbono.addEventListener('click', () => PaymentHandler.setPayType('abono'));
}

// =========================================================
// Exportación
// =========================================================
const Export = {
  getFilters() {
    const filters = {};
    if (state.filters.status) filters.status = state.filters.status;
    if (state.filters.search) filters.search = state.filters.search;
    // Nota: el endpoint no soporta 'debt' filter por ahora, se exportará y user filtra en Excel
    return filters;
  },

  async toPDF() {
    try {
      const filters = Export.getFilters();
      const params = new URLSearchParams(filters);

      const response = await fetch(`/clientes/api/clientes/reporte/pdf?${params}`);
      if (!response.ok) throw new Error('Error al generar PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LNSystemS_Listado_Clientes_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      notyf.success('Listado exportado a PDF correctamente');
    } catch (error) {
      console.error(error);
      notyf.error('Error al exportar PDF');
    }
  },

  async toExcel() {
    try {
      const filters = Export.getFilters();
      const params = new URLSearchParams(filters);

      const response = await fetch(`/clientes/api/clientes/reporte/excel?${params}`);
      if (!response.ok) throw new Error('Error al generar Excel');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LNSystemS_Listado_Clientes_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      notyf.success('Listado exportado a Excel correctamente');
    } catch (error) {
      console.error(error);
      notyf.error('Error al exportar Excel');
    }
  }
};

// =========================================================
// Inicialización
// =========================================================
function init() {
  // console.log('LN Systems - Módulo de Clientes - Comprobando entorno...');

  // Solo inicializar si estamos en la página de gestión de clientes (donde existe la tabla de clientes)
  if (document.getElementById('clientsTableBody')) {
    // console.log('LN Systems - Inicializando Gestión de Clientes');
    setupEventListeners();
    RNCValidator.init();
    loadClients();
  } else {
    // Si estamos en otra página (como reportes), solo inicializamos lo necesario para el perfil
    console.log('LN Systems - Modo Perfil cargado');
    setupProfileListeners();
  }
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Exponer funciones globales necesarias (para onclick en HTML)
window.clientActions = clientActions;
