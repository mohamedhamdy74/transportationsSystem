import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { db, platesMatch } from '../lib/db.js';
import { exportDailyPlans, importDailyPlans } from '../lib/excelUtils.js';
import PlateInput from '../components/PlateInput.jsx';
import { useTranslation } from 'react-i18next';
import {
  Upload, Download, Plus, Users, Car, Sun, Moon, Send, AlertTriangle,
  CheckCircle2, XCircle, X, Route, User, CalendarDays, Trash2, Hourglass
} from 'lucide-react';

function PassengerModal({ plan, pendingDeletions, onRequestDelete, onClose, isRtl }) {
  const [passengers, setPassengers] = useState(() => {
    try { return JSON.parse(plan.passengers || '[]'); } catch { return []; }
  });
  const [newName, setNewName] = useState('');

  const addPassenger = () => {
    if (!newName.trim()) return;
    setPassengers(p => [...p, newName.trim()]);
    setNewName('');
  };

  const removePassenger = (name, idx) => {
    const originalPassengers = JSON.parse(plan.passengers || '[]');
    const isOriginal = originalPassengers.includes(name);
    if (isOriginal) {
      onRequestDelete(name);
    } else {
      setPassengers(p => p.filter((_, i) => i !== idx));
    }
  };

  const isPendingDelete = (name) => {
    return pendingDeletions.some(r => {
      try {
        const detail = JSON.parse(r.car_type);
        return detail.planId === plan.id && detail.passengerName === name;
      } catch { return false; }
    });
  };

  const handleSave = async () => {
    const plans = await db.getDailyPlans();
    const idx = plans.findIndex(p => p.id === plan.id);
    if (idx !== -1) {
      plans[idx].passengers = JSON.stringify(passengers);
      plans[idx].passengerQnt = passengers.length;
      await db._writeAppwrite('dailyPlans', plan.id, plans[idx]);
    }
    onClose(true);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 font-cairo" onClick={onClose} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-gray-900 font-bold">{isRtl ? 'قائمة الركاب' : 'Passenger List'} — {plan.plateNumber}</h3>
            <p className="text-gray-400 text-xs mt-0.5">{plan.shift === 'day' ? '☀️' : '🌙'} {plan.route} — {plan.driverName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {passengers.map((name, i) => {
            const pending = isPendingDelete(name);
            return (
              <div key={i} className={`flex items-center gap-3 bg-gray-50 border rounded-xl px-3 py-2.5 ${pending ? 'border-amber-200' : 'border-gray-200'}`}>
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                <span className="flex-1 text-sm text-gray-800">{name}</span>
                  <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-1 rounded-lg font-medium"><Hourglass className="w-3.5 h-3.5" /> {isRtl ? 'بانتظار الموافقة' : 'Pending approval'}</span>
                  <button onClick={() => removePassenger(name, i)} className="text-rose-400 hover:text-rose-600 p-1">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
          {passengers.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{isRtl ? 'لا يوجد ركاب مسجلون' : 'No passengers registered'}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-4">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPassenger()}
            placeholder={isRtl ? 'اسم الراكب الجديد...' : 'New passenger name...'}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
          />
          <button onClick={addPassenger} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-xl text-sm font-bold transition-colors">
            {isRtl ? 'إضافة' : 'Add'}
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors">
            {isRtl ? `حفظ (${passengers.length} راكب)` : `Save (${passengers.length} passengers)`}
          </button>
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors">
            {isRtl ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CompanyDashboard({ defaultTab = 'daily' }) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [plans, setPlans] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [importStatus, setImportStatus] = useState(null);

  const [planForm, setPlanForm] = useState({
    carType: 'Microbus', plateNumber: '', driverName: '', driverPhone: '', gpsUsername: '', gpsPassword: '', route: '', passengerQnt: 0,
    date: new Date().toISOString().split('T')[0], shift: 'day'
  });

  const [reqForm, setReqForm] = useState({ request_type: 'add_vehicle', car_no: '', car_type: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = useCallback(async () => {
    setPlans(await db.getDailyPlans());
    setVehicles(await db.getGpsVehicles());
    setRequests(await db.getRequests());
    setInspections(await db.getInspections());
  }, []);

  const handleAddPlan = async () => {
    setValidationError(null);
    try {
      await db.addDailyPlan({ ...planForm, company: user?.company });
      await loadData();
      setShowPlanModal(false);
      setPlanForm({ carType: 'Microbus', plateNumber: '', driverName: '', driverPhone: '', gpsUsername: '', gpsPassword: '', route: '', passengerQnt: 0, date: new Date().toISOString().split('T')[0], shift: 'day' });
    } catch (err) {
      setValidationError(err.message);
    }
  };

  const handleAddRequest = async () => {
    if (!reqForm.car_no) return;
    await db.addRequestIfNotPending({ ...reqForm, company: user?.company });
    await loadData();
    setReqForm({ request_type: 'add_vehicle', car_no: '', car_type: '' });
  };

  const handleRequestDeletePassenger = async (passengerName) => {
    if (!selectedPlan) return;
    await db.addRequestIfNotPending({
      company: user?.company,
      request_type: 'delete_passenger',
      car_no: selectedPlan.plateNumber,
      car_type: JSON.stringify({ planId: selectedPlan.id, passengerName })
    });
    await loadData();
  };

  const handleRequestDeleteVehicle = async (vehicle) => {
    const alreadyPending = requests.some(
      r => r.request_type === 'delete_vehicle' && r.status === 'pending' && platesMatch(r.car_no, vehicle.carNo)
    );
    if (alreadyPending) {
      alert(isRtl ? 'يوجد طلب حذف معلّق لهذه العربية بالفعل' : 'A delete request is already pending for this vehicle');
      return;
    }
    if (!confirm(isRtl ? `إرسال طلب حذف للعربية ${vehicle.carNo}؟` : `Send delete request for ${vehicle.carNo}?`)) return;
    await db.addRequestIfNotPending({
      company: user?.company,
      request_type: 'delete_vehicle',
      car_no: vehicle.carNo,
      car_type: vehicle.carType || ''
    });
    await loadData();
  };

  const handleRequestDeleteVehicleFromPlan = async (plan) => {
    const alreadyPending = requests.some(
      r => r.request_type === 'delete_vehicle' && r.status === 'pending' && platesMatch(r.car_no, plan.plateNumber)
    );
    if (alreadyPending) {
      alert(isRtl ? 'يوجد طلب حذف معلّق لهذه العربية بالفعل' : 'A delete request is already pending for this vehicle');
      return;
    }
    if (!confirm(isRtl ? `إرسال طلب حذف للعربية ${plan.plateNumber}؟` : `Send delete request for ${plan.plateNumber}?`)) return;
    await db.addRequestIfNotPending({
      company: user?.company,
      request_type: 'delete_vehicle',
      car_no: plan.plateNumber,
      car_type: plan.carType || ''
    });
    await loadData();
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportStatus('loading');
    try {
      const parsed = await importDailyPlans(file, user?.company);
      let added = 0, errors = [];
      for (const plan of parsed) {
        try {
          await db.addDailyPlan({ ...plan, company: user?.company, shift: plan.shift || 'day' });
          added++;
        } catch (err) {
          errors.push(`${plan.plateNumber}: ${err.message}`);
        }
      }
      await loadData();
      setImportStatus(`Added ${added} trips. ${errors.length > 0 ? `Failed ${errors.length}.` : ''}`);
    } catch (err) {
      setImportStatus('Error: ' + err.message);
    }
    e.target.value = '';
  };

  const todayPlans = plans.filter(p => p.date === new Date().toISOString().split('T')[0]);
  const totalPassengers = todayPlans.reduce((s, p) => {
    try { return s + JSON.parse(p.passengers || '[]').length; } catch { return s + (p.passengerQnt || 0); }
  }, 0);
  const runningVehicles = vehicles.filter(v => v.comments === 'Running').length;
  const pendingReqs = requests.filter(r => r.status === 'pending').length;
  const pendingDeletions = requests.filter(r => r.request_type === 'delete_passenger' && r.status === 'pending');
  const pendingVehicleDeletions = requests.filter(r => r.request_type === 'delete_vehicle' && r.status === 'pending');

  const stats = [
    { label: isRtl ? 'رحلات اليوم' : "Today's Trips", value: todayPlans.length, color: 'emerald' },
    { label: isRtl ? 'إجمالي الركاب' : 'Total Passengers', value: totalPassengers, color: 'indigo' },
    { label: isRtl ? 'سيارات نشطة' : 'Active Vehicles', value: runningVehicles, color: 'teal' },
    { label: isRtl ? 'طلبات معلقة' : 'Pending Requests', value: pendingReqs, color: 'amber' },
  ];

  const colorMap = {
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    teal: 'text-teal-600 bg-teal-50 border-teal-200',
    amber: 'text-amber-600 bg-amber-50 border-amber-200',
  };

  return (
    <Layout>
      <div className="space-y-6 font-cairo" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user?.company}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {isRtl ? 'لوحة تحكم الشركة' : 'Company Dashboard'} — {new Date().toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <label className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer border border-gray-200 shadow-sm">
              <Upload className="w-4 h-4 text-gray-500" />
              {isRtl ? 'استيراد خطة' : 'Import Plan'}
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            </label>
            <button
              onClick={() => exportDailyPlans(todayPlans, user?.company, new Date().toISOString().split('T')[0])}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-md shadow-emerald-500/20"
            >
              <Download className="w-4 h-4" />
              {isRtl ? 'تصدير الخطة اليوم' : "Export Today's Plan"}
            </button>
          </div>
        </div>

        {importStatus && importStatus !== 'loading' && (
          <div className={`p-3 rounded-xl text-sm border flex items-center gap-2 ${importStatus.includes('Error') || importStatus.includes('خطأ') ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {importStatus.includes('Error') || importStatus.includes('خطأ') ? <XCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {importStatus}
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-4 flex-wrap">
          {stats.map(s => (
            <div key={s.label} className={`flex-1 min-w-[120px] bg-white border rounded-2xl p-5 shadow-sm ${colorMap[s.color].split(' ').slice(1).join(' ')}`}>
              <p className={`text-xs font-medium ${colorMap[s.color].split(' ')[0]}`}>{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${colorMap[s.color].split(' ')[0]}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
          {[
            { id: 'daily', label: isRtl ? 'خطة التشغيل اليومية' : 'Daily Plan' },
            { id: 'fleet', label: isRtl ? `الأسطول (${vehicles.length})` : `Fleet (${vehicles.length})` },
            { id: 'requests', label: isRtl ? `الطلبات (${requests.length})` : `Requests (${requests.length})` },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${activeTab === tab.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Daily Plans Tab */}
        {activeTab === 'daily' && (
          <div className="space-y-6">
            <button
              onClick={() => setShowPlanModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-md shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              {isRtl ? 'إضافة رحلة جديدة' : 'Add New Trip'}
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Day Shift */}
              <div className="space-y-4">
                <h3 className="text-gray-800 font-bold text-base flex items-center gap-2 border-b border-gray-200 pb-3">
                  <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Sun className="w-4 h-4 text-amber-500" />
                  </div>
                  {isRtl ? 'الوردية النهارية' : 'Day Shift'}
                  <span className="text-sm font-normal text-gray-400 ml-1">({plans.filter(p => p.shift === 'day').length})</span>
                </h3>
                {plans.filter(p => p.shift === 'day').length === 0 ? (
                  <p className="text-gray-400 text-sm py-4 text-center">{isRtl ? 'لا توجد رحلات نهارية مسجلة' : 'No day shift trips'}</p>
                ) : (
                  <div className="grid gap-4">
                    {plans.filter(p => p.shift === 'day').map((plan, i) => {
                      let pList = [];
                      try { pList = JSON.parse(plan.passengers || '[]'); } catch {}
                      return <PlanCard key={plan.id || i} plan={plan} idx={i} pList={pList} inspections={inspections} isRtl={isRtl} onManage={() => setSelectedPlan(plan)} onRequestDelete={() => handleRequestDeleteVehicleFromPlan(plan)} isPendingDelete={pendingVehicleDeletions.some(r => platesMatch(r.car_no, plan.plateNumber))} />;
                    })}
                  </div>
                )}
              </div>

              {/* Night Shift */}
              <div className="space-y-4">
                <h3 className="text-gray-800 font-bold text-base flex items-center gap-2 border-b border-gray-200 pb-3">
                  <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Moon className="w-4 h-4 text-indigo-500" />
                  </div>
                  {isRtl ? 'الوردية الليلية' : 'Night Shift'}
                  <span className="text-sm font-normal text-gray-400 ml-1">({plans.filter(p => p.shift === 'night').length})</span>
                </h3>
                {plans.filter(p => p.shift === 'night').length === 0 ? (
                  <p className="text-gray-400 text-sm py-4 text-center">{isRtl ? 'لا توجد رحلات ليلية مسجلة' : 'No night shift trips'}</p>
                ) : (
                  <div className="grid gap-4">
                    {plans.filter(p => p.shift === 'night').map((plan, i) => {
                      let pList = [];
                      try { pList = JSON.parse(plan.passengers || '[]'); } catch {}
                      return <PlanCard key={plan.id || i} plan={plan} idx={i} pList={pList} inspections={inspections} isRtl={isRtl} onManage={() => setSelectedPlan(plan)} onRequestDelete={() => handleRequestDeleteVehicleFromPlan(plan)} isPendingDelete={pendingVehicleDeletions.some(r => platesMatch(r.car_no, plan.plateNumber))} />;
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fleet Tab */}
        {activeTab === 'fleet' && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-semibold">
                    <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'رقم اللوحة' : 'Plate No.'}</th>
                    <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'نوع السيارة' : 'Car Type'}</th>
                    <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'اليوزرنيم' : 'Username'}</th>
                    <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'الحالة' : 'Status'}</th>
                    <th className={`px-4 py-3 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vehicles.map((v, i) => {
                    const isPendingDelete = pendingVehicleDeletions.some(r => platesMatch(r.car_no, v.carNo));
                    return (
                    <tr key={v.id || i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 font-bold">{v.carNo}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{v.carType}</td>
                      <td className="px-4 py-3 text-indigo-600 text-xs font-mono">{v.username}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          v.comments === 'Running'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${v.comments === 'Running' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                          {v.comments === 'Running' ? (isRtl ? 'تشغيل' : 'Running') : (isRtl ? 'خارج الخدمة' : 'Out of Service')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isPendingDelete ? (
                          <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-lg font-medium w-fit">
                            <Hourglass className="w-3 h-3" /> {isRtl ? 'بانتظار الموافقة' : 'Pending approval'}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRequestDeleteVehicle(v)}
                            className="text-xs text-rose-600 hover:text-rose-700 border border-rose-200 hover:border-rose-300 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg font-semibold transition-colors"
                          >
                            {isRtl ? 'طلب حذف' : 'Request Delete'}
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {vehicles.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{isRtl ? 'لا توجد سيارات مرتبطة بحسابك' : 'No vehicles linked to your account'}</p>
              </div>
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-gray-900 font-bold text-sm mb-4">{isRtl ? 'إرسال طلب جديد' : 'Send New Request'}</h3>
              <div className="space-y-4">
                <div className="flex gap-3 flex-wrap items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold text-gray-600 mb-2">{isRtl ? 'نوع الطلب' : 'Request Type'}</label>
                    <select
                      value={reqForm.request_type}
                      onChange={e => setReqForm(p => ({ ...p, request_type: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-emerald-400"
                    >
                      <option value="add_vehicle">{isRtl ? 'طلب إضافة سيارة' : 'Add Vehicle Request'}</option>
                      <option value="delete_vehicle">{isRtl ? 'طلب حذف سيارة' : 'Remove Vehicle Request'}</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold text-gray-600 mb-2">{isRtl ? 'نوع السيارة' : 'Car Type'}</label>
                    <input
                      value={reqForm.car_type}
                      onChange={e => setReqForm(p => ({ ...p, car_type: e.target.value }))}
                      placeholder={isRtl ? 'نوع السيارة...' : 'e.g. Microbus'}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <label className="block text-xs font-semibold text-gray-600 mb-3 text-center w-full">{isRtl ? 'رقم لوحة السيارة' : 'Vehicle Plate Number'}</label>
                  <PlateInput value={reqForm.car_no} onChange={val => setReqForm(p => ({ ...p, car_no: val }))} />
                </div>

                <div className="flex justify-end">
                  <button onClick={handleAddRequest} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-md shadow-emerald-500/20">
                    <Send className="w-4 h-4" />
                    {isRtl ? 'إرسال الطلب' : 'Send Request'}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {requests.map(req => {
                let displayTitle = '';
                let displaySubtitle = '';
                if (req.request_type === 'delete_passenger') {
                  try {
                    const detail = JSON.parse(req.car_type);
                    displayTitle = isRtl ? `طلب حذف الراكب: ${detail.passengerName}` : `Remove Passenger: ${detail.passengerName}`;
                    displaySubtitle = req.car_no;
                  } catch {
                    displayTitle = isRtl ? 'طلب حذف راكب' : 'Remove Passenger';
                    displaySubtitle = req.car_no;
                  }
                } else {
                  displayTitle = req.request_type === 'add_vehicle'
                    ? (isRtl ? 'طلب إضافة سيارة' : 'Add Vehicle Request')
                    : (isRtl ? 'طلب حذف سيارة' : 'Remove Vehicle Request');
                  displaySubtitle = `${req.car_type} — ${req.car_no}`;
                }

                return (
                  <div key={req.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                    <div className="flex-1">
                      <p className="text-gray-900 text-sm font-semibold">{displayTitle}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{displaySubtitle}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{new Date(req.created_at).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border ${
                      req.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {req.status === 'pending' ? <Hourglass className="w-3.5 h-3.5" /> : req.status === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />} {req.status}
                    </span>
                  </div>
                );
              })}
              {requests.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Send className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>{isRtl ? 'لا توجد طلبات بعد' : 'No requests yet'}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 font-cairo p-4 overflow-y-auto" onClick={() => { setShowPlanModal(false); setValidationError(null); }} dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-2xl mx-auto shadow-2xl my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-gray-900 font-bold text-lg">{isRtl ? 'إضافة سيارة / رحلة جديدة' : 'Add New Vehicle / Trip'}</h3>
              <button onClick={() => { setShowPlanModal(false); setValidationError(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 flex flex-col items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                <label className="block text-xs font-semibold text-gray-600 mb-3 text-center w-full">{isRtl ? 'رقم لوحة السيارة *' : 'Plate Number *'}</label>
                <PlateInput value={planForm.plateNumber} onChange={val => setPlanForm(p => ({ ...p, plateNumber: val }))} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{isRtl ? 'الوردية *' : 'Shift *'}</label>
                <select value={planForm.shift} onChange={e => setPlanForm(p => ({ ...p, shift: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-emerald-400">
                  <option value="day">{isRtl ? 'وردية نهارية' : 'Day Shift'}</option>
                  <option value="night">{isRtl ? 'وردية ليلية' : 'Night Shift'}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{isRtl ? 'تاريخ اضافة العربية' : 'Vehicle Addition Date'}</label>
                <input type="date" value={planForm.date} onChange={e => setPlanForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-emerald-400" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{isRtl ? 'نوع السيارة' : 'Car Type'}</label>
                <input value={planForm.carType} onChange={e => setPlanForm(p => ({ ...p, carType: e.target.value }))} placeholder="Microbus / Minibus" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-emerald-400" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{isRtl ? 'خط السير' : 'Route'}</label>
                <input value={planForm.route} onChange={e => setPlanForm(p => ({ ...p, route: e.target.value }))} placeholder={isRtl ? 'مثال: Aswan' : 'e.g. Aswan'} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-emerald-400" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{isRtl ? 'اسم السائق' : 'Driver Name'}</label>
                <input value={planForm.driverName} onChange={e => setPlanForm(p => ({ ...p, driverName: e.target.value }))} placeholder={isRtl ? 'اسم السائق' : 'Driver name'} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-emerald-400" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{isRtl ? 'رقم هاتف السائق' : 'Driver Phone'}</label>
                <input type="tel" value={planForm.driverPhone} onChange={e => setPlanForm(p => ({ ...p, driverPhone: e.target.value }))} placeholder={isRtl ? 'رقم الهاتف' : 'Phone number'} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-emerald-400" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{isRtl ? 'اسم مستخدم التتبع (GPS Username)' : 'GPS Username'}</label>
                <input value={planForm.gpsUsername} onChange={e => setPlanForm(p => ({ ...p, gpsUsername: e.target.value }))} placeholder={isRtl ? 'اسم مستخدم التتبع' : 'GPS Username'} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-emerald-400" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{isRtl ? 'كلمة مرور التتبع (GPS Password)' : 'GPS Password'}</label>
                <input type="password" value={planForm.gpsPassword} onChange={e => setPlanForm(p => ({ ...p, gpsPassword: e.target.value }))} placeholder={isRtl ? 'كلمة المرور' : 'Password'} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-emerald-400" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">{isRtl ? 'عدد الركاب' : 'Passenger Count'}</label>
                <input type="number" min="0" value={planForm.passengerQnt} onChange={e => setPlanForm(p => ({ ...p, passengerQnt: parseInt(e.target.value) || 0 }))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
            </div>

            {validationError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {validationError}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={handleAddPlan} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors">
                {isRtl ? 'إضافة الرحلة' : 'Add Trip'}
              </button>
              <button onClick={() => { setShowPlanModal(false); setValidationError(null); }} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-bold transition-colors">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passenger Modal */}
      {selectedPlan && (
        <PassengerModal
          plan={selectedPlan}
          pendingDeletions={pendingDeletions}
          onRequestDelete={handleRequestDeletePassenger}
          isRtl={isRtl}
          onClose={async (refresh) => {
            setSelectedPlan(null);
            if (refresh) await loadData();
          }}
        />
      )}
    </Layout>
  );
}

function PlanCard({ plan, idx, pList, inspections = [], isRtl, onManage, onRequestDelete, isPendingDelete }) {
  const isNotInspected = !inspections.some(ins => platesMatch(`${ins.no} ${ins.letters}`, plan.plateNumber));

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-emerald-300 hover:shadow-md transition-all shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
            {plan.num || idx + 1}
          </div>
          <div>
            <p className="text-gray-900 font-bold text-sm flex items-center gap-2">
              {plan.plateNumber}
              {isNotInspected && <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">{isRtl ? 'غير مفحوصة' : 'Not Inspected'}</span>}
            </p>
            <p className="text-gray-500 text-xs mt-0.5">{plan.carType}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {plan.driverName}
          </span>
          <span className="flex items-center gap-1.5">
            <Route className="w-3.5 h-3.5" />
            {plan.route}
          </span>
          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">
            {pList.length} {isRtl ? 'راكب' : 'pax'}
          </span>
          <span className="text-gray-400 font-mono flex items-center gap-1" title={isRtl ? 'تاريخ اضافة العربية' : 'Vehicle Addition Date'}>
            <CalendarDays className="w-3.5 h-3.5" />
            {plan.date}
          </span>
        </div>
      </div>

      {pList.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pList.slice(0, 5).map((name, j) => (
            <span key={j} className="text-xs bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded-lg">{name}</span>
          ))}
          {pList.length > 5 && (
            <span className="text-xs text-gray-400 px-2 py-0.5">+{pList.length - 5} {isRtl ? 'آخرين' : 'more'}</span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <button
          onClick={onManage}
          className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 transition-colors font-semibold"
        >
          <Users className="w-3.5 h-3.5" />
          {isRtl ? `إدارة قائمة الركاب (${pList.length})` : `Manage Passengers (${pList.length})`}
        </button>
        {onRequestDelete && (
          isPendingDelete ? (
            <span className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg font-semibold w-fit">
              <Hourglass className="w-3.5 h-3.5" /> {isRtl ? 'طلب حذف بانتظار الموافقة' : 'Delete pending approval'}
            </span>
          ) : (
            <button
              onClick={onRequestDelete}
              className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1.5 border border-rose-200 hover:border-rose-300 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isRtl ? 'طلب حذف العربية' : 'Request Delete Vehicle'}
            </button>
          )
        )}
      </div>
    </div>
  );
}
