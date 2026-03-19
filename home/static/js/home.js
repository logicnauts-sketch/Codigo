'use strict';

/* =========================================================
   LN Systems â€” home.js (COMPLETO)
   ========================================================= */

console.warn('LN Systems: home.js cargado correctamente.');

// Elementos del DOM
const floatingToggle = document.getElementById('floatingToggle');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const appContainer = document.getElementById('appContainer');
const mainContent = document.getElementById('mainContent');
const userBtn = document.getElementById('userBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
const accountingBtn = document.getElementById('accountingBtn');
const accountingDropdown = document.getElementById('accountingDropdown');
const sidebarOverlay = document.querySelector('.sidebar-overlay');

// Estado del sidebar controlado por clases en document.body

function updateClock() {
    const timeDisplay = document.getElementById('timeDisplay');
    if (!timeDisplay) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: true });
    timeDisplay.querySelector('span').textContent = timeStr;
}

// Iniciar reloj
setInterval(updateClock, 1000);
document.addEventListener('DOMContentLoaded', updateClock);

/* =========================================================
   GRÃFICOS FINANCIEROS - Variables Globales
   ========================================================= */
let comparisonChart = null;
let expensePieChart = null;

// Sincronizar colores de gráficos con cambio de tema
function updateChartsTheme(isDark) {
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  [comparisonChart, expensePieChart].forEach(chart => {
    if (!chart) return;
    if (chart.options.scales) {
      if (chart.options.scales.x) chart.options.scales.x.ticks.color = textColor;
      if (chart.options.scales.y) {
        chart.options.scales.y.ticks.color = textColor;
        chart.options.scales.y.grid.color = gridColor;
      }
    }
    chart.options.plugins.legend.labels.color = textColor;
    chart.update();
  });
}

/* =========================================================
   Sidebar Toggle â€” Patrón unificado Next Design
   Replica la lógica probada de configuracion_ui.html
   ========================================================= */
document.addEventListener('DOMContentLoaded', function() {
  const menuToggleBtn = document.getElementById('menuToggle');
  const floatingToggleBtn = document.getElementById('floatingToggle');

  if (!menuToggleBtn) return;

  const menuIcon = menuToggleBtn.querySelector('i');

  function updateIcon() {
    if (!menuIcon) return;
    menuIcon.className = document.body.classList.contains('sidebar-hidden')
      ? 'fas fa-bars'
      : 'fas fa-bars-staggered';
  }

  function doToggle() {
    document.body.classList.toggle('sidebar-hidden');
    updateIcon();
  }

  // Click en botón del menú
  menuToggleBtn.addEventListener('click', doToggle);

  // Click en botón flotante (si existe)
  if (floatingToggleBtn) floatingToggleBtn.addEventListener('click', doToggle);

  // Atajo de teclado: tecla S (solo si no está en un input/textarea/select)
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key.toLowerCase() === 's') {
      doToggle();
    }
  });

  // Sincronizar icono inicial
  updateIcon();

  // Exportar globalmente por si otros scripts lo necesitan
  window.toggleSidebar = doToggle;
});

/* =========================================================
   Dropdown de usuario
   ========================================================= */
if (userBtn && dropdownMenu) {
  userBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('show');
  });
}

/* =========================================================
   Cerrar dropdowns al hacer clic fuera + cerrar sidebar móvil
   ========================================================= */
document.addEventListener('click', (e) => {
  const dMenu = document.getElementById('dropdownMenu');
  const sTable = document.getElementById('sidebar');
  const fToggle = document.getElementById('floatingToggle');
  const mToggle = document.getElementById('menuToggle');

  // Dropdown de usuario
  if (dMenu && dMenu.classList.contains('show') &&
    !e.target.closest('#userBtn') && !e.target.closest('.dropdown-menu')) {
    dMenu.classList.remove('show');
  }

  // Sidebar en móviles: si click fuera del sidebar (y no en toggles)
  if (sTable && sTable.classList.contains('mobile-open') &&
    !e.target.closest('#sidebar') &&
    (!fToggle || !fToggle.contains(e.target)) &&
    (!mToggle || !mToggle.contains(e.target))) {
    document.body.classList.remove('mobile-sidebar-open');
    sTable.classList.remove('mobile-open');
  }
});

