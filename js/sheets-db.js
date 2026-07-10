// =====================================================
// DISPECT - Google Sheets Database Module
// Pattern: fetch() primary + JSONP fallback
// No user Gmail login needed - Execute as Me + Anyone
// =====================================================

class GoogleSheetsDB {
    constructor() {
        this.webAppUrl = CONFIG.GOOGLE_SHEETS_WEBAPP_URL || '';
        this.callbackCounter = 0;
        this.pendingCallbacks = new Set();
    }

    isConfigured() {
        return this.webAppUrl && this.webAppUrl !== '' && this.webAppUrl !== 'YOUR_WEBAPP_URL';
    }

    // ===== CORE API METHODS =====

    async gGet(action, params = {}) {
        const url = new URL(this.webAppUrl);
        url.searchParams.set('action', action);
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
            }
        }

        console.log(`📡 GET ${action}`, params);

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                redirect: 'follow'
            });
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (fetchError) {
            console.warn(`⚠️ fetch() failed for GET ${action}, trying JSONP...`, fetchError.message);
        }

        return this.jsonpRequest(url.toString());
    }

    async gPost(action, body = {}) {
        const url = new URL(this.webAppUrl);
        url.searchParams.set('action', action);

        const bodyKeys = Object.keys(body);
        const hasLargeData = bodyKeys.some(k => typeof body[k] === 'string' && body[k].length > 50000);
        console.log(`📤 POST ${action}`, bodyKeys, hasLargeData ? '(large payload)' : '');

        // Method 1: fetch POST with text/plain
        try {
            const controller = new AbortController();
            const fetchTimeout = hasLargeData ? 120000 : 30000;
            const timer = setTimeout(() => controller.abort(), fetchTimeout);

            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(body),
                redirect: 'follow',
                signal: controller.signal
            });
            clearTimeout(timer);

            const contentType = response.headers.get('content-type') || '';
            if (response.ok && contentType.includes('application/json')) {
                return await response.json();
            }

            if (response.ok) {
                const text = await response.text();
                try {
                    return JSON.parse(text);
                } catch (e) {
                    if (text.includes('google') || text.length > 100) {
                        return { success: true, message: 'Server processed (redirect response)' };
                    }
                }
            }
        } catch (fetchError) {
            console.warn(`⚠️ fetch POST failed for ${action}:`, fetchError.message);
        }

        // Method 2: JSONP fallback via GET with data parameter
        try {
            const getUrl = new URL(this.webAppUrl);
            getUrl.searchParams.set('action', action);
            getUrl.searchParams.set('data', JSON.stringify(body));
            return await this.jsonpRequest(getUrl.toString());
        } catch (jsonpError) {
            console.error(`❌ JSONP fallback also failed for ${action}:`, jsonpError.message);
            throw jsonpError;
        }
    }

    // JSONP request
    jsonpRequest(url) {
        return new Promise((resolve, reject) => {
            const callbackName = 'sheetsCallback_' + Date.now() + '_' + (++this.callbackCounter);
            this.pendingCallbacks.add(callbackName);

            const timeoutId = setTimeout(() => {
                this.pendingCallbacks.delete(callbackName);
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('JSONP timeout'));
            }, 30000);

            window[callbackName] = (data) => {
                clearTimeout(timeoutId);
                this.pendingCallbacks.delete(callbackName);
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                resolve(data);
            };

            const script = document.createElement('script');
            script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + callbackName;
            script.onerror = () => {
                clearTimeout(timeoutId);
                this.pendingCallbacks.delete(callbackName);
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('JSONP script error'));
            };
            document.head.appendChild(script);
        });
    }

    // ===== RECORDS OPERATIONS =====

    async getAllRecords() {
        const result = await this.gGet('getAll');
        if (result.success && result.records) {
            return result.records;
        }
        console.warn('getAllRecords failed:', result.error);
        return [];
    }

    async getRecordsBasic() {
        const result = await this.gGet('getRecordsBasic');
        if (result.success && result.records) {
            return result.records;
        }
        console.warn('getRecordsBasic failed:', result.error);
        return [];
    }

    async getRecordById(id) {
        const result = await this.gGet('get', { id });
        if (result.success && result.record) {
            return result.record;
        }
        return null;
    }

    async addRecord(record) {
        return await this.gPost('addRecord', { record });
    }

    async updateRecord(id, record) {
        return await this.gPost('updateRecord', { id, record });
    }

    async deleteRecord(id) {
        return await this.gPost('deleteRecord', { id });
    }

    async validateRecord(id, validation) {
        return await this.gPost('validateRecord', { id, validation });
    }

    // ===== USER OPERATIONS =====

    async getUsers() {
        const result = await this.gGet('getUsers');
        if (result.success && result.users) {
            return result.users;
        }
        return [];
    }

    async addUser(user) {
        return await this.gPost('addUser', { user });
    }

    async updateUser(nik, user) {
        return await this.gPost('updateUser', { nik, user });
    }

    async deleteUser(nik) {
        return await this.gPost('deleteUser', { nik });
    }

    // ===== PHOTO OPERATIONS =====

    async uploadPhoto(photoData) {
        return await this.gPost('uploadPhoto', photoData);
    }

    async deletePhoto(fileId) {
        return await this.gPost('deletePhoto', { fileId });
    }

    async getPhotoUrl(fileId) {
        const result = await this.gGet('getPhotoUrl', { fileId });
        if (result.success) {
            return result.url || result.webViewLink;
        }
        return null;
    }

    async getPhotoBase64(params) {
        return await this.gGet('getPhotoBase64', params);
    }
}

// Global instance
const sheetsDB = new GoogleSheetsDB();
