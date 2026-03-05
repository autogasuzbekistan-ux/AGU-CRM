# AGU CRM — O'zbekiston va O'rta Osiyo uchun CRM tizimi

> Bitrix24 ga o'xshash, lekin O'zbekiston bozori uchun moslashtirilgan, **Telegram**, **WhatsApp**, **Instagram** va **Facebook** bilan to'liq integratsiya qilingan CRM tizimi.

---

## Loyiha tuzilmasi

```
AGU-CRM/
├── backend/              # Node.js + Express API
│   └── src/
│       ├── modules/
│       │   ├── auth/            — Kirish, ro'yxat, JWT
│       │   ├── contacts/        — Mijozlar
│       │   ├── leads/           — Leadlar + auto-tayinlash
│       │   ├── deals/           — Bitimlar (Kanban)
│       │   ├── tasks/           — Vazifalar
│       │   ├── conversations/   — Omnichannel suhbatlar
│       │   ├── warehouse/       — Ombor + mahsulotlar
│       │   ├── analytics/       — Tahlil + reyting
│       │   ├── users/           — Operatorlar
│       │   ├── organizations/   — Tashkilot sozlamalari
│       │   ├── notifications/   — Bildirishnomalar
│       │   ├── realtime/        — Socket.IO
│       │   └── integrations/
│       │       ├── telegram/    — Telegram webhook
│       │       ├── whatsapp/    — WhatsApp Business API
│       │       ├── facebook/    — Facebook Messenger + Lead Ads
│       │       └── instagram/   — Instagram DM
│       └── database/
│           └── init.sql         — PostgreSQL schema
│
├── frontend/             # React + Vite + TailwindCSS
│   └── src/
│       ├── pages/
│       │   ├── dashboard/       — Asosiy ko'rinish
│       │   ├── contacts/        — Mijozlar
│       │   ├── leads/           — Leadlar
│       │   ├── deals/           — Kanban board
│       │   ├── conversations/   — Chat interfeysi
│       │   ├── tasks/           — Vazifalar
│       │   ├── warehouse/       — Ombor
│       │   ├── analytics/       — Grafiklar
│       │   └── settings/        — Integratsiyalar, foydalanuvchilar
│       └── store/               — Zustand (auth, socket)
│
├── telegram-bot/         # Operatorlar uchun Telegram bot
├── docker-compose.yml    # PostgreSQL + Redis + MinIO + Nginx
└── .env.example          # Muhit o'zgaruvchilari
```

---

## Asosiy imkoniyatlar

| Modul | Tavsif |
|-------|--------|
| 👥 **Mijozlar** | Kontaktlar bazasi, qidiruv, tayinlash |
| 🎯 **Leadlar** | Round-robin avtomatik tayinlash |
| 💼 **Bitimlar** | Kanban board, pipeline bosqichlari |
| 💬 **Suhbatlar** | Omnichannel (Telegram/WA/IG/FB) chat |
| ✅ **Vazifalar** | Qo'ng'iroq, uchrashuv, eslatmalar |
| 📦 **Ombor** | Real-vaqt qoldiq, kirim/chiqim |
| 📊 **Tahlil** | Savdo trendi, kanal statistikasi |
| 🏆 **Reyting** | Operatorlar raqobati (Leaderboard) |
| ⚡ **Real-time** | Socket.IO bildirishnomalar |

---

## Boshlash (Development)

```bash
# 1. Muhit o'zgaruvchilarini sozlash
cp .env.example .env
# .env faylini to'ldiring

# 2. Docker bilan infratuzilmani ko'tarish
docker-compose up -d postgres redis minio

# 3. Database yaratish
psql -h localhost -U agu_crm_user -d agu_crm -f backend/src/database/init.sql

# 4. Backend ishga tushirish
cd backend && npm install && npm run dev

# 5. Frontend ishga tushirish
cd frontend && npm install && npm run dev

# 6. Telegram bot (ixtiyoriy)
cd telegram-bot && npm install && npm run dev
```

---

## Ishga tushirish (Production)

```bash
docker-compose up -d
```

---

## Integratsiyalar sozlash

### Telegram Bot
1. @BotFather dan yangi bot yarating
2. Token oling
3. CRM Admin paneliga kiring → Integratsiyalar → Telegram → Token kiriting

### WhatsApp Business
1. [Meta Developer Console](https://developers.facebook.com) da app yarating
2. WhatsApp Business API ga uling
3. Token va Phone Number ID ni CRM ga kiriting
4. Webhook URL: `https://sizningdomen.uz/webhook/whatsapp`

### Instagram / Facebook
1. Meta App yarating
2. Instagram/Facebook sahifani bog'lang
3. Page Access Token ni CRM ga kiriting
4. Webhook URL: `https://sizningdomen.uz/webhook/instagram`

---

## Tarif rejalari (rejalar)

| Plan | Foydalanuvchilar | Narx |
|------|-----------------|------|
| Free | 5 ta | Bepul |
| Basic | 15 ta | Arzon |
| Professional | 50 ta | O'rtacha |
| Enterprise | Cheksiz | Kelishuv |

---

## Keyingi etaplar

- [ ] **2-etap**: Email integration (SMTP), SMS (Eskiz.uz)
- [ ] **3-etap**: Mobil ilova (React Native)
- [ ] **4-etap**: Ko'p tarmoqli (multi-tenant SaaS)
- [ ] **5-etap**: AI yordamchi (lead scoring, xabar taklifi)
- [ ] **6-etap**: 1C / UzEGov integratsiyasi

---

*AGU CRM — O'zbekiston biznesining CRM tizimi* 🇺🇿