// Cerrar sidebar al hacer clic en el overlay
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.querySelector('.sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', function () {
      document.body.classList.remove('mobile-sidebar-open');
      const sb = document.getElementById('sidebar');
      if (sb) sb.classList.remove('mobile-open');
    });
  }
});

/* =========================================================
   Menu items -> actualizar título y active (UI)
   ========================================================= */
const menuItems = document.querySelectorAll('.menu-item');
const pageTitle = document.querySelector('.content-title');

if (menuItems && menuItems.length) {
  menuItems.forEach(item => {
    item.addEventListener('click', function () {
      menuItems.forEach(i => i.classList.remove('active'));
      this.classList.add('active');

      if (pageTitle) {
        const span = this.querySelector('span');
        pageTitle.textContent = span ? span.textContent : this.textContent;
      }
    });
  });
}

/* =========================================================
   SISTEMA DE TEMAS (DARK MODE)
   ========================================================= */
(function handleThemeSystem() {
  const sidebarSwitch = document.getElementById('darkThemeSwitch');
  const themeBtn = document.getElementById('themeToggleBtn');
  const doc = document.documentElement;
  const body = document.body;

  function applyTheme(isDark) {
    if (isDark) {
      doc.classList.add('dark-theme');
      body.classList.add('dark-theme');
      localStorage.setItem('ln_theme', 'dark');
    } else {
      doc.classList.remove('dark-theme');
      body.classList.remove('dark-theme');
      localStorage.setItem('ln_theme', 'light');
    }
    // Sincronizar interruptores si existen
    if (sidebarSwitch) sidebarSwitch.checked = isDark;
    // Actualizar colores de gráficos
    if (typeof updateChartsTheme === 'function') updateChartsTheme(isDark);
  }

  // 1. Cargar preferencia (LocalStorage > Atributo Body)
  let initialTheme = localStorage.getItem('ln_theme');
  if (!initialTheme) {
    // Si no hay en local, heredar lo que venga de la DB (inyectado en la clase por Flask si lo configuramos así)
    initialTheme = body.classList.contains('dark-theme') ? 'dark' : 'light';
  }

  // Si el interruptor no está en el DOM y no somos admin (o el permiso global está OFF), forzar luz
  if (!sidebarSwitch) {
    initialTheme = 'light';
  }

  applyTheme(initialTheme === 'dark');

  // 2. Listeners para los interruptores
  if (sidebarSwitch) {
    sidebarSwitch.addEventListener('change', function () {
      applyTheme(this.checked);
    });
  }

  // 3. Botón del menú (sidebar)
  if (themeBtn && sidebarSwitch) {
    themeBtn.addEventListener('click', (e) => {
      if (e.target !== sidebarSwitch) {
        applyTheme(!sidebarSwitch.checked);
      }
    });
  }
})();

/* =========================================================
   Gráfico (legacy demo) â€” no rompe si no hay .bar
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const bars = document.querySelectorAll('.bar');
  const chartBtns = document.querySelectorAll('.chart-btn');
  const monthlyData = [
    12500, 18750, 25000, 33300,
    27100, 31250, 37500, 41670,
    35420, 39580, 29170, 25000
  ];

  if (bars && bars.length) {
    bars.forEach((bar, index) => {
      const height = bar.style.height || bar.getAttribute('data-height') || '50px';
      bar.style.height = '0';
      setTimeout(() => {
        bar.style.height = height;
      }, 200 + (index * 50));
    });
  }

  if (chartBtns && chartBtns.length) {
    chartBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        chartBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const range = this.dataset.range || 'month';
        updateChart(range);
      });
    });
  }

  function updateChart(range) {
    if (!bars || !bars.length) return;
    bars.forEach((bar, index) => {
      const amount = monthlyData[index] || 0;
      let displayAmount = amount;
      if (range === 'quarter') displayAmount = amount * 3;
      if (range === 'year') displayAmount = amount * 12;

      const formattedAmount = new Intl.NumberFormat('es-ES', {
        style: 'currency', currency: 'USD'
      }).format(displayAmount);

      const tooltip = bar.querySelector('.bar-tooltip');
      const month = bar.dataset.month || `Mes ${index + 1}`;
      if (tooltip) tooltip.textContent = `${month}: ${formattedAmount}`;
    });
  }

  updateChart('month');
});

/* =========================================================
   Dropdowns de contabilidad / impuestos / reportes / configuración
   (respeta tu estructura actual)
   ========================================================= */
