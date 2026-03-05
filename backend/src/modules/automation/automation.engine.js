/**
 * AGU CRM — Automation Engine
 * Pipeline trigger tizimi: event → conditions → actions
 */
const db = require('../../database/connection');
const logger = require('../../config/logger');
const { sendMessage } = require('../integrations/message.service');

// ── Action executors ──────────────────────────────────────────────────────────

async function execSendMessage(action, context, orgId) {
  const { contact_id, channel, channel_id } = context;
  if (!contact_id && !channel_id) return { ok: false, error: 'No contact' };

  let targetChannel = action.channel || channel || 'telegram';
  let targetId = channel_id;

  if (!targetId && contact_id) {
    // Eng so'nggi aktiv suhbatni topish
    const conv = await db('conversations')
      .where({ contact_id, organization_id: orgId, status: 'open' })
      .orderBy('last_message_at', 'desc')
      .first();
    if (conv) {
      targetChannel = conv.channel;
      targetId = conv.channel_conversation_id;
    }
  }

  if (!targetId) return { ok: false, error: 'No channel ID' };

  const text = interpolate(action.text || '', context);
  await sendMessage(orgId, targetChannel, targetId, text);
  return { ok: true, channel: targetChannel };
}

async function execCreateTask(action, context, orgId) {
  const { lead_id, deal_id, contact_id, assigned_to } = context;
  const dueHours = action.due_hours || 24;
  const dueDate = new Date(Date.now() + dueHours * 3600_000);

  const [task] = await db('tasks').insert({
    organization_id: orgId,
    title: interpolate(action.title || 'Vazifa', context),
    description: action.description || null,
    lead_id: lead_id || null,
    deal_id: deal_id || null,
    contact_id: contact_id || null,
    assigned_to: action.assigned_to || assigned_to || null,
    due_date: dueDate,
    priority: action.priority || 'medium',
  }).returning('id');

  return { ok: true, task_id: task.id };
}

async function execSendNotification(action, context, orgId) {
  // Barcha admins/managers ga yoki belgilangan foydalanuvchiga
  let userIds = [];
  if (action.user_id) {
    userIds = [action.user_id];
  } else {
    const users = await db('users')
      .where({ organization_id: orgId, is_active: true })
      .whereIn('role', ['admin', 'manager'])
      .pluck('id');
    userIds = users;
  }

  const message = interpolate(action.message || 'Avtomatik bildirishnoma', context);
  const notifications = userIds.map((uid) => ({
    organization_id: orgId,
    user_id: uid,
    type: 'automation',
    title: 'Avtomatizatsiya',
    message,
    data: JSON.stringify({ rule_name: context.rule_name }),
  }));

  if (notifications.length) {
    await db('notifications').insert(notifications);
  }
  return { ok: true, count: notifications.length };
}

async function execAddTag(action, context, orgId) {
  const tags = action.tags || [];
  if (!tags.length) return { ok: false, error: 'No tags' };

  const { lead_id, contact_id } = context;
  if (lead_id) {
    const lead = await db('leads').where({ id: lead_id }).first();
    if (lead) {
      const merged = [...new Set([...(lead.tags || []), ...tags])];
      await db('leads').where({ id: lead_id }).update({ tags: merged });
    }
  }
  if (contact_id) {
    const contact = await db('contacts').where({ id: contact_id }).first();
    if (contact) {
      const merged = [...new Set([...(contact.tags || []), ...tags])];
      await db('contacts').where({ id: contact_id }).update({ tags: merged });
    }
  }
  return { ok: true };
}

async function execUpdateLeadStatus(action, context, orgId) {
  if (!context.lead_id) return { ok: false, error: 'No lead_id' };
  await db('leads')
    .where({ id: context.lead_id, organization_id: orgId })
    .update({ status: action.status });
  return { ok: true };
}

async function execUpdateDealStage(action, context, orgId) {
  if (!context.deal_id || !action.stage_id) return { ok: false, error: 'Missing params' };
  await db('deals')
    .where({ id: context.deal_id, organization_id: orgId })
    .update({ pipeline_stage_id: action.stage_id });
  return { ok: true };
}

// ── Main engine ───────────────────────────────────────────────────────────────

const ACTION_HANDLERS = {
  send_message:        execSendMessage,
  create_task:         execCreateTask,
  send_notification:   execSendNotification,
  add_tag:             execAddTag,
  update_lead_status:  execUpdateLeadStatus,
  update_deal_stage:   execUpdateDealStage,
};

/**
 * Check if context matches conditions
 */
function matchesConditions(conditions, context) {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  for (const [key, value] of Object.entries(conditions)) {
    if (Array.isArray(value)) {
      if (!value.includes(context[key])) return false;
    } else {
      if (context[key] !== value) return false;
    }
  }
  return true;
}

/**
 * Replace {{variable}} placeholders in text
 */
function interpolate(text, context) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');
}

/**
 * Execute all matching automation rules for an event
 *
 * @param {string} orgId - Organization ID
 * @param {string} event - Trigger event name
 * @param {Object} context - Event context data (lead, deal, contact, etc.)
 */
async function runAutomations(orgId, event, context = {}) {
  try {
    const rules = await db('automation_rules')
      .where({ organization_id: orgId, trigger_event: event, is_active: true });

    if (!rules.length) return;

    for (const rule of rules) {
      const conditions = rule.trigger_conditions || {};

      if (!matchesConditions(conditions, context)) continue;

      const ctx = { ...context, rule_name: rule.name };
      const actions = rule.actions || [];
      const executedActions = [];

      const execute = async () => {
        for (const action of actions) {
          const handler = ACTION_HANDLERS[action.type];
          if (!handler) {
            executedActions.push({ type: action.type, ok: false, error: 'Unknown action' });
            continue;
          }
          try {
            const result = await handler(action, ctx, orgId);
            executedActions.push({ type: action.type, ...result });
          } catch (err) {
            executedActions.push({ type: action.type, ok: false, error: err.message });
            logger.error(`Automation action error rule=${rule.id} type=${action.type}:`, err.message);
          }
        }

        // Stats update
        await db('automation_rules')
          .where({ id: rule.id })
          .increment('run_count', 1)
          .update({ last_run_at: new Date() });

        // Log
        await db('automation_logs').insert({
          organization_id: orgId,
          rule_id: rule.id,
          rule_name: rule.name,
          trigger_event: event,
          entity_type: ctx.entity_type || null,
          entity_id: ctx.entity_id || null,
          actions_executed: JSON.stringify(executedActions),
          status: executedActions.every((a) => a.ok !== false) ? 'success' : 'partial',
        });

        logger.info(`Automation executed: rule="${rule.name}" event=${event} actions=${actions.length}`);
      };

      if (rule.delay_minutes > 0) {
        setTimeout(execute, rule.delay_minutes * 60_000);
      } else {
        await execute();
      }
    }
  } catch (err) {
    logger.error('Automation engine error:', err.message);
  }
}

module.exports = { runAutomations };
