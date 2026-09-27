// =====================================================
// DISPECT - Records Page Script
// With Permissions, Validation, Photo Upload
// =====================================================

let allRecords = [];
let filteredRecords = [];
let currentPreviewRecord = null;
let currentPage = 1;
let recordsPerPage = CONFIG.DEFAULT_PAGE_SIZE;
let photoFiles = {};
let photosToDelete = new Set();

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', function () {
    if (!protectPage()) return;

    if (!canView()) {
        showToast('Anda tidak memiliki akses untuk melihat records', 'error');
        setTimeout(() => {
            const basePath = window.location.pathname.includes(CONFIG.BASE_PATH) ? CONFIG.BASE_PATH : '/';
            window.location.href = basePath;
        }, 1500);
        return;
    }

    initRecordsPage();
});

async function initRecordsPage() {
    const user = auth.getUser();
    document.getElementById('userName').textContent = user?.name || 'User';

    setupPermissionUI();
    initPhotoUploadGrid();

    showLoading('⏳ Memuat semua data...');
    const success = await loadRecords();
    hideLoading();

    if (success) {
        showToast(`✅ ${allRecords.length} records dimuat`, 'success');
    } else {
        showToast(`⚠️ Menggunakan data lokal (${allRecords.length} records)`, 'warning');
    }

    renderRecords();
}

function setupPermissionUI() {
    const addBtn = document.getElementById('btnAddData');
    const userLink = document.getElementById('userManagementLink');

    if (!canEdit() && addBtn) addBtn.style.display = 'none';
    if (isAdmin() && userLink) userLink.style.display = 'inline-flex';
}

// =====================================================
// LOAD RECORDS
// =====================================================

async function loadRecords() {
    try {
        allRecords = await storage.getRecordsBasic();
        filteredRecords = [...allRecords];
        return allRecords.length >= 0;
    } catch (error) {
        console.error('❌ Error loading records:', error);
        allRecords = storage.getRecordsLocal();
        filteredRecords = [...allRecords];
        return false;
    }
}

// =====================================================
// RENDER RECORDS (Card List)
// =====================================================

