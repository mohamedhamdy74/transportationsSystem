import React, { useState } from 'react';
import Layout from '../components/Layout.jsx';
import { db } from '../lib/db.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTranslation } from 'react-i18next';
import {
  exportInspections, exportGpsVehicles, exportDailyPlans,
  importInspections, importGpsVehicles, importDailyPlans
} from '../lib/excelUtils.js';
import { FileSpreadsheet, Upload, Download, Info, CheckCircle2, XCircle, Loader2, Search, MapPin, ClipboardList } from 'lucide-react';

export default function ExcelCenter({ role }) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(null);

  const showStatus = (msg, isError = false) => {
    setStatus({ msg, isError });
    setTimeout(() => setStatus(null), 5000);
  };

  const handleImport = async (type, file) => {
    if (!file) return;
    setLoading(type);
    try {
      if (type === 'inspections') {
        const parsed = await importInspections(file);
        let added = 0;
        for (const ins of parsed) {
          await db.addInspection(ins);
          added++;
        }
        showStatus(`✓ Imported ${added} inspection records.`);
      } else if (type === 'gps') {
        const parsed = await importGpsVehicles(file);
        const existing = new Set((await db.getGpsVehicles()).map(v => v.carNo));
        let added = 0;
        for (const v of parsed) {
          if (!existing.has(v.carNo)) {
            await db.addGpsVehicle(v);
            added++;
          }
        }
        showStatus(`✓ Imported ${added} GPS vehicles.`);
      } else if (type === 'plans') {
        const parsed = await importDailyPlans(file, user?.company);
        let added = 0, errors = 0;
        for (const plan of parsed) {
          try {
            await db.addDailyPlan({ ...plan, company: user?.company });
            added++;
          } catch {
            errors++;
          }
        }
        showStatus(`✓ Imported ${added} trips${errors > 0 ? ` | Failed: ${errors}` : ''}.`);
      }
    } catch (err) {
      showStatus('✗ Error: ' + err.message, true);
    }
    setLoading(null);
  };

  const handleExport = async (type) => {
    setLoading(type);
    try {
      if (type === 'inspections') {
        exportInspections(await db.getInspections());
        showStatus('✓ Inspection records exported.');
      } else if (type === 'gps') {
        exportGpsVehicles(await db.getGpsVehicles());
        showStatus('✓ GPS data exported.');
      } else if (type === 'plans') {
        const plans = (await db.getDailyPlans()).filter(p => !user?.company || p.company === user?.company);
        exportDailyPlans(plans, user?.company || 'All', new Date().toISOString().split('T')[0]);
        showStatus('✓ Daily plans exported.');
      }
    } catch (err) {
      showStatus('✗ Export error: ' + err.message, true);
    }
    setLoading(null);
  };

  const cards = [
    {
      id: 'inspections',
      title: isRtl ? 'سجل الفحص' : 'Inspection Log',
      desc: isRtl ? 'استيراد / تصدير بيانات الفحص (AFRE Vehicle Register)' : 'Import / Export inspection data (AFRE Vehicle Register)',
      Icon: ClipboardList,
      color: 'amber',
      allowImport: ['admin', 'inspector'].includes(user?.role),
      allowExport: true,
    },
    {
      id: 'gps',
      title: isRtl ? 'بيانات GPS / السيارات' : 'GPS / Vehicles Data',
      desc: isRtl ? 'استيراد / تصدير حسابات GPS وبيانات السيارات' : 'Import / Export GPS accounts and vehicle data',
      Icon: MapPin,
      color: 'indigo',
      allowImport: user?.role === 'admin',
      allowExport: user?.role === 'admin',
    },
    {
      id: 'plans',
      title: isRtl ? 'خطط التشغيل اليومية' : 'Daily Operation Plans',
      desc: isRtl ? 'استيراد / تصدير خطط الرحلات اليومية وقوائم الركاب' : 'Import / Export daily trips and passenger lists',
      Icon: FileSpreadsheet,
      color: 'emerald',
      allowImport: true,
      allowExport: true,
    },
  ];

  const colorMap = {
    amber: {
      bg: 'bg-amber-50 border-amber-200',
      icon: 'text-amber-500 bg-amber-100',
      btn: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20',
      text: 'text-amber-600',
    },
    indigo: {
      bg: 'bg-indigo-50 border-indigo-200',
      icon: 'text-indigo-500 bg-indigo-100',
      btn: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20',
      text: 'text-indigo-600',
    },
    emerald: {
      bg: 'bg-emerald-50 border-emerald-200',
      icon: 'text-emerald-500 bg-emerald-100',
      btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20',
      text: 'text-emerald-600',
    },
  };

  return (
    <Layout>
      <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-indigo-500" />
            {isRtl ? 'مركز الاستيراد والتصدير' : 'Import & Export Center'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isRtl ? 'إدارة ملفات Excel بذكاء — متوافق مع التنسيق الأصلي للشيتات' : 'Smart Excel file management — compatible with original sheet formats'}
          </p>
        </div>

        {status && (
          <div className={`p-4 rounded-2xl border text-sm animate-fade-in flex items-center gap-3 ${status.isError ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {status.isError ? <XCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
            {status.msg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map(card => {
            const c = colorMap[card.color];
            return (
              <div key={card.id} className={`${c.bg} border rounded-2xl p-6 space-y-5 shadow-sm`}>
                <div className={`w-12 h-12 rounded-2xl ${c.icon} flex items-center justify-center`}>
                  <card.Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{card.title}</h3>
                  <p className="text-gray-500 text-xs mt-1 leading-relaxed">{card.desc}</p>
                </div>
                <div className="space-y-2">
                  {card.allowExport && (
                    <button
                      onClick={() => handleExport(card.id)}
                      disabled={loading === card.id}
                      className={`w-full flex items-center justify-center gap-2 ${c.btn} text-white py-2.5 rounded-xl text-sm font-bold transition-all shadow-md disabled:opacity-60`}
                    >
                      {loading === card.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {isRtl ? 'تصدير Excel' : 'Export Excel'}
                    </button>
                  )}
                  {card.allowImport && (
                    <label className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer border border-gray-200">
                      <Upload className="w-4 h-4" />
                      {isRtl ? 'استيراد Excel' : 'Import Excel'}
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={e => { handleImport(card.id, e.target.files[0]); e.target.value = ''; }}
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tips */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3 shadow-sm">
          <h3 className="text-gray-800 font-bold text-sm flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Info className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            {isRtl ? 'إرشادات الاستيراد' : 'Import Guidelines'}
          </h3>
          <ul className="text-gray-500 text-xs space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5 font-bold">•</span>
              <span><strong className="text-gray-700">{isRtl ? 'سجل الفحص:' : 'Inspection Log:'}</strong> {isRtl ? 'يجب أن يكون بتنسيق "AFRE Vehicle Register 2026.xlsx" مع الأعمدة: Ser, Company, No., Letters, Inspection Date, Exit Status' : 'Must use "AFRE Vehicle Register 2026.xlsx" format with: Ser, Company, No., Letters, Inspection Date, Exit Status'}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500 mt-0.5 font-bold">•</span>
              <span><strong className="text-gray-700">{isRtl ? 'بيانات GPS:' : 'GPS Data:'}</strong> {isRtl ? 'يجب أن يكون بتنسيق "Vehicle Information GPS 2.xlsx" الـ Sheet2 مع الأعمدة: N, Company, Username, Password, Car Type, Car No., Comments' : 'Must use "Vehicle Information GPS 2.xlsx" Sheet2 with: N, Company, Username, Password, Car Type, Car No., Comments'}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5 font-bold">•</span>
              <span><strong className="text-gray-700">{isRtl ? 'خطط التشغيل:' : 'Operation Plans:'}</strong> {isRtl ? 'يجب أن تحتوي على ورقة "traffic data" بالأعمدة: Num, Type of vehicles, Plate number, Driver name, Route, Passenger QNT' : 'Must contain "traffic data" sheet with: Num, Type of vehicles, Plate number, Driver name, Route, Passenger QNT'}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-500 mt-0.5 font-bold">⚠</span>
              <span>{isRtl ? 'عند استيراد خطط التشغيل، يتم التحقق تلقائياً من حالة كل سيارة في سجل الفحص. السيارات ذات حالة "OUT" سيتم رفضها.' : 'When importing operation plans, each vehicle is automatically checked against the inspection log. Vehicles with "OUT" status will be rejected.'}</span>
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
