import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

let socket = null;

export const useSocket = () => {
  const { accessToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    socket = io('/', {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket.IO ulandi');
    });

    socket.on('new_lead', ({ lead }) => {
      toast.custom((t) => (
        <div className={`bg-white shadow-lg rounded-xl p-4 border-l-4 border-blue-500 ${t.visible ? 'animate-enter' : 'animate-leave'}`}>
          <p className="font-semibold text-gray-900">Yangi lead! 🎯</p>
          <p className="text-sm text-gray-600">{lead.title}</p>
        </div>
      ), { duration: 6000 });
    });

    socket.on('new_message', ({ message }) => {
      // Suhbat sahifasida boshqariladi
    });

    socket.on('deal_moved', ({ dealId, stageId }) => {
      // React Query invalidate qilinadi
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO uzildi');
    });

    return () => {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    };
  }, [isAuthenticated, accessToken]);

  return socket;
};

export const getSocket = () => socket;
