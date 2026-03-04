const express = require('express');
const router = express.Router();
const controller = require('./contact.controller');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate);

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/search', controller.search);
router.get('/:id', controller.get);
router.put('/:id', controller.update);
router.delete('/:id', authorize('admin', 'manager'), controller.delete);
router.post('/:id/assign', authorize('admin', 'manager'), controller.assign);
router.get('/:id/history', controller.history);
router.get('/:id/conversations', controller.conversations);
router.get('/:id/deals', controller.deals);
router.get('/:id/tasks', controller.tasks);

module.exports = router;
