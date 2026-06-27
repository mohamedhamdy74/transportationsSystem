import { env } from './env.js';

export function toAuthEmail(username) {
  const domain = env.authEmailDomain || 'transport.local';
  const value = String(username || '').trim().toLowerCase();
  if (!value) return '';
  if (value.includes('@')) return value;
  const safe = value.replace(/[^a-z0-9._-]/gi, '');
  return `${safe}@${domain}`;
}

export function toDisplayUsername(email) {
  const domain = env.authEmailDomain || 'transport.local';
  const value = String(email || '').trim().toLowerCase();
  if (!value.includes('@')) return value;
  const [local, d] = value.split('@');
  if (d === domain) return local;
  return value;
}
