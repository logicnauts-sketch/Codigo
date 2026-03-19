(function () {
  'use strict';

  // =========================================================
  // Estado
  // =========================================================
  const reportState = {
    clients: [], // Datos crudos del backend
    dataTable: null,
    filters: {
      startDate: '',
      endDate: '',
      status: ''
    }
  };

  // =========================================================
  // DOM Elements
  // =========================================================
  const reportDOM = {
    // Filtros
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    filterStatus: document.getElementById('filterStatus'),
    applyFiltersBtn: document.getElementById('applyFiltersBtn'),

    // KPIs
    totalClients: document.getElementById('totalClients'),
    activeClients: document.getElementById('activeClients'),
    totalRevenue: document.getElementById('totalRevenue'),
    totalDebt: document.getElementById('totalDebt'),

    // Resumen
    countActive: document.getElementById('countActive'),
    countInactive: document.getElementById('countInactive'),
    clientsWithDebt: document.getElementById('clientsWithDebt'),
    avgDebt: document.getElementById('avgDebt'),

    // Exportación
    exportPDFBtn: document.getElementById('exportPDFBtn'),
    exportExcelBtn: document.getElementById('exportExcelBtn')
  };

  // =========================================================
  // Utilidades
  // =========================================================
  const reportUtils = {
    formatCurrency(amount) {
      return new Intl.NumberFormat('es-DO', {
        style: 'currency',
        currency: 'DOP'
      }).format(amount || 0);
    },

    formatDate(dateString) {
      if (!dateString) return '-';
      const date = new Date(dateString);
      return date.toLocaleDateString('es-DO');
    },

    setDefaultDates() {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

      if (reportDOM.startDate) {
        reportDOM.startDate.value = firstDay.toISOString().split('T')[0];
      }
      if (reportDOM.endDate) {
        reportDOM.endDate.value = today.toISOString().split('T')[0];
      }
    }
  };

  // =========================================================
  // API & Export
  // =========================================================
  const reportAPI = {
    async getClientsReport(filters = {}) {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.status) params.append('status', filters.status);

      const response = await fetch(`/api/clientes/reporte?${params}`);
      return await response.json();
    },

    async exportPDF(filters = {}) {
      const params = new URLSearchParams(filters);
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.status) params.append('status', filters.status);

      // Redirigir para descarga directa
      window.location.href = `/api/clientes/reporte/pdf?${params}`;
    },

    async exportExcel(filters = {}) {
      const params = new URLSearchParams(filters);
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.status) params.append('status', filters.status);

      window.location.href = `/api/clientes/reporte/excel?${params}`;
    }
  };

  // =========================================================
  // Renderizado y DataTables
  // =========================================================
  const reportRender = {
    initDataTable() {
      if (reportState.dataTable) return;

      reportState.dataTable = $('#reportTable').DataTable({
        language: {
          url: "/static/js/i18n/es-ES.json",
          search: "_INPUT_",
          searchPlaceholder: "Buscar en reporte...",
          lengthMenu: "Mostrar _MENU_ registros"
        },
        responsive: true,
        autoWidth: false,
        info: false,
        dom: '<"d-flex justify-content-between align-items-center mb-3"lf>rt<"d-flex justify-content-between align-items-center mt-3"ip>',
        pageLength: 25,
        columns: [
          { title: "Cliente" },
          { title: "Documento" },
          { title: "Facturas", className: "text-center" },
          { title: "Total Facturado", className: "text-end" },
          { title: "Total Pagado", className: "text-end" },
          { title: "Deuda Actual", className: "text-end" },
          { title: "Estado", className: "text-center" },
          { title: "Acciones", className: "text-center", orderable: false }
        ],
        drawCallback: function () {
          // Podríamos actualizar KPIs aquí basados en filtro visual si quisiéramos
        }
      });
    },

    updateTable(clients) {
      if (!reportState.dataTable) reportRender.initDataTable();

      // Preparar filas
      const rows = clients.map(client => {
        const totalBilled = parseFloat(client.total_facturado || 0);
        const totalPaid = parseFloat(client.total_pagado || 0);
        const debt = parseFloat(client.deuda_actual || 0);
        const invoices = parseInt(client.facturas_count || 0);

        const statusBadge = client.estado === 'activo'
          ? '<span class="badge badge-active">Activo</span>'
          : '<span class="badge badge-inactive">Inactivo</span>';

        return [
          `<div class="fw-bold client-name-text">${client.nombre}</div>`,
          `<div class="client-doc-text text-sm">${client.documento || '-'}</div>`,
          invoices,
          reportUtils.formatCurrency(totalBilled),
          reportUtils.formatCurrency(totalPaid),
          `<span class="${debt > 0 ? 'text-danger fw-bold' : 'text-success'}">${reportUtils.formatCurrency(debt)}</span>`,
          statusBadge,
          `<button class="btn btn-sm btn-outline-primary" onclick="viewClientProfile(${client.id})">
            <i class="fas fa-eye"></i> Ver
          </button>`
        ];
      });

      reportState.dataTable.clear();
      reportState.dataTable.rows.add(rows);
      reportState.dataTable.draw();
    },

    updateKPIs(clients) {
      const total = clients.length;
      const active = clients.filter(c => c.estado === 'activo').length;
      const totalRevenue = clients.reduce((sum, c) => sum + parseFloat(c.total_facturado || 0), 0);
      const totalDebt = clients.reduce((sum, c) => sum + parseFloat(c.deuda_actual || 0), 0);

      // KPIs Superiores
      if (reportDOM.totalClients) reportDOM.totalClients.textContent = total;
      if (reportDOM.activeClients) reportDOM.activeClients.textContent = active;
      if (reportDOM.totalRevenue) reportDOM.totalRevenue.textContent = reportUtils.formatCurrency(totalRevenue);
      if (reportDOM.totalDebt) reportDOM.totalDebt.textContent = reportUtils.formatCurrency(totalDebt);

      // Resumen Inferior
      const inactive = total - active;
      const withDebt = clients.filter(c => parseFloat(c.deuda_actual || 0) > 0).length;
      const avgDebt = withDebt > 0 ? totalDebt / withDebt : 0;

      if (reportDOM.countActive) reportDOM.countActive.textContent = active;
      if (reportDOM.countInactive) reportDOM.countInactive.textContent = inactive;
      if (reportDOM.clientsWithDebt) reportDOM.clientsWithDebt.textContent = withDebt;
      if (reportDOM.avgDebt) reportDOM.avgDebt.textContent = reportUtils.formatCurrency(avgDebt);
    }
  };

  // =========================================================
  // Lógica Principal
  // =========================================================
  async function loadReport() {
    try {
      if (!reportDOM.startDate || !reportDOM.endDate || !reportDOM.filterStatus) return;

      reportState.filters.startDate = reportDOM.startDate.value;
      reportState.filters.endDate = reportDOM.endDate.value;
      reportState.filters.status = reportDOM.filterStatus.value;

      const response = await reportAPI.getClientsReport(reportState.filters);

      if (response.success && response.clients) {
        reportState.clients = response.clients;
        reportRender.updateTable(reportState.clients);
        reportRender.updateKPIs(reportState.clients);
      } else {
        reportRender.updateTable([]);
        reportRender.updateKPIs([]);
      }
    } catch (error) {
      console.error(error);
    }
  }

  // =========================================================
  // Funciones Globales (Expuestas al window)
  // =========================================================
  window.viewClientProfile = async function (clientId) {
    // Intentar encontrar el módulo de acciones de cliente (global o en window)
    const actions = window.clientActions || (typeof clientActions !== 'undefined' ? clientActions : null);

    if (actions && typeof actions.viewProfile === 'function') {
      actions.viewProfile(clientId);
    } else if (typeof viewProfile === 'function') {
      viewProfile(clientId);
    } else {
      console.error('Módulo de clientes no cargado correctamente');
      alert('No se pudo abrir el perfil del cliente.');
    }
  };

  // =========================================================
  // Inicialización
  // =========================================================
  function init() {
    console.log('LN Systems - Reporte de Clientes (DataTables) - Encapsulado');

    reportUtils.setDefaultDates();
    reportRender.initDataTable();

    // Event Listeners
    if (reportDOM.applyFiltersBtn) {
      reportDOM.applyFiltersBtn.addEventListener('click', loadReport);
    }

    if (reportDOM.exportPDFBtn) {
      reportDOM.exportPDFBtn.addEventListener('click', () => {
        reportState.filters.startDate = reportDOM.startDate.value;
        reportState.filters.endDate = reportDOM.endDate.value;
        reportState.filters.status = reportDOM.filterStatus.value;
        reportAPI.exportPDF(reportState.filters);
      });
    }

    if (reportDOM.exportExcelBtn) {
      reportDOM.exportExcelBtn.addEventListener('click', () => {
        reportState.filters.startDate = reportDOM.startDate.value;
        reportState.filters.endDate = reportDOM.endDate.value;
        reportState.filters.status = reportDOM.filterStatus.value;
        reportAPI.exportExcel(reportState.filters);
      });
    }

    loadReport();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
