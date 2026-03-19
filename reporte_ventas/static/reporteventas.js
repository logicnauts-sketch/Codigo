/**
 * Reporte de Ventas - JavaScript Module v2.1
 * ===========================================
 * LN SYSTEMS - Módulo de supervisión operativa
 * Incluye: Tendencias, Comparativo, Drill-down, Exportación
 */

document.addEventListener('DOMContentLoaded', async function () {
    // =========================================
    // REFERENCIAS UI
    // =========================================
    const elements = {
        // Filtros
        period: document.getElementById('filter-period'),
        start: document.getElementById('date-start'),
        end: document.getElementById('date-end'),
        customRange: document.getElementById('custom-range'),
        origen: document.getElementById('filter-origen'),
        estado: document.getElementById('filter-estado'),
        applyBtn: document.getElementById('applyFilters'),

        // KPIs
        kTotal: document.getElementById('kpi-total'),
        kTicket: document.getElementById('kpi-ticket'),
        kCantidad: document.getElementById('kpi-cantidad'),
        kMargen: document.getElementById('kpi-margen'),
        kMargenPct: document.getElementById('kpi-margen-pct'),
        kEfectivo: document.getElementById('kpi-efectivo'),
        kEfectivoQty: document.getElementById('kpi-efectivo-qty'),
        kTarjeta: document.getElementById('kpi-tarjeta'),
        kTarjetaQty: document.getElementById('kpi-tarjeta-qty'),
        kTransfer: document.getElementById('kpi-transfer'),
        kTransferQty: document.getElementById('kpi-transfer-qty'),
        trend: document.getElementById('trend-box'),
        trendValue: document.getElementById('trend-value'),

        // Tabla
        body: document.getElementById('ventasBody'),

        // Gráficas
        topProductos: document.getElementById('topProductosList'),
        chartVentasHora: document.getElementById('chartVentasHora'),
        chartCanales: document.getElementById('chartCanales'),
        chartTendencia: document.getElementById('chartTendencia'),

        // Alertas
        alertBadge: document.getElementById('alertBadge'),
        alertCount: document.getElementById('alertCount'),
        alertsPanel: document.getElementById('alertsPanel'),
        alertsList: document.getElementById('alertsList'),

        // Acciones
        print: document.getElementById('printBtn'),
        btnComparativo: document.getElementById('btnComparar'),
        btnExport: document.getElementById('btnExport'),

        // Insights Contextualizados
        insightMejorDia: document.getElementById('insight-mejor-dia'),
        insightMejorFecha: document.getElementById('insight-mejor-fecha'),
        insightPeorDia: document.getElementById('insight-peor-dia'),
        insightPeorFecha: document.getElementById('insight-peor-fecha'),
        insightPromedioDiario: document.getElementById('insight-promedio-diario')
    };

    // Charts
    let chartHora = null;
    let chartCanales = null;
    let chartTendencia = null;
    let chartComparativo = null;
    let currentTrendType = 'semanal';

    // =========================================
    // UTILIDADES
    // =========================================
    function formatCurrency(val) {
        return 'RD$ ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(val || 0);
    }

    function getThemeColors() {
        const isDark = document.documentElement.classList.contains('dark-theme');
        return {
            text: isDark ? '#f1f5f9' : '#0f172a',
            muted: isDark ? '#94a3b8' : '#64748b',
            grid: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
        };
    }

    function getFilterParams() {
        const period = elements.period ? elements.period.value : 'mes';
        const params = new URLSearchParams({ period });

        if (period === 'personalizado' && elements.start && elements.end) {
            params.append('start_date', elements.start.value);
            params.append('end_date', elements.end.value);
        }
        
        if (elements.origen && elements.origen.value) params.append('origen', elements.origen.value);
        if (elements.estado && elements.estado.value) params.append('estado', elements.estado.value);

        return params.toString();
    }

    // =========================================
    // CARGA DE DATOS PRINCIPAL
    // =========================================
    async function loadDashboard() {
        const params = getFilterParams();

        // Actualizar fecha de impresión
        if (elements.pDate) {
            elements.pDate.textContent = new Date().toLocaleDateString();
        }

        try {
            // Carga prioritaria secuencial
            await loadKPIs(params);
            await loadVentas();

            // Carga escalonada (Staggered) para no saturar al servidor y permitir Heartbeats
            setTimeout(() => loadChartHora(params), 100);
            setTimeout(() => loadTopProductos(params), 300);
            setTimeout(() => loadAlertas(), 700);
            setTimeout(() => loadTrendChart(currentTrendType), 1000);

        } catch (e) {
            console.error('Error cargando dashboard:', e);
        }
    }

    // =========================================
    // KPIs
    // =========================================
    async function loadKPIs(params) {
        try {
            const res = await fetch(`/reporteventas/api/kpis?${params}`);
            const data = await res.json();

            if (!data.ok) throw new Error(data.error || 'Error desconocido');

            const t = data.totales || {};
            const m = data.por_metodo || {};
            const v = data.variacion || {};

            // Helper para actualizar texto de forma segura
            const safeSet = (el, val) => { if (el) el.textContent = val; };

            // Totales principales
            safeSet(elements.kTotal, formatCurrency(t.ventas));
            safeSet(elements.kTicket, formatCurrency(t.ticket_promedio));
            safeSet(elements.kCantidad, (t.cantidad || 0) + ' transacciones');
            safeSet(elements.kMargen, formatCurrency(t.margen_estimado));
            safeSet(elements.kMargenPct, (t.margen_porcentaje || 0) + '% del total');

            // Por método de pago
            if (m.efectivo) {
                safeSet(elements.kEfectivo, formatCurrency(m.efectivo.total));
                safeSet(elements.kEfectivoQty, m.efectivo.cantidad + ' ventas');
            }
            if (m.tarjeta) {
                safeSet(elements.kTarjeta, formatCurrency(m.tarjeta.total));
                safeSet(elements.kTarjetaQty, m.tarjeta.cantidad + ' ventas');
            }
            if (m.transferencia) {
                safeSet(elements.kTransfer, formatCurrency(m.transferencia.total));
                safeSet(elements.kTransferQty, m.transferencia.cantidad + ' ventas');
            }

            // Tendencia
            if (elements.trend && v.porcentaje !== undefined) {
                const isUp = v.direccion === 'up';
                elements.trend.className = 'kpi-trend ' + (isUp ? 'text-success' : 'text-danger');
                safeSet(elements.trendValue, (isUp ? '+' : '') + v.porcentaje + '%');
                const icon = elements.trend.querySelector('i');
                if (icon) icon.className = 'fas fa-arrow-' + (isUp ? 'up' : 'down');
            }

            // Actualizar gráficas (independientes del éxito de los KPIs)
            try {
                if (data.por_origen) updateChartCanales(data.por_origen);
            } catch (errChart) {
                console.error('Error renderizando gráfico canales:', errChart);
            }

            // Actualizar Insights
            if (data.insights) {
                const ins = data.insights;
                safeSet(elements.insightMejorDia, formatCurrency(ins.mejor.total));
                safeSet(elements.insightMejorFecha, ins.mejor.dia);
                safeSet(elements.insightPeorDia, formatCurrency(ins.peor.total));
                safeSet(elements.insightPeorFecha, ins.peor.dia);
                safeSet(elements.insightPromedioDiario, formatCurrency(ins.promedio));
            }

            if (data.metas) {
                updateGoalsWidget(data.metas);
            }

        } catch (e) {
            console.error('Error crítico en loadKPIs:', e);
        }
    }

    // =========================================
    // METAS (Fase 3)
    // =========================================
    function updateGoalsWidget(metas) {
        const banner = document.getElementById('goalsBanner');
        if (!banner) return;

        if (!metas.has_meta) {
            console.log("Ocultando banner de metas: No hay meta activa.");
            banner.style.display = 'none';
            return;
        }

        banner.style.display = 'flex';

        const pct = metas.porcentaje;
        const bar = document.getElementById('goalBar');
        const pctText = document.getElementById('goalPercent');
        const statusText = document.getElementById('goalStatusText');
        const projectionText = document.getElementById('goalProjectionText');
        const healthChip = document.getElementById('goalHealth');

        if (bar) {
            bar.style.width = Math.min(pct, 100) + '%';
            if (pct < 50) bar.style.backgroundColor = 'var(--cv-danger)';
            else if (pct < 80) bar.style.backgroundColor = 'var(--cv-warning)';
            else bar.style.backgroundColor = 'var(--cv-success)';
        }

        if (pctText) pctText.textContent = pct + '%';
        if (statusText) statusText.textContent = `Progreso: ${formatCurrency(metas.actual)} / ${formatCurrency(metas.monto_objetivo)}`;
        if (projectionText) projectionText.textContent = `Proyección cierre: ${formatCurrency(metas.proyeccion)}`;

        // Salud de la meta
        if (healthChip) {
            const hoy = new Date().getDate();
            const ultimoDia = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
            const pctEsperado = (hoy / ultimoDia) * 100;

            if (pct >= pctEsperado) {
                healthChip.className = 'goal-indicator-chip success';
                healthChip.querySelector('span').textContent = 'Salud: Óptima';
            } else if (pct >= pctEsperado * 0.8) {
                healthChip.className = 'goal-indicator-chip warning';
                healthChip.querySelector('span').textContent = 'Salud: Alerta';
            } else {
                healthChip.className = 'goal-indicator-chip danger';
                healthChip.querySelector('span').textContent = 'Salud: Crítica';
            }
        }
    }

    async function configurarMeta() {
        const goalStatus = document.getElementById('goalStatusText')?.textContent || '';
        let montoActual = "No establecida";
        if (goalStatus.includes('/')) {
            montoActual = goalStatus.split('/')[1].trim();
        }

        const { value: monto } = await Swal.fire({
            title: '<i class="fas fa-bullseye" style="color:var(--cv-primary); margin-right:10px;"></i>Meta de Ventas',
            html: `
                <div class="swal-custom-content" style="text-align: left; font-family: inherit;">
                    <p style="color: var(--cv-text-muted); font-size: 0.95em; margin-bottom: 20px;">
                        Establece el objetivo de facturación para este mes. El sistema calculará la salud de tu negocio basándose en este valor.
                    </p>
                    
                    <div style="background: var(--cv-bg-elevated); padding: 12px 16px; border-radius: 12px; margin-bottom: 24px; border: 1px solid var(--cv-border); display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(99, 102, 241, 0.1); display: flex; align-items: center; justify-content: center; color: var(--cv-primary);">
                            <i class="fas fa-flag-checkered"></i>
                        </div>
                        <div>
                            <small style="color: var(--cv-text-dim); display: block; font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.5px;">Meta Actual</small>
                            <span style="font-weight: 700; color: var(--cv-text); font-size: 1.1em;">${montoActual}</span>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 15px; color: var(--cv-text); font-size: 0.9em;">Nuevo Monto Objetivo (RD$)</label>
                        <input type="number" id="swal-input-monto" class="swal2-input" placeholder="Ej: 1,500,000" 
                               style="width: 100%; margin: 0; border-radius: 12px; border: 2px solid var(--cv-border); font-size: 1.4em; padding: 20px 15px; font-weight: 700; color: var(--cv-primary);">
                    </div>

                    <div class="quick-targets" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                        <button type="button" class="btn-quick" onclick="document.getElementById('swal-input-monto').value=500000" 
                                style="background: var(--cv-bg-elevated); border: 1px solid var(--cv-border); padding: 10px; border-radius: 10px; font-size: 0.85em; cursor: pointer; color: var(--cv-text); font-weight: 500; transition: all 0.2s;">500k</button>
                        <button type="button" class="btn-quick" onclick="document.getElementById('swal-input-monto').value=1000000" 
                                style="background: var(--cv-bg-elevated); border: 1px solid var(--cv-border); padding: 10px; border-radius: 10px; font-size: 0.85em; cursor: pointer; color: var(--cv-text); font-weight: 500; transition: all 0.2s;">1M</button>
                        <button type="button" class="btn-quick" onclick="document.getElementById('swal-input-monto').value=2000000" 
                                style="background: var(--cv-bg-elevated); border: 1px solid var(--cv-border); padding: 10px; border-radius: 10px; font-size: 0.85em; cursor: pointer; color: var(--cv-text); font-weight: 500; transition: all 0.2s;">2M</button>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Confirmar Meta',
            cancelButtonText: 'Cancelar',
            reverseButtons: true,
            customClass: {
                popup: 'cv-swal-popup',
                confirmButton: 'cv-swal-confirm',
                cancelButton: 'cv-swal-cancel'
            },
            preConfirm: () => {
                const val = document.getElementById('swal-input-monto').value;
                if (!val || val <= 0) {
                    Swal.showValidationMessage('Por favor ingresa un monto mayor a cero');
                    return false;
                }
                return val;
            },
            didOpen: () => {
                const input = document.getElementById('swal-input-monto');
                input.focus();
            }
        });

        if (monto) {
            try {
                const res = await fetch('/reporteventas/api/metas/configurar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ monto })
                });
                const data = await res.json();
                if (data.ok) {
                    Swal.fire({
                        title: '¡Meta Establecida!',
                        text: 'El dashboard se actualizará con los nuevos objetivos.',
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false,
                        customClass: { popup: 'cv-swal-popup' }
                    });
                    loadDashboard();
                } else {
                    Swal.fire('Error', data.error || 'No se pudo guardar la meta', 'error');
                }
            } catch (e) {
                Swal.fire('Error', 'Fallo de conexión con el servidor', 'error');
            }
        }
    }

    // =========================================
    // LISTA DE VENTAS
    // =========================================
    async function loadVentas() {
        const params = getFilterParams();

        if (elements.body) {
            elements.body.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center">
                        <div class="loading-state">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Sincronizando datos...</span>
                        </div>
                    </td>
                </tr>
            `;
        }

        try {
            const res = await fetch(`/reporteventas/api/lista?${params}`);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const ventas = await res.json();
            renderTable(Array.isArray(ventas) ? ventas : []);
        } catch (e) {
            console.error('Error cargando ventas:', e);
            if (elements.body) {
                elements.body.innerHTML = `
                    <tr>
                        <td colspan="9" class="text-center" style="padding: 30px; color: #94a3b8;">
                            <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                            No se pudieron cargar las transacciones
                        </td>
                    </tr>
                `;
            }
        }
    }

    // Exponer globalmente para el onclick legacy
    window.loadVentas = loadVentas;

    function renderTable(ventas) {
        if (!elements.body) return;

        if (ventas.length === 0) {
            elements.body.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <p>No hay ventas para el filtro seleccionado</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        elements.body.innerHTML = ventas.map(v => {
            // Asegurar que existan todos los campos para evitar TypeErrors
            const estado = v.estado || 'COMPLETADA';
            const origen = v.origen || 'POS';
            const doc_label = v.doc_label || 'VENTA';
            const cliente = v.cliente || 'Consumidor Final';
            const id = v.id || '---';
            const total = v.total || 0;
            const metodo = v.metodo_pago || 'EFECTIVO';
            const usuario = v.usuario || 'SISTEMA';
            const fecha_disp = v.fecha_display || '---';

            const origenIcon = {
                'POS': 'cash-register',
                'DELIVERY': 'motorcycle',
                'MESA': 'utensils',
                'TRABAJO': 'tools',
                'MANUAL': 'edit'
            }[origen.toUpperCase()] || 'store';

            const estadoClass = estado.toLowerCase();

            return `
            <tr class="${estadoClass === 'anulada' ? 'row-anulada' : ''}" onclick="drillIntoDay('${v.fecha_raw || ''}')" style="cursor:pointer;">
                <td data-label="Documento">
                    <div class="doc-cell">
                        <span class="doc-ncf">${doc_label}</span>
                        <span class="doc-id">#${id}</span>
                    </div>
                </td>
                <td data-label="Fecha/Hora">${fecha_disp}</td>
                <td data-label="Canal">
                    <span class="origen-badge origen-${origen.toLowerCase()}">
                        <i class="fas fa-${origenIcon}"></i> ${origen}
                    </span>
                </td>
                <td data-label="Cliente">${cliente}</td>
                <td data-label="Método" class="text-uppercase">${metodo}</td>
                <td data-label="Responsable">${usuario}</td>
                <td data-label="Estado">
                    <span class="badge-cv badge-${estadoClass}">${estado}</span>
                </td>
                <td data-label="Total" class="text-right font-mono">${formatCurrency(total)}</td>
                <td data-label="Acciones" class="no-print text-center" onclick="event.stopPropagation();">
                    <div class="action-group">
                        <button class="action-btn small" onclick="verDetalle(${v.id})" title="Ver Detalle">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn small" onclick="verFactura(${v.id})" title="Ver Factura PDF">
                            <i class="fas fa-file-pdf"></i>
                        </button>
                        ${estadoClass !== 'anulada' ? `
                            <button class="action-btn small danger" onclick="triggerAnular(${v.id}, '${v.doc_label}')" title="Anular">
                                <i class="fas fa-ban"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `}).join('');
    }

    // =========================================
    // GRÁFICAS
    // =========================================
    async function loadChartHora(params) {
        try {
            const res = await fetch(`/reporteventas/api/ventas-hora?${params}`);
            const data = await res.json();

            const labels = data.map(d => d.label);
            const values = data.map(d => d.total);

            const ctx = document.getElementById('chartVentasHora');
            if (!ctx) return;

            if (chartHora) chartHora.destroy();

            const theme = getThemeColors();

            chartHora = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Ventas',
                        data: values,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointBackgroundColor: '#6366f1'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: theme.grid },
                            ticks: {
                                color: theme.muted,
                                callback: v => 'RD$' + (v / 1000).toFixed(0) + 'k'
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: theme.muted }
                        }
                    }
                }
            });
        } catch (e) {
            console.error('Error chart hora:', e);
        }
    }

    function updateChartCanales(porOrigen) {
        const ctx = document.getElementById('chartCanales');
        if (!ctx) return;

        const labels = Object.keys(porOrigen).filter(k => porOrigen[k].total > 0);
        const values = labels.map(k => porOrigen[k].total);
        const canalColors = {
            'POS': '#10b981',
            'DELIVERY': '#f59e0b',
            'MESA': '#3b82f6',
            'TRABAJO': '#8b5cf6',
            'MANUAL': '#64748b'
        };

        if (chartCanales) chartCanales.destroy();

        if (values.length === 0) {
            // No destruir el canvas, solo mostrar un log o manejarlo visualmente sin romper el DOM
            console.log("updateChartCanales: Sin datos para mostrar");
            return;
        }

        const theme = getThemeColors();

        chartCanales = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: labels.map(l => canalColors[l] || '#64748b'),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            color: theme.text
                        }
                    }
                }
            }
        });
    }

    // =========================================
    // TENDENCIAS
    // =========================================
    async function loadTrendChart(tipo = 'semanal') {
        currentTrendType = tipo;

        try {
            const params = getFilterParams();
            let url;
            if (tipo === 'semanal') {
                url = `/reporteventas/api/tendencia-semanal?${params}`;
            } else if (tipo === 'mensual') {
                url = `/reporteventas/api/tendencia-mensual?${params}`;
            } else if (tipo === 'dia-semana') {
                url = `/reporteventas/api/analisis-dias?${params}`;
            }

            const res = await fetch(url);
            const data = await res.json();

            const ctx = document.getElementById('chartTendencia');
            if (!ctx) return;

            if (chartTendencia) chartTendencia.destroy();

            // Manejo de datos vacíos
            if (!data || data.length === 0) {
                if (elements.insightMejor) elements.insightMejor.textContent = '---';
                if (elements.insightPeor) elements.insightPeor.textContent = '---';
                if (elements.insightPromedio) elements.insightPromedio.textContent = formatCurrency(0);
                
                chartTendencia = new Chart(ctx, {
                    type: 'line',
                    data: { labels: ['Sin datos'], datasets: [{ label: 'Ventas', data: [0] }] }
                });
                return;
            }

            const labels = data.map(d => d.label || d.dia || '---');
            const values = data.map(d => d.total || d.ventas || 0);

            // Calcular insights con seguridad
            const max = Math.max(...values);
            const min = Math.min(...values);
            const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

            const maxIdx = values.indexOf(max);
            const minIdx = values.indexOf(min);

            if (elements.insightMejorDia) {
                elements.insightMejorDia.textContent = labels[maxIdx] || 'N/A';
            }
            if (elements.insightMejorFecha) {
                elements.insightMejorFecha.textContent = formatCurrency(max);
            }
            if (elements.insightPeorDia) {
                elements.insightPeorDia.textContent = labels[minIdx] || 'N/A';
            }
            if (elements.insightPeorFecha) {
                elements.insightPeorFecha.textContent = formatCurrency(min);
            }
            if (elements.insightPromedioDiario) {
                elements.insightPromedioDiario.textContent = formatCurrency(avg);
            }

            const theme = getThemeColors();

            chartTendencia = new Chart(ctx, {
                type: tipo === 'dia-semana' ? 'bar' : 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Ventas',
                        data: values,
                        borderColor: '#10b981',
                        backgroundColor: tipo === 'dia-semana'
                            ? 'rgba(16, 185, 129, 0.7)'
                            : 'rgba(16, 185, 129, 0.1)',
                        fill: tipo !== 'dia-semana',
                        tension: 0.4,
                        borderRadius: tipo === 'dia-semana' ? 8 : 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            suggestedMax: max > 0 ? max * 1.2 : 100,
                            grid: { color: theme.grid },
                            ticks: {
                                color: theme.muted,
                                callback: function(v) {
                                    if (max < 1000) return 'RD$ ' + v;
                                    return 'RD$ ' + (v / 1000).toFixed(1) + 'k';
                                }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: theme.muted }
                        }
                    }
                }
            });

        } catch (e) {
            console.error('Error chart tendencia:', e);
        }
    }

    // Tabs de tendencias
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            loadTrendChart(this.dataset.trend);
        });
    });

    // =========================================
    // TOP PRODUCTOS
    // =========================================
    async function loadTopProductos(params) {
        try {
            const res = await fetch(`/reporteventas/api/top-productos?${params}&limit=5`);
            const productos = await res.json();

            if (productos.length === 0) {
                elements.topProductos.innerHTML = '<div class="empty-list">Sin datos</div>';
                return;
            }

            elements.topProductos.innerHTML = productos.map((p, i) => `
                <div class="top-item">
                    <div class="top-rank">${i + 1}</div>
                    <div class="top-info">
                        <div class="top-name">${p.nombre}</div>
                        <div class="top-qty">${p.cantidad} vendidos</div>
                    </div>
                    <div class="top-value">${formatCurrency(p.total)}</div>
                </div>
            `).join('');
        } catch (e) {
            console.error('Error top productos:', e);
        }
    }


    // =========================================
    // ALERTAS
    // =========================================
    async function loadAlertas() {
        try {
            const res = await fetch('/reporteventas/api/alertas');
            const alertas = await res.json();

            if (!alertas || alertas.length === 0) {
                if (elements.alertBadge) elements.alertBadge.style.display = 'none';
                if (elements.alertsPanel) elements.alertsPanel.style.display = 'none';
                return;
            }

            if (elements.alertBadge) elements.alertBadge.style.display = 'flex';
            if (elements.alertCount) elements.alertCount.textContent = alertas.length;
            if (elements.alertsPanel) elements.alertsPanel.style.display = 'block';

            if (elements.alertsList) {
                elements.alertsList.innerHTML = alertas.map(a => `
                    <div class="alert-item alert-${a.tipo || 'info'}" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #fff; border-radius: 12px; border: 1px solid var(--border-subtle); margin-bottom: 8px;">
                        <div class="alert-icon" style="width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: ${a.tipo === 'danger' ? 'rgba(239,68,68,0.1)' : a.tipo === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)'}; color: ${a.tipo === 'danger' ? '#ef4444' : a.tipo === 'warning' ? '#f59e0b' : '#6366f1'};">
                            <i class="fas fa-${a.icon || 'exclamation-circle'}"></i>
                        </div>
                        <div class="alert-content" style="flex: 1;">
                            <div class="alert-msg" style="font-weight: 600; font-size: 0.85rem;">${a.mensaje}</div>
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) {
            console.error('Error alertas:', e);
        }
    }

    window.dismissAlert = async function (id) {
        await fetch(`/reporteventas/api/alertas/marcar-leida/${id}`, { method: 'POST' });
        loadAlertas();
    };

    // =========================================
    // COMPARATIVO DE PERÍODOS
    // =========================================
    function openComparativo() {
        const modal = document.getElementById('modalComparativo');
        if (!modal) {
            Swal.fire({
                icon: 'info',
                title: 'Próximamente',
                text: 'La función de comparación de períodos estará disponible pronto.',
                timer: 2500,
                showConfirmButton: false
            });
            return;
        }
        modal.classList.add('active');

        // Pre-configurar fechas por defecto
        const today = new Date();
        const lastWeekEnd = new Date(today);
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - 7);

        const prevWeekEnd = new Date(lastWeekStart);
        prevWeekEnd.setDate(lastWeekStart.getDate() - 1);
        const prevWeekStart = new Date(prevWeekEnd);
        prevWeekStart.setDate(prevWeekEnd.getDate() - 6);

        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal('comp-inicio-1', lastWeekStart.toISOString().split('T')[0]);
        setVal('comp-fin-1', lastWeekEnd.toISOString().split('T')[0]);
        setVal('comp-inicio-2', prevWeekStart.toISOString().split('T')[0]);
        setVal('comp-fin-2', prevWeekEnd.toISOString().split('T')[0]);
    }

    window.closeModal = function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    };

    window.cerrarComparativo = function () {
        closeModal('modalComparativo');
    };

    window.ejecutarComparativo = async function () {
        const inicio_1 = document.getElementById('comp-inicio-1')?.value;
        const fin_1 = document.getElementById('comp-fin-1')?.value;
        const inicio_2 = document.getElementById('comp-inicio-2')?.value;
        const fin_2 = document.getElementById('comp-fin-2')?.value;

        if (!inicio_1 || !fin_1 || !inicio_2 || !fin_2) {
            Swal.fire('Error', 'Complete todas las fechas', 'warning');
            return;
        }

        try {
            const res = await fetch('/reporteventas/api/comparar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inicio_1, fin_1, inicio_2, fin_2 })
            });
            const data = await res.json();

            if (!data.ok) throw new Error(data.error);

            // Mostrar resultados
            const resultContainer = document.getElementById('comparativo-resultado');
            if (resultContainer) resultContainer.style.display = 'block';

            const p1 = data.periodo_1;
            const p2 = data.periodo_2;
            const comp = data.comparacion;

            document.getElementById('comp-total-1').textContent = formatCurrency(p1.totales.ventas);
            document.getElementById('comp-qty-1').textContent = `${p1.totales.cantidad} ventas`;
            document.getElementById('comp-total-2').textContent = formatCurrency(p2.totales.ventas);
            document.getElementById('comp-qty-2').textContent = `${p2.totales.cantidad} ventas`;

            const diffPct = document.getElementById('comp-diff-pct');
            diffPct.textContent = `${comp.diferencia_porcentaje > 0 ? '+' : ''}${comp.diferencia_porcentaje.toFixed(1)}%`;
            diffPct.className = `diff-pct ${comp.diferencia_porcentaje >= 0 ? 'positive' : 'negative'}`;

            document.getElementById('comp-diff-abs').textContent = formatCurrency(Math.abs(comp.diferencia_absoluta));

            // Gráfica comparativa
            const ctx = document.getElementById('chartComparativo');
            if (chartComparativo) chartComparativo.destroy();

            chartComparativo = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Período 1', 'Período 2'],
                    datasets: [{
                        label: 'Total Ventas',
                        data: [p1.totales.ventas, p2.totales.ventas],
                        backgroundColor: ['rgba(99, 102, 241, 0.7)', 'rgba(16, 185, 129, 0.7)'],
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: v => 'RD$' + (v / 1000).toFixed(0) + 'k'
                            }
                        }
                    }
                }
            });

        } catch (e) {
            Swal.fire('Error', e.message || 'Error al comparar', 'error');
        }
    };

    if (elements.btnComparativo) {
        elements.btnComparativo.addEventListener('click', openComparativo);
    }

    document.getElementById('btnEjecutarComparativo')?.addEventListener('click', ejecutarComparativo);

    // =========================================
    // DRILL-DOWN
    // =========================================
    window.drillIntoKPI = async function (tipo) {
        try {
            const params = getFilterParams();
            const res = await fetch(`/reporteventas/api/drill/kpi/${tipo}?${params}`);
            const data = await res.json();

            if (!data.ok) throw new Error(data.error);

            document.getElementById('drillTitle').textContent = data.titulo;

            let content = '';

            if (tipo === 'total') {
                content = `
                    <div class="drill-summary">
                        <div class="drill-kpi-big">${formatCurrency(data.kpi_principal.ventas)}</div>
                        <div class="drill-kpi-sub">${data.kpi_principal.cantidad} transacciones</div>
                    </div>
                    <div class="drill-chart">
                        <canvas id="drillChart" style="height: 300px;"></canvas>
                    </div>
                `;
            } else if (tipo === 'metodo') {
                const metodos = data.data;
                content = `
                    <div class="drill-list">
                        ${Object.entries(metodos).map(([k, v]) => `
                            <div class="drill-list-item">
                                <span class="drill-label">${k.toUpperCase()}</span>
                                <span class="drill-value">${formatCurrency(v.total)}</span>
                                <span class="drill-qty">${v.cantidad} ventas</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else if (tipo === 'origen') {
                const origenes = data.data;
                content = `
                    <div class="drill-list">
                        ${Object.entries(origenes).filter(([k, v]) => v.total > 0).map(([k, v]) => `
                            <div class="drill-list-item">
                                <span class="drill-label">${k}</span>
                                <span class="drill-value">${formatCurrency(v.total)}</span>
                                <span class="drill-qty">${v.cantidad} ventas</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else if (tipo === 'margen') {
                const pct = data.margen_porcentaje;
                content = `
                    <div class="drill-margen">
                        <div class="margen-gauge">
                            <div class="gauge-value">${pct}%</div>
                            <div class="gauge-bar">
                                <div class="gauge-fill" style="width: ${Math.min(pct, 100)}%"></div>
                            </div>
                        </div>
                        <div class="margen-details">
                            <div class="margen-item">
                                <span>Total Ventas:</span>
                                <span>${formatCurrency(data.total_ventas)}</span>
                            </div>
                            <div class="margen-item">
                                <span>Margen Estimado:</span>
                                <span>${formatCurrency(data.margen_estimado)}</span>
                            </div>
                        </div>
                    </div>
                `;
            }

            document.getElementById('drillBody').innerHTML = content;
            document.getElementById('modalDrill').classList.add('active');

            // Si hay gráfica
            if (tipo === 'total' && data.desglose) {
                setTimeout(() => {
                    const ctx = document.getElementById('drillChart');
                    new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: data.desglose.map(d => d.label),
                            datasets: [{
                                data: data.desglose.map(d => d.total),
                                borderColor: '#6366f1',
                                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                fill: true,
                                tension: 0.4
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } }
                        }
                    });
                }, 100);
            }

        } catch (e) {
            Swal.fire('Error', e.message || 'Error al cargar detalle', 'error');
        }
    };

    window.drillIntoDay = async function (fecha) {
        if (!fecha) return;

        try {
            const res = await fetch(`/reporteventas/api/drill/dia/${fecha}`);
            const data = await res.json();

            if (!data.ok) throw new Error(data.error);

            document.getElementById('drillTitle').textContent = data.fecha_display;

            document.getElementById('drillBody').innerHTML = `
                <div class="drill-day-summary">
                    <div class="day-kpi">
                        <div class="day-kpi-label">Total del Día</div>
                        <div class="day-kpi-value">${formatCurrency(data.resumen.ventas)}</div>
                        <div class="day-kpi-sub">${data.resumen.cantidad} ventas</div>
                    </div>
                </div>
                <div class="drill-chart">
                    <h4>Ventas por Hora</h4>
                    <canvas id="drillChartHora" style="height: 200px;"></canvas>
                </div>
                <div class="drill-ventas-list">
                    <h4>Transacciones del Día</h4>
                    <div class="mini-ventas">
                        ${data.ventas.slice(0, 20).map(v => `
                            <div class="mini-venta-item">
                                <span class="mv-doc">${v.doc_label}</span>
                                <span class="mv-hora">${v.fecha_display}</span>
                                <span class="mv-total">${formatCurrency(v.total)}</span>
                            </div>
                        `).join('') || '<p>No hay transacciones</p>'}
                    </div>
                </div>
            `;

            document.getElementById('modalDrill').classList.add('active');

            // Gráfica de hora
            setTimeout(() => {
                const ctx = document.getElementById('drillChartHora');
                if (ctx && data.ventas_hora) {
                    new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: data.ventas_hora.map(h => h.label),
                            datasets: [{
                                data: data.ventas_hora.map(h => h.total),
                                backgroundColor: 'rgba(99, 102, 241, 0.7)',
                                borderRadius: 4
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } }
                        }
                    });
                }
            }, 100);

        } catch (e) {
            console.error('Error drill día:', e);
        }
    };

    window.closeDrill = function () {
        document.getElementById('modalDrill').classList.remove('active');
    };

    // Click en KPIs para drill-down
    document.querySelectorAll('.cv-kpi-card.clickable').forEach(card => {
        card.addEventListener('click', function () {
            const drillType = this.dataset.drill;
            if (drillType) {
                drillIntoKPI(drillType);
            }
        });
    });

    // =========================================
    // EXPORTACIÓN
    // =========================================
    async function exportToExcel() {
        const params = getFilterParams();

        Swal.fire({
            title: 'Generando Excel...',
            text: 'Por favor espere',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const response = await fetch(`/reporteventas/api/export/excel?${params}`);

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Error al generar Excel');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = response.headers.get('Content-Disposition')?.split('filename=')[1] || 'control_ventas.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            Swal.fire({
                icon: 'success',
                title: 'Excel Generado',
                text: 'El archivo se ha descargado',
                timer: 2000,
                showConfirmButton: false
            });

        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    }

    if (elements.exportExcel) {
        elements.exportExcel.addEventListener('click', exportToExcel);
    }

    // =========================================
    // ACCIONES GLOBALES
    // =========================================
    window.verDetalle = async function (id) {
        try {
            const res = await fetch(`/reporteventas/api/detalle/${id}`);
            const data = await res.json();

            if (!data.ok) {
                Swal.fire('Error', data.error, 'error');
                return;
            }

            const f = data.factura;
            const detalles = data.detalles;

            document.getElementById('modalDetalleBody').innerHTML = `
                <div class="detalle-header">
                    <div class="detalle-doc">
                        <h4>${f.ncf || f.numero_factura || 'FAC-' + f.id}</h4>
                        <span class="badge-cv badge-${f.estado.toLowerCase()}">${f.estado}</span>
                    </div>
                    <div class="detalle-meta">
                        <p><strong>Fecha:</strong> ${new Date(f.fecha).toLocaleString()}</p>
                        <p><strong>Cliente:</strong> ${f.cliente_nombre || 'Consumidor Final'}</p>
                        <p><strong>Cajero:</strong> ${f.usuario_nombre || 'N/A'}</p>
                        <p><strong>Método:</strong> ${f.metodo_pago}</p>
                    </div>
                </div>
                
                <div class="detalle-productos">
                    <h5>Productos/Servicios</h5>
                    <table class="mini-table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th class="text-right">Cant.</th>
                                <th class="text-right">Precio</th>
                                <th class="text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${detalles.map(d => `
                                <tr>
                                    <td>${d.producto_nombre || 'Producto #' + d.producto_id}</td>
                                    <td class="text-right">${d.cantidad}</td>
                                    <td class="text-right">${formatCurrency(d.precio_unitario)}</td>
                                    <td class="text-right">${formatCurrency(d.subtotal)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3" class="text-right"><strong>Subtotal:</strong></td>
                                <td class="text-right">${formatCurrency(f.subtotal)}</td>
                            </tr>
                            <tr>
                                <td colspan="3" class="text-right"><strong>ITBIS:</strong></td>
                                <td class="text-right">${formatCurrency(f.itbis)}</td>
                            </tr>
                            <tr class="total-row">
                                <td colspan="3" class="text-right"><strong>TOTAL:</strong></td>
                                <td class="text-right"><strong>${formatCurrency(f.total)}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                
                ${data.historial.length > 0 ? `
                    <div class="detalle-historial">
                        <h5><i class="fas fa-history"></i> Historial de Auditoría</h5>
                        <div class="historial-list">
                            ${data.historial.map(h => `
                                <div class="historial-item">
                                    <span class="historial-action">${h.accion}</span>
                                    <span class="historial-user">${h.usuario || 'Sistema'}</span>
                                    <span class="historial-time">${h.fecha}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            `;

            document.getElementById('modalDetalle').classList.add('active');
        } catch (e) {
            Swal.fire('Error', 'No se pudo cargar el detalle', 'error');
        }
    };

    window.cerrarModal = function () {
        document.getElementById('modalDetalle').classList.remove('active');
    };

    window.imprimirDetalle = function () {
        window.print();
    };

    window.verFactura = function (id) {
        window.open(`/facturacion/api/facturas/${id}/pdf`, '_blank');
    };

    window.triggerAnular = function (id, label) {
        Swal.fire({
            title: '¿Anular Venta?',
            html: `
                <p>Esta acción anulará la venta <strong>${label}</strong>.</p>
                <p class="text-sm text-muted">Se revertirá el inventario y se registrará en auditoría.</p>
            `,
            icon: 'warning',
            input: 'text',
            inputPlaceholder: 'Motivo de anulación (requerido)',
            inputValidator: (value) => {
                if (!value) return 'Debes indicar el motivo de la anulación';
            },
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Sí, Anular',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch('/reporteventas/api/anular', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, motivo: result.value })
                    });
                    const data = await res.json();

                    if (data.ok) {
                        Swal.fire({
                            title: 'Anulada',
                            text: data.msg,
                            icon: 'success'
                        });
                        loadDashboard();
                    } else {
                        Swal.fire('Error', data.error, 'error');
                    }
                } catch (e) {
                    Swal.fire('Error', 'Error de conexión', 'error');
                }
            }
        });
    };

    // =========================================
    // EVENT LISTENERS
    // =========================================
    if (elements.period) {
        elements.period.addEventListener('change', () => {
            if (elements.customRange) {
                elements.customRange.style.display = elements.period.value === 'personalizado' ? 'flex' : 'none';
            }
            if (elements.period.value !== 'personalizado') {
                loadDashboard();
            }
        });
    }

    if (elements.applyBtn) elements.applyBtn.addEventListener('click', loadDashboard);

    if (elements.btnComparativo) {
        elements.btnComparativo.addEventListener('click', openComparativo);
    }


    if (elements.print) elements.print.addEventListener('click', () => window.print());

    if (elements.btnMetas) {
        elements.btnMetas.addEventListener('click', configurarMeta);
    }

    if (elements.markAllRead) {
        elements.markAllRead.addEventListener('click', async () => {
            await fetch('/reporteventas/api/alertas/marcar-todas', { method: 'POST' });
            loadAlertas();
        });
    }

    if (elements.exportExcel) {
        elements.exportExcel.addEventListener('click', () => {
            const params = getFilterParams();
            window.location.href = `/reporteventas/api/export/excel?${params}`;
        });
    }

    // Auto-refresh cada 5 minutos
    setInterval(loadDashboard, 5 * 60 * 1000);

    // =========================================
    // SIDEBAR TOGGLE
    // =========================================
    const sidebarToggle = document.getElementById('menuToggle');
    
    function toggleSidebar() {
        const body = document.body;
        const isHidden = body.classList.toggle('sidebar-hidden');
        localStorage.setItem('sidebar-hidden', isHidden);
        
        // Sincronizar icono
        const icon = sidebarToggle ? sidebarToggle.querySelector('i') : null;
        if (icon) {
            // Sidebar Cerrado: fa-bars
            // Sidebar Abierto: fa-bars-staggered
            icon.className = isHidden ? 'fas fa-bars' : 'fas fa-bars-staggered';
        }
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 's' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            toggleSidebar();
        }
    });

    // Restore Sidebar State & Icon
    if (localStorage.getItem('sidebar-hidden') === 'true') {
        document.body.classList.add('sidebar-hidden');
    } else if (localStorage.getItem('sidebar-hidden') === 'false') {
        document.body.classList.remove('sidebar-hidden');
    }
    
    // Ensure icon matches state on load
    const initialHidden = document.body.classList.contains('sidebar-hidden');
    const initialIcon = sidebarToggle ? sidebarToggle.querySelector('i') : null;
    if (initialIcon) {
        initialIcon.className = initialHidden ? 'fas fa-bars' : 'fas fa-bars-staggered';
    }

    // Event Listeners
    
    // Dropdown Toggle Logic
    const userDisplay = document.querySelector('.user-display');
    const dropdownMenu = document.querySelector('.dropdown-menu');

    if (userDisplay && dropdownMenu) {
        userDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!userDisplay.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('show');
            }
        });
    }

    if (elements.applyBtn) {
        elements.applyBtn.addEventListener('click', () => {
            const icon = elements.applyBtn.querySelector('i');
            if (icon) icon.classList.add('fa-spin');
            loadDashboard().finally(() => {
                if (icon) icon.classList.remove('fa-spin');
            });
        });
    }

    if (elements.period) {
        elements.period.addEventListener('change', function() {
            if (elements.customRange) {
                elements.customRange.style.display = this.value === 'personalizado' ? 'flex' : 'none';
            }
        });
    }

    if (elements.btnExport) {
        elements.btnExport.addEventListener('click', () => {
            Swal.fire({
                title: 'Exportar Reporte',
                text: '¿En qué formato deseas descargar el informe?',
                icon: 'question',
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: '<i class="fas fa-file-excel me-2"></i> Excel',
                denyButtonText: '<i class="fas fa-file-pdf me-2"></i> PDF',
                cancelButtonText: 'Cancelar',
                customClass: {
                    popup: 'premium-modal',
                    confirmButton: 'premium-btn-excel',
                    denyButton: 'premium-btn-pdf',
                    cancelButton: 'premium-btn-cancel'
                },
                buttonsStyling: false
            }).then((result) => {
                const params = getFilterParams();
                if (result.isConfirmed) {
                    window.location.href = `/reporteventas/api/export/excel?${params}`;
                } else if (result.isDenied) {
                    window.location.href = `/reporteventas/api/export/pdf?${params}`;
                }
            });
        });
    }

    // Carga inicial
    loadDashboard();
});
