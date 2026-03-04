const express = require('express');
const router = express.Router();

const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/users/user.routes');
const contactRoutes = require('../modules/contacts/contact.routes');
const leadRoutes = require('../modules/leads/lead.routes');
const dealRoutes = require('../modules/deals/deal.routes');
const pipelineRoutes = require('../modules/deals/pipeline.routes');
const productRoutes = require('../modules/warehouse/product.routes');
const warehouseRoutes = require('../modules/warehouse/warehouse.routes');
const taskRoutes = require('../modules/tasks/task.routes');
const conversationRoutes = require('../modules/conversations/conversation.routes');
const analyticsRoutes = require('../modules/analytics/analytics.routes');
const integrationRoutes = require('../modules/integrations/integration.routes');
const notificationRoutes = require('../modules/notifications/notification.routes');
const organizationRoutes = require('../modules/organizations/organization.routes');

// Auth (token kerak emas)
router.use('/auth', authRoutes);

// Qolgan routelar - token kerak
router.use('/organizations', organizationRoutes);
router.use('/users', userRoutes);
router.use('/contacts', contactRoutes);
router.use('/leads', leadRoutes);
router.use('/deals', dealRoutes);
router.use('/pipelines', pipelineRoutes);
router.use('/products', productRoutes);
router.use('/warehouse', warehouseRoutes);
router.use('/tasks', taskRoutes);
router.use('/conversations', conversationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/integrations', integrationRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
