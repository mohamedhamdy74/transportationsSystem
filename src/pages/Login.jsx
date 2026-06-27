import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Car, Eye, EyeOff, AlertCircle, LogIn, Loader2, Globe } from 'lucide-react';
import { env } from '../lib/env.js';

export default function Login() {
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.username, form.password);
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'inspector') navigate('/inspector');
      else navigate('/company');
    } catch {
      // error handled by context
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
  };

  const isRtl = i18n.language === 'ar';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center relative overflow-hidden font-cairo" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Background Orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-500 opacity-5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500 opacity-5 blur-[120px]" />
        {/* Grid lines */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Language Toggle */}
      <button 
        onClick={toggleLanguage}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200 text-gray-700 hover:text-indigo-600 transition-colors text-sm font-medium"
      >
        <Globe className="w-4 h-4" />
        {isRtl ? 'English' : 'العربية'}
      </button>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 mb-4 shadow-xl shadow-indigo-500/20">
            <Car className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('app_title')}</h1>
          <p className="text-gray-500 mt-2 text-sm">{t('login.welcome')}</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-xl shadow-gray-200/50">
          <h2 className="text-xl font-bold text-gray-800 mb-1">{t('login.submit')}</h2>
          <p className="text-gray-500 text-sm mb-6">{t('login.subtitle')}</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('login.username')}</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder={isRtl ? 'اسم المستخدم' : 'Username'}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('login.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors`}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-3 text-rose-600 text-sm animate-fade-in">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all duration-200 shadow-md shadow-indigo-500/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {t('login.submit')}
                </>
              )}
            </button>
          </form>

          {env.enableDemoLogin && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-gray-400 text-xs text-center mb-3">{isRtl ? 'حسابات تجريبية (تطوير فقط)' : 'Demo accounts (dev only)'}</p>
            <p className="text-gray-400 text-xs text-center">
              {isRtl ? 'استخدم حساباتك من لوحة Appwrite' : 'Use accounts configured in Appwrite'}
            </p>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
