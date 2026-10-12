function resolveApiBase() {
  const configured = (process.env.REACT_APP_API_BASE || process.env.REACT_APP_BACKEND_URL || '').trim().replace(/\/+$/, '');
  if (!configured) return 'https://ckr-backend.onrender.com/api';
  return configured.endsWith('/api') ? configured : `${configured}/api`;
}

const API_BASE = resolveApiBase();
const ADMIN_TOKEN_KEY = 'ckr_admin_token';
let adminTokenMemory = null;

function getSessionStore() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function clearLegacyLocalToken() {
  try {
    window.localStorage?.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const detail = Array.isArray(data?.detail)
      ? 'Gönderilen bilgilerde eksik ya da hatalı alan var.'
      : data?.detail;
    const error = new Error(detail || 'İşlem tamamlanamadı.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function getAdminToken() {
  return adminTokenMemory || getSessionStore()?.getItem(ADMIN_TOKEN_KEY) || null;
}

export function setAdminToken(token) {
  adminTokenMemory = token || null;
  clearLegacyLocalToken();
  const store = getSessionStore();
  if (token) {
    store?.setItem(ADMIN_TOKEN_KEY, token);
  } else {
    store?.removeItem(ADMIN_TOKEN_KEY);
  }
}

export function clearAdminToken() {
  adminTokenMemory = null;
  getSessionStore()?.removeItem(ADMIN_TOKEN_KEY);
  clearLegacyLocalToken();
}

export function createLead(payload) {
  return request('/leads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function draftHeaders(token) {
  return token ? { 'X-CKR-Draft-Token': token } : {};
}

export function createLeadDraft(payload) {
  return request('/leads/draft', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateLeadDraft(applicationId, token, payload) {
  return request(`/leads/${encodeURIComponent(applicationId)}/draft`, {
    method: 'PATCH',
    headers: draftHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function completeLeadDraft(applicationId, token, payload) {
  return request(`/leads/${encodeURIComponent(applicationId)}/complete`, {
    method: 'PATCH',
    headers: draftHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function updateLeadPreference(id, payload) {
  return request(`/leads/${id}/preference`, {
    method: 'PATCH',
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
  }).catch((error) => {
    if (error.status === 401) clearAdminToken();
    throw error;
  });
}

export function listLeads(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const suffix = query.toString();
  return adminRequest(`/admin/leads${suffix ? `?${suffix}` : ''}`);
}

export function getLead(id) {
  return adminRequest(`/admin/leads/${id}`);
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
  const suffix = query.toString();
  const response = await fetch(`${API_BASE}/admin/leads/export.xlsx${suffix ? `?${suffix}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data?.detail || 'Excel aktarımı tamamlanamadı.');
    error.status = response.status;
    if (response.status === 401) clearAdminToken();
    throw error;
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
