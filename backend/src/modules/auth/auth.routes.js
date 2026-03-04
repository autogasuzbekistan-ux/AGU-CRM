const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');

// Ro'yxatdan o'tish
router.post('/register', authController.register);

// Kirish
router.post('/login', authController.login);

// Token yangilash
router.post('/refresh', authController.refresh);

// Chiqish
router.post('/logout', authenticate, authController.logout);

// Parolni tiklash
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Email tasdiqlash
router.get('/verify-email/:token', authController.verifyEmail);

// Joriy foydalanuvchi
router.get('/me', authenticate, authController.me);

// Telegram orqali kirish
router.post('/telegram', authController.telegramAuth);

module.exports = router;
