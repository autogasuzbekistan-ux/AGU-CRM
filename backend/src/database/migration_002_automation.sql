-- ============================================================
-- MIGRATION 002: Automation, Broadcasting, Invoices
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. AUTOMATION RULES (Pipeline trigger tizimi)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             VARCHAR(200) NOT NULL,
  description      TEXT,
  is_active        BOOLEAN DEFAULT true,

  -- Trigger
  trigger_event    VARCHAR(60) NOT NULL,
  -- Values: lead_created | lead_status_changed | lead_assigned
  --         deal_created | deal_stage_changed | deal_won | deal_lost
  --         message_received | task_overdue | contact_created

  trigger_conditions JSONB DEFAULT '{}',
  -- Example: {"status": "new", "source": "telegram", "priority": "high"}

  -- Actions (array)
  actions          JSONB DEFAULT '[]',
  -- Example: [
  --   {"type": "send_message", "channel": "whatsapp", "text": "Salom {{contact_name}}!"},
  --   {"type": "create_task", "title": "Qo'ng'iroq qilish", "due_hours": 2},
  --   {"type": "send_notification", "message": "Yangi lead keldi"},
  --   {"type": "add_tag", "tags": ["yangi", "telegram"]},
  --   {"type": "update_lead_status", "status": "processing"},
  --   {"type": "send_sms", "text": "Sizning buyurtmangiz qabul qilindi"}
  -- ]

  delay_minutes    INTEGER DEFAULT 0,
  run_count        INTEGER DEFAULT 0,
  last_run_at      TIMESTAMPTZ,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_org_event
  ON automation_rules(organization_id, trigger_event, is_active);

-- ────────────────────────────────────────────────────────────
-- 2. AUTOMATION LOGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id         UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
  rule_name       VARCHAR(200),
  trigger_event   VARCHAR(60),
  entity_type     VARCHAR(30), -- 'lead' | 'deal' | 'contact' | 'conversation'
  entity_id       UUID,
  actions_executed JSONB DEFAULT '[]',
  status          VARCHAR(20) DEFAULT 'success', -- success | partial | failed
  error_message   TEXT,
  executed_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_org
  ON automation_logs(organization_id, executed_at DESC);

-- ────────────────────────────────────────────────────────────
-- 3. BROADCASTS (Ommaviy xabar)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcasts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title            VARCHAR(300) NOT NULL,
  message          TEXT NOT NULL,
  channel          VARCHAR(20) NOT NULL DEFAULT 'all',
  -- Values: telegram | whatsapp | sms | all

  -- Segment filters
  segment_filters  JSONB DEFAULT '{}',
  -- Example: {"tags": ["premium"], "source": "telegram", "city": "Toshkent"}

  status           VARCHAR(20) DEFAULT 'draft',
  -- draft | scheduled | sending | sent | cancelled

  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,

  -- Stats
  total_recipients INTEGER DEFAULT 0,
  sent_count       INTEGER DEFAULT 0,
  delivered_count  INTEGER DEFAULT 0,
  failed_count     INTEGER DEFAULT 0,

  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_org ON broadcasts(organization_id, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 4. BROADCAST RECIPIENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id    UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel         VARCHAR(20),
  channel_id      VARCHAR(200), -- telegram_id, phone, etc.
  status          VARCHAR(20) DEFAULT 'pending',
  -- pending | sent | delivered | failed | skipped
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  UNIQUE(broadcast_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast
  ON broadcast_recipients(broadcast_id, status);

-- ────────────────────────────────────────────────────────────
-- 5. INVOICES (Hisob-faktura / To'lov)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number   VARCHAR(50) UNIQUE,
  title            VARCHAR(300) NOT NULL,

  deal_id          UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,

  amount           DECIMAL(15,2) NOT NULL,
  currency         VARCHAR(3) DEFAULT 'UZS',

  status           VARCHAR(20) DEFAULT 'draft',
  -- draft | sent | paid | cancelled | expired | refunded

  payment_provider VARCHAR(20),
  -- payme | click | cash | transfer | manual

  -- Payment provider data
  payment_url      TEXT,
  transaction_id   VARCHAR(200),
  provider_data    JSONB DEFAULT '{}',

  -- Items (line items)
  items            JSONB DEFAULT '[]',
  -- [{"name": "Mahsulot", "qty": 2, "price": 50000, "total": 100000}]

  notes            TEXT,
  due_date         DATE,
  paid_at          TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,

  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_deal ON invoices(deal_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices(contact_id);

-- Auto-increment invoice number function
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  org_prefix TEXT;
  next_num   INTEGER;
BEGIN
  SELECT UPPER(LEFT(name, 3)) INTO org_prefix
  FROM organizations WHERE id = NEW.organization_id;

  SELECT COUNT(*) + 1 INTO next_num
  FROM invoices WHERE organization_id = NEW.organization_id;

  NEW.invoice_number := org_prefix || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_invoice_number ON invoices;
CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION generate_invoice_number();

-- Updated_at triggers
CREATE OR REPLACE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_broadcasts_updated_at
  BEFORE UPDATE ON broadcasts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