function renderRecords() {
    const grid = document.getElementById('recordsGrid');
    const emptyState = document.getElementById('emptyState');
    const userCanEdit = canEdit();
    const userCanValidate = canValidate();
    const isViewerOnly = !userCanEdit && !userCanValidate && canView();

    let recordsToDisplay = filteredRecords;

    // Viewer-only: show only validated records
    if (isViewerOnly) {
        recordsToDisplay = recordsToDisplay.filter(r => r.validationStatus === 'valid');
    }

    if (!recordsToDisplay || recordsToDisplay.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        document.getElementById('paginationContainer').classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    // Pagination
    const totalPages = Math.ceil(recordsToDisplay.length / recordsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    const startIndex = (currentPage - 1) * recordsPerPage;
    const paginatedRecords = recordsToDisplay.slice(startIndex, startIndex + recordsPerPage);

    grid.innerHTML = paginatedRecords.map(record => {
        let badgeClass = 'badge-not-validated';
        let badgeText = '🟡 NOT VALIDATED';
        if (record.validationStatus === 'valid') {
            badgeClass = 'badge-validated';
            badgeText = '🟢 VALIDATED';
        } else if (record.validationStatus === 'invalid') {
            badgeClass = 'badge-invalid';
            badgeText = '🔴 INVALID';
        }

        return `
            <div class="record-card">
                <div class="record-card-row1">
                    <div class="record-card-flavor">
                        <span class="flavor-name">${escapeHtml(record.flavor || '-')}</span>
                        <span class="badge ${badgeClass}">${badgeText}</span>
                    </div>
                    <div class="record-card-actions">
                        <button class="btn-action view" onclick="openPreview('${record.id}')" title="Lihat Detail">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${userCanEdit || userCanValidate ? `
                        <button class="btn-action edit" onclick="openEditModal('${record.id}')" title="Edit / Validasi">
                            <i class="fas fa-edit"></i>
                        </button>` : ''}
                        ${userCanEdit ? `
                        <button class="btn-action delete" onclick="deleteRecord('${record.id}')" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>` : ''}
                    </div>
                </div>
                <div class="record-card-row2">
                    <span class="record-card-distributor">${escapeHtml(record.distributor || '-')}</span>
                    <span class="record-card-meta">${escapeHtml(record.negara || '-')} • ${formatDate(record.tanggal || record.updatedAt)}</span>
                </div>
            </div>
        `;
    }).join('');

    renderPagination(totalPages, recordsToDisplay.length);
}

// =====================================================
// PAGINATION
// =====================================================

function renderPagination(totalPages, totalRecords) {
    const container = document.getElementById('paginationContainer');
    if (totalPages <= 1) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    let html = `
        <button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) startPage = Math.max(1, endPage - maxButtons + 1);

    if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += `<span class="pagination-info">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="pagination-info">...</span>`;
        html += `<button class="pagination-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    html += `
        <button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
        <span class="pagination-info">${totalRecords} records</span>
    `;

    container.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    renderRecords();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =====================================================
// SEARCH / FILTER
// =====================================================

function toggleSearch() {
    const panel = document.getElementById('searchPanel');
    panel.classList.toggle('active');
}

function applyFilters() {
    const nomorMaterial = document.getElementById('searchNomorMaterial').value.trim().toLowerCase();
    const flavor = document.getElementById('searchFlavor').value.trim().toLowerCase();
    const negara = document.getElementById('searchNegara').value.trim().toLowerCase();
    const distributor = document.getElementById('searchDistributor').value.trim().toLowerCase();
    const date = document.getElementById('searchDate').value;
    const validation = document.getElementById('searchValidation').value;

    filteredRecords = allRecords.filter(record => {
        if (nomorMaterial && !(record.nomorMaterial || '').toLowerCase().includes(nomorMaterial)) return false;
        if (flavor && !(record.flavor || '').toLowerCase().includes(flavor)) return false;
        if (negara && !(record.negara || '').toLowerCase().includes(negara)) return false;
        if (distributor && !(record.distributor || '').toLowerCase().includes(distributor)) return false;
        if (date && record.tanggal !== date) return false;
        if (validation) {
            if (validation === 'not_validated' && record.validationStatus && record.validationStatus !== 'not_validated' && record.validationStatus !== '') return false;
            if (validation === 'valid' && record.validationStatus !== 'valid') return false;
            if (validation === 'invalid' && record.validationStatus !== 'invalid') return false;
        }
        return true;
    });

    currentPage = 1;
    renderRecords();
}

function clearFilters() {
    document.getElementById('searchNomorMaterial').value = '';
    document.getElementById('searchFlavor').value = '';
    document.getElementById('searchNegara').value = '';
    document.getElementById('searchDistributor').value = '';
    document.getElementById('searchDate').value = '';
    document.getElementById('searchValidation').value = '';
    filteredRecords = [...allRecords];
    currentPage = 1;
    renderRecords();
}

// =====================================================
// PHOTO UPLOAD GRID (for Add/Edit Modal)
// =====================================================

function initPhotoUploadGrid() {
    const grid = document.getElementById('photoUploadGrid');
    grid.innerHTML = CONFIG.PHOTO_COLUMNS.map(col => `
        <div class="photo-upload-container" style="display:flex; flex-direction:column; gap:8px;">
            <input type="text" id="photoname_${col.key}" placeholder="Nama ${col.label}" style="width:100%; padding:8px; border:2px solid var(--gray-200); border-radius:var(--border-radius); font-size:0.85rem;" />
            <div class="photo-upload-item" id="upload_${col.key}">
                <img id="preview_img_${col.key}" class="photo-preview-img hidden" src="" alt="Preview">
                <label class="upload-content" id="upload_content_${col.key}" for="upload_file_${col.key}">
                    <i class="fas fa-cloud-upload-alt upload-icon"></i>
                    <span class="upload-label">${col.label}</span>
                    <span class="upload-filename" id="filename_${col.key}"></span>
                </label>
                <div class="upload-actions">
                    <button type="button" class="action-btn preview-btn hidden" id="preview_btn_${col.key}" onclick="previewFullImage('${col.key}', event)" title="Lihat Penuh">
                        <i class="fas fa-search-plus"></i>
                    </button>
                    <button type="button" class="action-btn delete-btn hidden" id="delete_btn_${col.key}" onclick="removePhotoWithConfirm('${col.key}', event)" title="Hapus Foto">
                        <i class="fas fa-trash"></i>
                    </button>
                    <label class="action-btn upload-btn" title="Pilih File" onclick="checkOverwrite(event, '${col.key}', 'upload_file_${col.key}')">
                        <i class="fas fa-folder-open"></i>
                        <input type="file" id="upload_file_${col.key}" accept="image/*" onchange="handlePhotoSelect(event, '${col.key}')" style="display:none;">
                    </label>
                    <label class="action-btn camera-btn" title="Ambil Foto" onclick="checkOverwrite(event, '${col.key}', 'camera_file_${col.key}')">
                        <i class="fas fa-camera"></i>
                        <input type="file" id="camera_file_${col.key}" accept="image/*" capture="environment" onchange="handlePhotoSelect(event, '${col.key}')" style="display:none;">
                    </label>
                </div>
            </div>
        </div>
    `).join('');
}

function handlePhotoSelect(event, key) {
    const file = event.target.files[0];
    const container = document.getElementById(`upload_${key}`);
    const filenameEl = document.getElementById(`filename_${key}`);
    const previewImg = document.getElementById(`preview_img_${key}`);
    const deleteBtn = document.getElementById(`delete_btn_${key}`);
    const previewBtn = document.getElementById(`preview_btn_${key}`);

    if (file) {
        photoFiles[key] = file;
        photosToDelete.delete(key);
        container.classList.add('has-file');
        filenameEl.textContent = file.name;
        if (previewImg) {
            previewImg.src = URL.createObjectURL(file);
            previewImg.classList.remove('hidden');
        }
        if (deleteBtn) deleteBtn.classList.remove('hidden');
        if (previewBtn) previewBtn.classList.remove('hidden');
    }
}

window.previewFullImage = function(key, event) {
    if (event) event.stopPropagation();
    const previewImg = document.getElementById(`preview_img_${key}`);
    if (previewImg && previewImg.src) {
        Swal.fire({
            imageUrl: previewImg.src,
            imageAlt: 'Preview Foto',
            showConfirmButton: false,
            showCloseButton: true,
            customClass: {
                image: 'full-preview-image'
            }
        });
    }
}

window.removePhotoWithConfirm = function(key, event) {
    if (event) event.stopPropagation();
    
    Swal.fire({
        title: 'Yakin hapus foto?',
        text: 'Foto ini akan dihapus permanen dari Google Drive & Sheet saat Anda klik Update.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Ya, hapus!',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            removePhoto(key, null);
        }
    });
}

window.checkOverwrite = function(event, key, inputId) {
    const container = document.getElementById(`upload_${key}`);
    if (container.classList.contains('has-file')) {
        event.preventDefault();
        Swal.fire({
            title: 'Yakin ganti foto?',
            text: 'Foto lama akan dihapus permanen saat Anda klik Update.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Ya, ganti!',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                document.getElementById(inputId).click();
            }
        });
    }
}

window.removePhoto = function(key, event) {
    if (event) event.stopPropagation();
    delete photoFiles[key];
    photosToDelete.add(key);

    const container = document.getElementById(`upload_${key}`);
    const filenameEl = document.getElementById(`filename_${key}`);
    const previewImg = document.getElementById(`preview_img_${key}`);
    const deleteBtn = document.getElementById(`delete_btn_${key}`);
    const previewBtn = document.getElementById(`preview_btn_${key}`);
    const fileInput = document.getElementById(`upload_file_${key}`);

    if (fileInput) fileInput.value = '';
    if (container) container.classList.remove('has-file');
    if (filenameEl) filenameEl.textContent = '';
    if (previewImg) {
        previewImg.src = '';
        previewImg.classList.add('hidden');
    }
    if (deleteBtn) {
        deleteBtn.classList.add('hidden');
    }
    if (previewBtn) {
        previewBtn.classList.add('hidden');
    }
}

// =====================================================
// ADD / EDIT MODAL
// =====================================================

function openAddModal() {
    document.getElementById('addEditTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Tambah Data Baru';
    document.getElementById('btnSaveRecord').innerHTML = '<i class="fas fa-save"></i> Simpan';
    document.getElementById('editRecordId').value = '';
    document.getElementById('recordForm').reset();
    photoFiles = {};
    photosToDelete = new Set();
    const valSection = document.getElementById('editValidationSection');
    if (valSection) valSection.style.display = 'none';
    initPhotoUploadGrid();
    document.getElementById('addEditModal').classList.add('active');
}

function openEditModal(id) {
    const record = allRecords.find(r => String(r.id) === String(id));
    if (!record) {
        showToast('Record tidak ditemukan', 'error');
        return;
    }

    document.getElementById('addEditTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Data';
    document.getElementById('btnSaveRecord').innerHTML = '<i class="fas fa-save"></i> Update';
    document.getElementById('editRecordId').value = record.id;
    document.getElementById('formNomorMaterial').value = record.nomorMaterial || '';
    document.getElementById('formNegara').value = record.negara || '';
    document.getElementById('formDistributor').value = record.distributor || '';
    document.getElementById('formFlavor').value = record.flavor || '';
    document.getElementById('formKodeProduksi1').value = record.kodeProduksi1 || '';
    document.getElementById('formKodeProduksi2').value = record.kodeProduksi2 || '';
    document.getElementById('formKodeProduksi3').value = record.kodeProduksi3 || '';

    photoFiles = {};
    photosToDelete = new Set();
    initPhotoUploadGrid();

    // Show existing photo names and status
    CONFIG.PHOTO_COLUMNS.forEach(col => {
        const nameInput = document.getElementById(`photoname_${col.key}`);
        if (nameInput) nameInput.value = record[col.key] || '';

        const linkKey = 'link_' + col.key;
        const photoLink = record[linkKey] || '';
        const photoName = record[col.key] || '';
        const previewImg = document.getElementById(`preview_img_${col.key}`);
        const filenameEl = document.getElementById(`filename_${col.key}`);
        const container = document.getElementById(`upload_${col.key}`);
        const deleteBtn = document.getElementById(`delete_btn_${col.key}`);
        const previewBtn = document.getElementById(`preview_btn_${col.key}`);

        let fileId = null;
        if (photoLink) {
            const match = photoLink.match(/[-\w]{25,}/);
            if (match) fileId = match[0];
        } else if (photoName.match(/[-\w]{25,}/)) {
            fileId = photoName;
        }

        if (fileId) {
            if (filenameEl) filenameEl.textContent = 'File terupload';
            if (container) container.classList.add('has-file');
            if (deleteBtn) deleteBtn.classList.remove('hidden');
            if (previewBtn) previewBtn.classList.remove('hidden');
            
            if (previewImg) {
                previewImg.classList.remove('hidden');
                // Use fast Google Drive Thumbnail URL
                previewImg.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
            }
        }
    });

    if (canValidate()) {
        document.getElementById('editValidationSection').style.display = 'block';
        document.getElementById('editValidationStatus').value = record.validationStatus || '';
        document.getElementById('editValidationReason').value = record.validationReason || '';
    } else {
        document.getElementById('editValidationSection').style.display = 'none';
    }

    document.getElementById('addEditModal').classList.add('active');
}

function closeAddEditModal() {
    document.getElementById('addEditModal').classList.remove('active');
    photoFiles = {};
}

async function saveRecord() {
    const id = document.getElementById('editRecordId').value;
    const nomorMaterial = document.getElementById('formNomorMaterial').value.trim();
    const negara = document.getElementById('formNegara').value.trim();
    const distributor = document.getElementById('formDistributor').value.trim();
    const flavor = document.getElementById('formFlavor').value.trim();
    const kodeProduksi1 = document.getElementById('formKodeProduksi1').value.trim();
    const kodeProduksi2 = document.getElementById('formKodeProduksi2').value.trim();
    const kodeProduksi3 = document.getElementById('formKodeProduksi3').value.trim();

    if (!nomorMaterial || !negara || !distributor || !flavor) {
        showToast('Mohon isi semua field yang wajib', 'warning');
        return;
    }

    const user = auth.getUser();
    const now = new Date().toISOString();
    // Auto set tanggal to current date
    const tanggal = now.split('T')[0];
    const btn = document.getElementById('btnSaveRecord');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

    try {
        // Upload photos (if any new files) — kompres high-res (max 5MB/foto) + paralel + retry
        const uploadedPhotos = {};
        const photoEntries = Object.entries(photoFiles);
        if (photoEntries.length > 0) {
            showLoading(`🗜️ Mengompres ${photoEntries.length} foto...`);
            const r = await uploadPhotosParallel(photoEntries, flavor, (done, total) => {
                const pct = Math.round((done / total) * 100);
                showLoading(`📤 Upload foto ${done}/${total} (${pct}%)...`);
            });
            Object.assign(uploadedPhotos, r.uploaded);
            hideLoading();
            if (r.failed.length > 0) {
                const labels = r.failed.map(k =>
                    (CONFIG.PHOTO_COLUMNS.find(c => c.key === k) || {}).label || k
                ).join(', ');
                showToast(`⚠️ ${r.failed.length} foto gagal terupload (${labels}). Data tetap disimpan — silakan edit & upload ulang foto tersebut.`, 'warning');
            }
        }

        photosToDelete.forEach(key => {
            uploadedPhotos['link_' + key] = '';
        });

        const recordData = {
            tanggal,
            nomorMaterial,
            negara,
            distributor,
            flavor,
            kodeProduksi1,
            kodeProduksi2,
            kodeProduksi3,
            ...uploadedPhotos
        };

        // Capture photo names from text inputs
        CONFIG.PHOTO_COLUMNS.forEach(col => {
            const nameInput = document.getElementById(`photoname_${col.key}`);
            if (nameInput) {
                recordData[col.key] = nameInput.value.trim();
            }
        });

        if (id) {
            // Update
            recordData.updatedAt = now;
            recordData.updatedBy = user?.name || 'Unknown';
            
            // Delete old photos from Drive if they were removed or replaced
            const existingRecord = allRecords.find(r => String(r.id) === String(id));
            if (existingRecord) {
                const keysToDeleteOldFile = new Set([...photosToDelete, ...Object.keys(photoFiles)]);
                for (const key of keysToDeleteOldFile) {
                    const oldLink = existingRecord['link_' + key];
                    if (oldLink) {
                        const match = oldLink.match(/[-\w]{25,}/);
                        if (match) {
                            try {
                                showLoading(`🗑️ Menghapus foto lama...`);
                                await storage.deletePhoto(match[0]);
                            } catch (e) {
                                console.error('Gagal hapus foto lama:', e);
                            }
                        }
                    }
                    if (photosToDelete.has(key)) {
                        recordData[key] = ''; // Also clear the photo name if it was explicitly deleted
                    }
                }
            }

            await storage.updateRecord(id, recordData);
            
            if (canValidate()) {
                const validationStatus = document.getElementById('editValidationStatus').value;
                const validationReason = document.getElementById('editValidationReason').value;
                await storage.validateRecord(id, {
                    validationStatus,
                    validationReason,
                    validatedBy: user?.name,
                    validatedAt: now
                });
            }
            
            showToast('✅ Data berhasil diupdate', 'success');
        } else {
            // Add new
            recordData.id = generateId('REC');
            recordData.createdAt = now;
            recordData.updatedAt = now;
            recordData.createdBy = user?.name || 'Unknown';
            recordData.updatedBy = user?.name || 'Unknown';
            recordData.validationStatus = '';
            await storage.addRecord(recordData);
            showToast('✅ Data berhasil ditambahkan', 'success');
        }

        closeAddEditModal();

        // Reload records
        showLoading('🔄 Memperbarui data...');
        await loadRecords();
        hideLoading();
        renderRecords();

    } catch (error) {
        console.error('Save error:', error);
        showToast('❌ Gagal menyimpan data: ' + error.message, 'error');
        hideLoading();
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Simpan';
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// =====================================================
// FAST UPLOAD: Kompresi high-res + Paralel + Retry
// - File <= 5MB dikirim ORIGINAL tanpa kompresi (kualitas 100%).
// - File > 5MB dikompres adaptif (resolusi max 3840px, JPEG q92
//   turun bertahap) sampai <= 5MB. Misal foto 10MB -> ~3-5MB
//   tetap tajam, bukan 200KB seperti sebelumnya.
// - PENGECUALIAN: Etiket Banded (photo_etiketbanded) SELALU dikirim
//   ORIGINAL 1:1 tanpa kompresi — misal 12MB ya terupload 12MB.
// =====================================================

const UPLOAD_CONFIG = {
    MAX_DIM: 3840,                    // sisi terpanjang max 3840px (4K, tetap high-res)
    QUALITY: 0.92,                    // kualitas JPEG awal 92%
    MIN_QUALITY: 0.70,                // kualitas terendah bila file masih > 5MB
    MAX_FILE_SIZE: 5 * 1024 * 1024,   // target: maksimal 5MB per foto (non-pengecualian)
    ORIGINAL_KEYS: ['photo_etiketbanded'], // Etiket Banded: selalu original, tanpa kompresi
    BATCH_MAX_BYTES: 8 * 1024 * 1024, // batch 1-request hanya bila total <= 8MB
    CONCURRENCY: 2,     // 2 foto diupload bersamaan (file besar -> jangan 3)
    MAX_RETRY: 2,       // tiap foto dicoba max 2x
    RETRY_DELAY: 2000   // jeda antar retry (ms)
};

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Kompres satu file gambar via canvas dengan target max 5MB high-res.
// - key termasuk ORIGINAL_KEYS (Etiket Banded) -> SELALU ORIGINAL 1:1.
// - File <= MAX_FILE_SIZE -> kembalikan ORIGINAL (tanpa quality loss).
// - File lebih besar -> encode JPEG adaptif: coba kualitas 0.92 di
//   resolusi penuh (max 3840px); bila masih > 5MB, turunkan kualitas
//   lalu kecilkan dimensi bertahap sampai <= 5MB.
// Return File JPEG terkompresi (atau file original bila gagal/decode error).
async function compressImage(file, maxDim = UPLOAD_CONFIG.MAX_DIM, quality = UPLOAD_CONFIG.QUALITY, key = '') {
    // Bukan gambar -> kembalikan apa adanya
    if (!file.type || !file.type.startsWith('image/')) return file;
    // Etiket Banded -> SELALU original 1:1, tanpa kompresi berapa pun ukurannya
    // (perbandingan case-insensitive agar tidak lolos karena beda huruf)
    const normKey = String(key || '').trim().toLowerCase();
    const originalKeys = (UPLOAD_CONFIG.ORIGINAL_KEYS || []).map(k => String(k).toLowerCase());
    if (normKey && originalKeys.includes(normKey)) {
        console.log(`📷 Etiket Banded: original ${(file.size / 1024 / 1024).toFixed(2)}MB tanpa kompresi (${file.name})`);
        return file;
    }
    // File sudah <= 5MB -> JANGAN dikompres, kirim original (kualitas 100%)
    if (file.size <= UPLOAD_CONFIG.MAX_FILE_SIZE) return file;

    let bitmap = null;
    try {
        if (typeof createImageBitmap === 'function') {
            try {
                bitmap = await createImageBitmap(file, { imageOrientation: 'fromImage' });
            } catch (e) {
                bitmap = await createImageBitmap(file);
            }
        }
    } catch (e) { bitmap = null; }

    let w, h, source = null;
    if (bitmap) {
        w = bitmap.width; h = bitmap.height; source = bitmap;
    } else {
        // Fallback: <img>
        const url = URL.createObjectURL(file);
        try {
            const img = await new Promise((resolve, reject) => {
                const el = new Image();
                el.onload = () => resolve(el);
                el.onerror = () => reject(new Error('File bukan gambar valid'));
                el.src = url;
            });
            w = img.naturalWidth; h = img.naturalHeight; source = img;
        } catch (e) {
            URL.revokeObjectURL(url);
            return file; // gagal decode (mis. HEIC) -> kirim original
        }
        // jangan revoke dulu sebelum draw; revoke setelah draw di bawah
        source._objectUrl = url;
    }

    // Encode satu ukuran canvas ke JPEG dengan quality tertentu.
    const encodeAt = (dw, dh, q) => new Promise((res) => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = dw; canvas.height = dh;
            const ctx = canvas.getContext('2d');
            // Background putih agar PNG transparan tidak jadi hitam saat ke JPEG
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, dw, dh);
            if (bitmap) {
                ctx.drawImage(bitmap, 0, 0, dw, dh);
            } else {
                ctx.drawImage(source, 0, 0, dw, dh);
            }
            canvas.toBlob(res, 'image/jpeg', q);
        } catch (e) {
            res(null);
        }
    });

    try {
        // Tangga dimensi (high-res dulu) & kualitas (tinggi dulu).
        const dimSteps = [maxDim, 3200, 2560, 1920].filter(d => d > 0);
        const qSteps = [quality, 0.85, 0.78, UPLOAD_CONFIG.MIN_QUALITY || 0.7];
        let bestBlob = null;

        outer:
        for (const dim of dimSteps) {
            const scale = Math.min(1, dim / Math.max(w, h));
            const dw = Math.max(1, Math.round(w * scale));
            const dh = Math.max(1, Math.round(h * scale));
            for (const q of qSteps) {
                const blob = await encodeAt(dw, dh, q);
                if (!blob) continue;
                bestBlob = blob;
                if (blob.size <= UPLOAD_CONFIG.MAX_FILE_SIZE) {
                    break outer; // dapat yang <= 5MB dengan resolusi/kualitas terbaik
                }
                // masih > 5MB -> coba kualitas lebih rendah / dimensi lebih kecil
            }
        }

        if (bitmap) { try { bitmap.close(); } catch (_) {} }
        else if (source && source._objectUrl) URL.revokeObjectURL(source._objectUrl);

        if (!bestBlob) return file;
        const baseName = (file.name || 'photo').replace(/\.\w+$/, '');
        const out = new File([bestBlob], baseName + '.jpg', { type: 'image/jpeg' });
        console.log(`🗜️ Kompresi high-res: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(out.size / 1024 / 1024).toFixed(2)}MB (${file.name})`);
        return out;
    } catch (e) {
        console.warn('Kompresi gagal, pakai file original:', e.message);
        try { if (bitmap) bitmap.close(); } catch (_) {}
        try { if (source && source._objectUrl) URL.revokeObjectURL(source._objectUrl); } catch (_) {}
        return file;
    }
}

function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

// Siapkan payload satu foto: kompres (kecuali Etiket Banded = original) -> base64 -> objek siap kirim.
async function preparePhotoPayload(key, file, flavor) {
    const photoLabel = CONFIG.PHOTO_COLUMNS.find(c => c.key === key)?.label || key;
    const compressed = await compressImage(file, UPLOAD_CONFIG.MAX_DIM, UPLOAD_CONFIG.QUALITY, key);
    console.log(`📤 Payload ${key}: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressed.size / 1024 / 1024).toFixed(2)}MB`);
    const base64 = await blobToBase64(compressed);
    const ext = (compressed.name && compressed.name.includes('.'))
        ? compressed.name.split('.').pop()
        : 'jpg';
    return {
        key,
        payload: {
            fileName: `${flavor}_${photoLabel}_${Date.now()}.${ext}`,
            mimeType: compressed.type || 'image/jpeg',
            base64Data: base64,
            folderName: photoLabel
        }
    };
}

// Kirim SATU payload foto dengan retry. Return fileId atau throw.
async function sendPhotoPayload(payload) {
    let lastErr = null;
    for (let attempt = 1; attempt <= UPLOAD_CONFIG.MAX_RETRY; attempt++) {
        try {
            const result = await storage.uploadPhoto(payload);
            if (result && result.success && result.fileId) return result.fileId;
            lastErr = new Error((result && result.error) || 'Upload gagal tanpa pesan');
        } catch (e) {
            lastErr = e;
        }
        if (attempt < UPLOAD_CONFIG.MAX_RETRY) {
            await sleep(UPLOAD_CONFIG.RETRY_DELAY * attempt);
        }
    }
    throw lastErr;
}

// Upload BANYAK foto dengan strategi tercepat:
// 1. Kompres high-res semua (paralel, lokal — cepat, max 5MB/foto).
// 2. Coba BATCH 1 request HANYA bila total payload kecil (hemat cold-start
//    Apps Script). File besar -> langsung satuan agar tidak melebihi limit
//    ukuran/timeout Apps Script.
// 3. Sisa yang gagal -> satuan paralel (max CONCURRENCY jalur) + retry.
// onProgress(done, total) dipanggil tiap satu foto selesai.
// Return { uploaded: {link_key: url}, failed: [key...] }
async function uploadPhotosParallel(entries, flavor, onProgress) {
    const uploaded = {};
    const failed = [];
    const total = entries.length;
    let done = 0;
    const tick = () => { done++; if (onProgress) onProgress(done, total); };

    // --- Langkah 1: kompres semua sekaligus ---
    const prepared = await Promise.all(
        entries.map(([key, file]) => preparePhotoPayload(key, file, flavor).catch(err => {
            console.error(`Kompresi gagal untuk ${key}:`, err);
            failed.push(key); tick();
            return null;
        }))
    );
    let pending = prepared.filter(Boolean);

    // --- Langkah 2: coba batch 1 request (butuh backend terbaru) ---
    // Dilewati bila total payload besar (foto high-res 5MB): 1 request raksasa
    // rawan timeout/limit Apps Script — lebih aman upload satuan paralel.
    const totalBytes = pending.reduce((s, p) => s + ((p.payload.base64Data || '').length * 0.75), 0);
    if (pending.length > 1 && totalBytes <= (UPLOAD_CONFIG.BATCH_MAX_BYTES || 8 * 1024 * 1024)) {
        try {
            const batchResult = await storage.uploadPhotos(
                pending.map(p => ({ key: p.key, ...p.payload }))
            );
            if (batchResult && batchResult.success && Array.isArray(batchResult.results)) {
                const okKeys = new Set();
                for (const r of batchResult.results) {
                    if (r && r.fileId) {
                        uploaded['link_' + r.key] = 'https://lh3.googleusercontent.com/d/' + r.fileId;
                        okKeys.add(r.key); tick();
                    }
                }
                pending = pending.filter(p => !okKeys.has(p.key));
                // yang error di batch -> lanjut ke satuan di bawah (tanpa tick ganda)
                if (pending.length === 0) return { uploaded, failed };
            }
            // else: backend lama / batch gagal total -> fallback satuan semua
        } catch (e) {
            console.warn('Batch upload gagal, fallback ke satuan:', e.message);
        }
    }

    // --- Langkah 3: satuan paralel + retry ---
    let cursor = 0;
    async function worker() {
        while (cursor < pending.length) {
            const item = pending[cursor++];
            try {
                const fileId = await sendPhotoPayload(item.payload);
                uploaded['link_' + item.key] = 'https://lh3.googleusercontent.com/d/' + fileId;
            } catch (err) {
                console.error(`Photo upload failed for ${item.key}:`, err);
                failed.push(item.key);
            }
            tick();
        }
    }

    const workers = [];
    const n = Math.min(UPLOAD_CONFIG.CONCURRENCY, pending.length);
    for (let i = 0; i < n; i++) workers.push(worker());
    await Promise.all(workers);
    return { uploaded, failed };
}

// =====================================================
// DELETE RECORD
// =====================================================

async function deleteRecord(id) {
    const record = allRecords.find(r => String(r.id) === String(id));
    if (!record) return;

    if (!confirm(`Hapus record "${record.flavor}"?\n\nData yang dihapus tidak dapat dikembalikan.`)) return;

    showLoading('🗑️ Menghapus data...');
    try {
        await storage.deleteRecord(id);
        showToast('✅ Data berhasil dihapus', 'success');
        await loadRecords();
        renderRecords();
    } catch (error) {
        showToast('❌ Gagal menghapus: ' + error.message, 'error');
    }
    hideLoading();
}

// =====================================================
// PREVIEW MODAL
// =====================================================

function openPreview(id) {
    const record = allRecords.find(r => String(r.id) === String(id));
    if (!record) {
        showToast('Record tidak ditemukan', 'error');
        return;
    }

    currentPreviewRecord = record;

    // Render photo tabs
    const tabsContainer = document.getElementById('previewPhotoTabs');
    tabsContainer.innerHTML = CONFIG.PHOTO_COLUMNS.map((col, i) => `
        <button class="photo-tab ${i === 0 ? 'active' : ''}" onclick="switchPhotoTab(this, '${col.key}')">
            ${col.label}
        </button>
    `).join('');

    // Show first photo
    showPhotoInViewer(CONFIG.PHOTO_COLUMNS[0].key);

    // Render info
    const infoGrid = document.getElementById('previewInfoGrid');
    infoGrid.innerHTML = `
        <div class="preview-info-item"><i class="fas fa-globe"></i> Negara: <strong>${escapeHtml(record.negara || '-')}</strong></div>
        <div class="preview-info-item"><i class="fas fa-building"></i> Distributor: <strong>${escapeHtml(record.distributor || '-')}</strong></div>
        <div class="preview-info-item"><i class="fas fa-barcode"></i> Nomor Material: <strong>${escapeHtml(record.nomorMaterial || '-')}</strong></div>
        <div class="preview-info-item"><i class="fas fa-calendar"></i> Tanggal: <strong>${formatDate(record.tanggal)}</strong></div>
        <div class="preview-info-item"><i class="fas fa-tag"></i> Flavor: <strong>${escapeHtml(record.flavor || '-')}</strong></div>
    `;

    // Kode Produksi
    document.getElementById('previewKodeProduksi1').textContent = record.kodeProduksi1 || '-';
    document.getElementById('previewKodeProduksi2').textContent = record.kodeProduksi2 || '-';
    document.getElementById('previewKodeProduksi3').textContent = record.kodeProduksi3 || '-';

    // Validation
    renderValidationSection(record);

    document.getElementById('previewModal').classList.add('active');
}

function closePreviewModal() {
    document.getElementById('previewModal').classList.remove('active');
    currentPreviewRecord = null;
}

function switchPhotoTab(btn, key) {
    document.querySelectorAll('.photo-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    showPhotoInViewer(key);
}

async function showPhotoInViewer(key) {
    const viewer = document.getElementById('previewPhotoViewer');
    const photoName = currentPreviewRecord?.[key] || '';
    const photoLink = currentPreviewRecord?.['link_' + key] || '';
    
    let fileId = null;
    if (photoLink) {
        const match = photoLink.match(/[-\w]{25,}/);
        if (match) fileId = match[0];
    } else if (photoName.match(/[-\w]{25,}/)) {
        fileId = photoName; // fallback for old data
    }

    if (!fileId && !photoName) {
        viewer.innerHTML = `<div class="no-photo"><i class="fas fa-image"></i><span>Tidak ada foto</span></div>`;
        return;
    }
    
    if (!fileId) {
        viewer.innerHTML = `<div class="no-photo" style="flex-direction:column; gap:10px;"><i class="fas fa-image" style="font-size:3rem; color:var(--gray-300);"></i><span><strong>${escapeHtml(photoName)}</strong></span><span style="font-size:0.85rem; color:var(--gray-500);">File foto belum diupload</span></div>`;
        return;
    }

    viewer.innerHTML = `<div class="no-photo"><i class="fas fa-spinner fa-spin"></i><span>Memuat foto...</span></div>`;
    
    const nameLabel = photoName && photoName !== fileId ? `<div style="position:absolute; top:10px; left:10px; background:rgba(0,0,0,0.6); color:white; padding:4px 8px; border-radius:4px; z-index:10; font-size:0.85rem;">${escapeHtml(photoName)}</div>` : '';

    const driveUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    viewer.innerHTML = `${nameLabel}<img src="${driveUrl}" alt="Photo" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'no-photo\\'><i class=\\'fas fa-exclamation-triangle\\'></i><span>Gagal memuat foto</span></div>'">`;
}

