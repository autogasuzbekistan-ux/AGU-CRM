const axios = require('axios');
const Redis = require('ioredis');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  lazyConnect: true,
});

// Telegram ID bo'yicha session saqlash
const saveSession = async (telegramId, data) => {
  await redis.set(`bot_session:${telegramId}`, JSON.stringify(data), 'EX', 7 * 24 * 3600);
};

const getSession = async (telegramId) => {
  const data = await redis.get(`bot_session:${telegramId}`);
  return data ? JSON.parse(data) : null;
};

const clearSession = async (telegramId) => {
  await redis.del(`bot_session:${telegramId}`);
};

// API chaqiruvlar
const apiCall = async (method, path, data, token) => {
  const response = await axios({
    method,
    url: `${BACKEND_URL}/api/v1${path}`,
    data,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
};

const login = async (telegramId, username) => {
  return apiCall('POST', '/auth/telegram', { telegramId, username });
};

const getLeads = async (token) => {
  return apiCall('GET', '/leads?limit=10&status=new', null, token);
};

const getMyLeads = async (token) => {
  return apiCall('GET', '/leads?limit=10', null, token);
};

const getDeals = async (token) => {
  return apiCall('GET', '/deals?limit=10&status=open', null, token);
};

const getTasks = async (token) => {
  return apiCall('GET', '/tasks?status=pending&limit=10', null, token);
};

const getStats = async (token) => {
  return apiCall('GET', '/analytics/dashboard', null, token);
};

const completeTask = async (taskId, token) => {
  return apiCall('PATCH', `/tasks/${taskId}/complete`, {}, token);
};

const sendMessage = async (conversationId, content, token) => {
  return apiCall('POST', `/conversations/${conversationId}/messages`, { content }, token);
};

const getConversations = async (token) => {
  return apiCall('GET', '/conversations?status=open&unread=true&limit=10', null, token);
};

module.exports = { saveSession, getSession, clearSession, login, getLeads, getMyLeads, getDeals, getTasks, getStats, completeTask, sendMessage, getConversations };
