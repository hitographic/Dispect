const fs = require('fs');
fetch('https://script.google.com/macros/s/AKfycbyDo4mbp8-7toTDRM-I6RMN43-JjlxblTsJGdO8z9GfSEmy6uHYjrjNdNYwWBqwdA0V/exec', {
  method: 'POST',
  body: JSON.stringify({
    action: 'uploadPhoto',
    fileName: 'test.jpg',
    mimeType: 'image/jpeg',
    base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    folderName: 'test'
  })
}).then(r => r.json()).then(console.log).catch(console.error);
