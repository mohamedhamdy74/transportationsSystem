const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const API_KEY = 'standard_252587c36c976dbc7186931b663aa3cb18cd3076683f70a69cdb2e4f1f4ea0c59bd10bcbcd55fcbd68e17d5dcf434bfce5a0bb169f7bade19af8c022a9b89c201b75b0458136f427b3c5e55bf7fb3479f78e6b16d87471f2c41ccd4ad72f3a64a7b4fc82269cb57d63ab464aa3454d54f72a7dbaabffda201f75f130f654cc75';
const PROJECT_ID = '6a3903c1003165e1ec9c';

fetch(`${ENDPOINT}/databases`, {
  headers: {
    'X-Appwrite-Key': API_KEY,
    'X-Appwrite-Project': PROJECT_ID
  }
}).then(r => r.json()).then(console.log).catch(console.error);