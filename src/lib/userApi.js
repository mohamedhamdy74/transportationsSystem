import { account } from './appwrite.js';

async function getSessionHeader() {
  const sessions = await account.listSessions();
  const current = sessions.sessions?.[0];
  if (!current?.$id) throw new Error('لا توجد جلسة نشطة.');
  return current.$id;
}

async function apiRequest(path, body) {
  const sessionId = await getSessionHeader();
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Appwrite-Session': sessionId,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'فشل تنفيذ العملية.');
  }
  return data;
}

export function createAppUser(payload) {
  return apiRequest('/api/users/create', payload);
}

export function updateAppUser(payload) {
  return apiRequest('/api/users/update', payload);
}

export function deleteAppUser(payload) {
  return apiRequest('/api/users/delete', payload);
}
