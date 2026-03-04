-- AGU CRM - PostgreSQL Database Schema
-- O'zbekiston va O'rta Osiyo bozori uchun CRM tizimi

-- Extensionlar
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- Full-text search uchun

-- ============================================
-- TASHKILOTLAR (Companies / Tenants)
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    website VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'UZ',
    timezone VARCHAR(50) DEFAULT 'Asia/Tashkent',
    currency VARCHAR(10) DEFAULT 'UZS',
    plan VARCHAR(50) DEFAULT 'free', -- free, basic, professional, enterprise
    plan_expires_at TIMESTAMPTZ,
    max_users INTEGER DEFAULT 5,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FOYDALANUVCHILAR (Users)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'operator', -- super_admin, admin, manager, operator
    department VARCHAR(100),
    position VARCHAR(100),
    telegram_id BIGINT UNIQUE,
    telegram_username VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMPTZ,
    email_verified_at TIMESTAMPTZ,
    phone_verified_at TIMESTAMPTZ,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, email)
);

CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_telegram ON users(telegram_id);
CREATE INDEX idx_users_role ON users(organization_id, role);

-- ============================================
-- MIJOZLAR (Contacts / Customers)
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(20) DEFAULT 'person', -- person, company
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    phone2 VARCHAR(20),
    telegram_id BIGINT,
    telegram_username VARCHAR(100),
    instagram_id VARCHAR(100),
    facebook_id VARCHAR(100),
    whatsapp_phone VARCHAR(20),
    avatar_url TEXT,
    source VARCHAR(50), -- telegram, instagram, facebook, whatsapp, manual, website, referral
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, blocked
    city VARCHAR(100),
    region VARCHAR(100),
    country VARCHAR(100) DEFAULT 'UZ',
    address TEXT,
    birthday DATE,
    gender VARCHAR(10),
    language VARCHAR(10) DEFAULT 'uz', -- uz, ru, en
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',
    total_deals INTEGER DEFAULT 0,
    total_revenue DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_org ON contacts(organization_id);
CREATE INDEX idx_contacts_assigned ON contacts(assigned_to);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_telegram ON contacts(telegram_id);
CREATE INDEX idx_contacts_source ON contacts(source);
CREATE INDEX idx_contacts_search ON contacts USING GIN(to_tsvector('simple', COALESCE(first_name,'') || ' ' || COALESCE(last_name,'') || ' ' || COALESCE(phone,'')));

-- ============================================
-- LEADLAR (Leads)
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source VARCHAR(50), -- telegram, instagram, facebook, whatsapp, manual, website, referral
    source_id VARCHAR(255), -- external message/post ID
    status VARCHAR(50) DEFAULT 'new', -- new, processing, qualified, converted, rejected
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    budget DECIMAL(15,2),
    currency VARCHAR(10) DEFAULT 'UZS',
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    converted_at TIMESTAMPTZ,
    converted_deal_id UUID,
    rejected_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_org ON leads(organization_id);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_leads_status ON leads(organization_id, status);
CREATE INDEX idx_leads_source ON leads(source);

-- ============================================
-- BITIMLAR (Deals / Sales Pipeline)
-- ============================================
CREATE TABLE IF NOT EXISTS pipelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6',
    sort_order INTEGER DEFAULT 0,
    probability INTEGER DEFAULT 0, -- 0-100%
    is_won BOOLEAN DEFAULT false,
    is_lost BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'UZS',
    probability INTEGER DEFAULT 0,
    expected_close_date DATE,
    closed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'open', -- open, won, lost
    lost_reason TEXT,
    source VARCHAR(50),
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deals_org ON deals(organization_id);
CREATE INDEX idx_deals_pipeline ON deals(pipeline_id, stage_id);
CREATE INDEX idx_deals_assigned ON deals(assigned_to);
CREATE INDEX idx_deals_contact ON deals(contact_id);
CREATE INDEX idx_deals_status ON deals(organization_id, status);