if (accountingBtn && accountingDropdown) {
  accountingBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    accountingBtn.classList.toggle('active');
    accountingDropdown.classList.toggle('show');
  });
}

const taxesBtn = document.getElementById('impuestosBtn');
const taxesDropdown = document.getElementById('impuestosDropdown');
if (taxesBtn && taxesDropdown) {
  taxesBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    this.classList.toggle('active');
    taxesDropdown.classList.toggle('show');
  });
}

const reportsBtn = document.getElementById('reportesBtn');
const reportsDropdown = document.getElementById('reportesDropdown');
if (reportsBtn && reportsDropdown) {
  reportsBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    this.classList.toggle('active');
    reportsDropdown.classList.toggle('show');
  });
}

const configuracionBtn = document.getElementById('configuracionBtn');
const configuracionDropdown = document.getElementById('configuracionDropdown');
if (configuracionBtn && configuracionDropdown) {
  configuracionBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    this.classList.toggle('active');
    configuracionDropdown.classList.toggle('show');
  });
}

// Dropdown Restaurant (Nuevo)
const restaurantBtn = document.getElementById('restaurantBtn');
const restaurantDropdown = document.getElementById('restaurantDropdown');
if (restaurantBtn && restaurantDropdown) {
  restaurantBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    this.classList.toggle('active');
    restaurantDropdown.classList.toggle('show');
  });
}

// Dropdown Clientes
const clientesBtn = document.getElementById('clientesBtn');
const clientesDropdown = document.getElementById('clientesDropdown');
if (clientesBtn && clientesDropdown) {
  clientesBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    this.classList.toggle('active');
    clientesDropdown.classList.toggle('show');
  });
}

// Dropdown Operaciones (Nuevo)
const operacionesBtn = document.getElementById('operacionesBtn');
const operacionesDropdown = document.getElementById('operacionesDropdown');
if (operacionesBtn && operacionesDropdown) {
  operacionesBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    this.classList.toggle('active');
    operacionesDropdown.classList.toggle('show');
  });
}


// Cerrar todos los dropdowns con clic fuera
document.addEventListener('click', (e) => {
  if (accountingBtn && accountingDropdown && accountingDropdown.classList.contains('show')) {
    if (!accountingBtn.contains(e.target) && !accountingDropdown.contains(e.target)) {
      accountingBtn.classList.remove('active');
      accountingDropdown.classList.remove('show');
    }
  }

  if (taxesBtn && taxesDropdown && taxesDropdown.classList.contains('show')) {
    if (!taxesBtn.contains(e.target) && !taxesDropdown.contains(e.target)) {
      taxesBtn.classList.remove('active');
      taxesDropdown.classList.remove('show');
    }
  }

  if (reportsBtn && reportsDropdown && reportsDropdown.classList.contains('show')) {
    if (!reportsBtn.contains(e.target) && !reportsDropdown.contains(e.target)) {
      reportsBtn.classList.remove('active');
      reportsDropdown.classList.remove('show');
    }
  }

  if (configuracionBtn && configuracionDropdown && configuracionDropdown.classList.contains('show')) {
    if (!configuracionBtn.contains(e.target) && !configuracionDropdown.contains(e.target)) {
      configuracionBtn.classList.remove('active');
      configuracionDropdown.classList.remove('show');
    }
  }

  if (restaurantBtn && restaurantDropdown && restaurantDropdown.classList.contains('show')) {
    if (!restaurantBtn.contains(e.target) && !restaurantDropdown.contains(e.target)) {
      restaurantBtn.classList.remove('active');
      restaurantDropdown.classList.remove('show');
    }
  }

  if (clientesBtn && clientesDropdown && clientesDropdown.classList.contains('show')) {
    if (!clientesBtn.contains(e.target) && !clientesDropdown.contains(e.target)) {
      clientesBtn.classList.remove('active');
      clientesDropdown.classList.remove('show');
    }
  }

  if (operacionesBtn && operacionesDropdown && operacionesDropdown.classList.contains('show')) {
    if (!operacionesBtn.contains(e.target) && !operacionesDropdown.contains(e.target)) {
      operacionesBtn.classList.remove('active');
      operacionesDropdown.classList.remove('show');
    }
  }
});

