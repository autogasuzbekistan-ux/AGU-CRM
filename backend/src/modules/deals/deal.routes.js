const express = require('express');
const router = express.Router();
const controller = require('./deal.controller');
const { authenticate, authorize } = require('../../middleware/auth');

router.use(authenticate);

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/kanban', controller.kanban);
router.get('/:id', controller.get);
router.put('/:id', controller.update);
router.patch('/:id/stage', controller.moveStage);
router.patch('/:id/won', controller.markWon);
router.patch('/:id/lost', controller.markLost);
router.post('/:id/products', controller.addProduct);
router.get('/:id/products', controller.getProducts);
router.delete('/:id', authorize('admin', 'manager'), controller.delete);

module.exports = router;
