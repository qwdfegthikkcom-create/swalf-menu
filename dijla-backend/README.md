# منيو مطعم دجلة: نظام الطلبات والكاشير (نموذج عرض)

الصفحات في `docs/dijla-menu/` وتُنشر على GitHub Pages:

- `index.html`: منيو الزبون. رمز QR كل طاولة يفتح `.../dijla-menu/?t=رقم_الطاولة`.
- `cashier.html`: شاشة الكاشير (تحتاج رمز دخول).
- `assets/menu.js`: الأصناف والأسعار (تجريبية). المصدر الوحيد للأصناف.
- `assets/backend.js`: الاتصال. فيه `mode`:
  - `'local'`: تجربة على جهاز واحد. الطلبات تُحفظ في المتصفح وتصل إلى الكاشير في نافذة أخرى من المتصفح نفسه. رمز الكاشير هنا `2468`.
  - `'cloud'`: قاعدة بيانات Supabase. الطلب من أي هاتف يصل إلى الكاشير على أي جهاز.

## تشغيل وضع السحابة (مرة واحدة)

1. في Supabase نفّذ `schema.sql` ثم `seed.sql` (من SQL Editor أو أداة الترحيل).
2. اضبط رمز الكاشير، ولا تكتبه في أي ملف في المستودع:
   `select dijla_set_pin('الرمز');`
3. في `docs/dijla-menu/assets/backend.js` غيّر `mode: 'local'` إلى `mode: 'cloud'`، وارفع.

## تعديل الأصناف أو الأسعار

عدّل `docs/dijla-menu/assets/menu.js`، ثم:

```
node dijla-backend/seed.cjs > dijla-backend/seed.sql
```

ونفّذ `seed.sql` في Supabase. الأسعار التي يدفعها الزبون تُحسب في القاعدة لا في المتصفح.

## الأمان

- الجداول في مخطط `dijla` غير المكشوف، ولا يصل إليها الزائر إلا عبر دوال `dijla_*` التي تفحص كل مدخل.
- الكاشير يدخل برمز مخزّن مشفّراً، ويأخذ جلسة تنتهي بعد 12 ساعة. عشر محاولات خاطئة في عشر دقائق تقفل الدخول عشر دقائق.
- الدوال لا تحذف أي بيانات: الجلسة المنتهية تُعلَّم منتهية، والطلبات القديمة تبقى ولا تظهر في الكاشير بعد يومها. لا يقبل أكثر من 60 طلباً في خمس دقائق.
- قاعدة البيانات الحالية: مشروع Supabase `wajha-menus` (rnmpoampazbcxijcbcfl).

## الاختبار

يحتاج Postgres محلياً (وفيه الدورين `anon` و`authenticated` والمخطط `extensions`)، و`npm i pg playwright`:

```
psql -f dijla-backend/schema.sql && psql -f dijla-backend/seed.sql && psql -c "select dijla_set_pin('2468')"
node dijla-backend/test/server.cjs "$PWD/docs" 8090 &
node dijla-backend/test/e2e.cjs /tmp cloud   # هاتف زبون وجهاز كاشير منفصلان
node dijla-backend/test/e2e.cjs /tmp local   # التجربة على جهاز واحد
```
