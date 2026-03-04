const express = require('express');
const router = express.Router();
const controller = require('./lead.controller');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate);

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/stats', controller.stats);
router.get('/:id', controller.get);
router.put('/:id', controller.update);
router.patch('/:id/status', controller.updateStatus);
router.post('/:id/assign', authorize('admin', 'manager'), controller.assign);
router.post('/:id/convert', controller.convertToDeal);
router.delete('/:id', authorize('admin', 'manager'), controller.delete);

module.exports = router;