/* =========================================================
   ROLE-based behaviour
   La restricción granular la impone Jinja2 en el servidor.
   ========================================================= */

/* =========================================================
   Dashboard data (API)
   ========================================================= */
function updateDashboardData() {
  // Los datos en Next Design se proveen por Jinja en vivo, no hay endpoint /api/dashboard-data activo.
}

// Polling suave (cada 10 min es suficiente para "infraestructura crítica")
setInterval(updateDashboardData, 600000);

/* =========================================================
   GRÃFICOS FINANCIEROS (REPORTE COMPLETO)
   ========================================================= */
async function initFinanceCharts() {
  // Gráfico inicializado por el template Jinja en home.html
}

document.addEventListener('DOMContentLoaded', () => {
  updateDashboardData();
  initFinanceCharts();
  updateAgentStatus(); // Inicializar monitor de hardware
});

/* =========================================================
   MONITOR DE INFRAESTRUCTURA CRÃTICA (AGENTE)
   ========================================================= */
function updateAgentStatus() {
  const pill = document.getElementById('agentStatusPill');
  const text = document.getElementById('agentStatusText');
  if (!pill || !text) return;

  async function check(silent = false) {
    let attempts = 0;
    const maxAttempts = 2; // Permitir un reintento si falla

    while (attempts < maxAttempts) {
      try {
        if (!silent && text && attempts === 0) text.textContent = 'Agente: Verificando...';
        const res = await fetch('/api/agent/health');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Limpiamos estilos inline
        pill.style.backgroundColor = '';
        pill.style.color = '';
        pill.style.border = '';

        if (data.alive) {
          if (data.mode === 'bridge') {
            pill.className = 'status-pill online bridge';
            text.textContent = 'Agente: Modo Nube';
            pill.title = 'El sistema está en Modo Bridge. El agente local sincroniza stock y facturas automáticamente.';
            sessionStorage.setItem('ln_agent_status', 'bridge');
          } else {
            pill.className = 'status-pill online';
            text.textContent = 'Agente: En Línea';
            pill.title = `Conectado a ${data.url} (Sync OK)`;
            sessionStorage.setItem('ln_agent_status', 'online');
          }
          return; // Ã‰xito, salir del loop
        } else {
          // Si el servidor respondió pero el agente está realmente vivo=false según el monitor
          pill.className = 'status-pill offline';
          text.textContent = 'Agente: Offline';
          pill.title = `Error: ${data.error || 'Desconectado'}.`;
          sessionStorage.setItem('ln_agent_status', 'offline');
          return;
        }
      } catch (e) {
        attempts++;
        if (attempts >= maxAttempts) {
          console.warn('Fallo definitivo de salud tras reintentos:', e);
          pill.className = 'status-pill offline';
          text.textContent = 'Agente: Error';
          pill.title = 'No se pudo contactar con el monitor de salud del sistema.';
          sessionStorage.setItem('ln_agent_status', 'offline');
        } else {
          // Esperar 1 segundo antes del reintento
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  }

  // Inicialización Inmediata desde Caché de Sesión
  const cachedStatus = sessionStorage.getItem('ln_agent_status');
  if (cachedStatus === 'online') {
    pill.className = 'status-pill online';
    text.textContent = 'Agente: En Línea';
  } else if (cachedStatus === 'bridge') {
    pill.className = 'status-pill online bridge';
    text.textContent = 'Agente: Modo Nube';
  }

  // Chequeo inicial (silencioso si hay caché) + Polling cada 15 segundos
  check(!!cachedStatus && cachedStatus !== 'offline');
  setInterval(() => check(true), 15000);

  // Click para reintento manual
  pill.onclick = () => {
    check(false);
  };
}

/* =========================================================
   BÃšSQUEDA GLOBAL INTELIGENTE
   ========================================================= */
document.addEventListener('DOMContentLoaded', function initGlobalSearch() {

  const searchInput = document.getElementById('globalSearchInput');
  const searchDropdown = document.getElementById('searchResultsDropdown');
  const searchContent = document.getElementById('searchResultsContent');

  if (!searchInput || !searchDropdown || !searchContent) {
    console.error('Global Search: Elements not found', { searchInput, searchDropdown, searchContent });
    return;
  }
  console.log('Global Search: Initialized successfully');

  let debounceTimer;

  // Debounce helper
  function debounce(fn, delay) {
    return function (...args) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // Abrir dropdown
  function openDropdown() {
    searchDropdown.classList.add('active');
  }

  // Cerrar dropdown
  function closeDropdown() {
    searchDropdown.classList.remove('active');
  }

  // Renderizar resultados
  function renderResults(data) {
    if (!data || (Object.keys(data).every(k => !data[k] || data[k].length === 0))) {
      searchContent.innerHTML = `
        <div class="search-placeholder">
          <i class="fas fa-search-minus"></i>
          <span>No se encontraron resultados</span>
        </div>
      `;
      return;
    }

    const categories = [
      { key: 'productos', icon: 'fa-box', label: 'Productos', type: 'product', urlBase: '/inventario/productos?search=' },
      { key: 'facturas', icon: 'fa-file-invoice', label: 'Facturas', type: 'invoice', urlBase: '/control-ventas?factura=' },
      { key: 'clientes', icon: 'fa-user', label: 'Clientes', type: 'client', urlBase: '/clientes?search=' },
      { key: 'proveedores', icon: 'fa-building', label: 'Proveedores', type: 'provider', urlBase: '/proveedores?search=' },
      { key: 'usuarios', icon: 'fa-users', label: 'Usuarios', type: 'user', urlBase: '/usuarios?search=' },
      { key: 'configuracion', icon: 'fa-cog', label: 'Configuración', type: 'config', urlBase: '' }
    ];

    let html = '';

    categories.forEach(cat => {
      const items = data[cat.key];
      if (!items || items.length === 0) return;

      html += `<div class="search-category">`;
      html += `<div class="search-category-title"><i class="fas ${cat.icon} me-1"></i> ${cat.label}</div>`;

      items.forEach(item => {
        let url = item.url ? item.url : (cat.urlBase + encodeURIComponent(item.codigo || item.id || item.nombre || ''));

        // Fix para facturas que usan ?factura=
        if (cat.key === 'facturas' && item.numero) {
          url = cat.urlBase + encodeURIComponent(item.numero);
        }

        html += `
          <a href="${url}" class="search-result-item">
            <div class="search-result-icon ${cat.type}">
              <i class="fas ${cat.icon}"></i>
            </div>
            <div class="search-result-info">
              <div class="search-result-name">${item.nombre || item.codigo || item.numero || 'Sin nombre'}</div>
              <div class="search-result-meta">${item.meta || ''}</div>
            </div>
          </a>
        `;
      });

      html += `</div>`;
    });

    searchContent.innerHTML = html;
  }

  // Ejecutar búsqueda
  async function executeSearch(query) {
    if (!query || query.length < 2) {
      searchContent.innerHTML = `
        <div class="search-placeholder">
          <i class="fas fa-search"></i>
          <span>Escribe al menos 2 caracteres...</span>
        </div>
      `;
      return;
    }

    searchContent.innerHTML = `
      <div class="search-placeholder">
        <i class="fas fa-circle-notch fa-spin"></i>
        <span>Buscando...</span>
      </div>
    `;
    openDropdown();

    try {
      const res = await fetch(`/api/global-search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      renderResults(data);
    } catch (err) {
      console.error('Error en búsqueda global:', err);
      searchContent.innerHTML = `
        <div class="search-placeholder">
          <i class="fas fa-exclamation-triangle"></i>
          <span>Error al buscar</span>
        </div>
      `;
    }
  }

  // Event Listeners
  const debouncedSearch = debounce(executeSearch, 300);

  /* Improved Input Handler */
  const handleInput = (e) => {
    const val = e.target ? e.target.value.trim() : searchInput.value.trim();
    if (val.length > 0) {
      searchDropdown.classList.add('active');
      searchDropdown.style.display = 'block';
    }
    debouncedSearch(val);
  };

  searchInput.addEventListener('input', handleInput);
  searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleInput(e);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length >= 2) {
      openDropdown();
    }
  });

  // Cerrar al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.global-search-wrapper')) {
      closeDropdown();
    }
  });

  // Atajo de teclado Ctrl+K
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }

    // Escape para cerrar
    if (e.key === 'Escape') {
      closeDropdown();
      searchInput.blur();
    }
  });
});

/* =========================================================
   PLAN START LIMIT INTERCEPTOR (Global)
   ========================================================= */
(function () {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    try {
      const response = await originalFetch(...args);

      // Si es error 403, verificar si es por límte del plan
      if (response.status === 403) {
        const clone = response.clone();
        try {
          const data = await clone.json();
          if (data.code === 'LIMIT_REACHED') {
            // Trigger Modal
            const modalEl = document.getElementById('upgradeModal');
            if (modalEl) {
              // Actualizar mensaje si viene del backend
              if (data.error || data.message) {
                const msgEl = document.getElementById('upgradeModalMessage');
                if (msgEl) msgEl.innerText = data.error || data.message;
              }

              // Usar Bootstrap API
              if (typeof bootstrap !== 'undefined') {
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
              }
            }
          }
        } catch (e) {
          // No es JSON o no tiene el formato esperado, ignorar
        }
      }
      return response;
    } catch (error) {
      throw error;
    }
  };
})();

/* =========================================================
   GLOBAL AGENT STATUS CHECKER
   ========================================================= */
(function () {
  const fetchWithTimeout = async (resource, options = {}) => {
    const { timeout = 5000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  };

  const updateGlobalStatus = (status, text) => {
    const pill = document.getElementById('agentStatusPill');
    const pillText = document.getElementById('agentStatusText');
    if (!pill || !pillText) return;

    pill.style.backgroundColor = '';
    pill.style.color = '';
    pill.style.borderColor = '';
    pill.title = text || '';

    if (status === 'online') {
      pill.style.backgroundColor = '#ecfdf5';
      pill.style.color = '#047857';
      pill.style.border = '1px solid #a7f3d0';
      pillText.innerText = 'Agente: Online';
    } else if (status === 'offline') {
      pill.style.backgroundColor = '#fef2f2';
      pill.style.color = '#b91c1c';
      pill.style.border = '1px solid #fecaca';
      pillText.innerText = 'Agente: Offline';
    } else if (status === 'sync') {
      pill.style.backgroundColor = '#eff6ff';
      pill.style.color = '#1d4ed8';
      pill.style.border = '1px solid #bfdbfe';
      pillText.innerText = 'Conectando...';
    }
  };

  const checkAgent = async () => {
    const url = localStorage.getItem('ln_agent_url');
    const mode = localStorage.getItem('ln_agent_mode');

    if (!url) return; // No config, no check

    // If on configuracion page, let the local script handle it to avoid double traffic
    if (window.location.pathname.includes('/configuracion')) return;

    updateGlobalStatus('sync', 'Verificando...');

    try {
      if (mode === 'proxy') {
        const proxyResp = await fetchWithTimeout('/configuracion/agente/proxy/diag', { timeout: 4000 });
        if (proxyResp.ok) {
          updateGlobalStatus('online', 'Conectado vía Puente');
          return;
        }
      } else {
        // Direct check
        let baseUrl = url.includes('/print') ? url.replace('/print', '') : url;
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

        try {
          const resp = await fetchWithTimeout(`${baseUrl}/diag`, { timeout: 2000 });
          if (resp.ok) {
            updateGlobalStatus('online', 'Conectado Local');
            return;
          }
        } catch (e) { /* Silent fail */ }

        // Fallback to proxy if direct fails, even if mode wasn't proxy
        const proxyResp = await fetchWithTimeout('/configuracion/agente/proxy/diag', { timeout: 4000 });
        if (proxyResp.ok) {
          updateGlobalStatus('online', 'Conectado vía Puente (Fallback)');
          localStorage.setItem('ln_agent_mode', 'proxy'); // Auto-switch
          return;
        }
      }
      throw new Error('All checks failed');
    } catch (e) {
      updateGlobalStatus('offline', 'Sin conexión con agente');
    }
  };

  // Run after a slight delay to prioritize main content loading
  setTimeout(checkAgent, 1500);
})();

