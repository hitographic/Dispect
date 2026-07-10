// =====================================================
// DISPECT - User Management Script
// Admin-only page for managing users
// =====================================================

let allUsers = [];

document.addEventListener('DOMContentLoaded', function () {
    if (!protectPage()) return;

    if (!isAdmin()) {
        showToast('Halaman ini hanya bisa diakses admin', 'error');
        setTimeout(() => {
            const basePath = window.location.pathname.includes(CONFIG.BASE_PATH) ? CONFIG.BASE_PATH : './';
            window.location.href = basePath + 'records.html';
        }, 1500);
        return;
    }

    const user = auth.getUser();
    document.getElementById('userName').textContent = user?.name || 'Admin';

    initPermissionsCheckboxes();
    loadUsers();
});

// =====================================================
// LOAD USERS
// =====================================================

async function loadUsers() {
    try {
        showLoading('Memuat data user...');
        allUsers = await sheetsDB.getUsers();
        hideLoading();
        renderUsersTable();
    } catch (error) {
        hideLoading();
        showToast('❌ Gagal memuat data user: ' + error.message, 'error');
        renderUsersTable();
    }
}

// =====================================================
// RENDER TABLE
// =====================================================

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    document.getElementById('userCount').textContent = `${allUsers.length} users`;

    if (allUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:40px;color:var(--gray-400);">
                    <i class="fas fa-users" style="font-size:2rem;margin-bottom:8px;opacity:0.3;display:block;"></i>
                    Belum ada user
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = allUsers.map(user => {
        const roleBadge = `<span class="role-badge ${user.role || 'field'}">${escapeHtml(user.role || 'field')}</span>`;

        let permissions = [];
        if (user.permissions) {
            if (Array.isArray(user.permissions)) {
                permissions = user.permissions;
            } else if (typeof user.permissions === 'string') {
                permissions = user.permissions.split('|').map(p => p.trim()).filter(p => p);
            }
        }

        const permTags = permissions.map(p => `<span style="display:inline-block;padding:1px 6px;background:var(--primary-50);color:var(--primary-700);border-radius:4px;font-size:0.7rem;margin:1px;">${escapeHtml(p)}</span>`).join(' ');

        return `
            <tr>
                <td style="font-weight:600;font-family:monospace;">${escapeHtml(user.nik || '-')}</td>
                <td>${escapeHtml(user.name || '-')}</td>
                <td>${roleBadge}</td>
                <td>${permTags || '<span style="color:var(--gray-400)">-</span>'}</td>
                <td style="font-size:0.8rem;color:var(--gray-500);">${formatDate(user.createdAt)}</td>
                <td style="text-align:center;">
                    <div style="display:flex;gap:4px;justify-content:center;">
                        <button class="btn-action edit" onclick="openEditUserModal('${user.nik}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action delete" onclick="deleteUser('${user.nik}')" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// =====================================================
// PERMISSIONS CHECKBOXES
// =====================================================

function initPermissionsCheckboxes() {
    const container = document.getElementById('permissionsCheckboxes');
    container.innerHTML = CONFIG.PERMISSIONS.map(perm => `
        <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;font-weight:400;color:var(--gray-700);cursor:pointer;">
            <input type="checkbox" value="${perm}" class="perm-checkbox" style="accent-color:var(--primary-color);">
            ${perm.replace(/_/g, ' ')}
        </label>
    `).join('');
}

function getSelectedPermissions() {
    return Array.from(document.querySelectorAll('.perm-checkbox:checked')).map(cb => cb.value);
}

function setSelectedPermissions(permsArr) {
    document.querySelectorAll('.perm-checkbox').forEach(cb => {
        cb.checked = permsArr.includes(cb.value);
    });
}

// =====================================================
// ADD / EDIT USER MODAL
// =====================================================

function openAddUserModal() {
    document.getElementById('userModalTitle').innerHTML = '<i class="fas fa-user-plus"></i> Tambah User Baru';
    document.getElementById('btnSaveUser').innerHTML = '<i class="fas fa-save"></i> Simpan';
    document.getElementById('editUserNik').value = '';
    document.getElementById('userForm').reset();
    document.getElementById('formUserNik').disabled = false;
    setSelectedPermissions([]);
    document.getElementById('userModal').classList.add('active');
}

function openEditUserModal(nik) {
    const user = allUsers.find(u => String(u.nik) === String(nik));
    if (!user) {
        showToast('User tidak ditemukan', 'error');
        return;
    }

    document.getElementById('userModalTitle').innerHTML = '<i class="fas fa-user-edit"></i> Edit User';
    document.getElementById('btnSaveUser').innerHTML = '<i class="fas fa-save"></i> Update';
    document.getElementById('editUserNik').value = user.nik;

    document.getElementById('formUserNik').value = user.nik;
    document.getElementById('formUserNik').disabled = true; // NIK cannot be changed
    document.getElementById('formUserPassword').value = user.password || '';
    document.getElementById('formUserName').value = user.name || '';
    document.getElementById('formUserRole').value = user.role || 'field';

    let perms = [];
    if (user.permissions) {
        if (Array.isArray(user.permissions)) perms = user.permissions;
        else if (typeof user.permissions === 'string') perms = user.permissions.split('|').map(p => p.trim()).filter(p => p);
    }
    setSelectedPermissions(perms);

    document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
}

async function saveUser() {
    const editNik = document.getElementById('editUserNik').value;
    const nik = document.getElementById('formUserNik').value.trim();
    const password = document.getElementById('formUserPassword').value;
    const name = document.getElementById('formUserName').value.trim();
    const role = document.getElementById('formUserRole').value;
    const permissions = getSelectedPermissions().join('|');

    if (!nik || !password || !name || !role) {
        showToast('Mohon isi semua field', 'warning');
        return;
    }

    const btn = document.getElementById('btnSaveUser');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

    try {
        const now = new Date().toISOString();
        const userData = { nik, password, name, role, permissions };

        if (editNik) {
            // Update
            userData.updatedAt = now;
            await sheetsDB.updateUser(editNik, userData);
            showToast('✅ User berhasil diupdate', 'success');
        } else {
            // Add
            userData.createdAt = now;
            userData.updatedAt = now;
            await sheetsDB.addUser(userData);
            showToast('✅ User berhasil ditambahkan', 'success');
        }

        closeUserModal();
        await loadUsers();
    } catch (error) {
        showToast('❌ Gagal menyimpan: ' + error.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Simpan';
}

// =====================================================
// DELETE USER
// =====================================================

async function deleteUser(nik) {
    const user = allUsers.find(u => String(u.nik) === String(nik));
    if (!user) return;

    if (!confirm(`Hapus user "${user.name}" (NIK: ${nik})?\n\nData yang dihapus tidak dapat dikembalikan.`)) return;

    showLoading('🗑️ Menghapus user...');
    try {
        await sheetsDB.deleteUser(nik);
        showToast('✅ User berhasil dihapus', 'success');
        await loadUsers();
    } catch (error) {
        showToast('❌ Gagal menghapus: ' + error.message, 'error');
    }
    hideLoading();
}
