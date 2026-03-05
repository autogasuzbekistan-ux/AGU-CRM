const jwt = require('jsonwebtoken');
const db = require('../../database/connection');
const logger = require('../../config/logger');

module.exports = (io) => {
  // Socket autentifikatsiya
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) return next(new Error('Token topilmadi'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await db('users').where({ id: decoded.userId, is_active: true }).first();

      if (!user) return next(new Error('Foydalanuvchi topilmadi'));

      socket.userId = user.id;
      socket.organizationId = user.organization_id;
      socket.userRole = user.role;
      next();
    } catch (err) {
      next(new Error('Noto\'g\'ri token'));
    }
  });

  io.on('connection', async (socket) => {
    logger.info(`Socket ulandi: ${socket.userId}`);

    // Foydalanuvchini o'z xonasiga qo'shish
    socket.join(`user:${socket.userId}`);
    socket.join(`org:${socket.organizationId}`);

    // Online status
    await db('users').where({ id: socket.userId }).update({ is_online: true, last_seen_at: new Date() });
    io.to(`org:${socket.organizationId}`).emit('user_online', { userId: socket.userId });

    // Suhbatga qo'shilish
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conv:${conversationId}`);
      logger.debug(`User ${socket.userId} joined conv:${conversationId}`);
    });

    // Suhbatdan chiqish
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conv:${conversationId}`);
    });

    // Yozmoqda ko'rsatish
    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(`conv:${conversationId}`).emit('typing', {
        userId: socket.userId,
        conversationId,
        isTyping,
      });
    });

    // Xabar o'qildi
    socket.on('mark_read', async ({ conversationId }) => {
      await db('conversations')
        .where({ id: conversationId, organization_id: socket.organizationId })
        .update({ unread_count: 0 });
      await db('messages')
        .where({ conversation_id: conversationId, is_read: false })
        .update({ is_read: true });
    });

    // Ulanish uzilganda
    socket.on('disconnect', async () => {
      logger.info(`Socket uzildi: ${socket.userId}`);
      await db('users').where({ id: socket.userId }).update({
        is_online: false,
        last_seen_at: new Date(),
      });
      io.to(`org:${socket.organizationId}`).emit('user_offline', { userId: socket.userId });
    });
  });
};
