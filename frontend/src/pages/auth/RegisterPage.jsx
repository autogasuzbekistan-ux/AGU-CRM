import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [form, setForm] = useState({
    organizationName: '', firstName: '', lastName: '', email: '', phone: '', password: '',
  });
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success('Muvaffaqiyatli ro\'yxatdan o\'tdingiz!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xato yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, name, type = 'text', placeholder }) => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        placeholder={placeholder}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        required
      />
    </div>
  );

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Ro'yxatdan o'tish</h2>
      <p className="text-sm text-gray-500 mb-6">Kompaniyangizni boshlang</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Kompaniya nomi" name="organizationName" placeholder="MChJ YourCompany" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ism" name="firstName" placeholder="Azizbek" />
          <Field label="Familiya" name="lastName" placeholder="Karimov" />
        </div>
        <Field label="Email" name="email" type="email" placeholder="siz@company.uz" />
        <Field label="Telefon" name="phone" placeholder="+998901234567" />
        <Field label="Parol" name="password" type="password" placeholder="Kamida 8 belgi" />

        <button type="submit" className="btn-primary w-full justify-center py-2.5 mt-2" disabled={loading}>
          {loading ? 'Yaratilmoqda...' : 'Boshlash'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Hisobingiz bormi?{' '}
        <Link to="/login" className="text-primary-600 font-medium hover:underline">Kirish</Link>
      </p>
    </div>
  );
}
