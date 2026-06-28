import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout.jsx';
import Pagination from '../components/Pagination.jsx';
import MaskedPassword from '../components/MaskedPassword.jsx';
import { db, getAllAccountsForAdmin, platesMatch, getPlanPassengers, companiesMatch, getLatestInspectionsPerPlate } from '../lib/db.js';
import { createAppUser, updateAppUser } from '../lib/userApi.js';
import { env } from '../lib/env.js';
import { exportInspections, exportGpsVehicles, exportPassengersList, exportFilteredInspections, exportDailyPlans } from '../lib/excelUtils.js';
import { useTranslation } from 'react-i18next';
import { Building2, Car, ClipboardList, Users, Search, SlidersHorizontal, Download, Plus, Check, X, RefreshCw, Trash2, Pencil, AlertTriangle } from 'lucide-react';

function StatCard({ label, value, sub, color }) {
  const colors = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
  };
  return (
    <div className={`${colors[color]} border rounded-2xl p-4 md:p-5 shadow-sm flex-1 min-w-[140px] sm:min-w-[200px]`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard({ defaultTab = 'overview' }) {
  const [inspections, setInspections] = useState([]);
  const [gpsVehicles, setGpsVehicles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [dailyPlans, setDailyPlans] = useState([]);
  const [customAccounts, setCustomAccounts] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [expandedCompany, setExpandedCompany] = useState(null);

  // Filters (companies+passengers tab)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Filters (inspections tab)
  const [insSearchTerm, setInsSearchTerm] = useState('');
  const [insSelectedCompany, setInsSelectedCompany] = useState('');
  const [insSelectedStatus, setInsSelectedStatus] = useState('');
  const [insCurrentPage, setInsCurrentPage] = useState(1);

  // Account form
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountForm, setAccountForm] = useState({ company: '', username: '', password: '', role: 'company' });
  const [accountSearch, setAccountSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    await db.repairPassengerCounts();
    const [ins, gps, req, plans, customAccs] = await Promise.all([
      db.getInspections(),
      db.getGpsVehicles(),
      db.getRequests(),
      db.getDailyPlans(),
      db.getCustomAccounts()
    ]);
    setInspections(ins);
    setGpsVehicles(gps);
    setRequests(req);
    setDailyPlans(plans);
    setCustomAccounts(customAccs);
    const allAccs = await getAllAccountsForAdmin();
    setAllAccounts(allAccs);
  }, []);

  const reloadFromAppwrite = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const handleApprove = async (id) => {
    try {
      await db.resolveRequest(id, 'approved');
      await loadData();
    } catch (e) {
      alert('فشلت الموافقة: ' + e.message);
    }
  };

  const handleReject = async (id) => {
    if (!confirm('هل تريد رفض هذا الطلب؟ سيتم حذف العربية وجميع رحلاتها نهائياً من قاعدة البيانات.')) return;
    try {
      await db.resolveRequest(id, 'rejected');
      await loadData();
    } catch (e) {
      alert('فشل الرفض: ' + e.message);
    }
  };

  const handleDeleteVehicle = async (vehicle) => {
    if (!confirm(`هل تريد حذف العربية ${vehicle.carNo} نهائياً من قاعدة البيانات؟`)) return;
    try {
      await db.deleteGpsVehicle(vehicle.id);
      await db.deleteDailyPlansByPlate(vehicle.carNo, vehicle.company);
      await loadData();
    } catch (e) {
      alert('فشل الحذف: ' + e.message);
    }
  };

  const handleDeleteVehicleByPlate = async (carNo, company) => {
    if (!confirm(`هل تريد حذف العربية ${carNo} وجميع رحلاتها نهائياً؟`)) return;
    try {
      await db.deleteGpsVehicleByPlate(carNo, company);
      await db.deleteDailyPlansByPlate(carNo, company);
      const pendingReqs = (await db.getRequests()).filter(
        r => r.status === 'pending' && companiesMatch(r.company, company) && platesMatch(r.car_no, carNo)
      );
      for (const r of pendingReqs) {
        await db.deleteRequest(r.id);
      }
      await loadData();
    } catch (e) {
      alert('فشل الحذف: ' + e.message);
    }
  };

  const handleDeletePassenger = async (planId, passengerName) => {
    if (!confirm(`هل تريد حذف الراكب "${passengerName}" نهائياً؟`)) return;
    try {
      await db.deletePassengerFromPlan(planId, passengerName);
      await loadData();
    } catch (e) {
      alert('فشل حذف الراكب: ' + e.message);
    }
  };

  const running = gpsVehicles.filter(v => v.comments === 'Running').length;
  const out = gpsVehicles.filter(v => v.comments === 'Out' || v.comments === 'Not Work').length;
  const pending = requests.filter(r => r.status === 'pending').length;
  const pendingRequests = requests.filter(r => r.status === 'pending');

  // Extract unique companies from GPS vehicles and plans
  const allCompanies = Array.from(new Set([
    ...gpsVehicles.map(v => v.company),
    ...dailyPlans.map(p => p.company)
  ])).filter(Boolean);

  // Smart Search and Advanced Filtered Plans
  const filteredPlans = dailyPlans.filter(p => {
    // 1. Shift filter
    if (selectedShift && p.shift !== selectedShift) return false;
    // 2. Company filter
    if (selectedCompany && !companiesMatch(p.company, selectedCompany)) return false;
    // 3. Date filter
    if (selectedDate && p.date !== selectedDate) return false;
    // 4. Smart search matching multiple fields
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      let passengerList = [];
      try { passengerList = JSON.parse(p.passengers || '[]'); } catch {}
      
      const matchPlate = p.plateNumber?.toLowerCase().includes(term);
      const matchDriver = p.driverName?.toLowerCase().includes(term);
      const matchRoute = p.route?.toLowerCase().includes(term);
      const matchCompany = p.company?.toLowerCase().includes(term);
      const matchPassenger = passengerList.some(name => name.toLowerCase().includes(term));
      
      return matchPlate || matchDriver || matchRoute || matchCompany || matchPassenger;
    }
    return true;
  });

  // Group GPS vehicles by company
  const companiesMap = gpsVehicles.reduce((acc, v) => {
    const k = v.company || 'غير محدد';
    if (!acc[k]) acc[k] = { total: 0, running: 0, out: 0, vehiclesList: [] };
    acc[k].total++;
    acc[k].vehiclesList.push(v);
    if (v.comments === 'Running') acc[k].running++;
    else acc[k].out++;
    return acc;
  }, {});

  allCompanies.forEach(c => {
    if (!companiesMap[c]) {
      companiesMap[c] = { total: 0, running: 0, out: 0, vehiclesList: [] };
    }
  });

  // Companies visible in the "Companies & Passengers" tab under current filters
  const hasCompanyFilters = !!(searchTerm.trim() || selectedCompany || selectedShift || selectedDate);
  const visibleCompanies = allCompanies.filter(company => {
    if (!hasCompanyFilters) return true;
    return filteredPlans.some(p => companiesMatch(p.company, company));
  });

  const latestInspections = useMemo(
    () => getLatestInspectionsPerPlate(inspections),
    [inspections]
  );

  // Smart filtered inspections (overview tab) — status filter uses latest record per plate
  const inspectionSource = insSelectedStatus ? latestInspections : inspections;
  const filteredInspections = inspectionSource.filter(ins => {
    if (insSelectedCompany && ins.company !== insSelectedCompany) return false;
    if (insSelectedStatus && ins.exitStatus !== insSelectedStatus) return false;
    if (insSearchTerm.trim()) {
      const term = insSearchTerm.toLowerCase();
      return (
        ins.no?.toLowerCase().includes(term) ||
        ins.letters?.toLowerCase().includes(term) ||
        ins.company?.toLowerCase().includes(term) ||
        ins.operatorDriver?.toLowerCase().includes(term)
      );
    }
    return true;
  });
  const insCompanies = Array.from(new Set(inspections.map(i => i.company).filter(Boolean)));

  useEffect(() => { setInsCurrentPage(1); }, [insSearchTerm, insSelectedCompany, insSelectedStatus]);

  const insPageSize = env.paginationPageSize;


  const sourceLabel = (source) => ({
    profile: 'Appwrite Auth',
    system: 'نظام',
    seed: 'من النظام',
    custom: 'مضاف يدوياً',
    gps: 'من GPS',
  }[source] || source);

  const roleLabel = (role) => ({
    admin: 'آدمن',
    inspector: 'فاحص',
    company: 'شركة',
  }[role] || role);

  const openAccountEditor = (acc) => {
    setEditingAccount(acc);
    setAccountForm({
      company: acc.company || '',
      username: acc.username || '',
      password: '',
      role: acc.role || 'company',
      convertToCustom: false,
    });
    setShowAccountModal(true);
  };

  const saveAccount = async () => {
    if (!accountForm.company || !accountForm.username) return;
    if (editingAccount?.source === 'gps' && !accountForm.convertToCustom) {
      await db.updateGpsVehicle(editingAccount.gpsVehicleId || editingAccount.id, accountForm);
    } else if (editingAccount?.source === 'profile') {
      if (!accountForm.password && !accountForm.username) return;
      await updateAppUser({
        userId: editingAccount.userId,
        username: accountForm.username,
        password: accountForm.password || undefined,
        role: accountForm.role,
        company: accountForm.company,
        name: accountForm.username,
      });
    } else if (editingAccount) {
      await updateAppUser({
        userId: editingAccount.userId,
        username: accountForm.username,
        password: accountForm.password || undefined,
        role: accountForm.role,
        company: accountForm.company,
        name: accountForm.username,
      });
    } else {
      if (!accountForm.password) return;
      await createAppUser({
        username: accountForm.username,
        password: accountForm.password,
        role: accountForm.role,
        company: accountForm.company,
        name: accountForm.username,
      });
    }
    await loadData();
    setShowAccountModal(false);
    setAccountForm({ company: '', username: '', password: '', role: 'company' });
    setEditingAccount(null);
  };

  return (
    <Layout>
      <div className="space-y-6 font-cairo" dir="rtl">
        {/* Page Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">لوحة تحكم الآدمن</h1>
            <p className="text-gray-500 text-sm mt-1">مراقبة شاملة للأسطول والعمليات اليومية والركاب</p>
          </div>
          <button
            onClick={() => exportGpsVehicles(gpsVehicles)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-md shadow-indigo-500/20"
          >
            <Download className="w-4 h-4" />
            تصدير GPS
          </button>
        </div>

        {/* Stats Row */}
        <div className="flex gap-4 flex-wrap">
          <StatCard label="إجمالي السيارات" value={gpsVehicles.length} sub={`في ${allCompanies.length} شركة`} color="indigo" />
          <StatCard label="تشغيل (Running)" value={running} sub="متاحة حالياً" color="emerald" />
          <StatCard label="خارج الخدمة (Out)" value={out} sub="غير متاحة" color="rose" />
          <StatCard label="طلبات معلقة" value={pending} sub="تحتاج موافقة" color="amber" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
          {[
            { id: 'overview', label: 'نظرة عامة (الفحص)' },
            { id: 'requests', label: `الطلبات المعلقة (${pending})` },
            { id: 'companies', label: 'الشركات والركاب' },
            { id: 'accounts', label: `حسابات الشركات (${allAccounts.length})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap -mb-px ${
                activeTab === t.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Inspection Filters Bar */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-gray-900 font-semibold text-sm">فلاتر سجل الفحص</h3>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => exportFilteredInspections(filteredInspections, { company: insSelectedCompany, exitStatus: insSelectedStatus, search: insSearchTerm })}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    تصدير الفحص ({filteredInspections.length})
                  </button>
                  {(insSearchTerm || insSelectedCompany || insSelectedStatus) && (
                    <button
                      onClick={() => { setInsSearchTerm(''); setInsSelectedCompany(''); setInsSelectedStatus(''); }}
                      className="text-rose-600 hover:text-rose-700 text-xs px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 transition-colors"
                    >
                      إعادة تعيين
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={insSearchTerm}
                  onChange={e => { setInsSearchTerm(e.target.value); setInsCurrentPage(1); }}
                  placeholder="بحث برقم اللوحة، الشركة، السائق..."
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-xs placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                />
                <select
                  value={insSelectedCompany}
                  onChange={e => { setInsSelectedCompany(e.target.value); setInsCurrentPage(1); }}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-xs focus:outline-none focus:border-indigo-400"
                >
                  <option value="">كل الشركات</option>
                  {insCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={insSelectedStatus}
                  onChange={e => { setInsSelectedStatus(e.target.value); setInsCurrentPage(1); }}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-xs focus:outline-none focus:border-indigo-400"
                >
                  <option value="">كل الحالات</option>
                  <option value="Till now">🟢 نشطة</option>
                  <option value="OUT">🔴 خارج الخدمة</option>
                </select>
              </div>
              {(insSearchTerm || insSelectedCompany || insSelectedStatus) && (
                <p className="text-indigo-600 text-xs">
                  {insSelectedStatus
                    ? `نتائج: ${filteredInspections.length} عربية (آخر فحص) من ${latestInspections.length} عربية`
                    : `نتائج: ${filteredInspections.length} سجل من ${inspections.length} إجمالي`}
                </p>
              )}
            </div>

            {/* Inspections Table */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-semibold">
                      <th className="px-4 py-3 text-right">رقم اللوحة</th>
                      <th className="px-4 py-3 text-right">الحروف</th>
                      <th className="px-4 py-3 text-right">الشركة</th>
                      <th className="px-4 py-3 text-right">النوع</th>
                      <th className="px-4 py-3 text-right">تاريخ الفحص</th>
                      <th className="px-4 py-3 text-right">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const startIndex = (insCurrentPage - 1) * insPageSize;
                      const currentItems = filteredInspections.slice(startIndex, startIndex + insPageSize);
                      
                      if (currentItems.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="text-center py-12 text-gray-400">لا توجد نتائج مطابقة</td>
                          </tr>
                        );
                      }
                      
                      return currentItems.map((ins, i) => (
                        <tr key={ins.id || i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-900 font-mono">{ins.no}</td>
                          <td className="px-4 py-3 text-gray-600">{ins.letters}</td>
                          <td className="px-4 py-3 text-gray-600 truncate max-w-[150px]">{ins.company}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{ins.vehicleType}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{ins.inspectionDate}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              ins.exitStatus === 'Till now'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {ins.exitStatus === 'Till now' ? '🟢 نشطة' : '🔴 خارج الخدمة'}
                            </span>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              
              <Pagination
                currentPage={insCurrentPage}
                totalItems={filteredInspections.length}
                pageSize={insPageSize}
                onPageChange={setInsCurrentPage}
                isRtl
              />
            </div>
          </div>
        )}


        {activeTab === 'requests' && (
          <div className="space-y-3">
            {pendingRequests.length === 0 && (
              <div className="text-center py-16 text-gray-400 bg-white border border-gray-200 rounded-2xl">لا توجد طلبات معلقة</div>
            )}
            {pendingRequests.map(req => {
              let isPassengerDelete = req.request_type === 'delete_passenger';
              let passengerName = '';
              if (isPassengerDelete) {
                try {
                  const detail = JSON.parse(req.car_type);
                  passengerName = detail.passengerName;
                } catch {}
              }

              const hasInspection = inspections.some(ins => platesMatch(`${ins.no} ${ins.letters}`, req.car_no));
              const isUninspectedAdd = req.request_type === 'add_vehicle' && !hasInspection;
              const isInspectedAdd = req.request_type === 'add_vehicle' && hasInspection;

              return (
                <div key={req.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 flex-wrap shadow-sm">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    req.request_type === 'add_vehicle' ? 'bg-emerald-100' : 
                    req.request_type === 'edit_vehicle' ? 'bg-indigo-100' : 'bg-rose-100'
                  }`}>
                    {req.request_type === 'add_vehicle' ? (
                      <Plus className="w-5 h-5 text-emerald-600" />
                    ) : req.request_type === 'edit_vehicle' ? (
                      <Edit2 className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <Trash2 className="w-5 h-5 text-rose-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-sm font-semibold flex items-center gap-2 flex-wrap">
                      <span>
                        {req.request_type === 'add_vehicle' && 'طلب إضافة سيارة'}
                        {req.request_type === 'delete_vehicle' && 'طلب حذف سيارة'}
                        {req.request_type === 'edit_vehicle' && 'طلب تعديل سيارة (GPS)'}
                        {req.request_type === 'delete_passenger' && `طلب موافقة على حذف راكب: ${passengerName}`}
                      </span>
                      {isUninspectedAdd && (
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          غير مفحوصة ⚠️
                        </span>
                      )}
                      {isInspectedAdd && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          مفحوصة ✓
                        </span>
                      )}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      <span className="text-gray-800 font-semibold">{req.company}</span>
                      {isPassengerDelete ? ` — سيارة رقم ${req.car_no}` : ` — ${req.car_type} — ${req.car_no}`}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">{new Date(req.created_at).toLocaleString('ar-EG')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      onClick={() => handleApprove(req.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      موافقة
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs px-3 py-1.5 rounded-lg font-medium border border-rose-200 transition-colors"
                    >
                      رفض
                    </button>
                    {(req.request_type === 'add_vehicle' || req.request_type === 'delete_vehicle') && (
                      <button
                        onClick={() => handleDeleteVehicleByPlate(req.car_no, req.company)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg font-medium border border-gray-200 transition-colors flex items-center gap-1"
                        title="حذف مباشر من قاعدة البيانات"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف نهائي
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'companies' && (
          <div className="space-y-4">
            {/* Search & Filters — scoped to this tab only */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <h3 className="text-gray-900 font-semibold text-sm">البحث الذكي وتصفية الشركات والركاب</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1 font-semibold">بحث ذكي (سائق، راكب، لوحة، خط...)</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="ابحث عن أي شيء..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-xs placeholder-gray-400 focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1 font-semibold">الشركة</label>
                  <select
                    value={selectedCompany}
                    onChange={e => setSelectedCompany(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-xs focus:outline-none focus:border-indigo-400"
                  >
                    <option value="">كل الشركات</option>
                    {allCompanies.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1 font-semibold">الوردية</label>
                  <select
                    value={selectedShift}
                    onChange={e => setSelectedShift(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-xs focus:outline-none focus:border-indigo-400"
                  >
                    <option value="">كل الورديات</option>
                    <option value="day">الوردية النهارية ☀️</option>
                    <option value="night">الوردية الليلية 🌙</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1 font-semibold">تاريخ اضافة العربية</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-xs focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              {hasCompanyFilters && (
                <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-200">
                  <span className="text-indigo-600 font-medium">
                    نتائج التصفية: {visibleCompanies.length} شركة — {filteredPlans.length} رحلة
                  </span>
                  <button
                    onClick={() => { setSearchTerm(''); setSelectedCompany(''); setSelectedShift(''); setSelectedDate(''); setExpandedCompany(null); }}
                    className="text-rose-600 hover:text-rose-700 transition-colors"
                  >
                    إعادة تعيين الفلاتر
                  </button>
                </div>
              )}

              {/* Export Buttons */}
              <div className="flex gap-2 flex-wrap pt-2 border-t border-gray-200">
                <button
                  onClick={() => exportPassengersList(filteredPlans, { company: selectedCompany, shift: selectedShift, date: selectedDate }, gpsVehicles)}
                  className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-2 rounded-xl text-xs font-medium border border-emerald-200 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  تصدير الركاب ({filteredPlans.reduce((s, p) => { try { return s + JSON.parse(p.passengers || '[]').length; } catch { return s; } }, 0)})
                </button>
                <button
                  onClick={() => exportDailyPlans(filteredPlans, selectedCompany || 'All', selectedDate || new Date().toISOString().split('T')[0])}
                  className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-2 rounded-xl text-xs font-medium border border-amber-200 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  تصدير خطط التشغيل ({filteredPlans.length})
                </button>
                <button
                  onClick={() => exportGpsVehicles(selectedCompany ? gpsVehicles.filter(v => v.company === selectedCompany) : gpsVehicles)}
                  className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-xl text-xs font-medium border border-indigo-200 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  تصدير سيارات GPS ({selectedCompany ? gpsVehicles.filter(v => v.company === selectedCompany).length : gpsVehicles.length})
                </button>
              </div>
            </div>


            {visibleCompanies.length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-white border border-gray-200 rounded-2xl">
                لا توجد نتائج مطابقة للبحث أو الفلاتر المحددة
              </div>
            ) : (
              visibleCompanies.map(company => {
              const stats = companiesMap[company] || { total: 0, running: 0, out: 0, vehiclesList: [] };
              const companyPlans = filteredPlans.filter(p => companiesMatch(p.company, company));
              const planPlates = [...new Map(companyPlans.map(p => [p.plateNumber, p])).values()];

              return (
                <div key={company} className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
                  <div className="p-5 flex items-center justify-between flex-wrap gap-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                        {company.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-gray-900 font-bold text-base">{company}</h3>
                        <p className="text-gray-500 text-xs mt-0.5">
                          GPS: {stats.total} عربية | الرحلات: {companyPlans.length} | اللوحات: {planPlates.length}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-white text-gray-600 border border-gray-200 px-3 py-1.5 rounded-xl">☀️ نهاراً: {companyPlans.filter(p => p.shift === 'day').length}</span>
                      <span className="text-xs bg-white text-gray-600 border border-gray-200 px-3 py-1.5 rounded-xl">🌙 ليلاً: {companyPlans.filter(p => p.shift === 'night').length}</span>
                      {planPlates.slice(0, 4).map(p => (
                        <span key={p.id} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-lg">{p.plateNumber}</span>
                      ))}
                      {planPlates.length > 4 && <span className="text-xs text-gray-400">+{planPlates.length - 4}</span>}
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                      <div className="space-y-2">
                        <h4 className="text-indigo-600 font-semibold text-xs border-r-2 border-indigo-500 pr-2">حسابات GPS + العربيات المضافة</h4>
                        {stats.vehiclesList.length === 0 && planPlates.length === 0 ? (
                          <p className="text-gray-400 text-xs">لا توجد عربيات مسجلة لهذه الشركة</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {stats.vehiclesList.map(v => (
                              <span key={v.id} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border font-medium ${
                                v.comments === 'Running' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${v.comments === 'Running' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                {v.carNo} ({v.carType}) — 🔑 {v.username} / {v.password}
                                <button
                                  onClick={() => handleDeleteVehicle(v)}
                                  className="text-rose-500 hover:text-rose-700 p-0.5 rounded transition-colors"
                                  title="حذف العربية"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                            {planPlates.filter(p => !stats.vehiclesList.some(v => platesMatch(v.carNo, p.plateNumber))).map(p => (
                              <span key={p.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border font-medium bg-amber-50 text-amber-700 border-amber-200">
                                {p.plateNumber} ({p.carType}) — رحلة
                                <button
                                  onClick={() => handleDeleteVehicleByPlate(p.plateNumber, company)}
                                  className="text-rose-500 hover:text-rose-700 p-0.5 rounded transition-colors"
                                  title="حذف العربية"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h4 className="text-amber-600 font-bold text-xs flex items-center gap-1.5">
                            <span>☀️</span> الوردية النهارية (Day Shift)
                          </h4>
                          {companyPlans.filter(p => p.shift === 'day').length === 0 ? (
                            <p className="text-gray-400 text-xs">لا توجد رحلات نهارية مسجلة</p>
                          ) : (
                            <div className="space-y-3">
                              {companyPlans.filter(p => p.shift === 'day').map(plan => (
                                <AdminPlanCard key={plan.id} plan={plan} inspections={inspections} onDeletePassenger={handleDeletePassenger} onDeleteVehicle={handleDeleteVehicleByPlate} />
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-indigo-600 font-bold text-xs flex items-center gap-1.5">
                            <span>🌙</span> الوردية الليلية (Night Shift)
                          </h4>
                          {companyPlans.filter(p => p.shift === 'night').length === 0 ? (
                            <p className="text-gray-400 text-xs">لا توجد رحلات ليلية مسجلة</p>
                          ) : (
                            <div className="space-y-3">
                              {companyPlans.filter(p => p.shift === 'night').map(plan => (
                                <AdminPlanCard key={plan.id} plan={plan} inspections={inspections} onDeletePassenger={handleDeletePassenger} onDeleteVehicle={handleDeleteVehicleByPlate} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                </div>
              );
            })
            )}
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-5">
            {/* Actions Bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <input
                type="text"
                placeholder="ابحث بالشركة أو اسم المستخدم..."
                value={accountSearch}
                onChange={e => setAccountSearch(e.target.value)}
                className="flex-1 min-w-[200px] bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 shadow-sm"
              />
<div className="flex items-center gap-2">
                 <button
                   onClick={reloadFromAppwrite}
                   className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-3 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm"
                 >
                   مزامنة Appwrite
                 </button>
                  <button
                    onClick={async () => { if (confirm('هل تريد إعادة تهيئة البيانات المحلّية إلى القيم الافتراضية؟')) { db.reset(); await loadData(); }} }
                    className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                  >
                    إعادة تهيئة البيانات
                  </button>
               </div>

              <button
                onClick={() => { setEditingAccount(null); setAccountForm({ company: '', username: '', password: '', role: 'company' }); setShowAccountModal(true); }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-md shadow-indigo-500/20"
              >
                <Plus className="w-4 h-4" />
                إضافة حساب
              </button>
            </div>

            <button
              onClick={() => { setEditingAccount(null); setAccountForm({ company: '', username: '', password: '', role: 'company' }); setShowAccountModal(true); }}
              className="fixed bottom-6 left-6 md:hidden z-50 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg"
              title="إضافة حساب"
            >
              <Plus className="w-5 h-5" />
            </button>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-semibold">
                      <th className="px-4 py-3 text-right">النوع</th>
                      <th className="px-4 py-3 text-right">الشركة</th>
                      <th className="px-4 py-3 text-right">اسم المستخدم</th>
                      <th className="px-4 py-3 text-right">كلمة المرور</th>
                      <th className="px-4 py-3 text-right">المصدر</th>
                      <th className="px-4 py-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allAccounts
                      .filter(a => {
                        if (!accountSearch.trim()) return true;
                        const term = accountSearch.toLowerCase();
                        return a.company?.toLowerCase().includes(term) || a.username?.toLowerCase().includes(term);
                      })
                      .map((acc, i) => (
                          <tr key={acc.id || acc.username + i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-600 text-sm">{roleLabel(acc.role || 'company')}</td>
                            <td className="px-4 py-3 text-gray-900 font-medium text-sm">{acc.company}</td>
                            <td className="px-4 py-3 text-indigo-600 font-mono text-xs">{acc.username}</td>
                            <td className="px-4 py-3 text-gray-500">
                              {acc.source === 'profile'
                                ? <span className="text-xs text-emerald-600 font-medium">Appwrite Auth</span>
                                : <MaskedPassword value={acc.password} />}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                acc.source === 'system' ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : acc.source === 'custom' ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                : acc.source === 'gps' ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}>
                                {sourceLabel(acc.source)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openAccountEditor(acc)}
                                  className="text-indigo-600 hover:text-indigo-800 transition-colors"
                                  title="تعديل"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                {acc.source !== 'system' && (
                                  <button
                                    onClick={async () => {
                                      if (confirm(`هل تريد حذف/إعادة تعيين حساب ${acc.username}؟`)) {
                                        await db.deleteAccountBySource(acc);
                                        await loadData();
                                      }
                                    }}
                                    className="text-rose-500 hover:text-rose-700 transition-colors"
                                    title="حذف"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {allAccounts.length === 0 && <div className="text-center py-12 text-gray-400">لا توجد حسابات مسجلة</div>}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 font-cairo" dir="rtl" onClick={() => setShowAccountModal(false)}>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-gray-900 font-semibold mb-5">
              {editingAccount ? `تعديل حساب ${roleLabel(editingAccount.role || 'company')}` : 'إضافة حساب جديد'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1 font-semibold">اسم الشركة *</label>
                <input
                  value={accountForm.company}
                  onChange={e => setAccountForm(p => ({ ...p, company: e.target.value }))}
                  placeholder="مثال: H H C"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1 font-semibold">اسم المستخدم (Username) *</label>
                <input
                  value={accountForm.username}
                  onChange={e => setAccountForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="مثال: hhc@taqa"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1 font-semibold">النوع *</label>
                <select
                  value={accountForm.role}
                  onChange={e => setAccountForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-400"
                >
                  <option value="company">شركة</option>
                  <option value="inspector">فاحص</option>
                  <option value="admin">آدمن</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1 font-semibold">
                  {editingAccount?.source === 'profile' ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور *'}
                </label>
                <input
                  value={accountForm.password}
                  onChange={e => setAccountForm(p => ({ ...p, password: e.target.value }))}
                  placeholder={editingAccount?.source === 'profile' ? 'اتركها فارغة للإبقاء على الحالية' : 'كلمة المرور'}
                  required={!editingAccount || editingAccount.source !== 'profile'}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                />
              </div>
              {editingAccount && editingAccount.source === 'gps' && (
                <div className="flex items-center gap-2">
                  <input
                    id="convertToCustom"
                    type="checkbox"
                    checked={!!accountForm.convertToCustom}
                    onChange={e => setAccountForm(p => ({ ...p, convertToCustom: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <label htmlFor="convertToCustom" className="text-xs text-gray-600">فصل عن GPS وتحويل إلى حساب مضاف يدوياً</label>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={saveAccount}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                {editingAccount ? 'حفظ التعديلات' : 'إضافة الحساب'}
              </button>
              <button
                onClick={() => { setShowAccountModal(false); setEditingAccount(null); }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function AdminPlanCard({ plan, inspections = [], onDeletePassenger, onDeleteVehicle }) {
  const pList = getPlanPassengers(plan);
  
  const hasInspection = inspections.some(ins => platesMatch(`${ins.no} ${ins.letters}`, plan.plateNumber));

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3 hover:border-indigo-200 transition-all">
      <div className="flex items-start justify-between flex-wrap gap-2 text-xs">
        <div>
          <p className="text-gray-900 font-semibold flex items-center gap-2 flex-wrap">
            {plan.plateNumber} — <span className="text-gray-500">{plan.carType}</span>
            {!hasInspection && <span className="bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded text-[10px] font-bold">غير مفحوصة</span>}
            {hasInspection && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold">مفحوصة ✓</span>}
          </p>
          <p className="text-gray-500 mt-1">
            السائق: <span className="text-indigo-600">{plan.driverName || 'غير مسجل'}</span>
            {plan.driverPhone && <span className="mr-2 text-indigo-500 font-mono text-[10px]" dir="ltr">☎ {plan.driverPhone}</span>}
          </p>
          <p className="text-gray-500 mt-0.5">خط السير: <span className="text-gray-800">{plan.route || 'غير محدد'}</span></p>
        </div>
        <div className="text-left font-mono text-gray-500">
          <p className="text-[10px] text-gray-400">تاريخ اضافة العربية</p>
          <p className="text-gray-700">{plan.date}</p>
          <span className="inline-block mt-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg font-medium">{pList.length} راكب</span>
        </div>
      </div>

      {onDeleteVehicle && (
        <button
          onClick={() => onDeleteVehicle(plan.plateNumber, plan.company)}
          className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1.5 border border-rose-200 hover:border-rose-300 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg font-medium transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          حذف العربية نهائياً
        </button>
      )}

      {pList.length > 0 ? (
        <div className="border-t border-gray-200 pt-3">
          <p className="text-gray-600 text-xs mb-1.5 font-semibold">أسماء الركاب:</p>
          <div className="flex flex-wrap gap-1">
            {pList.map((name, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 text-[11px] bg-white text-gray-700 px-2 py-0.5 rounded-lg border border-gray-200">
                {name}
                {onDeletePassenger && (
                  <button
                    onClick={() => onDeletePassenger(plan.id, name)}
                    className="text-rose-500 hover:text-rose-700 p-0.5 rounded transition-colors"
                    title="حذف الراكب"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-t border-gray-200 pt-2 text-center text-gray-400 text-xs">
          لا يوجد ركاب مسجلون في هذه الرحلة
        </div>
      )}
    </div>
  );
}
