import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import GpsTrackerPage from './pages/GpsTrackerPage.jsx';
import CompanyDashboard from './pages/CompanyDashboard.jsx';
import InspectorDashboard from './pages/InspectorDashboard.jsx';
import ExcelCenter from './pages/ExcelCenter.jsx';

function Unauthorized() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center font-cairo" dir="rtl">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h1>
        <p className="text-gray-500">ليس لديك صلاحية الوصول لهذه الصفحة.</p>
        <a href="/login" className="mt-4 inline-block text-indigo-600 hover:text-indigo-700 text-sm font-medium">العودة لتسجيل الدخول</a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/gps" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <GpsTrackerPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/requests" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard defaultTab="requests" />
            </ProtectedRoute>
          } />
          <Route path="/admin/excel" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ExcelCenter />
            </ProtectedRoute>
          } />

          {/* Company Routes */}
          <Route path="/company" element={
            <ProtectedRoute allowedRoles={['company']}>
              <CompanyDashboard />
            </ProtectedRoute>
          } />
          <Route path="/company/daily-plan" element={
            <ProtectedRoute allowedRoles={['company']}>
              <CompanyDashboard defaultTab="daily" />
            </ProtectedRoute>
          } />
          <Route path="/company/fleet" element={
            <ProtectedRoute allowedRoles={['company']}>
              <CompanyDashboard defaultTab="fleet" />
            </ProtectedRoute>
          } />
          <Route path="/company/excel" element={
            <ProtectedRoute allowedRoles={['company']}>
              <ExcelCenter />
            </ProtectedRoute>
          } />

          {/* Inspector Routes */}
          <Route path="/inspector" element={
            <ProtectedRoute allowedRoles={['inspector']}>
              <InspectorDashboard />
            </ProtectedRoute>
          } />
          <Route path="/inspector/register" element={
            <ProtectedRoute allowedRoles={['inspector']}>
              <InspectorDashboard />
            </ProtectedRoute>
          } />
          <Route path="/inspector/excel" element={
            <ProtectedRoute allowedRoles={['inspector']}>
              <ExcelCenter />
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
