import React, { useEffect, useMemo, useState } from 'react';
import { Download, LogOut, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { adminLogin, clearAdminToken, exportLeads, getAdminToken, listLeads, updateLead } from '../../lib/api';

const requestLabels = {
  seller: 'Satıcı',
  buyer: 'Alıcı',
  landlord: 'Kiraya Veren',
  tenant: 'Kiralayan',
};

const statusLabels = {
  new: 'Yeni',
  contacted: 'İletişime Geçildi',
  qualified: 'Nitelikli',
  follow_up: 'Takipte',
  closed: 'Kapandı',
  archived: 'Arşiv',
};

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function rowBudget(lead) {
  return lead.budget_expectation || lead.price_expectation || '-';
}

function detailEntries(value) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '');
}

export default function AdminPanel() {
  const [token, setToken] = useState(getAdminToken());
  const [password, setPassword] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    q: '',
    request_type: '',
    follow_up_status: '',
    date_from: '',
    date_to: '',
    sort_by: 'created_at',
    sort_dir: 'desc',
    limit: 200,
  });

  const activeParams = useMemo(() => {
    const params = { ...filters };
    if (params.date_from) params.date_from = `${params.date_from}T00:00:00`;
    if (params.date_to) params.date_to = `${params.date_to}T23:59:59`;
    return params;
  }, [filters]);

  const load = async () => {
    if (!getAdminToken()) return;
    setLoading(true);
    setError('');
    try {
      const data = await listLeads(activeParams);
      setItems(data.items || []);
      setTotal(data.total || 0);
      setSelected((current) => {
        if (!current) return data.items?.[0] || null;
        return data.items?.find((item) => item.id === current.id) || data.items?.[0] || null;
      });
    } catch (err) {
      setError(err.message);
      if (err.message.includes('oturumu')) {
        clearAdminToken();
        setToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeParams]);

  const login = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await adminLogin(password);
      setToken(getAdminToken());
      setPassword('');
    } catch (err) {
      setError(err.message);
    }
  };

  const logout = () => {
    clearAdminToken();
    setToken(null);
    setItems([]);
    setSelected(null);
  };

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const saveSelected = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateLead(selected.id, {
        follow_up_status: selected.follow_up_status,
        admin_notes: selected.admin_notes || '',
      });
      setSelected(updated);
      setItems((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const downloadExcel = async () => {
    setError('');
    try {
      await exportLeads(activeParams);
    } catch (err) {
      setError(err.message);
    }
  };

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
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Yönetici şifresi"
            autoFocus
          />
          {error && <p className="ckr-admin-error">{error}</p>}
          <button className="ckr-btn ckr-btn-primary" type="submit">Giriş Yap</button>
          <a href="/#" className="ckr-admin-home">Siteye dön</a>
        </form>
      </main>
    );
  }

  return (
    <main className="ckr-admin-shell">
      <section className="ckr-admin-panel">
        <header className="ckr-admin-header">
          <div>
            <span className="ckr-eyebrow">ÇKR Yönetim</span>
            <h1>Müşteri Takip Tablosu</h1>
            <p>{total} kayıt listeleniyor. Ana kayıtlar MongoDB'de tutulur; Excel yalnızca dışa aktarımdır.</p>
          </div>
          <div className="ckr-admin-actions">
            <button className="ckr-btn ckr-btn-gold" onClick={downloadExcel}><Download size={16} /> Excel'e Aktar</button>
            <button className="ckr-btn ckr-btn-ghost" onClick={load}><RefreshCw size={16} /> Yenile</button>
            <button className="ckr-btn ckr-btn-ghost" onClick={logout}><LogOut size={16} /> Çıkış</button>
          </div>
        </header>

        <div className="ckr-admin-filters">
          <label>
            <Search size={15} />
            <input value={filters.q} onChange={(e) => setFilter('q', e.target.value)} placeholder="Ad, telefon, e-posta, konum ara" />
          </label>
          <select value={filters.request_type} onChange={(e) => setFilter('request_type', e.target.value)}>
            <option value="">Tüm talepler</option>
            {Object.entries(requestLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={filters.follow_up_status} onChange={(e) => setFilter('follow_up_status', e.target.value)}>
            <option value="">Tüm durumlar</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input type="date" value={filters.date_from} onChange={(e) => setFilter('date_from', e.target.value)} />
          <input type="date" value={filters.date_to} onChange={(e) => setFilter('date_to', e.target.value)} />
          <select value={`${filters.sort_by}:${filters.sort_dir}`} onChange={(e) => {
            const [sort_by, sort_dir] = e.target.value.split(':');
            setFilters((current) => ({ ...current, sort_by, sort_dir }));
          }}>
            <option value="created_at:desc">Yeni kayıt önce</option>
            <option value="created_at:asc">Eski kayıt önce</option>
            <option value="name:asc">Ada göre A-Z</option>
            <option value="request_type:asc">Talep türüne göre</option>
            <option value="follow_up_status:asc">Duruma göre</option>
          </select>
        </div>

        {error && <p className="ckr-admin-error">{error}</p>}

        <div className="ckr-admin-grid">
          <div className="ckr-admin-table-wrap">
            <table className="ckr-admin-table">
              <thead>
                <tr>
                  <th>Başvuru tarihi</th>
                  <th>Ad soyad</th>
                  <th>Telefon</th>
                  <th>E-posta</th>
                  <th>Talep türü</th>
                  <th>Mülk türü</th>
                  <th>İlçe</th>
                  <th>Mahalle</th>
                  <th>Bütçe/Fiyat</th>
                  <th>Zamanlama</th>
                  <th>Kaynak</th>
                  <th>Motivasyon</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {items.map((lead) => (
                  <tr key={lead.id} className={selected?.id === lead.id ? 'is-selected' : ''} onClick={() => setSelected(lead)}>
                    <td>{formatDate(lead.created_at)}</td>
                    <td>{lead.contact?.name}</td>
                    <td>{lead.contact?.phone}</td>
                    <td>{lead.contact?.email || '-'}</td>
                    <td>{requestLabels[lead.request_type] || lead.request_type}</td>
                    <td>{lead.property_type || '-'}</td>
                    <td>{lead.location?.district || '-'}</td>
                    <td>{lead.location?.neighborhood || lead.location?.raw || '-'}</td>
                    <td>{rowBudget(lead)}</td>
                    <td>{lead.timing || '-'}</td>
                    <td>{lead.source?.button_source || lead.source?.form_type || '-'}</td>
                    <td>{lead.motivation?.score ?? '-'}</td>
                    <td><span className="ckr-status-pill">{statusLabels[lead.follow_up_status] || lead.follow_up_status}</span></td>
                  </tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr><td colSpan="13">Kayıt bulunamadı.</td></tr>
                )}
                {loading && (
                  <tr><td colSpan="13">Yükleniyor...</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <aside className="ckr-admin-detail">
            {selected ? (
              <>
                <h2>{selected.contact?.name}</h2>
                <p>{requestLabels[selected.request_type]} başvurusu · {formatDate(selected.created_at)}</p>
                <dl>
                  <dt>Kayıt ID</dt><dd>{selected.id}</dd>
                  <dt>Telefon</dt><dd>{selected.contact?.phone}</dd>
                  <dt>E-posta</dt><dd>{selected.contact?.email || '-'}</dd>
                  <dt>Mülk türü</dt><dd>{selected.property_type || '-'}</dd>
                  <dt>Konum</dt><dd>{selected.location?.raw || selected.location?.neighborhood || '-'}</dd>
                  <dt>İlçe</dt><dd>{selected.location?.district || '-'}</dd>
                  <dt>Mahalle</dt><dd>{selected.location?.neighborhood || '-'}</dd>
                  <dt>Bütçe/Fiyat</dt><dd>{rowBudget(selected)}</dd>
                  <dt>Zamanlama</dt><dd>{selected.timing || '-'}</dd>
                  <dt>Kaynak</dt><dd>{selected.source?.button_source || selected.source?.form_type || '-'}</dd>
                  <dt>Sayfa</dt><dd>{selected.source?.page_path || '-'}</dd>
                  <dt>Referans</dt><dd>{selected.source?.referrer || '-'}</dd>
                  <dt>Motivasyon</dt><dd>{selected.motivation?.score ?? '-'} {selected.motivation?.category ? `· ${selected.motivation.category}` : ''}</dd>
                  <dt>Motivasyon özeti</dt><dd>{selected.motivation?.summary || '-'}</dd>
                  <dt>E-posta bildirimi</dt><dd>{selected.email_notification_status || '-'}</dd>
                  <dt>Not</dt><dd>{selected.notes || '-'}</dd>
                </dl>

                {detailEntries(selected.property_features).length > 0 && (
                  <div className="ckr-admin-detail-block">
                    <h3>Mülk / Talep Özellikleri</h3>
                    <dl>
                      {detailEntries(selected.property_features).map(([key, value]) => (
                        <React.Fragment key={key}>
                          <dt>{key}</dt>
                          <dd>{String(value)}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  </div>
                )}

                {selected.motivation?.answers && (
                  <div className="ckr-admin-detail-block">
                    <h3>Motivasyon Cevapları</h3>
                    <pre>{JSON.stringify(selected.motivation.answers, null, 2)}</pre>
                  </div>
                )}

                <label className="ckr-admin-field">
                  Takip durumu
                  <select value={selected.follow_up_status} onChange={(e) => setSelected((current) => ({ ...current, follow_up_status: e.target.value }))}>
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>

                <label className="ckr-admin-field">
                  Takip notu
                  <textarea rows={5} value={selected.admin_notes || ''} onChange={(e) => setSelected((current) => ({ ...current, admin_notes: e.target.value }))} />
                </label>

                <button className="ckr-btn ckr-btn-primary" onClick={saveSelected} disabled={saving}>
                  {saving ? 'Kaydediliyor...' : 'Durumu ve Notu Kaydet'}
                </button>
              </>
            ) : (
              <p>Detayları görmek için tablodan bir müşteri seçin.</p>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
