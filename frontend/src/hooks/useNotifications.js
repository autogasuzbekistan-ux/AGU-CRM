import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';

export const useNotifications = () => {
  const { data } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => api.get('/notifications?unread=true&limit=1').then((r) => r.data.meta),
    refetchInterval: 30_000,
  });

  return { unreadCount: data?.unread || 0 };
};
