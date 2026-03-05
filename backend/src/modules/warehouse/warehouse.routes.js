const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth');
const db = require('../../database/connection');

router.use(authenticate);

// Omborlar ro'yxati
router.get('/', async (req, res, next) => {
  try {
    const warehouses = await db('warehouses as w')
      .leftJoin('users as u', 'w.manager_id', 'u.id')
      .where({ 'w.organization_id': req.organizationId, 'w.is_active': true })
      .select('w.*', db.raw("CONCAT(u.first_name, ' ', u.last_name) as manager_name"));
    res.json({ success: true, data: warehouses });
  } catch (error) {
    next(error);
  }
});

router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    const { name, address, managerId } = req.body;
    const [wh] = await db('warehouses').insert({
      organization_id: req.organizationId,
      name, address, manager_id: managerId,
    }).returning('*');
    res.status(201).json({ success: true, data: wh });
  } catch (error) {
    next(error);
  }
});

// Ombor qoldig'i (real-time)
router.get('/:id/stock', async (req, res, next) => {
  try {
    const stock = await db('stock as s')
      .join('products as p', 's.product_id', 'p.id')
      .leftJoin('product_categories as cat', 'p.category_id', 'cat.id')
      .where({ 's.warehouse_id': req.params.id, 'p.organization_id': req.organizationId })
      .select(
        'p.id as product_id', 'p.name', 'p.sku', 'p.unit', 'p.price', 'p.min_stock',
        'cat.name as category',
        's.quantity', 's.reserved_quantity',
        db.raw('s.quantity - s.reserved_quantity as available'),
        db.raw('CASE WHEN s.quantity <= p.min_stock THEN true ELSE false END as low_stock'),
        db.raw('s.quantity * p.price as total_value')
      )
      .orderBy('low_stock', 'desc');

    const totalValue = stock.reduce((sum, s) => sum + parseFloat(s.total_value || 0), 0);
    const lowStockCount = stock.filter((s) => s.low_stock).length;

    res.json({ success: true, data: stock, meta: { totalValue, lowStockCount } });
  } catch (error) {
    next(error);
  }
});

// Kirim/Chiqim (qo'lda)
router.post('/:id/movement', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { productId, type, quantity, price, notes } = req.body;
    const warehouseId = req.params.id;

    await db.transaction(async (trx) => {
      // Harakat yozuvi
      await trx('stock_movements').insert({
        organization_id: req.organizationId,
        product_id: productId,
        warehouse_id: warehouseId,
        user_id: req.user.id,
        type, quantity, price, notes,
        reference_type: 'manual',
      });

      // Qoldiqni yangilash
      const delta = type === 'in' ? quantity : -quantity;
      await trx('stock')
        .insert({ product_id: productId, warehouse_id: warehouseId, quantity: delta })
        .onConflict(['product_id', 'warehouse_id'])
        .merge({ quantity: trx.raw(`stock.quantity + ${delta}`) });
    });

    res.json({ success: true, message: 'Harakat qayd etildi' });
  } catch (error) {
    next(error);
  }
});

// Harakat tarixi
router.get('/:id/movements', async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const movements = await db('stock_movements as sm')
      .join('products as p', 'sm.product_id', 'p.id')
      .leftJoin('users as u', 'sm.user_id', 'u.id')
      .where({ 'sm.warehouse_id': req.params.id, 'sm.organization_id': req.organizationId })
      .select(
        'sm.*', 'p.name as product_name', 'p.sku', 'p.unit',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as operator_name")
      )
      .orderBy('sm.created_at', 'desc')
      .offset(offset).limit(parseInt(limit));

    res.json({ success: true, data: movements });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
