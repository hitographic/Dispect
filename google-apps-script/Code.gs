// =====================================================
// DISPECT - Google Apps Script Backend
// Deploy: Execute as ME (animenja.store@gmail.com), Access: Anyone
//
// IMPORTANT: After pasting this code:
// 1. Open appsscript.json (View > Show manifest file)
// 2. Add these oauthScopes:
//    "oauthScopes": [
//      "https://www.googleapis.com/auth/spreadsheets",
//      "https://www.googleapis.com/auth/drive",
//      "https://www.googleapis.com/auth/script.external_request"
//    ]
// 3. Run testDriveAccess() manually → Accept permission prompt
// 4. Deploy > New deployment > Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy new URL to js/config.js
// =====================================================
//
// SHEETS:
// 1. Records - Data inspeksi produk (23 kolom)
// 2. Users - Data user (NIK, password, name, role, permissions)
//
// RECORDS STRUCTURE (23 kolom):
// A:id, B:tanggal, C:flavor, D:nomorMaterial, E:negara, F:distributor,
// G:createdAt, H:updatedAt, I:createdBy, J:updatedBy,
// K:photo_bumbu, L:photo_mbumbu, M:photo_si,
// N:photo_kartonDepan, O:photo_kartonBelakang,
// P:photo_etiket, Q:photo_etiketbanded, R:photo_plakban,
// S:kodeProduksi, T:validationStatus, U:validatedBy, V:validatedAt, W:validationReason
// =====================================================

// ===== CONFIGURATION =====
var SPREADSHEET_ID = '1ttdxeFz5EWqIuQDEcqX-ekaTN98iHqrcdadZVd50hDE';
var DRIVE_FOLDER_ID = '1n8ym3VQ3mPoMkSzZwL-6Fwz-Xh54iyl4';

var RECORDS_HEADERS = ['id', 'tanggal', 'flavor', 'nomorMaterial', 'negara', 'distributor',
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
                       'validationStatus', 'validatedBy', 'validatedAt', 'validationReason'];

var USERS_HEADERS = ['nik', 'password', 'name', 'role', 'permissions', 'createdAt', 'updatedAt'];

