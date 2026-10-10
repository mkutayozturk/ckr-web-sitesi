const API_BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '') || '/api';
const ADMIN_TOKEN_KEY = 'ckr_admin_token';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.detail || 'İşlem tamamlanamadı.');
  }
  return data;
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function createLead(payload) {
  return request('/leads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function adminLogin(password) {
  const data = await request('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  setAdminToken(data.access_token);
  return data;
}

export function adminRequest(path, options = {}) {
  const token = getAdminToken();
  return request(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export function listLeads(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  return adminRequest(`/admin/leads?${query.toString()}`);
}

export function updateLead(id, payload) {
  return adminRequest(`/admin/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function exportLeads(params = {}) {
  const token = getAdminToken();
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const response = await fetch(`${API_BASE}/admin/leads/export.xlsx?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.detail || 'Excel aktarımı tamamlanamadı.');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ckr-musteri-basvurulari-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
