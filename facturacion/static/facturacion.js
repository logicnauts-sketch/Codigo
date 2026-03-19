// =========================================
// Next Design | POS ELITE ENGINE v2.0
// =========================================

document.addEventListener('DOMContentLoaded', () => {
    // --- Global State ---
    let cart = [];
    let products = [];
    let currentPaymentMethod = 'efectivo';
    let currentClient = { id: 1, name: 'Consumidor Final', rnc: '000-0000000-0' };
    
    // Multisession State
    const CART_SESSIONS_KEY = 'surti_kids_pos_sessions_v1';
    let cartSessions = [];
    let activeSessionId = null;

    const notyf = new Notyf({
        duration: 3000,
        position: { x: 'right', y: 'top' },
        types: [{ type: 'success', background: 'var(--success)' }]
    });

    // --- Initialization ---
    initSessions();
    fetchInitialData();
    setupEventListeners();

    // --- Core Functions ---

    function initSessions() {
        const saved = localStorage.getItem(CART_SESSIONS_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            cartSessions = parsed.cartSessions || [];
            activeSessionId = parsed.activeSessionId;
        }

        if (cartSessions.length === 0) {
            createNewSession();
        } else {
            loadSession(activeSessionId);
        }
    }

    function createNewSession() {
        const id = 's_' + Date.now().toString(36);
        const newSession = {
            id: id,
            name: 'Carrito ' + (cartSessions.length + 1),
            cart: [],
            client: { id: 1, name: 'Consumidor Final', rnc: '000-0000000-0' },
            paymentMethod: 'efectivo'
        };
        cartSessions.push(newSession);
        switchSession(id);
    }

    function switchSession(id) {
        saveCurrentSessionState();
        activeSessionId = id;
        loadSession(id);
        renderSessions();
        saveAllToStorage();
    }

    function saveCurrentSessionState() {
        const idx = cartSessions.findIndex(s => s.id === activeSessionId);
        if (idx !== -1) {
            cartSessions[idx].cart = [...cart];
            cartSessions[idx].client = { ...currentClient };
            cartSessions[idx].paymentMethod = currentPaymentMethod;
        }
    }

    function loadSession(id) {
        const session = cartSessions.find(s => s.id === id);
        if (session) {
            cart = [...session.cart];
            currentClient = { ...session.client };
            currentPaymentMethod = session.paymentMethod;
            activeSessionId = id;
            updateUI();
        }
    }

    function saveAllToStorage() {
        localStorage.setItem(CART_SESSIONS_KEY, JSON.stringify({
            activeSessionId,
            cartSessions
        }));
    }

    async function fetchInitialData() {
        try {
            const res = await fetch('/facturacion/api/productos');
            products = await res.json();
            // Initial render of products in the search suggestions if needed, 
            // but mainly for inventory explorer modal.
        } catch (e) { console.error('Error fetching data:', e); }
    }

    function updateUI() {
        renderCart();
        updateSummary();
        renderSessions();
        updateClientUI();
        updatePaymentTiles();
    }

    function renderCart() {
        const container = document.getElementById('cart-items');
        const emptyState = document.getElementById('empty-cart');
        const btnCheckout = document.getElementById('btnCheckout');

        if (cart.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'flex';
            btnCheckout.disabled = true;
            return;
        }

        emptyState.style.display = 'none';
        btnCheckout.disabled = false;

        container.innerHTML = cart.map(item => `
            <tr>
                <td>
                    <span class="item-name">${item.nombre}</span>
                    <span class="item-meta">${item.codigo}</span>
                </td>
                <td style="text-align:center;">
                    <div class="qty-control mx-auto">
                        <button class="qty-btn" onclick="window.updateQty(${item.id}, -1)"><i class="fas fa-minus"></i></button>
                        <span class="fw-bold">${item.qty}</span>
                        <button class="qty-btn" onclick="window.updateQty(${item.id}, 1)"><i class="fas fa-plus"></i></button>
                    </div>
                </td>
                <td style="text-align:right; font-weight:600;">RD$ ${item.precio.toLocaleString()}</td>
                <td style="text-align:right; font-weight:800; color: var(--accent);">RD$ ${(item.precio * item.qty).toLocaleString()}</td>
                <td style="text-align:center;">
                    <button class="btn btn-link text-danger p-0" onclick="window.removeItem(${item.id})">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function updateSummary() {
        const total = cart.reduce((sum, item) => sum + (item.precio * item.qty), 0);
        const subtotal = total / 1.18;
        const tax = total - subtotal;

        document.getElementById('subtotal').textContent = `RD$ ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('tax').textContent = `RD$ ${tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('total').textContent = `RD$ ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        // Update modal as well
        const modalTotal = document.getElementById('modal-total');
        if (modalTotal) modalTotal.textContent = `RD$ ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function renderSessions() {
        const container = document.getElementById('cart-sessions-bar');
        container.innerHTML = cartSessions.map(s => `
            <div class="session-pill ${s.id === activeSessionId ? 'active' : ''}" onclick="window.switchSession('${s.id}')">
                <i class="fas fa-shopping-cart"></i>
                <div class="d-flex flex-column">
                    <span style="font-size:0.65rem; font-weight:800; opacity:0.8;">${s.name}</span>
                    <span style="font-size:0.85rem; font-weight:900;">RD$ ${((s.cart || []).reduce((sum, i) => sum + (i.precio * i.qty), 0)).toLocaleString()}</span>
                </div>
                ${cartSessions.length > 1 ? `<i class="fas fa-times ms-2 close-session" style="font-size:0.7rem;" onclick="window.closeSession('${s.id}', event)"></i>` : ''}
            </div>
        `).join('') + `
            <div class="session-pill" style="min-width: unset; width: 45px; justify-content: center; background: var(--bg-deep);" onclick="window.createNewSession()">
                <i class="fas fa-plus"></i>
            </div>
        `;
    }

    function updateClientUI() {
        document.getElementById('active-client-name').textContent = currentClient.name;
    }

    function updatePaymentTiles() {
        document.querySelectorAll('.payment-tile').forEach(tile => {
            if (tile.dataset.method === currentPaymentMethod) {
                tile.classList.add('active');
            } else {
                tile.classList.remove('active');
            }
        });
    }

    // --- Public Handlers ---

    window.switchSession = (id) => switchSession(id);
    
    window.createNewSession = () => createNewSession();

    window.closeSession = (id, event) => {
        event.stopPropagation();
        if (cartSessions.length <= 1) return;
        
        cartSessions = cartSessions.filter(s => s.id !== id);
        if (activeSessionId === id) {
            activeSessionId = cartSessions[0].id;
        }
        loadSession(activeSessionId);
        renderSessions();
        saveAllToStorage();
    };

    window.updateQty = (id, delta) => {
        const item = cart.find(i => i.id === id);
        if (item) {
            item.qty += delta;
            if (item.qty <= 0) {
                cart = cart.filter(i => i.id !== id);
            }
            updateUI();
            saveCurrentSessionState();
            saveAllToStorage();
        }
    };

    window.removeItem = (id) => {
        cart = cart.filter(i => i.id !== id);
        updateUI();
        saveCurrentSessionState();
        saveAllToStorage();
    };

    window.addToCart = (product) => {
        const existing = cart.find(i => i.id === product.id);
        if (existing) {
            existing.qty++;
        } else {
            cart.push({ ...product, qty: 1 });
        }
        updateUI();
        saveCurrentSessionState();
        saveAllToStorage();
        notyf.success(`Agregado: ${product.nombre}`);
    };

    // --- Event Listeners ---

    function setupEventListeners() {
        // Product Search Suggestions
        const searchInput = document.getElementById('product-search');
        const suggestionsBox = document.getElementById('search-suggestions');

        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            if (query.length < 2) {
                suggestionsBox.classList.add('hidden');
                return;
            }

            const filtered = products.filter(p => 
                p.nombre.toLowerCase().includes(query) || 
                p.codigo.includes(query)
            ).slice(0, 5);

            if (filtered.length > 0) {
                suggestionsBox.innerHTML = filtered.map(p => `
                    <div class="suggestion-item" onclick='window.selectProduct(${JSON.stringify(p)})'>
                        <div class="suggestion-icon"><i class="fas fa-tag"></i></div>
                        <div style="flex:1;">
                            <div style="font-weight:800; font-size:0.9rem;">${p.nombre}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${p.codigo}</div>
                        </div>
                        <div style="font-weight:900; color:var(--accent);">RD$ ${p.precio.toLocaleString()}</div>
                    </div>
                `).join('');
                suggestionsBox.classList.remove('hidden');
            } else {
                suggestionsBox.classList.add('hidden');
            }
        });

        window.selectProduct = (p) => {
            window.addToCart(p);
            searchInput.value = '';
            suggestionsBox.classList.add('hidden');
            searchInput.focus();
        };

        // Payment Tiles
        document.querySelectorAll('.payment-tile').forEach(tile => {
            tile.addEventListener('click', () => {
                currentPaymentMethod = tile.dataset.method;
                updatePaymentTiles();
                saveCurrentSessionState();
                saveAllToStorage();
            });
        });

        // Checkout Button
        const btnCheckout = document.getElementById('btnCheckout');
        const paymentModal = new bootstrap.Modal(document.getElementById('payment-modal'));
        
        btnCheckout.addEventListener('click', () => {
            if (currentPaymentMethod === 'efectivo') {
                paymentModal.show();
                setTimeout(() => document.getElementById('amount-received').focus(), 500);
            } else {
                processFinalSale();
            }
        });

        // Cash Received Logic
        const amountReceivedInput = document.getElementById('amount-received');
        const confirmPaymentBtn = document.getElementById('confirm-payment');

        amountReceivedInput.addEventListener('input', () => {
            const total = cart.reduce((sum, item) => sum + (item.precio * item.qty), 0);
            const received = parseFloat(amountReceivedInput.value) || 0;
            const change = Math.max(0, received - total);
            
            document.getElementById('modal-change').textContent = `RD$ ${change.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
            confirmPaymentBtn.disabled = received < total;
        });

        confirmPaymentBtn.addEventListener('click', () => {
            processFinalSale();
            paymentModal.hide();
        });

        // Inventory Explorer (F9)
        const productsModal = new bootstrap.Modal(document.getElementById('products-modal'));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F9') {
                e.preventDefault();
                renderInventoryList('');
                productsModal.show();
            }
            if (e.key === 'F2') {
                e.preventDefault();
                createNewSession();
            }
            if (e.key === 'Enter' && document.activeElement === searchInput && searchInput.value.length > 0) {
                // If there's an exact match by barcode, add it
                const exactMatch = products.find(p => p.codigo === searchInput.value.trim());
                if (exactMatch) {
                    window.addToCart(exactMatch);
                    searchInput.value = '';
                    suggestionsBox.classList.add('hidden');
                }
            }
        });

        const modalProductSearch = document.getElementById('modal-product-search');
        modalProductSearch.addEventListener('input', () => {
            renderInventoryList(modalProductSearch.value);
        });
    }

    function renderInventoryList(query) {
        const list = document.getElementById('products-list');
        const q = query.toLowerCase().trim();
        const filtered = products.filter(p => p.nombre.toLowerCase().includes(q) || p.codigo.includes(q));

        list.innerHTML = filtered.map(p => `
            <tr style="cursor:pointer;" onclick='window.selectProductModal(${JSON.stringify(p)})'>
                <td><span class="badge bg-light text-dark">${p.codigo}</span></td>
                <td><span class="fw-bold">${p.nombre}</span></td>
                <td>${p.stock}</td>
                <td style="text-align:right; font-weight:800; color:var(--accent);">RD$ ${p.precio.toLocaleString()}</td>
            </tr>
        `).join('');
    }

    window.selectProductModal = (p) => {
        window.addToCart(p);
        bootstrap.Modal.getInstance(document.getElementById('products-modal')).hide();
    };

    async function processFinalSale() {
        if (cart.length === 0) return;

        const btnCheckout = document.getElementById('btnCheckout');
        btnCheckout.disabled = true;
        btnCheckout.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';

        try {
            const response = await fetch('/facturacion/api/procesar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente_id: currentClient.id,
                    metodo_pago: currentPaymentMethod,
                    detalles: cart,
                    total: cart.reduce((sum, item) => sum + (item.precio * item.qty), 0)
                })
            });

            const result = await response.json();
            if (result.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Â¡Venta Completada!',
                    text: `Factura No. ${result.factura_id} emitida con éxito.`,
                    confirmButtonColor: 'var(--accent)'
                });
                
                // Clear current session
                cart = [];
                currentClient = { id: 1, name: 'Consumidor Final', rnc: '000-0000000-0' };
                currentPaymentMethod = 'efectivo';
                
                saveCurrentSessionState();
                saveAllToStorage();
                updateUI();
            } else {
                notyf.error('Error: ' + result.mensaje);
            }
        } catch (error) {
            console.error('Error processing sale:', error);
            notyf.error('Error de conexión con el servidor');
        } finally {
            btnCheckout.disabled = false;
            btnCheckout.innerHTML = '<i class="fas fa-bolt"></i> PROCESAR VENTA';
        }
    }

    // --- Helpers ---
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

    function applyFormatting(id) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                const start = e.target.selectionStart;
                const formatted = formatDocument(e.target.value);
                e.target.value = formatted;
                try { e.target.setSelectionRange(start, start); } catch(err) {}
            });
        }
    }

    // Apply formatting to relevant inputs
    applyFormatting('rnc-search-realtime');
    applyFormatting('client-search');
});