// ===== UNIFIED REQUEST HANDLER =====

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    var params = e.parameter || {};
    var action = params.action;
    var callback = params.callback;

    // Parse POST body
    var postData = {};
    if (e.postData && e.postData.contents) {
      try { postData = JSON.parse(e.postData.contents); } catch (err) {}
      if (postData.action) action = postData.action;
    }

    // Parse data param (JSONP write operations)
    var data = {};
    if (params.data) {
      try { data = JSON.parse(params.data); } catch (err) {}
      if (data.action) action = data.action;
    }

    // Merge all sources
    var merged = {};
    for (var k in params) merged[k] = params[k];
    for (var k in data) merged[k] = data[k];
    for (var k in postData) merged[k] = postData[k];

    var result;

    switch (action) {
      // ===== AUTH =====
      case 'login':
        result = loginUser(merged.nik || params.nik, merged.password || params.password);
        break;

      // ===== USERS =====
      case 'getUsers':
        result = getAllUsersData();
        break;
      case 'addUser':
        result = addUserData(merged.user || merged);
        break;
      case 'updateUser':
        result = updateUserData(merged.nik, merged.user || merged);
        break;
      case 'deleteUser':
        result = deleteUserData(merged.nik);
        break;

      // ===== RECORDS =====
      case 'getAll':
        result = getAllRecordsData();
        break;
      case 'getRecordsBasic':
        result = getRecordsBasicData();
        break;
      case 'get':
        result = getRecordByIdData(merged.id || params.id);
        break;
      case 'addRecord':
        result = addRecordData(merged.record || merged);
        break;
      case 'updateRecord':
        result = updateRecordData(merged.id || merged.recordId, merged.record || merged);
        break;
      case 'deleteRecord':
        result = deleteRecordData(merged.id || merged.recordId);
        break;
      case 'validateRecord':
        result = validateRecordData(merged.id || merged.recordId, merged.validation || merged);
        break;

      // ===== PHOTO =====
      case 'uploadPhoto':
        result = handleUploadPhoto(merged);
        break;
      case 'deletePhoto':
        result = handleDeletePhoto(merged.fileId);
        break;
      case 'getPhotoUrl':
        result = handleGetPhotoUrl(merged.fileId || params.fileId);
        break;
      case 'getPhotoBase64':
        result = handleGetPhotoBase64(merged);
        break;

      // ===== UTILITY =====
      case 'fixStructure':
        result = fixRecordsStructure();
        break;
      case 'testDriveWrite':
        result = testDriveWrite();
        break;

      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }

    // Return JSONP or JSON
    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(result) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    var errorResult = { success: false, error: error.toString() };
    var cb = (e.parameter || {}).callback;
    if (cb) {
      return ContentService
        .createTextOutput(cb + '(' + JSON.stringify(errorResult) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(JSON.stringify(errorResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===== UTILITY FUNCTIONS =====

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

function generateId(prefix) {
  return (prefix || 'ID') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

function nowISO() {
  return new Date().toISOString();
}

// =====================================================
// RECORDS SHEET MANAGEMENT
// =====================================================

function getRecordsSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Records');
  if (!sheet) {
    sheet = ss.insertSheet('Records');
    sheet.getRange(1, 1, 1, RECORDS_HEADERS.length).setValues([RECORDS_HEADERS]);
    sheet.getRange(1, 1, 1, RECORDS_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function fixRecordsStructure() {
  var sheet = getRecordsSheet();
  sheet.getRange(1, 1, 1, RECORDS_HEADERS.length).setValues([RECORDS_HEADERS]);
  sheet.getRange(1, 1, 1, RECORDS_HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return { success: true, message: 'Records structure fixed' };
}

// =====================================================
// USERS SHEET MANAGEMENT
// =====================================================

function getUsersSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  if (!sheet) {
    sheet = ss.insertSheet('Users');
    sheet.getRange(1, 1, 1, USERS_HEADERS.length).setValues([USERS_HEADERS]);
    sheet.getRange(1, 1, 1, USERS_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// =====================================================
// USER OPERATIONS
// =====================================================

function loginUser(nik, password) {
  var sheet = getUsersSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() == String(nik).trim() && String(data[i][1]).trim() == String(password).trim()) {
      var permissionsStr = data[i][4] ? String(data[i][4]).trim() : '';
      var permissions = [];
      if (permissionsStr) {
        permissions = permissionsStr.split('|').map(function(p) { return p.trim(); }).filter(function(p) { return p.length > 0; });
      }

      return {
        success: true,
        user: {
          nik: String(data[i][0]),
          name: data[i][2],
          role: data[i][3],
          permissions: permissions
        }
      };
    }
  }
  return { success: false, error: 'NIK atau password salah' };
}

function getAllUsersData() {
  var sheet = getUsersSheet();
  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) return { success: true, users: [] };

  var users = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      var permStr = data[i][4] ? String(data[i][4]).trim() : '';
      users.push({
        nik: String(data[i][0]),
        password: String(data[i][1]),
        name: data[i][2],
        role: data[i][3],
        permissions: permStr,
        createdAt: data[i][5],
        updatedAt: data[i][6]
      });
    }
  }
  return { success: true, users: users };
}

function addUserData(user) {
  if (!user || !user.nik) return { success: false, error: 'NIK is required' };

  var sheet = getUsersSheet();
  var now = nowISO();
  var permissions = user.permissions || '';
  if (Array.isArray(permissions)) permissions = permissions.join('|');

  var row = [
    String(user.nik),
    user.password || '',
    user.name || '',
    user.role || 'field',
    permissions,
    user.createdAt || now,
    user.updatedAt || now
  ];

  sheet.appendRow(row);
  return { success: true, message: 'User added' };
}

function updateUserData(nik, userData) {
  if (!nik) return { success: false, error: 'NIK is required' };

  var sheet = getUsersSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() == String(nik).trim()) {
      var permissions = userData.permissions || data[i][4];
      if (Array.isArray(permissions)) permissions = permissions.join('|');

      var updatedRow = [
        String(userData.nik || data[i][0]),
        userData.password || data[i][1],
        userData.name || data[i][2],
        userData.role || data[i][3],
        permissions,
        data[i][5], // keep original createdAt
        userData.updatedAt || nowISO()
      ];

      sheet.getRange(i + 1, 1, 1, USERS_HEADERS.length).setValues([updatedRow]);
      return { success: true, message: 'User updated' };
    }
  }
  return { success: false, error: 'User not found' };
}

function deleteUserData(nik) {
  if (!nik) return { success: false, error: 'NIK is required' };

  var sheet = getUsersSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() == String(nik).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'User deleted' };
    }
  }
  return { success: false, error: 'User not found' };
}

