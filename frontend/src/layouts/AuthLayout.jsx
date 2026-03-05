import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-2xl font-bold text-primary-600">A</span>
          </div>
          <h1 className="text-2xl font-bold text-white">AGU CRM</h1>
          <p className="text-primary-200 text-sm mt-1">O'zbekiston va O'rta Osiyo uchun CRM</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <Outlet />
        </div>

        <p className="text-center text-primary-200 text-xs mt-6">
          © 2025 AGU CRM. Barcha huquqlar himoyalangan.
        </p>
      </div>
    </div>
  );
}