-- ============================================
-- MAHSULOTLAR VA OMBOR (Products & Warehouse)
-- ============================================
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES product_categories(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255),
    description TEXT,
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES product_categories(id),
    sku VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    price DECIMAL(15,2) DEFAULT 0,
    purchase_price DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'UZS',
    unit VARCHAR(50) DEFAULT 'dona', -- dona, kg, litr, metr
    min_stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, sku)
);

CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    manager_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity DECIMAL(15,3) DEFAULT 0,
    reserved_quantity DECIMAL(15,3) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50) NOT NULL, -- in, out, transfer, adjustment
    quantity DECIMAL(15,3) NOT NULL,
    price DECIMAL(15,2),
    reference_type VARCHAR(50), -- deal, order, manual
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_product ON stock(product_id);
CREATE INDEX idx_stock_movements_org ON stock_movements(organization_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);

-- ============================================
-- VAZIFALAR (Tasks)
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'task', -- task, call, meeting, email, follow_up
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    priority VARCHAR(20) DEFAULT 'medium',
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    reminder_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_org ON tasks(organization_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(organization_id, status);
CREATE INDEX idx_tasks_due ON tasks(due_date);

-- ============================================
-- XABARLAR (Messages - Omnichannel)
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL, -- telegram, instagram, facebook, whatsapp, email, phone
    channel_conversation_id VARCHAR(255), -- external chat ID
    status VARCHAR(50) DEFAULT 'open', -- open, resolved, pending
    last_message_at TIMESTAMPTZ,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, channel, channel_conversation_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL, -- contact, operator, bot
    sender_id UUID, -- user_id or contact_id
    external_id VARCHAR(255), -- channel-specific message ID
    type VARCHAR(50) DEFAULT 'text', -- text, image, video, audio, file, location, sticker
    content TEXT,
    media_url TEXT,
    media_type VARCHAR(100),
    is_read BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_org ON conversations(organization_id);
CREATE INDEX idx_conversations_contact ON conversations(contact_id);
CREATE INDEX idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX idx_conversations_channel ON conversations(channel, channel_conversation_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sent ON messages(conversation_id, sent_at DESC);

-- ============================================
-- OPERATORLAR RAQOBATI (Operator Competition)
-- ============================================
CREATE TABLE IF NOT EXISTS operator_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL, -- daily, weekly, monthly
    period_date DATE NOT NULL,
    leads_received INTEGER DEFAULT 0,
    leads_converted INTEGER DEFAULT 0,
    deals_created INTEGER DEFAULT 0,
    deals_won INTEGER DEFAULT 0,
    deals_lost INTEGER DEFAULT 0,
    revenue DECIMAL(15,2) DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0, -- seconds
    score DECIMAL(10,2) DEFAULT 0,
    rank INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, period_type, period_date)
);

CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL, -- first_deal, 10_deals, top_operator, etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    earned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_operator_stats_user ON operator_stats(user_id, period_type, period_date);
CREATE INDEX idx_operator_stats_org ON operator_stats(organization_id, period_type, period_date);

-- ============================================
-- INTEGRATSIYALAR (Integrations)
-- ============================================
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- telegram, instagram, facebook, whatsapp, email
    name VARCHAR(255) NOT NULL,
    credentials JSONB DEFAULT '{}', -- encrypted
    settings JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, error
    last_sync_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integrations_org ON integrations(organization_id, type);

-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- create, update, delete, login, etc.
    entity_type VARCHAR(100), -- contact, deal, lead, etc.
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ============================================
-- BILDIRISHNOMALAR (Notifications)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    sent_via TEXT[] DEFAULT '{}', -- web, telegram, email
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(user_id, created_at DESC);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger qo'shish
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['organizations','users','contacts','leads','deals','products','tasks','conversations','operator_stats','integrations']
    LOOP
        EXECUTE format('
            CREATE TRIGGER update_%s_updated_at
            BEFORE UPDATE ON %s
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
        ', t, t);
    END LOOP;
END;
$$;

-- Default pipeline yaratish (trigger orqali)
-- Bu seed.js da amalga oshiriladi