// =====================================================
// RECORDS OPERATIONS
// =====================================================

function getAllRecordsData() {
  var sheet = getRecordsSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, records: [] };

  var headers = data[0];
  var records = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var record = {};
    for (var j = 0; j < headers.length; j++) {
      record[headers[j]] = data[i][j] !== undefined ? String(data[i][j]) : '';
    }
    records.push(record);
  }

  return { success: true, records: records };
}

function getRecordsBasicData() {
  // Same as getAll but faster (no photo URL processing)
  return getAllRecordsData();
}

function getRecordByIdData(id) {
  if (!id) return { success: false, error: 'ID is required' };

  var sheet = getRecordsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() == String(id).trim()) {
      var record = {};
      for (var j = 0; j < headers.length; j++) {
        record[headers[j]] = data[i][j] !== undefined ? String(data[i][j]) : '';
      }
      return { success: true, record: record };
    }
  }
  return { success: false, error: 'Record not found' };
}

function addRecordData(record) {
  if (!record) return { success: false, error: 'Record data is required' };

  var sheet = getRecordsSheet();
  var id = record.id || generateId('REC');
  var now = nowISO();

  var row = RECORDS_HEADERS.map(function(header) {
    if (header === 'id') return id;
    if (header === 'createdAt') return record.createdAt || now;
    if (header === 'updatedAt') return record.updatedAt || now;
    return record[header] || '';
  });

  sheet.appendRow(row);

  var newRecord = {};
  RECORDS_HEADERS.forEach(function(h, idx) { newRecord[h] = row[idx]; });

  return { success: true, message: 'Record added', record: newRecord };
}

function updateRecordData(id, recordData) {
  if (!id) return { success: false, error: 'ID is required' };

  var sheet = getRecordsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() == String(id).trim()) {
      var updatedRow = headers.map(function(header, idx) {
        if (header === 'id') return data[i][0]; // keep ID
        if (header === 'createdAt') return data[i][idx]; // keep original createdAt
        if (header === 'createdBy') return data[i][idx]; // keep original createdBy
        if (recordData[header] !== undefined && recordData[header] !== '') return recordData[header];
        return data[i][idx]; // keep original
      });

      updatedRow[headers.indexOf('updatedAt')] = recordData.updatedAt || nowISO();
      if (recordData.updatedBy) updatedRow[headers.indexOf('updatedBy')] = recordData.updatedBy;

      sheet.getRange(i + 1, 1, 1, headers.length).setValues([updatedRow]);
      return { success: true, message: 'Record updated' };
    }
  }
  return { success: false, error: 'Record not found' };
}

function deleteRecordData(id) {
  if (!id) return { success: false, error: 'ID is required' };

  var sheet = getRecordsSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).trim() == String(id).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Record deleted' };
    }
  }
  return { success: false, error: 'Record not found' };
}

