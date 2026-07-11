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
                        ${userCanEdit ? `
                        <button class="btn-action edit" onclick="openEditModal('${record.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action delete" onclick="deleteRecord('${record.id}')" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>` : ''}
                        ${userCanValidate ? `
                        <button class="btn-action validate" onclick="openValidationModal('${record.id}')" title="Validasi">
                            <i class="fas fa-clipboard-check"></i>
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
                <div class="upload-content" id="upload_content_${col.key}">
                    <i class="fas fa-cloud-upload-alt upload-icon"></i>
                    <span class="upload-label">${col.label}</span>
                    <span class="upload-filename" id="filename_${col.key}"></span>
                </div>
                <input type="file" accept="image/*" onchange="handlePhotoSelect(event, '${col.key}')" capture="environment">
            </div>
        </div>
    `).join('');
}

function handlePhotoSelect(event, key) {
    const file = event.target.files[0];
    const container = document.getElementById(`upload_${key}`);
    const filenameEl = document.getElementById(`filename_${key}`);
    const previewImg = document.getElementById(`preview_img_${key}`);

    if (file) {
        photoFiles[key] = file;
        container.classList.add('has-file');
        filenameEl.textContent = file.name;
        if (previewImg) {
            previewImg.src = URL.createObjectURL(file);
            previewImg.classList.remove('hidden');
        }
    } else {
        delete photoFiles[key];
        container.classList.remove('has-file');
        filenameEl.textContent = '';
        if (previewImg) {
            previewImg.src = '';
            previewImg.classList.add('hidden');
        }
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

        let fileId = null;
        if (photoLink) {
            const match = photoLink.match(/[-\w]{25,}/);
            if (match) fileId = match[0];
        } else if (photoName.match(/[-\w]{25,}/)) {
            fileId = photoName;
        }

        if (fileId) {
            if (filenameEl) filenameEl.textContent = 'Memuat...';
            if (container) container.classList.add('has-file');
            
            if (previewImg) {
                previewImg.classList.remove('hidden');
                // Fetch base64 asynchronously just like in Detail Viewer
                storage.getPhotoBase64({ fileId }).then(result => {
                    if (result.success && result.base64) {
                        previewImg.src = `data:${result.mimeType || 'image/jpeg'};base64,${result.base64}`;
                    } else {
                        previewImg.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
                    }
                    if (filenameEl) filenameEl.textContent = 'File terupload';
                }).catch(() => {
                    previewImg.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
                    if (filenameEl) filenameEl.textContent = 'File terupload';
                });
            }
        }
    });

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
        // Upload photos first (if any new files)
        const uploadedPhotos = {};
        for (const [key, file] of Object.entries(photoFiles)) {
            try {
                showLoading(`📤 Upload foto ${key}...`);
                const base64 = await fileToBase64(file);
                const photoLabel = CONFIG.PHOTO_COLUMNS.find(c => c.key === key)?.label || key;
                const result = await storage.uploadPhoto({
                    fileName: `${flavor}_${photoLabel}_${Date.now()}.${file.name.split('.').pop()}`,
                    mimeType: file.type,
                    base64Data: base64,
                    folderName: photoLabel
                });
                if (result.success && result.fileId) {
                    uploadedPhotos['link_' + key] = 'https://lh3.googleusercontent.com/d/' + result.fileId;
                }
            } catch (uploadErr) {
                console.error(`Photo upload failed for ${key}:`, uploadErr);
            }
        }
        hideLoading();

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
            await storage.updateRecord(id, recordData);
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

    try {
        const result = await storage.getPhotoBase64({ fileId: fileId });
        if (result.success && result.base64) {
            viewer.innerHTML = `${nameLabel}<img src="data:${result.mimeType || 'image/jpeg'};base64,${result.base64}" alt="Photo" loading="lazy">`;
        } else {
            const driveUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
            viewer.innerHTML = `${nameLabel}<img src="${driveUrl}" alt="Photo" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'no-photo\\'><i class=\\'fas fa-exclamation-triangle\\'></i><span>Gagal memuat foto</span></div>'">`;
        }
    } catch (error) {
        const driveUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
        viewer.innerHTML = `${nameLabel}<img src="${driveUrl}" alt="Photo" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'no-photo\\'><i class=\\'fas fa-exclamation-triangle\\'></i><span>Gagal memuat foto</span></div>'">`;
    }
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

// =====================================================
// VALIDATION MODAL
// =====================================================

function openValidationModal(id) {
    document.getElementById('validateRecordId').value = id;
    document.getElementById('validationStatus').value = '';
    document.getElementById('validationReason').value = '';
    document.getElementById('validationModal').classList.add('active');
}

function closeValidationModal() {
    document.getElementById('validationModal').classList.remove('active');
}

async function submitValidation() {
    const id = document.getElementById('validateRecordId').value;
    const status = document.getElementById('validationStatus').value;
    const reason = document.getElementById('validationReason').value.trim();
    const user = auth.getUser();

    if (!status) {
        showToast('Pilih status validasi', 'warning');
        return;
    }

    showLoading('📝 Menyimpan validasi...');
    try {
        await storage.validateRecord(id, {
            validationStatus: status,
            validationReason: reason,
            validatedBy: user?.name || 'Unknown',
            validatedAt: new Date().toISOString()
        });

        showToast('✅ Validasi berhasil disimpan', 'success');
        closeValidationModal();

        await loadRecords();
        renderRecords();
    } catch (error) {
        showToast('❌ Gagal menyimpan validasi: ' + error.message, 'error');
    }
    hideLoading();
}
