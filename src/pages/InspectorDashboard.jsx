import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout.jsx';
import Pagination from '../components/Pagination.jsx';
import { db, getLatestInspectionsPerPlate } from '../lib/db.js';
import { env } from '../lib/env.js';
import { exportInspections, importInspections } from '../lib/excelUtils.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTranslation } from 'react-i18next';
import {
  Upload, Download, Plus, CheckCircle2, XCircle, AlertCircle,
  Search, Filter, ClipboardList, Loader2
} from 'lucide-react';

export default function InspectorDashboard() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [inspections, setInspections] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = env.paginationPageSize;
  const [showAddModal, setShowAddModal] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({
    no: '', letters: '', company: '', vehicleType: 'Microbus', vehicleModel: '',
    inspectionDate: new Date().toISOString().split('T')[0],
    status: 'Accept', exitStatus: 'Till now',
    operatorDriver: '', licenseExpiry: '', regExpiry: '',
    inspectedBy: user?.username || '', remarks: ''
  });

  useEffect(() => { loadData(); }, []);

  const loadData = useCallback(async () => {
    const list = await db.getInspections();
    setInspections(list);
  }, []);

  const handleAdd = async () => {
    if (!form.no || !form.letters) return;
    await db.addInspection({ ...form });
    await loadData();
    setSuccess(`Vehicle ${form.no} ${form.letters} registered. Status: ${form.exitStatus}`);
    setShowAddModal(false);
    setForm(f => ({ ...f, no: '', letters: '', company: '', vehicleModel: '', operatorDriver: '', remarks: '' }));
    setTimeout(() => setSuccess(null), 5000);
  };

  useEffect(() => { setCurrentPage(1); }, [search, filterStatus]);

  const latestInspections = useMemo(
    () => getLatestInspectionsPerPlate(inspections),
    [inspections]
  );

  const sourceList = filterStatus ? latestInspections : inspections;

  const filtered = sourceList.filter(ins => {
    const matchSearch = !search ||
      ins.no.includes(search) ||
      ins.letters.includes(search) ||
      ins.company.toLowerCase().includes(search.toLowerCase()) ||
      ins.operatorDriver.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || ins.exitStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportStatus('loading');
    try {
      const parsed = await importInspections(file);
      const newList = parsed.map((ins, index) => ({
        id: `insp_${Date.now()}_${index}`,
        no: String(ins.no || '').trim(),
        letters: String(ins.letters || '').trim(),
        company: String(ins.company || '').trim(),
        vehicleType: ins.vehicleType || '',
        vehicleModel: ins.vehicleModel || '',
        inspectionDate: ins.inspectionDate || new Date().toISOString().split('T')[0],
        status: ins.status || 'Accept',
        exitStatus: ins.exitStatus || 'Till now',
        operatorDriver: ins.operatorDriver || '',
        licenseExpiry: ins.licenseExpiry || '',
        regExpiry: ins.regExpiry || '',
        inspectedBy: ins.inspectedBy || '',
        remarks: ins.remarks || ''
      }));
      await db.saveInspections(newList);
      for (const ins of getLatestInspectionsPerPlate(newList)) {
        await db.syncGpsVehicleStatus(`${ins.no} ${ins.letters}`, ins.exitStatus === 'Till now' ? 'Running' : 'Out');
      }
      await loadData();
      setImportStatus(`Imported ${newList.length} records successfully.`);
    } catch (err) {
      setImportStatus('Error: ' + err.message);
    }
    e.target.value = '';
  };

  const handleStatusToggle = async (id) => {
    const list = await db.getInspections();
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) return;
    const cur = list[idx];
    const newStatus = cur.exitStatus === 'Till now' ? 'OUT' : 'Till now';
    await db.updateInspectionStatus(id, newStatus);
    await loadData();
  };

  const running = latestInspections.filter(i => i.exitStatus === 'Till now').length;
  const out = latestInspections.filter(i => i.exitStatus === 'OUT').length;

  const pageStart = (currentPage - 1) * pageSize;
  const pagedItems = filtered.slice(pageStart, pageStart + pageSize);

  return (
    <Layout>
      <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-amber-500" />
              {isRtl ? 'سجل الفحص' : 'Inspection Log'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {isRtl ? 'تسجيل وتتبع فحص المركبات — أي تغيير يؤثر فوراً على الشركات' : 'Register and track vehicle inspections — changes reflect immediately'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer border border-gray-200 shadow-sm">
              <Upload className="w-4 h-4 text-gray-500" />
              {isRtl ? 'استيراد Excel' : 'Import Excel'}
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            </label>
            <button
              onClick={() => exportInspections(filtered)}
              className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border border-gray-200 shadow-sm"
            >
              <Download className="w-4 h-4 text-gray-500" />
              {isRtl ? 'تصدير Excel' : 'Export Excel'}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-md shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              {isRtl ? 'تسجيل فحص جديد' : 'New Inspection'}
            </button>
          </div>
        </div>

        {/* Alerts */}
        {success && (
          <div className="p-3 rounded-xl text-sm border bg-emerald-50 border-emerald-200 text-emerald-700 flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}
        {importStatus && (
          <div className={`p-3 rounded-xl text-sm border flex items-center gap-2 ${importStatus.includes('Error') || importStatus.includes('خطأ') ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {importStatus.includes('Error') || importStatus.includes('خطأ') ? <XCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {importStatus}
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[120px] bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
            <p className="text-gray-500 text-xs font-medium">{isRtl ? 'إجمالي العربيات' : 'Total Vehicles'}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{latestInspections.length}</p>
            <p className="text-gray-400 text-xs mt-1">{isRtl ? `${inspections.length} سجل فحص` : `${inspections.length} inspection records`}</p>
          </div>
          <div className="flex-1 min-w-[120px] bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 shadow-sm">
            <p className="text-emerald-600 text-xs font-medium">{isRtl ? 'نشطة (Till now)' : 'Active (Till now)'}</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{running}</p>
          </div>
          <div className="flex-1 min-w-[120px] bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4 shadow-sm">
            <p className="text-rose-600 text-xs font-medium">{isRtl ? 'خارج الخدمة (OUT)' : 'Out of Service (OUT)'}</p>
            <p className="text-3xl font-bold text-rose-600 mt-1">{out}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-0">
            <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
            <input
              type="text"
              placeholder={isRtl ? 'ابحث بالرقم / الحروف / الشركة / السائق...' : 'Search by plate / company / driver...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`w-full bg-white border border-gray-200 rounded-xl ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all shadow-sm`}
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-gray-700 text-sm focus:outline-none focus:border-amber-400 transition-all shadow-sm"
          >
            <option value="">{isRtl ? 'كل الحالات (آخر فحص لكل عربية)' : 'All statuses (latest per plate)'}</option>
            <option value="Till now">{isRtl ? 'نشطة (Till now)' : 'Active (Till now)'}</option>
            <option value="OUT">{isRtl ? 'خارج الخدمة (OUT)' : 'Out of Service (OUT)'}</option>
          </select>
        </div>

        {/* Inspection Table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-semibold">
                  <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'رقم اللوحة' : 'Plate No.'}</th>
                  <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'الحروف' : 'Letters'}</th>
                  <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'الشركة' : 'Company'}</th>
                  <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'نوع المركبة' : 'Vehicle Type'}</th>
                  <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'السائق/المشغل' : 'Driver/Operator'}</th>
                  <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'تاريخ الفحص' : 'Inspection Date'}</th>
                  <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className="px-4 py-3 text-center">{isRtl ? 'تغيير الحالة' : 'Toggle'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedItems.map((ins, i) => (
                  <tr key={ins.id || i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 font-mono font-bold">{ins.no}</td>
                    <td className="px-4 py-3 text-gray-600">{ins.letters}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-[140px] truncate">{ins.company}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{ins.vehicleType}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[130px] truncate">{ins.operatorDriver}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{ins.inspectionDate}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        ins.exitStatus === 'Till now'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ins.exitStatus === 'Till now' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {ins.exitStatus === 'Till now' ? (isRtl ? 'نشطة' : 'Active') : 'OUT'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleStatusToggle(ins.id)}
                        className={`w-10 h-5 rounded-full transition-all relative shrink-0 ${
                          ins.exitStatus === 'Till now' ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${
                          ins.exitStatus === 'Till now' ? 'right-0.5' : 'left-0.5'
                        }`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{isRtl ? 'لا توجد سجلات تطابق البحث' : 'No records match your search'}</p>
            </div>
          )}
          <Pagination
            currentPage={currentPage}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            isRtl={isRtl}
          />
        </div>
      </div>

      {/* Add Inspection Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-gray-900 font-bold text-lg mb-5">{isRtl ? 'تسجيل فحص مركبة جديد' : 'Register New Inspection'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: isRtl ? 'رقم اللوحة *' : 'Plate No. *', key: 'no', placeholder: '6417' },
                { label: isRtl ? 'الحروف *' : 'Letters *', key: 'letters', placeholder: 'ص م ق' },
                { label: isRtl ? 'اسم الشركة *' : 'Company *', key: 'company', placeholder: 'Al-Hendawy' },
                { label: isRtl ? 'نموذج السيارة' : 'Vehicle Model', key: 'vehicleModel', placeholder: 'Toyota 2013' },
                { label: isRtl ? 'السائق/المشغل' : 'Driver/Operator', key: 'operatorDriver', placeholder: 'Driver name' },
                { label: isRtl ? 'تاريخ الفحص' : 'Inspection Date', key: 'inspectionDate', placeholder: '', type: 'date' },
                { label: isRtl ? 'تاريخ انتهاء الرخصة' : 'License Expiry', key: 'licenseExpiry', placeholder: '', type: 'date' },
                { label: isRtl ? 'تاريخ انتهاء التسجيل' : 'Registration Expiry', key: 'regExpiry', placeholder: '', type: 'date' },
                { label: isRtl ? 'الفاحص' : 'Inspector', key: 'inspectedBy', placeholder: 'Inspector name' },
              ].map(f => (
                <div key={f.key} className={f.key === 'company' || f.key === 'operatorDriver' || f.key === 'inspectedBy' ? 'col-span-2' : ''}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{isRtl ? 'نوع المركبة' : 'Vehicle Type'}</label>
                <select value={form.vehicleType} onChange={e => setForm(p => ({ ...p, vehicleType: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-amber-400">
                  {['Microbus', 'Mini Bus', 'Pick-up', 'Sedan', 'SUV', 'Other'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{isRtl ? 'حالة الفحص' : 'Inspection Status'}</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-amber-400">
                  <option value="Accept">Accept</option>
                  <option value="Reject">Reject</option>
                  <option value="Accept With Comment">Accept With Comment</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-2">{isRtl ? 'حالة الخروج (Exit Status)' : 'Exit Status'}</label>
                <div className="flex gap-3">
                  {['Till now', 'OUT'].map(s => (
                    <button key={s} type="button" onClick={() => setForm(p => ({ ...p, exitStatus: s }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                        form.exitStatus === s
                          ? s === 'Till now'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-rose-500 bg-rose-50 text-rose-700'
                          : 'border-gray-200 bg-gray-50 text-gray-500'
                      }`}>
                      {s === 'Till now' ? '🟢 Till now' : '🔴 OUT'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">{isRtl ? 'ملاحظات' : 'Remarks'}</label>
                <input value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))}
                  placeholder={isRtl ? 'ملاحظات إضافية...' : 'Additional remarks...'}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-amber-400" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleAdd} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl text-sm font-bold transition-colors">
                {isRtl ? 'تسجيل الفحص' : 'Register'}
              </button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-bold transition-colors">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