function validateRecordData(id, validation) {
  if (!id) return { success: false, error: 'ID is required' };
  if (!validation) return { success: false, error: 'Validation data is required' };

  var sheet = getRecordsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var statusIdx = headers.indexOf('validationStatus');
  var byIdx = headers.indexOf('validatedBy');
  var atIdx = headers.indexOf('validatedAt');
  var reasonIdx = headers.indexOf('validationReason');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() == String(id).trim()) {
      if (statusIdx >= 0) sheet.getRange(i + 1, statusIdx + 1).setValue(validation.validationStatus || '');
      if (byIdx >= 0) sheet.getRange(i + 1, byIdx + 1).setValue(validation.validatedBy || '');
      if (atIdx >= 0) sheet.getRange(i + 1, atIdx + 1).setValue(validation.validatedAt || nowISO());
      if (reasonIdx >= 0) sheet.getRange(i + 1, reasonIdx + 1).setValue(validation.validationReason || '');

      // Also update updatedAt
      var updatedAtIdx = headers.indexOf('updatedAt');
      if (updatedAtIdx >= 0) sheet.getRange(i + 1, updatedAtIdx + 1).setValue(nowISO());

      return { success: true, message: 'Record validated' };
    }
  }
  return { success: false, error: 'Record not found' };
}

// =====================================================
// PHOTO OPERATIONS
// =====================================================

function handleUploadPhoto(params) {
  try {
    var fileName = params.fileName || 'photo_' + Date.now() + '.jpg';
    var mimeType = params.mimeType || 'image/jpeg';
    var base64Data = params.base64Data;
    var folderName = params.folderName || '';

    if (!base64Data) return { success: false, error: 'No photo data' };

    var parentFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var targetFolder = parentFolder;

    // Create subfolder if specified
    if (folderName) {
      var subFolders = parentFolder.getFoldersByName(folderName);
      if (subFolders.hasNext()) {
        targetFolder = subFolders.next();
      } else {
        targetFolder = parentFolder.createFolder(folderName);
      }
    }

    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
    var file = targetFolder.createFile(blob);

    // Make file publicly viewable
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success: true,
      fileId: file.getId(),
      fileName: file.getName(),
      webViewLink: file.getUrl(),
      webContentLink: 'https://drive.google.com/uc?export=view&id=' + file.getId()
    };
  } catch (error) {
    return { success: false, error: 'Upload failed: ' + error.toString() };
  }
}

function handleDeletePhoto(fileId) {
  try {
    if (!fileId) return { success: false, error: 'No file ID' };
    var file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    return { success: true, message: 'Photo deleted' };
  } catch (error) {
    return { success: false, error: 'Delete failed: ' + error.toString() };
  }
}

function handleGetPhotoUrl(fileId) {
  try {
    if (!fileId) return { success: false, error: 'No file ID' };
    var file = DriveApp.getFileById(fileId);
    return {
      success: true,
      fileId: fileId,
      webViewLink: file.getUrl(),
      webContentLink: 'https://drive.google.com/uc?export=view&id=' + fileId,
      thumbnailUrl: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800'
    };
  } catch (error) {
    return { success: false, error: 'Failed to get URL: ' + error.toString() };
  }
}

function handleGetPhotoBase64(params) {
  try {
    var fileId = params.fileId;
    if (!fileId) return { success: false, error: 'No file ID' };

    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var base64 = Utilities.base64Encode(blob.getBytes());

    return {
      success: true,
      base64: base64,
      mimeType: blob.getContentType(),
      fileName: file.getName()
    };
  } catch (error) {
    return { success: false, error: 'Failed to get photo: ' + error.toString() };
  }
}

// =====================================================
// TEST & UTILITY
// =====================================================

function testDriveWrite() {
  try {
    var testFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var testBlob = Utilities.newBlob('DISPECT test file - safe to delete', 'text/plain', 'dispect_permission_test.txt');
    var testFile = testFolder.createFile(testBlob);
    var testId = testFile.getId();
    testFile.setTrashed(true);
    return { success: true, message: 'Drive write OK', testFileId: testId };
  } catch (error) {
    return { success: false, error: 'Drive write FAILED: ' + error.toString() };
  }
}

// Run this function once to accept permissions
function testDriveAccess() {
  var result = testDriveWrite();
  Logger.log(result);

  var loginTest = loginUser('wahid', 'admin123');
  Logger.log(loginTest);

  var recordsTest = getRecordsBasicData();
  Logger.log('Records count: ' + (recordsTest.records ? recordsTest.records.length : 0));
}
