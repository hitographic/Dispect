const fs = require('fs');
fetch('https://script.google.com/macros/s/AKfycby8ZhwYbIDHlBGkw_nU93t4PKLK48huq5UTtRLjQvW_lnz-_KeCTSy5FMQPoBoHYNNT/exec', {
  method: 'POST',
  body: JSON.stringify({
    action: 'uploadPhoto',
    fileName: 'test.jpg',
    mimeType: 'image/jpeg',
    base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    folderName: 'test'
  })
}).then(r => r.json()).then(console.log).catch(console.error);
