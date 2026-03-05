import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Xush kelibsiz!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Kirish imkonsiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Kirish</h2>
      <p className="text-sm text-gray-500 mb-6">Hisobingizga kiring</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            placeholder="siz@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="label">Parol</label>
          <input
            type="password"
            className="input"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" className="rounded" /> Meni eslab qol
          </label>
          <Link to="/forgot-password" className="text-sm text-primary-600 hover:underline">
            Parolni unutdingizmi?
          </Link>
        </div>

        <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
          {loading ? 'Kirmoqda...' : 'Kirish'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Hisobingiz yo'qmi?{' '}
        <Link to="/register" className="text-primary-600 font-medium hover:underline">
          Ro'yxatdan o'tish
        </Link>
      </p>
    </div>
  );
}
