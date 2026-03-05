const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth');
const db = require('../../database/connection');

router.use(authenticate);

// Mahsulotlar
router.get('/', async (req, res, next) => {
  try {
    const { search, categoryId, isActive = 'true', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('products as p')
      .leftJoin('product_categories as cat', 'p.category_id', 'cat.id')
      .where({ 'p.organization_id': req.organizationId })
      .select('p.*', 'cat.name as category_name')
      .orderBy('p.name', 'asc');

    if (isActive !== 'all') query = query.where({ 'p.is_active': isActive === 'true' });
    if (categoryId) query = query.where({ 'p.category_id': categoryId });
    if (search) query = query.whereRaw("p.name ILIKE ?", [`%${search}%`]);

    const [{ count }] = await query.clone().count('p.id as count');
    const products = await query.offset(offset).limit(parseInt(limit));

    // Har bir mahsulot uchun ombor qoldig'i
    for (const p of products) {
      const stockData = await db('stock')
        .where({ product_id: p.id })
        .sum('quantity as total')
        .first();
      p.total_stock = parseFloat(stockData.total || 0);
    }

    res.json({ success: true, data: products, meta: { total: parseInt(count), page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    next(error);
  }
});

router.post('/', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { sku, name, description, categoryId, price, purchasePrice, unit, minStock } = req.body;

    const [product] = await db('products').insert({
      organization_id: req.organizationId,
      sku, name, description,
      category_id: categoryId,
      price: price || 0,
      purchase_price: purchasePrice || 0,
      unit: unit || 'dona',
      min_stock: minStock || 0,
    }).returning('*');

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await db('products')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .first();

    if (!product) return res.status(404).json({ success: false, message: 'Mahsulot topilmadi' });

    // Omborlar bo'yicha qoldiq
    product.stock = await db('stock as s')
      .join('warehouses as w', 's.warehouse_id', 'w.id')
      .where({ 's.product_id': product.id })
      .select('w.name as warehouse_name', 's.quantity', 's.reserved_quantity',
        db.raw('s.quantity - s.reserved_quantity as available'));

    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const [product] = await db('products')
      .where({ id: req.params.id, organization_id: req.organizationId })
      .update(req.body)
      .returning('*');

    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

// Kategoriyalar
router.get('/categories/all', async (req, res, next) => {
  try {
    const categories = await db('product_categories')
      .where({ organization_id: req.organizationId, is_active: true })
      .orderBy('name', 'asc');
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

router.post('/categories', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { name, parentId, description } = req.body;
    const [cat] = await db('product_categories').insert({
      organization_id: req.organizationId,
      name, parent_id: parentId, description,
    }).returning('*');
    res.status(201).json({ success: true, data: cat });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
