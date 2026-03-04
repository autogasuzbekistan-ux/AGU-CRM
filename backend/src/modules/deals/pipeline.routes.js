const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth');
const db = require('../../database/connection');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const pipelines = await db('pipelines')
      .where({ organization_id: req.organizationId })
      .orderBy('is_default', 'desc');

    for (const p of pipelines) {
      p.stages = await db('pipeline_stages')
        .where({ pipeline_id: p.id })
        .orderBy('sort_order', 'asc');
    }

    res.json({ success: true, data: pipelines });
  } catch (error) {
    next(error);
  }
});

router.post('/', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { name, description, stages } = req.body;

    const result = await db.transaction(async (trx) => {
      const [pipeline] = await trx('pipelines').insert({
        organization_id: req.organizationId,
        name,
        description,
      }).returning('*');

      if (stages && stages.length > 0) {
        await trx('pipeline_stages').insert(
          stages.map((s, i) => ({
            pipeline_id: pipeline.id,
            name: s.name,
            color: s.color || '#3B82F6',
            sort_order: i + 1,
            probability: s.probability || 0,
            is_won: s.is_won || false,
            is_lost: s.is_lost || false,
          }))
        );
      }

      return pipeline;
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/stages', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { stages } = req.body;
    await db('pipeline_stages').where({ pipeline_id: req.params.id }).delete();
    await db('pipeline_stages').insert(
      stages.map((s, i) => ({ ...s, pipeline_id: req.params.id, sort_order: i + 1 }))
    );

    res.json({ success: true, message: 'Bosqichlar yangilandi' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
