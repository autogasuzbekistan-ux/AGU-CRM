import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Search, CheckCheck, Filter } from 'lucide-react';
import api from '../../api/axios';

const CHANNEL_ICONS = { telegram: '✈️', whatsapp: '📱', instagram: '📸', facebook: '👥', email: '📧' };
const CHANNEL_COLORS = {
  telegram: 'bg-blue-500', whatsapp: 'bg-green-500',
  instagram: 'bg-pink-500', facebook: 'bg-blue-700', email: 'bg-gray-500',
};

export default function ConversationsPage() {
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState({ channel: '', status: 'open' });
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['conversations', filter],
    queryFn: () => {
      const p = new URLSearchParams(filter).toString();
      return api.get(`/conversations?${p}`).then((r) => r.data.data);
    },
    refetchInterval: 10_000,
  });

  const { data: messages } = useQuery({
    queryKey: ['messages', selected?.id],
    queryFn: () => api.get(`/conversations/${selected.id}/messages`).then((r) => r.data.data),
    enabled: !!selected,
    refetchInterval: 5_000,
  });

  const sendMutation = useMutation({
    mutationFn: (content) => api.post(`/conversations/${selected.id}/messages`, { content }),
    onSuccess: () => {
      qc.invalidateQueries(['messages', selected.id]);
      qc.invalidateQueries(['conversations']);
      setMessage('');
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => api.patch(`/conversations/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries(['conversations']),
  });

  const conversations = data || [];

  const handleSend = () => {
    if (!message.trim() || !selected) return;
    sendMutation.mutate(message.trim());
  };

  return (
    <div className="h-full flex">
      {/* Suhbatlar ro'yxati */}
      <div className="w-80 border-r border-gray-100 bg-white flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 mb-3">Suhbatlar</h2>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-8 text-sm" placeholder="Qidirish..." />
          </div>
          <div className="flex gap-2">
            {['', 'telegram', 'whatsapp', 'instagram'].map((ch) => (
              <button
                key={ch}
                onClick={() => setFilter({ ...filter, channel: ch })}
                className={`text-lg px-2 py-1 rounded-lg transition-all ${filter.channel === ch ? 'bg-primary-100' : 'hover:bg-gray-100'}`}
                title={ch || 'Hammasi'}
              >
                {ch ? CHANNEL_ICONS[ch] : '📋'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">Suhbat topilmadi</div>
          ) : conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelected(conv)}
              className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected?.id === conv.id ? 'bg-primary-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-lg shrink-0">
                    {conv.contact_avatar ? (
                      <img src={conv.contact_avatar} className="w-full h-full rounded-full object-cover" alt="" />
                    ) : (
                      (conv.contact_name || '?')[0]
                    )}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 ${CHANNEL_COLORS[conv.channel]} rounded-full flex items-center justify-center text-[8px]`}>
                    {CHANNEL_ICONS[conv.channel]}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {conv.contact_name || 'Noma\'lum'}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {conv.last_message_at && new Date(conv.last_message_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {conv.last_message?.content || '...'}
                  </p>
                </div>

                {conv.unread_count > 0 && (
                  <span className="w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center shrink-0">
                    {conv.unread_count}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat oynasi */}
      {selected ? (
        <div className="flex-1 flex flex-col bg-gray-50">
          {/* Chat header */}
          <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
                {(selected.contact_name || '?')[0]}
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900">{selected.contact_name || 'Noma\'lum'}</p>
                <p className="text-xs text-gray-400">{CHANNEL_ICONS[selected.channel]} {selected.channel}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {selected.status === 'open' && (
                <button
                  onClick={() => resolveMutation.mutate(selected.id)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                >
                  <CheckCheck size={13} /> Yopish
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {(messages || []).map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender_type === 'operator' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                  msg.sender_type === 'operator'
                    ? 'bg-primary-600 text-white rounded-br-md'
                    : 'bg-white border border-gray-100 text-gray-900 rounded-bl-md shadow-sm'
                }`}>
                  {msg.content}
                  <p className={`text-xs mt-1 ${msg.sender_type === 'operator' ? 'text-primary-200' : 'text-gray-400'}`}>
                    {new Date(msg.sent_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="bg-white border-t border-gray-100 p-4">
            <div className="flex gap-3">
              <input
                className="input flex-1"
                placeholder="Xabar yozing..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || sendMutation.isPending}
                className="btn-primary px-4"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center text-gray-400">
            <p className="text-4xl mb-3">💬</p>
            <p className="font-medium">Suhbat tanlang</p>
            <p className="text-sm mt-1">Chap tomondagi ro'yxatdan suhbat tanlang</p>
          </div>
        </div>
      )}
    </div>
  );
}
