import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  LogOut,
  Menu,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import {
  adminLogin,
  clearAdminToken,
  exportLeads,
  getAdminToken,
  getLead,
  listLeads,
  updateLead,
} from '../../lib/api';

const requestLabels = {
  seller: 'Satıcı',
  buyer: 'Alıcı',
  landlord: 'Kiraya Veren',
  tenant: 'Kiralayan',
};

const statusLabels = {
  new: 'Yeni',
  contacted: 'İletişime Geçildi',
  qualified: 'Nitelikli Talep',
  follow_up: 'Takip Edilecek',
  closed: 'Sonuçlandı',
  archived: 'Arşivlendi',
};

const applicationStatusLabels = {
  draft: 'Yarım Başvuru',
  completed: 'Tamamlanan Başvuru',
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const FOLLOW_UP_STATUSES = ['contacted', 'qualified', 'follow_up'];

function applicationStatusLabel(value) {
  return applicationStatusLabels[value || 'completed'] || value || applicationStatusLabels.completed;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function rowBudget(lead) {
  return lead?.budget_expectation || lead?.price_expectation || '-';
}

function locationLabel(lead) {
  const selections = lead?.location?.selections || [];
  if (selections.length) {
    const labels = selections.map((item) => item.label).filter(Boolean);
    if (labels.length > 3) return `${labels.slice(0, 3).join(', ')} +${labels.length - 3}`;
    return labels.join(', ');
  }
  const province = lead?.location?.province;
  const district = lead?.location?.district;
  const neighborhood = lead?.location?.neighborhood || lead?.location?.settlement;
  const parts = [province, district, neighborhood].filter(Boolean);
  if (parts.length) return parts.join(' / ');
  return lead?.location?.raw || '-';
}

function sourceLabel(source) {
  return [source?.button_source, source?.form_type].filter(Boolean).join(' / ') || '-';
}

function detailEntries(value) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '');
}

