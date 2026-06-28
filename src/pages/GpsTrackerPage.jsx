import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout.jsx';
import MaskedPassword from '../components/MaskedPassword.jsx';
import { db } from '../lib/db.js';
import { exportGpsVehicles, importGpsVehicles } from '../lib/excelUtils.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTranslation } from 'react-i18next';
import { Upload, Download, Plus, Search, MapPin, CheckCircle2, XCircle, Trash2, Edit2, Loader2 } from 'lucide-react';
import { getLatestInspectionForPlate } from '../lib/db.js';

function StatusBadge({ status, isRtl }) {
  const map = {
    'Running': { label: isRtl ? 'تشغيل' : 'Running', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    'Out': { label: isRtl ? 'خارج الخدمة' : 'Out of Service', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    'Not Work': { label: isRtl ? 'لا تعمل' : 'Not Working', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  };
  const s = map[status] || map['Not Work'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'Running' ? 'bg-emerald-500 animate-pulse' : 'bg-current opacity-60'}`} />
      {s.label}
    </span>
  );
}

export default function GpsTrackerPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [inspections, setInspections] = useState([]);
  const [form, setForm] = useState({ id: null, company: '', username: '', password: '', imei: '', carType: '', carNo: '', comments: 'Running' });

  const loadData = async () => {
    const list = await db.getGpsVehicles();
    const ins = await db.getInspections();
    setInspections(ins);

    // Attach dynamic status based on inspection if available
    const mapped = list.map(v => {
      const latest = getLatestInspectionForPlate(ins, v.carNo);
      let dynamicStatus = v.comments;
      if (latest) {
        dynamicStatus = latest.exitStatus === 'Till now' ? 'Running' : 'Out';
      }
      return { ...v, dynamicStatus };
    });
    setVehicles(mapped);
  };

  useEffect(() => { loadData(); }, []);

  const companies = [...new Set(vehicles.map(v => v.company).filter(Boolean))].sort();

  const filtered = vehicles.filter(v => {
    const matchSearch = !search || v.carNo.toLowerCase().includes(search.toLowerCase()) || v.company.toLowerCase().includes(search.toLowerCase()) || v.username.toLowerCase().includes(search.toLowerCase());
    const matchCompany = !filterCompany || v.company === filterCompany;
    const matchStatus = !filterStatus || v.dynamicStatus === filterStatus;
    return matchSearch && matchCompany && matchStatus;
  });

  const handleAdd = async () => {
    if (!form.company || !form.carNo) return;
    if (form.id) {
      await db.updateGpsVehicle(form.id, form);
    } else {
      await db.addGpsVehicle(form);
    }
    await loadData();
    setShowAddModal(false);
    setForm({ id: null, company: '', username: '', password: '', imei: '', carType: '', carNo: '', comments: 'Running' });
  };

  const handleDelete = async (id) => {
    if (!confirm(isRtl ? 'هل تريد حذف هذه السيارة؟' : 'Delete this vehicle?')) return;
    await db.deleteGpsVehicle(id);
    await loadData();
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportStatus('loading');
    try {
      const parsed = await importGpsVehicles(file);
      const current = await db.getGpsVehicles();
      const existingNos = new Set(current.map(v => v.carNo));
      let added = 0;
      for (const v of parsed) {
        if (!existingNos.has(v.carNo)) {
          await db.addGpsVehicle(v);
          added++;
        }
      }
      await loadData();
      setImportStatus(`Imported ${added} new vehicles.`);
    } catch (err) {
      setImportStatus('Error: ' + err.message);
    }
    e.target.value = '';
  };

  const handleStatusUpdate = async (id, newStatus) => {
    const list = await db.getGpsVehicles();
    const idx = list.findIndex(v => v.id === id);
    if (idx !== -1) {
      list[idx].comments = newStatus;
      await db.updateGpsVehicle(id, list[idx]);
      await loadData();
    }
  };

  const running = vehicles.filter(v => v.dynamicStatus === 'Running').length;
  const out = vehicles.filter(v => v.dynamicStatus !== 'Running').length;

  return (
    <Layout>
      <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-7 h-7 text-indigo-500" />
              {isRtl ? 'لوحة تتبع GPS' : 'GPS Tracker'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {isRtl ? 'إدارة حسابات التتبع وحالة السيارات' : 'Manage vehicle tracking accounts and status'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer border border-gray-200 shadow-sm">
              <Upload className="w-4 h-4 text-gray-500" />
              {isRtl ? 'استيراد Excel' : 'Import Excel'}
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            </label>
            <button
              onClick={() => exportGpsVehicles(filtered)}
              className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border border-gray-200 shadow-sm"
            >
              <Download className="w-4 h-4 text-gray-500" />
              {isRtl ? 'تصدير Excel' : 'Export Excel'}
            </button>
            <button
              onClick={() => { setForm({ id: null, company: '', username: '', password: '', imei: '', carType: '', carNo: '', comments: 'Running' }); setShowAddModal(true); }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-md shadow-indigo-500/20"
            >
              <Plus className="w-4 h-4" />
              {isRtl ? 'إضافة سيارة' : 'Add Vehicle'}
            </button>
          </div>
        </div>

        {/* Status message */}
        {importStatus && importStatus !== 'loading' && (
          <div className={`p-3 rounded-xl text-sm border flex items-center gap-2 ${importStatus.includes('Error') ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {importStatus.includes('Error') ? <XCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {importStatus}
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-4 flex-wrap">
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-3 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
            <span className="text-gray-500 text-sm">{isRtl ? 'الإجمالي' : 'Total'}</span>
            <span className="text-gray-900 font-bold text-lg">{vehicles.length}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 flex items-center gap-3 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-600 text-sm">{isRtl ? 'تشغيل' : 'Running'}</span>
            <span className="text-emerald-700 font-bold text-lg">{running}</span>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-5 py-3 flex items-center gap-3 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-rose-600 text-sm">{isRtl ? 'خارج الخدمة' : 'Out of Service'}</span>
            <span className="text-rose-700 font-bold text-lg">{out}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-0">
            <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
            <input
              type="text"
              placeholder={isRtl ? 'ابحث بالسيارة أو الشركة...' : 'Search by vehicle or company...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`w-full bg-white border border-gray-200 rounded-xl ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 shadow-sm`}
            />
          </div>
          <select
            value={filterCompany}
            onChange={e => setFilterCompany(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 text-sm focus:outline-none focus:border-indigo-400 shadow-sm"
          >
            <option value="">{isRtl ? 'كل الشركات' : 'All Companies'}</option>
            {companies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 text-sm focus:outline-none focus:border-indigo-400 shadow-sm"
          >
            <option value="">{isRtl ? 'كل الحالات' : 'All Statuses'}</option>
            <option value="Running">{isRtl ? 'تشغيل' : 'Running'}</option>
            <option value="Out">{isRtl ? 'خارج الخدمة' : 'Out of Service'}</option>
            <option value="Not Work">{isRtl ? 'لا تعمل' : 'Not Working'}</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-semibold">
                  <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>#</th>
                  <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'الشركة' : 'Company'}</th>
                  <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'اسم المستخدم' : 'Username'}</th>
                  <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'كلمة المرور' : 'Password'}</th>
                  <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>IMEI</th>
                  <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'نوع السيارة' : 'Car Type'}</th>
                  <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'رقم اللوحة' : 'Plate No.'}</th>
                  <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className="px-4 py-3 text-center">{isRtl ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.slice(0, 100).map((v, i) => (
                  <tr key={v.id || i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs max-w-[120px] truncate font-medium">{v.company}</td>
                    <td className="px-4 py-3 text-indigo-600 text-xs font-mono">{v.username}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs"><MaskedPassword value={v.password} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{v.imei || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{v.carType}</td>
                    <td className="px-4 py-3 text-gray-900 font-bold text-xs">{v.carNo}</td>
                    <td className="px-4 py-3">
                      <select
                        value={v.dynamicStatus}
                        onChange={e => handleStatusUpdate(v.id, e.target.value)}
                        className={`text-xs rounded-lg px-2 py-1.5 border focus:outline-none cursor-pointer font-medium ${
                          v.dynamicStatus === 'Running'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-rose-50 border-rose-200 text-rose-700'
                        }`}
                      >
                        <option value="Running">{isRtl ? 'تشغيل' : 'Running'}</option>
                        <option value="Out">{isRtl ? 'خارج الخدمة' : 'Out of Service'}</option>
                        <option value="Not Work">{isRtl ? 'لا تعمل' : 'Not Working'}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setForm({ ...v }); setShowAddModal(true); }}
                          className="text-indigo-400 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-indigo-50"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
                          className="text-rose-400 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{isRtl ? 'لا توجد سيارات تطابق البحث' : 'No vehicles match your search'}</p>
            </div>
          )}
          {filtered.length > 100 && (
            <div className="text-center py-3 text-gray-400 text-xs border-t border-gray-100">
              {isRtl ? `يعرض 100 من أصل ${filtered.length} — استخدم الفلاتر` : `Showing 100 of ${filtered.length} — use filters`}
            </div>
          )}
        </div>

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
            <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-gray-900 font-bold text-lg mb-5">{form.id ? (isRtl ? 'تعديل سيارة GPS' : 'Edit GPS Vehicle') : (isRtl ? 'إضافة سيارة GPS جديدة' : 'Add New GPS Vehicle')}</h3>
              <div className="space-y-4">
                {[
                  { label: isRtl ? 'الشركة *' : 'Company *', key: 'company', placeholder: 'H H C' },
                  { label: isRtl ? 'اسم المستخدم' : 'Username', key: 'username', placeholder: 'GPS Username' },
                  { label: isRtl ? 'كلمة المرور' : 'Password', key: 'password', placeholder: 'GPS Password' },
                  { label: 'IMEI', key: 'imei', placeholder: 'IMEI Number' },
                  { label: isRtl ? 'نوع السيارة' : 'Car Type', key: 'carType', placeholder: 'Microbus' },
                  { label: isRtl ? 'رقم اللوحة *' : 'Plate No. *', key: 'carNo', placeholder: 'ص ه ع 8594' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                    <input
                      value={form[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{isRtl ? 'الحالة' : 'Status'}</label>
                  <select
                    value={form.comments}
                    onChange={e => setForm(p => ({ ...p, comments: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-400"
                  >
                    <option value="Running">{isRtl ? 'تشغيل' : 'Running'}</option>
                    <option value="Out">{isRtl ? 'خارج الخدمة' : 'Out of Service'}</option>
                    <option value="Not Work">{isRtl ? 'لا تعمل' : 'Not Working'}</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleAdd} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors">
                  {form.id ? t('common.save') : t('common.add')}
                </button>
                <button onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-bold transition-colors">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