function renderValidationSection(record) {
    const content = document.getElementById('validationContent');

    if (record.validationStatus === 'valid') {
        content.innerHTML = `
            <div class="validation-box valid">
                <i class="fas fa-check-circle"></i>
                <div>
                    <strong>Valid</strong> - Data sudah sesuai
                    ${record.validationReason ? `<br><small>${escapeHtml(record.validationReason)}</small>` : ''}
                    ${record.validatedBy ? `<br><small>Oleh: ${escapeHtml(record.validatedBy)} • ${formatDate(record.validatedAt)}</small>` : ''}
                </div>
            </div>
        `;
    } else if (record.validationStatus === 'invalid') {
        content.innerHTML = `
            <div class="validation-box invalid">
                <i class="fas fa-times-circle"></i>
                <div>
                    <strong>Invalid</strong> - Data tidak sesuai
                    ${record.validationReason ? `<br><small>${escapeHtml(record.validationReason)}</small>` : ''}
                    ${record.validatedBy ? `<br><small>Oleh: ${escapeHtml(record.validatedBy)} • ${formatDate(record.validatedAt)}</small>` : ''}
                </div>
            </div>
        `;
    } else {
        content.innerHTML = `
            <div class="validation-box pending">
                <i class="fas fa-clock"></i>
                <div>
                    <strong>Belum Divalidasi</strong>
                    <br><small>Data ini belum divalidasi oleh validator</small>
                </div>
            </div>
        `;
    }
}
