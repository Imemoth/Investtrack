# InvestTrack — TODO

## 🔴 Kritikus (monetizáció alapja)

### Stripe integráció
- [ ] Stripe account + product létrehozás (Free / Pro / Pro+)
- [ ] Supabase `subscriptions` tábla + webhook handler
- [ ] Checkout flow (Vercel serverless `/api/checkout`)
- [ ] Billing portal (lemondás, frissítés)
- [ ] Feature flag hook: `useSubscription()` → tier ellenőrzés

### Free tier korlátok
- [ ] Max 5 pozíció (felette "Upgrade" CTA)
- [ ] Napi 3x manuális árfrissítés (Pro: automatikus 15 percenként)
- [ ] XTB import: csak nyitott pozíciók (Pro: lezárt + historikus is)
- [ ] AI elemzés: Pro+ only
- [ ] Paywall UI komponens (blur overlay + upgrade gomb)

---

## 🟡 Következő sprint

### 📈 Historikus portfólió görbe
- [ ] `portfolio_snapshots` tábla már megvan Supabase-ben
- [ ] Napi snapshot mentés árfrissítés után (`savePortfolioSnapshot`)
- [ ] Historikus görbe komponens (line chart, recharts)
- [ ] Időszak választó: 1H / 1M / 3M / 6M / 1Y / MAX
- [ ] Portfólió érték + befektetett tőke + P&L görbe egyszerre
- [ ] Dashboard-ra berakni a Benchmark mellé (vagy helyette)

### 🔔 Célár push értesítés
- [ ] Web Push API + Service Worker regisztráció
- [ ] Supabase `price_alerts` tábla: `{ user_id, ticker, target_price, direction, active }`
- [ ] Vercel cron job (óránként): árak lekérése → alert kiküldés
- [ ] Alert beállítás UI: pozíció kártyán "🔔 Célár beállítása"
- [ ] Push notification payload: "NVDA elérte a $600-t 🎯"
- [ ] Email fallback ha push nem elérhető (Resend API)

---

## 🟢 Backlog

### UX / Polish
- [ ] Onboarding flow új felhasználónak (első bejelentkezés wizard)
- [ ] Saját domain (nem project-26h5o.vercel.app)
- [ ] Landing page (nem az app tölt be bejelentkezés nélkül)
- [ ] Dark/Light téma perzisztencia Supabase-ben (ne csak localStorage)

### Funkciók
- [ ] Adókalkulátor (SZJA 15% + SZOCHO számítás realizált nyereségre)
- [ ] Automatikus árfrissítés háttérben (Service Worker + Vercel cron)
- [ ] Több portfólió (pl. "Péter", "Feleség") — Pro+
- [ ] Referral rendszer (1 hónap ingyen ha meghívsz valakit)
- [ ] PDF export (nyomtatható kimutatás)
- [ ] Osztalék tracker (várható kifizetések naptárban)

### Technikai adósság
- [ ] DashboardWidgets.jsx szétbontása (túl nagy)
- [ ] FeatureModals.jsx felülvizsgálat (van-e amit ki lehet dobni)
- [ ] Error boundary komponens (app crash helyett szép hibaüzenet)
- [ ] Rate limiting az árfrissítésen (Yahoo Finance API limit)
- [ ] Offline mód javítása (Service Worker cache)

---

## ✅ Kész

- [x] XTB XLSX import (nyitott + lezárt pozíciók)
- [x] Lot-alapú vételár követés + FIFO eladás
- [x] Realizált P&L szétválasztás
- [x] Ticker autocomplete (Yahoo Finance)
- [x] Aktuális ár auto-betöltés
- [x] Függőben lévő megbízások (limit order tracker)
- [x] Supabase backend + auth (email + Google)
- [x] Treemap pozíció súlyok
- [x] Top movers accordion
- [x] Kompakt mobil lista
- [x] App.jsx refaktor (komponensekre bontás)
