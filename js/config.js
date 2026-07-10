// =====================================================
// DISPECT - Configuration
// =====================================================

const CONFIG = {
    // Google Apps Script Web App URL
    // PENTING: Ganti dengan URL Web App setelah deploy Apps Script
    GOOGLE_SHEETS_WEBAPP_URL: 'https://script.google.com/macros/s/AKfycby8ZhwYbIDHlBGkw_nU93t4PKLK48huq5UTtRLjQvW_lnz-_KeCTSy5FMQPoBoHYNNT/exec',

    // Google Drive Folder ID untuk foto
    GOOGLE_DRIVE_FOLDER_ID: '1n8ym3VQ3mPoMkSzZwL-6Fwz-Xh54iyl4',

    // Google Sheets Spreadsheet ID
    SPREADSHEET_ID: '1ttdxeFz5EWqIuQDEcqX-ekaTN98iHqrcdadZVd50hDE',

    // App Configuration
    APP_NAME: 'DISPECT',
    APP_FULL_NAME: 'Display Inspection Tracker',
    VERSION: '1.0.0',

    // Base path for GitHub Pages
    BASE_PATH: '/Dispect/',

    // Storage Keys
    STORAGE_KEYS: {
        USER: 'dispect_user',
        RECORDS: 'dispect_records',
        RECORDS_TIMESTAMP: 'dispect_records_ts'
    },

    // Pagination
    DEFAULT_PAGE_SIZE: 12,
    PAGE_SIZE_OPTIONS: [8, 12, 16, 24, 48],

    // Photo column mapping
    PHOTO_COLUMNS: [
        { key: 'photo_bumbu', label: 'Bumbu' },
        { key: 'photo_mbumbu', label: 'M. Bumbu' },
        { key: 'photo_si', label: 'SI' },
        { key: 'photo_kartonDepan', label: 'Karton Depan' },
        { key: 'photo_kartonBelakang', label: 'Karton Belakang' },
        { key: 'photo_etiket', label: 'Etiket' },
        { key: 'photo_etiketbanded', label: 'Etiket Banded' },
        { key: 'photo_plakban', label: 'Plakban' }
    ],

    // Records headers (33 kolom)
    RECORDS_HEADERS: [
        'id', 'tanggal', 'flavor', 'nomorMaterial', 'negara', 'distributor',
        'createdAt', 'updatedAt', 'createdBy', 'updatedBy',
        'photo_bumbu', 'link_photo_bumbu',
        'photo_mbumbu', 'link_photo_mbumbu',
        'photo_si', 'link_photo_si',
        'photo_kartonDepan', 'link_photo_kartonDepan',
        'photo_kartonBelakang', 'link_photo_kartonBelakang',
        'photo_etiket', 'link_photo_etiket',
        'photo_etiketbanded', 'link_photo_etiketbanded',
        'photo_plakban', 'link_photo_plakban',
        'kodeProduksi1', 'kodeProduksi2', 'kodeProduksi3',
        'validationStatus', 'validatedBy', 'validatedAt', 'validationReason'
    ],

    // User roles
    ROLES: ['admin', 'supervisor', 'field'],

    // Available permissions
    PERMISSIONS: [
        'user_admin',
        'records_viewer',
        'records_editor',
        'records_validator',
        'master_editor'
    ]
};
