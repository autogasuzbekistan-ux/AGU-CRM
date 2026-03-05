import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Phone, Mail, MessageSquare, TrendingUp, CheckSquare } from 'lucide-react';
import api from '../../api/axios';
import { formatPhone, formatUZS, formatDate } from '../../utils/format';

const TAB_ICONS = { deals: TrendingUp, tasks: CheckSquare, conversations: MessageSquare };

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: contact } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get(`/contacts/${id}`).then((r) => r.data.data),
  });

  const { data: deals } = useQuery({
    queryKey: ['contact-deals', id],
    queryFn: () => api.get(`/contacts/${id}/deals`).then((r) => r.data.data),
  });

  const { data: tasks } = useQuery({
    queryKey: ['contact-tasks', id],
    queryFn: () => api.get(`/contacts/${id}/tasks`).then((r) => r.data.data),
  });

  if (!contact) return <div className="p-6 text-gray-400">Yuklanmoqda...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6 text-sm">
        <ArrowLeft size={16} /> Orqaga
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile */}
        <div className="card p-6">
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-3xl font-bold text-primary-700 mx-auto mb-4">
              {contact.first_name?.[0]}{contact.last_name?.[0]}
            </div>
            <h2 className="text-xl font-bold text-gray-900">{contact.first_name} {contact.last_name}</h2>
            {contact.company_name && <p className="text-gray-500 text-sm mt-1">{contact.company_name}</p>}
          </div>

          <div className="space-y-3 text-sm">
            {contact.phone && (
              <div className="flex items-center gap-3 text-gray-700">
                <Phone size={15} className="text-gray-400" />
                <a href={`tel:${contact.phone}`} className="hover:text-primary-600">{formatPhone(contact.phone)}</a>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-3 text-gray-700">
                <Mail size={15} className="text-gray-400" />
                <a href={`mailto:${contact.email}`} className="hover:text-primary-600">{contact.email}</a>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{contact.total_deals || 0}</p>
              <p className="text-xs text-gray-400">Bitimlar</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{formatUZS(contact.total_revenue || 0)}</p>
              <p className="text-xs text-gray-400">Daromad</p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Deals */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp size={16} /> Bitimlar ({deals?.length || 0})
            </h3>
            {deals?.length === 0 ? (
              <p className="text-gray-400 text-sm">Hali bitim yo'q</p>
            ) : deals?.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{d.title}</p>
                  <p className="text-xs text-gray-400">{formatDate(d.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatUZS(d.amount)}</p>
                  <span className={`badge text-xs ${d.status === 'won' ? 'badge-green' : d.status === 'lost' ? 'badge-red' : 'badge-blue'}`}>
                    {d.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Tasks */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckSquare size={16} /> Vazifalar ({tasks?.length || 0})
            </h3>
            {tasks?.length === 0 ? (
              <p className="text-gray-400 text-sm">Hali vazifa yo'q</p>
            ) : tasks?.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className={`w-4 h-4 rounded border-2 shrink-0 ${t.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-gray-300'}`} />
                <div className="flex-1">
                  <p className={`text-sm ${t.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{t.title}</p>
                  {t.due_date && <p className="text-xs text-gray-400">{formatDate(t.due_date)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
