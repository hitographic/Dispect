// =====================================================
// DISPECT - Storage Module
// Abstraction layer: Google Sheets + Local Storage
// =====================================================

class Storage {
    constructor() {
        this.isOnline = navigator.onLine;
        this.useGoogleSheets = false;

        this.checkGoogleSheets();

        window.addEventListener('online', () => { this.isOnline = true; });
        window.addEventListener('offline', () => { this.isOnline = false; });
    }

    checkGoogleSheets() {
        if (typeof sheetsDB !== 'undefined' && sheetsDB.isConfigured()) {
            this.useGoogleSheets = true;
            console.log('✅ Google Sheets database connected');
        } else {
            this.useGoogleSheets = false;
            console.log('ℹ️ Using local storage (Google Sheets not configured)');
        }
    }

    // ==================== FAST RECORDS LOAD ====================

    async getRecordsBasic() {
        if (this.useGoogleSheets && this.isOnline) {
            try {
                console.log('🚀 Storage: FAST fetch - getRecordsBasic...');
                const records = await Promise.race([
                    sheetsDB.getRecordsBasic(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Fast fetch timeout')), 20000)
                    )
                ]);

                if (records !== null && records.length >= 0) {
                    console.log(`✅ Storage: FAST fetched ${records.length} records`);
                    this.saveRecordsLocal(records);
                    return records;
                }
            } catch (error) {
                console.error('❌ Storage: Error in fast fetch:', error.message);
            }
        }

        console.log('📦 Storage: Using local storage');
        return this.getRecordsLocal();
    }

    // ==================== FULL RECORDS LOAD ====================

    async getAllRecords() {
        if (this.useGoogleSheets && this.isOnline) {
            try {
                const records = await Promise.race([
                    sheetsDB.getAllRecords(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Full fetch timeout')), 100000)
                    )
                ]);

                if (records !== null && records.length >= 0) {
                    this.saveRecordsLocal(records);
                    return records;
                }
            } catch (error) {
                console.error('❌ Storage: Error fetching:', error.message);
            }
        }

        return this.getRecordsLocal();
    }

    // ==================== RECORD CRUD ====================

    async addRecord(record) {
        this.addRecordLocal(record);

        if (this.useGoogleSheets && this.isOnline) {
            try {
                const result = await sheetsDB.addRecord(record);
                if (result.success && result.record) {
                    return result.record;
                }
                return result;
            } catch (error) {
                console.error('❌ Storage: Error adding record:', error);
            }
        }

        return record;
    }

    async updateRecord(id, record) {
        this.updateRecordLocal(id, record);

        if (this.useGoogleSheets && this.isOnline) {
            try {
                return await sheetsDB.updateRecord(id, record);
            } catch (error) {
                console.error('❌ Storage: Error updating record:', error);
            }
        }

        return { success: true };
    }

    async deleteRecord(id) {
        this.deleteRecordLocal(id);

        if (this.useGoogleSheets && this.isOnline) {
            try {
                return await sheetsDB.deleteRecord(id);
            } catch (error) {
                console.error('❌ Storage: Error deleting record:', error);
            }
        }

        return { success: true };
    }

    async validateRecord(id, validation) {
        if (this.useGoogleSheets && this.isOnline) {
            try {
                return await sheetsDB.validateRecord(id, validation);
            } catch (error) {
                console.error('❌ Storage: Error validating record:', error);
            }
        }
        return { success: false, error: 'Offline - cannot validate' };
    }

    // ==================== PHOTO OPERATIONS ====================

    async uploadPhoto(photoData) {
        if (this.useGoogleSheets && this.isOnline) {
            try {
                return await sheetsDB.uploadPhoto(photoData);
            } catch (error) {
                console.error('❌ Storage: Error uploading photo:', error);
            }
        }
        return { success: false, error: 'Offline - cannot upload' };
    }

    async getPhotoBase64(params) {
        if (this.useGoogleSheets && this.isOnline) {
            try {
                return await sheetsDB.getPhotoBase64(params);
            } catch (error) {
                console.error('❌ Storage: Error getting photo:', error);
            }
        }
        return { success: false };
    }

    // ==================== LOCAL STORAGE ====================

    getRecordsLocal() {
        try {
            const data = localStorage.getItem(CONFIG.STORAGE_KEYS.RECORDS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    saveRecordsLocal(records) {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.RECORDS, JSON.stringify(records));
            localStorage.setItem(CONFIG.STORAGE_KEYS.RECORDS_TIMESTAMP, Date.now().toString());
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }
    }

    addRecordLocal(record) {
        const records = this.getRecordsLocal();
        records.unshift(record);
        this.saveRecordsLocal(records);
    }

    updateRecordLocal(id, updatedData) {
        const records = this.getRecordsLocal();
        const index = records.findIndex(r => r.id === id || String(r.id) === String(id));
        if (index !== -1) {
            records[index] = { ...records[index], ...updatedData };
            this.saveRecordsLocal(records);
        }
    }

    deleteRecordLocal(id) {
        const records = this.getRecordsLocal();
        const filtered = records.filter(r => r.id !== id && String(r.id) !== String(id));
        this.saveRecordsLocal(filtered);
    }
}

// Global instance
const storage = new Storage();
