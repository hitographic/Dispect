// =====================================================
// DISPECT - Authentication Module
// Supports Google Sheets User Database via Apps Script
// =====================================================

class Auth {
    constructor() {
        this.currentUser = null;
        this.webAppUrl = CONFIG.GOOGLE_SHEETS_WEBAPP_URL || '';
    }

    // Check if user is logged in
    isLoggedIn() {
        const user = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
        if (user) {
            try {
                this.currentUser = JSON.parse(user);
                return true;
            } catch (e) {
                localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
                return false;
            }
        }
        return false;
    }

    // Get current user
    getUser() {
        if (!this.currentUser) {
            const user = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
            if (user) {
                try {
                    this.currentUser = JSON.parse(user);
                } catch (e) {
                    return null;
                }
            }
        }
        return this.currentUser;
    }

    // JSONP request for CORS bypass
    jsonpRequest(url) {
        return new Promise((resolve, reject) => {
            const callbackName = 'authCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            const timeoutId = setTimeout(() => {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('Request timeout'));
            }, 15000);

            window[callbackName] = (data) => {
                clearTimeout(timeoutId);
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                resolve(data);
            };

            const script = document.createElement('script');
            script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + callbackName;
            script.onerror = () => {
                clearTimeout(timeoutId);
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('Script load error'));
            };
            document.head.appendChild(script);
        });
    }

    // Login with NIK and Password via Google Sheets
    async login(nik, password) {
        if (this.webAppUrl && this.webAppUrl !== 'YOUR_WEBAPP_URL') {
            try {
                const result = await this.jsonpRequest(
                    `${this.webAppUrl}?action=login&nik=${encodeURIComponent(nik)}&password=${encodeURIComponent(password)}`
                );

                if (result.success && result.user) {
                    let permissions = [];
                    if (result.user.permissions) {
                        if (Array.isArray(result.user.permissions)) {
                            permissions = result.user.permissions;
                        } else if (typeof result.user.permissions === 'string') {
                            permissions = result.user.permissions.split('|').map(p => p.trim()).filter(p => p);
                        }
                    }

                    this.currentUser = {
                        nik: result.user.nik,
                        name: result.user.name,
                        role: result.user.role || 'field',
                        permissions: permissions,
                        loginTime: new Date().toISOString()
                    };
                    localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(this.currentUser));
                    return { success: true, user: this.currentUser };
                }
                return { success: false, error: result.error || 'NIK atau password salah' };
            } catch (error) {
                console.error('Login error:', error);
                return { success: false, error: 'Gagal terhubung ke server. Periksa koneksi internet.' };
            }
        }

        // Fallback: demo mode (no backend configured)
        return { success: false, error: 'Server belum dikonfigurasi. Hubungi admin.' };
    }

    // Logout
    logout() {
        this.currentUser = null;
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
        const basePath = window.location.pathname.includes(CONFIG.BASE_PATH) ? CONFIG.BASE_PATH : '/';
        window.location.href = basePath;
    }
}

// Global auth instance
const auth = new Auth();

// =====================================================
// Permission Helper Functions (Global)
// =====================================================

function hasPermission(permission) {
    const user = auth.getUser();
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.permissions && user.permissions.includes(permission);
}

function canView() {
    return hasPermission('records_viewer');
}

function canEdit() {
    return hasPermission('records_editor');
}

function canValidate() {
    return hasPermission('records_validator');
}

function isAdmin() {
    const user = auth.getUser();
    return user && (user.role === 'admin' || hasPermission('user_admin'));
}

// Protect page — redirect to login if not authenticated
function protectPage() {
    if (!auth.isLoggedIn()) {
        const basePath = window.location.pathname.includes(CONFIG.BASE_PATH) ? CONFIG.BASE_PATH : '/';
        window.location.href = basePath;
        return false;
    }
    return true;
}

// =====================================================
// Utility Functions (Global)
// =====================================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function showLoading(message = 'Memuat data...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p id="loadingMessage">${message}</p>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        document.getElementById('loadingMessage').textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

function generateId(prefix) {
    return (prefix || 'ID') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}