function formatDetailValue(value) {
  if (value === undefined || value === null || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  return String(value);
}

function selectedLocationText(location) {
  const selections = location?.selections || [];
  if (!selections.length) return '-';
  return selections.map((item) => item.label || item.settlement || item.district || item.province).filter(Boolean).join('\n');
}

function buildDateParams(filters) {
  const params = { ...filters };
  if (params.date_from) params.date_from = `${params.date_from}T00:00:00`;
  if (params.date_to) params.date_to = `${params.date_to}T23:59:59`;
  return params;
}

function buildWhatsAppUrl(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  let normalized = digits;
  if (normalized.startsWith('0')) normalized = `90${normalized.slice(1)}`;
  if (normalized.length === 10) normalized = `90${normalized}`;
  return `https://wa.me/${normalized}`;
}

export default function AdminPanel() {
  const [token, setToken] = useState(getAdminToken());
  const [password, setPassword] = useState('');
  const [activeView, setActiveView] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [statsRows, setStatsRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({
    q: '',
    request_type: '',
    follow_up_status: '',
    application_status: '',
    province: '',
    district: '',
    settlement: '',
    date_from: '',
    date_to: '',
    sort_by: 'created_at',
    sort_dir: 'desc',
    limit: 25,
    skip: 0,
  });

  const activeParams = useMemo(() => buildDateParams(filters), [filters]);

  const exportParams = useMemo(() => {
    const { q, request_type, follow_up_status, application_status, province, district, settlement, date_from, date_to } = buildDateParams(filters);
    return { q, request_type, follow_up_status, application_status, province, district, settlement, date_from, date_to };
  }, [filters]);

  const overviewStats = useMemo(() => {
    const rows = statsRows || [];
    return {
      total: rows.length,
      draft: rows.filter((lead) => lead.application_status === 'draft').length,
      completed: rows.filter((lead) => (lead.application_status || 'completed') === 'completed').length,
      follow: rows.filter((lead) => FOLLOW_UP_STATUSES.includes(lead.follow_up_status)).length,
      closed: rows.filter((lead) => lead.follow_up_status === 'closed').length,
    };
  }, [statsRows]);

  const page = Math.floor(filters.skip / filters.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));

  const handleAuthError = useCallback((err) => {
    if (err?.status === 401) {
      clearAdminToken();
      setToken(null);
      setItems([]);
      setStatsRows([]);
      setSelected(null);
      setError('Oturum süresi doldu. Lütfen yeniden giriş yapın.');
      return true;
    }
    return false;
  }, []);

  const loadList = useCallback(async () => {
    if (!getAdminToken()) return;
    setLoading(true);
    setError('');
    try {
      const data = await listLeads(activeParams);
      const rows = data.items || [];
      setItems(rows);
      setTotal(data.total || 0);
      setSelected((current) => {
        if (!current) return null;
        const refreshed = rows.find((item) => item.id === current.id);
        return refreshed ? { ...current, ...refreshed } : null;
      });
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message || 'Müşteri başvuruları yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [activeParams, handleAuthError]);

  const loadStats = useCallback(async () => {
    if (!getAdminToken()) return;
    setStatsLoading(true);
    try {
      const allRows = [];
      let skip = 0;
      let totalCount = 0;

      do {
        const pageData = await listLeads({ limit: 500, skip, sort_by: 'created_at', sort_dir: 'desc' });
        const rows = pageData.items || [];
        totalCount = pageData.total || 0;
        allRows.push(...rows);
        skip += rows.length;
        if (rows.length === 0) break;
      } while (allRows.length < totalCount);

      setStatsRows(allRows);
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message || 'Özet bilgiler yüklenemedi.');
    } finally {
      setStatsLoading(false);
    }
  }, [handleAuthError]);

  const refreshAll = useCallback(() => {
    loadList();
    loadStats();
  }, [loadList, loadStats]);

  useEffect(() => {
    const previousTitle = document.title;
    let robots = document.querySelector('meta[name="robots"]');
    const createdRobotsMeta = !robots;

    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }

    const previousRobotsContent = robots.getAttribute('content');
    document.title = 'ÇKR Yönetim Paneli';
    robots.setAttribute('content', 'noindex,nofollow,noarchive');

    return () => {
      document.title = previousTitle;
      if (createdRobotsMeta) {
        robots.remove();
      } else if (previousRobotsContent) {
        robots.setAttribute('content', previousRobotsContent);
      } else {
        robots.removeAttribute('content');
      }
    };
  }, []);

  useEffect(() => {
    if (token) loadList();
  }, [token, loadList]);

  useEffect(() => {
    if (token) loadStats();
  }, [token, loadStats]);

  const login = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      const data = await adminLogin(password);
      setToken(data.access_token || getAdminToken());
      setPassword('');
      setActiveView('overview');
    } catch (err) {
      setError(err.message || 'Giriş yapılamadı.');
    }
  };

  const logout = () => {
    clearAdminToken();
    setToken(null);
    setItems([]);
    setStatsRows([]);
    setSelected(null);
    setPassword('');
    setError('');
    setSuccess('');
  };

  const setFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: key === 'limit' ? Number(value) : value,
      skip: 0,
    }));
  };

  const setSort = (value) => {
    const [sort_by, sort_dir] = value.split(':');
    setFilters((current) => ({ ...current, sort_by, sort_dir, skip: 0 }));
  };

  const setPage = (direction) => {
    setFilters((current) => {
      const maxPageIndex = Math.max(0, Math.ceil(total / current.limit) - 1);
      const currentPageIndex = Math.floor(current.skip / current.limit);
      const nextPageIndex = Math.max(0, Math.min(currentPageIndex + direction, maxPageIndex));
      return { ...current, skip: nextPageIndex * current.limit };
    });
  };

  const openLeadDetail = async (lead) => {
    if (!lead?.id) return;
    setDetailLoading(true);
    setError('');
    setSuccess('');
    try {
      const detail = await getLead(lead.id);
      setSelected(detail);
      setActiveView('leads');
      setMobileMenuOpen(false);
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message || 'Müşteri detayı yüklenemedi.');
    } finally {
      setDetailLoading(false);
    }
  };

  const saveSelected = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await updateLead(selected.id, {
        follow_up_status: selected.follow_up_status,
        admin_notes: selected.admin_notes || '',
      });
      setSelected(updated);
      setItems((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      setStatsRows((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
      setSuccess('Değişiklikler kaydedildi.');
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message || 'Değişiklikler kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const downloadExcel = async () => {
    setDownloading(true);
    setError('');
    setSuccess('');
    try {
      await exportLeads(exportParams);
      setSuccess('Excel dosyası indirilmeye hazırlandı.');
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message || 'Excel aktarımı tamamlanamadı.');
    } finally {
      setDownloading(false);
    }
  };

  const showView = (view) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  };

  const selectedWhatsAppUrl = buildWhatsAppUrl(selected?.contact?.phone);

  const sidebar = (
    <aside className={`ckr-admin-sidebar ${mobileMenuOpen ? 'is-open' : ''}`}>
      <div className="ckr-admin-sidebar-head">
        <ShieldCheck size={28} />
        <div>
          <strong>ÇKR Yönetim</strong>
          <span>Müşteri takip paneli</span>
        </div>
      </div>

      <nav className="ckr-admin-menu" aria-label="Yönetim menüsü">
        <button className={activeView === 'overview' ? 'is-active' : ''} onClick={() => showView('overview')}>
          <BarChart3 size={18} /> Genel Bakış
        </button>
        <button className={activeView === 'leads' ? 'is-active' : ''} onClick={() => showView('leads')}>
          <Users size={18} /> Müşteri Başvuruları
        </button>
        <button onClick={downloadExcel} disabled={downloading}>
          <FileSpreadsheet size={18} /> {downloading ? 'Hazırlanıyor...' : "Excel'e Aktar"}
        </button>
        <button onClick={logout}>
          <LogOut size={18} /> Çıkış Yap
        </button>
      </nav>
    </aside>
  );

  if (!token) {
    return (
      <main className="ckr-admin-shell">
        <form className="ckr-admin-login" onSubmit={login}>
          <ShieldCheck size={34} />
          <h1>ÇKR Yönetim Paneli</h1>
          <p>Müşteri başvurularını görüntülemek için yönetici şifresiyle giriş yapın.</p>
          <input
            type="password"
            className="ckr-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Yönetici şifresi"
            autoComplete="current-password"
            autoFocus
          />
          {error && <p className="ckr-admin-error">{error}</p>}
          <button className="ckr-btn ckr-btn-primary" type="submit" disabled={!password || loading}>
            Giriş Yap
          </button>
          <a href="/" className="ckr-admin-home">Siteye dön</a>
        </form>
      </main>
    );
  }

  return (
    <main className="ckr-admin-shell">
      <section className="ckr-admin-layout">
        {sidebar}

        <section className="ckr-admin-content">
          <header className="ckr-admin-topbar">
            <button
              className="ckr-admin-mobile-toggle"
              type="button"
              onClick={() => setMobileMenuOpen((current) => !current)}
              aria-label={mobileMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div>
              <span className="ckr-eyebrow">ÇKR Yönetim</span>
              <h1>{activeView === 'overview' ? 'Genel Bakış' : 'Müşteri Başvuruları'}</h1>
              <p>Veriler canlı backend API üzerinden alınır; sahte kayıt gösterilmez.</p>
            </div>
            <div className="ckr-admin-actions">
              <button className="ckr-btn ckr-btn-ghost" onClick={refreshAll} disabled={loading || statsLoading}>
                <RefreshCw size={16} /> Yenile
              </button>
              <button className="ckr-btn ckr-btn-gold" onClick={downloadExcel} disabled={downloading}>
                <Download size={16} /> {downloading ? 'Hazırlanıyor...' : "Excel'i İndir"}
              </button>
            </div>
          </header>

          {error && <p className="ckr-admin-error">{error}</p>}
          {success && <p className="ckr-admin-success">{success}</p>}

          {activeView === 'overview' && (
            <section className="ckr-admin-overview">
              <div className="ckr-admin-summary-grid">
                <article className="ckr-admin-summary-card">
                  <span>Toplam Başvuru</span>
                  <strong>{statsLoading ? '...' : overviewStats.total}</strong>
                </article>
                <article className="ckr-admin-summary-card">
                  <span>Yarım Başvurular</span>
                  <strong>{statsLoading ? '...' : overviewStats.draft}</strong>
                </article>
                <article className="ckr-admin-summary-card">
                  <span>Tamamlanan Başvurular</span>
                  <strong>{statsLoading ? '...' : overviewStats.completed}</strong>
                </article>
                <article className="ckr-admin-summary-card">
                  <span>Görüşülecek / Takipte</span>
                  <strong>{statsLoading ? '...' : overviewStats.follow}</strong>
                </article>
              </div>
              <p className="ckr-admin-muted">
                Özet kartlar tüm sayfalı kayıtlar çekilerek hesaplanır. Henüz kayıt yoksa değerler sıfır görünür.
              </p>
            </section>
          )}

          {activeView === 'leads' && (
            <>
              <div className="ckr-admin-filters">
                <label className="ckr-admin-search">
                  <Search size={15} />
                  <input
                    value={filters.q}
                    onChange={(event) => setFilter('q', event.target.value)}
                    placeholder="Ad, telefon, e-posta veya konum ara"
                  />
                </label>
                <select value={filters.request_type} onChange={(event) => setFilter('request_type', event.target.value)}>
                  <option value="">Tüm talepler</option>
                  {Object.entries(requestLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select value={filters.follow_up_status} onChange={(event) => setFilter('follow_up_status', event.target.value)}>
                  <option value="">Tüm durumlar</option>
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select value={filters.application_status} onChange={(event) => setFilter('application_status', event.target.value)}>
                  <option value="">Tüm başvuru durumları</option>
                  {Object.entries(applicationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input value={filters.province} onChange={(event) => setFilter('province', event.target.value)} placeholder="İl" />
                <input value={filters.district} onChange={(event) => setFilter('district', event.target.value)} placeholder="İlçe" />
                <input value={filters.settlement} onChange={(event) => setFilter('settlement', event.target.value)} placeholder="Mahalle / köy" />
                <input type="date" value={filters.date_from} onChange={(event) => setFilter('date_from', event.target.value)} />
                <input type="date" value={filters.date_to} onChange={(event) => setFilter('date_to', event.target.value)} />
                <select value={`${filters.sort_by}:${filters.sort_dir}`} onChange={(event) => setSort(event.target.value)}>
                  <option value="created_at:desc">Yeni kayıt önce</option>
                  <option value="created_at:asc">Eski kayıt önce</option>
                  <option value="name:asc">Ada göre A-Z</option>
                  <option value="request_type:asc">Talep türüne göre</option>
                  <option value="follow_up_status:asc">Duruma göre</option>
                  <option value="application_status:asc">Başvuru durumuna göre</option>
                </select>
                <select value={filters.limit} onChange={(event) => setFilter('limit', event.target.value)}>
                  {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option} kayıt</option>)}
                </select>
              </div>

              <div className="ckr-admin-grid">
                <div>
                  <div className="ckr-admin-table-wrap">
                    <table className="ckr-admin-table">
                      <thead>
                        <tr>
                          <th>Başvuru tarihi</th>
                          <th>Ad soyad</th>
                          <th>Telefon</th>
                          <th>Talep türü</th>
                          <th>Gayrimenkul türü</th>
                          <th>İl / ilçe / mahalle</th>
                          <th>Fiyat veya bütçe beklentisi</th>
                          <th>Başvuru kaynağı</th>
                          <th>Başvuru durumu</th>
                          <th>Takip durumu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((lead) => (
                          <tr
                            key={lead.id}
                            className={selected?.id === lead.id ? 'is-selected' : ''}
                            onClick={() => openLeadDetail(lead)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') openLeadDetail(lead);
                            }}
                            tabIndex={0}
                          >
                            <td>{formatDate(lead.created_at)}</td>
                            <td>{lead.contact?.name || '-'}</td>
                            <td>{lead.contact?.phone || '-'}</td>
                            <td>{requestLabels[lead.request_type] || lead.request_type}</td>
                            <td>{lead.property_type || '-'}</td>
                            <td>{locationLabel(lead)}</td>
                            <td>{rowBudget(lead)}</td>
                            <td>{sourceLabel(lead.source)}</td>
                            <td><span className="ckr-status-pill">{applicationStatusLabel(lead.application_status)}</span></td>
                            <td><span className="ckr-status-pill">{statusLabels[lead.follow_up_status] || lead.follow_up_status}</span></td>
                          </tr>
                        ))}
                        {!loading && items.length === 0 && (
                          <tr><td colSpan="10">Kayıt bulunamadı.</td></tr>
                        )}
                        {loading && (
                          <tr><td colSpan="10">Yükleniyor...</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="ckr-admin-pagination">
                    <span>{total} kayıt · Sayfa {page} / {totalPages}</span>
                    <div>
                      <button className="ckr-btn ckr-btn-ghost" onClick={() => setPage(-1)} disabled={filters.skip === 0 || loading}>
                        Önceki
                      </button>
                      <button className="ckr-btn ckr-btn-ghost" onClick={() => setPage(1)} disabled={page >= totalPages || loading}>
                        Sonraki
                      </button>
                    </div>
                  </div>
                </div>

                <aside className="ckr-admin-detail">
                  {detailLoading && <p className="ckr-admin-muted">Müşteri detayı yükleniyor...</p>}
                  {selected ? (
                    <>
                      <div className="ckr-admin-detail-head">
                        <div>
                          <h2>{selected.contact?.name || 'İsimsiz başvuru'}</h2>
                          <p>{requestLabels[selected.request_type] || selected.request_type} · {formatDate(selected.created_at)}</p>
                        </div>
                        {selectedWhatsAppUrl && (
                          <a className="ckr-admin-whatsapp" href={selectedWhatsAppUrl} target="_blank" rel="noreferrer">
                            <MessageCircle size={16} /> WhatsApp
                          </a>
                        )}
                      </div>

                      <div className="ckr-admin-detail-block">
                        <h3>İletişim Bilgileri</h3>
                        <dl>
                          <dt>Ad soyad</dt><dd>{selected.contact?.name || '-'}</dd>
                          <dt>Telefon</dt><dd>{selected.contact?.phone || '-'}</dd>
                          <dt>E-posta</dt><dd>{selected.contact?.email || '-'}</dd>
                        </dl>
                      </div>

                      <div className="ckr-admin-detail-block">
                        <h3>Konum ve Talep</h3>
                        <dl>
                          <dt>Kayıt ID</dt><dd>{selected.id}</dd>
                          <dt>Başvuru ID</dt><dd>{selected.application_id || '-'}</dd>
                          <dt>Başvuru durumu</dt><dd>{applicationStatusLabel(selected.application_status)}</dd>
                          <dt>Talep türü</dt><dd>{requestLabels[selected.request_type] || selected.request_type}</dd>
                          <dt>Mülk türü</dt><dd>{selected.property_type || '-'}</dd>
                          <dt>İl</dt><dd>{selected.location?.province || '-'}</dd>
                          <dt>İl kodu</dt><dd>{selected.location?.province_code || '-'}</dd>
                          <dt>İlçe</dt><dd>{selected.location?.district || '-'}</dd>
                          <dt>Seçilen ilçeler</dt><dd>{formatDetailValue(selected.location?.districts)}</dd>
                          <dt>Mahalle</dt><dd>{selected.location?.neighborhood || '-'}</dd>
                          <dt>Belde</dt><dd>{selected.location?.municipality || '-'}</dd>
                          <dt>Yerleşim türü</dt><dd>{selected.location?.settlement_type || '-'}</dd>
                          <dt>Konum</dt><dd>{selected.location?.raw || '-'}</dd>
                          <dt>Çoklu bölge tercihleri</dt><dd><pre>{selectedLocationText(selected.location)}</pre></dd>
                          <dt>Bütçe/Fiyat</dt><dd>{rowBudget(selected)}</dd>
                          <dt>Zamanlama</dt><dd>{selected.timing || '-'}</dd>
                        </dl>
                      </div>

                      <div className="ckr-admin-detail-block">
                        <h3>Kaynak ve Başvuru</h3>
                        <dl>
                          <dt>Kaynak buton</dt><dd>{selected.source?.button_source || '-'}</dd>
                          <dt>Form</dt><dd>{selected.source?.form_type || '-'}</dd>
                          <dt>Sayfa</dt><dd>{selected.source?.page_path || '-'}</dd>
                          <dt>Referans</dt><dd>{selected.source?.referrer || '-'}</dd>
                          <dt>Başvuru tarihi</dt><dd>{formatDate(selected.created_at)}</dd>
                          <dt>Güncelleme</dt><dd>{formatDate(selected.updated_at)}</dd>
                          <dt>Tamamlanma tarihi</dt><dd>{formatDate(selected.completed_at)}</dd>
                          <dt>Taslak saklama sonu</dt><dd>{formatDate(selected.draft_expires_at)}</dd>
                          <dt>KVKK bilgilendirme</dt><dd>{selected.kvkk_acknowledged ? 'Bilgilendirildi' : '-'}</dd>
                          <dt>Pazarlama izni</dt><dd>{selected.marketing_consent ? 'Var' : 'Yok'}</dd>
                          <dt>Hukuki sebep</dt><dd>{selected.processing_legal_basis || '-'}</dd>
                        </dl>
                      </div>

                      <div className="ckr-admin-detail-block">
                        <h3>Gayrimenkul Özellikleri</h3>
                        {detailEntries(selected.property_features).length > 0 ? (
                          <dl>
                            {detailEntries(selected.property_features).map(([key, value]) => (
                              <React.Fragment key={key}>
                                <dt>{key}</dt>
                                <dd>{formatDetailValue(value)}</dd>
                              </React.Fragment>
                            ))}
                          </dl>
                        ) : (
                          <p className="ckr-admin-muted">Ek özellik bilgisi yok.</p>
                        )}
                      </div>

                      <div className="ckr-admin-detail-block">
                        <h3>Motivasyon Cevapları</h3>
                        <dl>
                          <dt>Puan</dt><dd>{selected.motivation?.score ?? '-'}</dd>
                          <dt>Kategori</dt><dd>{selected.motivation?.category || '-'}</dd>
                          <dt>Özet</dt><dd>{selected.motivation?.summary || '-'}</dd>
                        </dl>
                        {selected.motivation?.answers && (
                          <pre>{formatDetailValue(selected.motivation.answers)}</pre>
                        )}
                      </div>

                      <label className="ckr-admin-field">
                        Takip durumu
                        <select
                          value={selected.follow_up_status}
                          onChange={(event) => setSelected((current) => ({ ...current, follow_up_status: event.target.value }))}
                        >
                          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>

                      <label className="ckr-admin-field">
                        Yönetici notları
                        <textarea
                          rows={5}
                          value={selected.admin_notes || ''}
                          onChange={(event) => setSelected((current) => ({ ...current, admin_notes: event.target.value }))}
                        />
                      </label>

                      <button className="ckr-btn ckr-btn-primary" onClick={saveSelected} disabled={saving}>
                        {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                      </button>
                    </>
                  ) : (
                    <div className="ckr-admin-empty">
                      <h2>Müşteri detayı</h2>
                      <p>Detayları görmek için tablodan bir müşteri seçin.</p>
                    </div>
                  )}
                </aside>
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
