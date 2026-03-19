document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const rememberCheckbox = document.getElementById('remember');
    const savedSessionsContainer = document.getElementById('saved-sessions');
    const savedUsersList = document.getElementById('saved-users-list');

    // Cargar sesiones guardadas al iniciar
    loadSavedSessions();

    // Función para mostrar mensajes de error (Enterprise Style)
    const showError = (message) => {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        errorMessage.style.animation = 'shake 0.4s ease';

        // Limpiar después de 5s
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    };

    // Función para guardar sesión (Local Storage)
    function saveSession(username) {
        const savedSessions = JSON.parse(localStorage.getItem('ln_enterprise_sessions')) || [];
        const existing = savedSessions.findIndex(s => s.username === username);

        if (existing === -1) {
            savedSessions.push({
                username: username,
                savedAt: new Date().toISOString()
            });
            localStorage.setItem('ln_enterprise_sessions', JSON.stringify(savedSessions));
            loadSavedSessions();
        }
    }

    // Función para cargar sesiones guardadas (Enterprise Grid)
    function loadSavedSessions() {
        const savedSessions = JSON.parse(localStorage.getItem('ln_enterprise_sessions')) || [];
        savedUsersList.innerHTML = '';

        if (savedSessions.length === 0) {
            savedSessionsContainer.style.display = 'none';
            return;
        }

        savedSessionsContainer.style.display = 'block';

        savedSessions.slice(-2).forEach(session => { // Solo mostrar las últimas 2
            const initial = session.username.charAt(0).toUpperCase();

            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'account-item';
            item.innerHTML = `
                <div class="account-info">
                    <div class="account-avatar">${initial}</div>
                    <span class="account-name">${session.username}</span>
                </div>
                <span class="btn-remove-account" data-username="${session.username}" title="Eliminar">
                    <i class="fas fa-trash-alt"></i>
                </span>
            `;

            // Al hacer clic en TODO el item, selecciona la cuenta
            item.onclick = (e) => {
                // Si el clic fue en el botón eliminar, no seleccionar
                if (e.target.closest('.btn-remove-account')) return;

                usernameInput.value = session.username;
                passwordInput.focus();

                // Feedback visual de selección
                item.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(16, 185, 129, 0.1) 100%)';
                item.style.borderColor = '#10b981';
                setTimeout(() => {
                    item.style.background = '';
                    item.style.borderColor = '';
                }, 300);
            };

            // Eliminar cuenta (clic en X)
            item.querySelector('.btn-remove-account').onclick = (e) => {
                e.stopPropagation();
                deleteSession(session.username);
            };

            savedUsersList.appendChild(item);
        });
    }


    function deleteSession(username) {
        let savedSessions = JSON.parse(localStorage.getItem('ln_enterprise_sessions')) || [];
        savedSessions = savedSessions.filter(s => s.username !== username);
        localStorage.setItem('ln_enterprise_sessions', JSON.stringify(savedSessions));
        loadSavedSessions();
    }

    // Manejar el envío del formulario
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        const remember = rememberCheckbox.checked;

        if (!username || !password) {
            showError('Se requieren credenciales válidas.');
            return;
        }

        const loginBtn = document.getElementById('btn-login');
        const originalContent = loginBtn.innerHTML;

        // Estado de "Verificación"
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Autenticando...</span>';

        async function executeLogin(challengeAccepted = false) {
            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({ username, password, challenge_accepted: challengeAccepted })
                });

                const data = await response.json();

                if (data.challenge) {
                    // DESAFÍO DE IP (LN Radar / SHE)
                    const result = await Swal.fire({
                        title: '¿Fuiste tú?',
                        text: `${data.msg} (IP: ${data.ip})`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Sí, soy yo',
                        cancelButtonText: 'No, bloquear access',
                        confirmButtonColor: '#10b981',
                        cancelButtonColor: '#ef4444',
                        background: '#1e293b',
                        color: '#fff'
                    });

                    if (result.isConfirmed) {
                        return executeLogin(true); // Re-intentar confirmando IP
                    } else {
                        showError('Acceso denegado por sospecha de intrusión.');
                        loginBtn.disabled = false;
                        loginBtn.innerHTML = originalContent;
                        return;
                    }
                }

                if (response.ok && data.success) {
                    if (remember) saveSession(username);
                    loginBtn.innerHTML = '<i class="fas fa-check"></i> <span>Acceso Concedido</span>';
                    loginBtn.style.background = '#10b981';
                    setTimeout(() => {
                        window.location.href = (data.rol === 'empleado') ? '/caja' : '/home';
                    }, 800);
                } else {
                    showError(data.error || 'Error de autenticación centralizada.');
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = originalContent;
                }
            } catch (error) {
                console.error('Auth Error:', error);
                showError('No se pudo establecer conexión con el sistema.');
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalContent;
            }
        }

        executeLogin();
    });

    // Micro-interacciones de Input
    const inputs = document.querySelectorAll('.input-container input');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.closest('.form-group').style.opacity = '1';
        });
        input.addEventListener('blur', () => {
            if (!input.value) input.parentElement.closest('.form-group').style.opacity = '0.8';
        });
    });

    // --- Lógica de Recuperación ---
    const forgotLink = document.querySelector('.forgot-link');
    const recoveryModal = document.getElementById('recovery-modal');
    const btnCloseRecovery = document.getElementById('btn-close-recovery');
    const recoveryForm = document.getElementById('recovery-form');
    const btnSendRecovery = document.getElementById('btn-send-recovery');

    if (forgotLink && recoveryModal) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            recoveryModal.style.display = 'flex';
            document.getElementById('recovery-email').focus();
        });

        const closeModal = () => {
            recoveryModal.style.display = 'none';
        };

        btnCloseRecovery.addEventListener('click', closeModal);

        // Cerrar al hacer click fuera
        recoveryModal.addEventListener('click', (e) => {
            if (e.target === recoveryModal) closeModal();
        });

        recoveryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('recovery-email').value.trim();
            if (!email) return;

            btnSendRecovery.disabled = true;
            btnSendRecovery.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

            try {
                const res = await fetch('/api/recover-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();

                if (data.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Correo Enviado',
                        text: 'Si el correo existe, recibirás instrucciones en breve.',
                        confirmButtonColor: '#10b981'
                    });
                    closeModal();
                    document.getElementById('recovery-email').value = '';
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.error || 'No se pudo procesar la solicitud.',
                        confirmButtonColor: '#ef4444'
                    });
                }
            } catch (err) {
                console.error(err);
                Swal.fire('Error', 'Fallo de conexión', 'error');
            } finally {
                btnSendRecovery.disabled = false;
                btnSendRecovery.innerHTML = '<span>Enviar Enlace</span> <i class="fas fa-paper-plane"></i>';
            }
        });
    }
});
