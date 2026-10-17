/* منيو مطعم دجلة — نموذج عرض.
   الأصناف والأسعار تجريبية. هذا الملف هو المصدر الوحيد للأصناف:
   منه تُبنى صفحة الزبون وصفحة الكاشير، ومنه يُولَّد جدول الأصناف في قاعدة البيانات
   (node dijla-backend/seed.cjs). أي تعديل هنا يحتاج إعادة توليد الجدول. */
window.DIJLA_MENU = {
  currency: 'د.ع',
  tables: 20,
  categories: [
    { id: 'house', name: 'أطباق دجلة', note: 'أطباق البيت التي يُعرف بها المطعم' },
    { id: 'grill', name: 'المشويات', note: 'على الفحم، تُقدَّم مع الخبز والسلطة' },
    { id: 'starters', name: 'المقبلات والشوربة' },
    { id: 'sweets', name: 'الحلويات' },
    { id: 'drinks', name: 'المشروبات' }
  ],
  items: [
    { id: 'masgouf', cat: 'house', name: 'سمك مسگوف', desc: 'شبوط مشقوق ومشوي على الحطب، مع الطماطم والبصل والعمبة والخبز الحار.', price: 25000, unit: 'الكيلو', tag: 'الأشهر' },
    { id: 'quzi', cat: 'house', name: 'قوزي على تمن', desc: 'لحم غنم مطبوخ ببطء على تمن بالكرزات واللوز والزبيب.', price: 18000 },
    { id: 'dolma', cat: 'house', name: 'دولمة عراقية', desc: 'ورق عنب وبصل وباذنجان وفلفل محشوة بالرز واللحم، مطبوخة على أضلاع.', price: 12000 },
    { id: 'tashreeb', cat: 'house', name: 'تشريب لحم', desc: 'خبز مشرب بمرق اللحم والحمص واللومي.', price: 10000 },
    { id: 'biryani', cat: 'house', name: 'برياني عراقي', desc: 'رز بالبهارات مع الدجاج والشعرية والبطاطا والكرزات.', price: 9000 },

    { id: 'kebab', cat: 'grill', name: 'كباب عراقي', desc: 'ثلاثة أسياخ كباب لحم مع طماطم وبصل مشوي.', price: 9000 },
    { id: 'tikka-lahm', cat: 'grill', name: 'تكة لحم', desc: 'قطع لحم متبّلة على السيخ.', price: 11000 },
    { id: 'tikka-dajaj', cat: 'grill', name: 'تكة دجاج', desc: 'صدر دجاج متبّل باللبن والليمون.', price: 8000 },
    { id: 'half-chicken', cat: 'grill', name: 'نص دجاجة مشوية', desc: 'مع ثوم وبطاطا مقلية.', price: 9000 },
    { id: 'mix-grill', cat: 'grill', name: 'مشكل مشاوي', desc: 'كباب وتكة لحم وتكة دجاج، يكفي شخصين.', price: 22000, tag: 'لشخصين' },

    { id: 'kubba-mosul', cat: 'starters', name: 'كبة موصلية', desc: 'قرص كبة برغل رقيق محشو باللحم المفروم، على الطريقة الموصلية.', price: 6000, tag: 'موصلية' },
    { id: 'kubba-halab', cat: 'starters', name: 'كبة حلب', desc: 'كبة رز مقلية محشوة باللحم والبصل، أربع قطع.', price: 5000 },
    { id: 'adas', cat: 'starters', name: 'شوربة عدس', desc: 'مع الليمون والخبز المحمص.', price: 2500 },
    { id: 'hummus', cat: 'starters', name: 'حمص بالطحينة', desc: 'بزيت الزيتون والكمون.', price: 3000 },
    { id: 'mutabbal', cat: 'starters', name: 'متبل باذنجان', desc: 'باذنجان مشوي بالطحينة والثوم.', price: 3000 },
    { id: 'tabbouleh', cat: 'starters', name: 'تبولة', desc: 'بقدونس وبرغل وطماطم بالليمون.', price: 3500 },
    { id: 'fattoush', cat: 'starters', name: 'فتوش', desc: 'خضار طازجة وخبز محمص بالسماق.', price: 3500 },

    { id: 'mann-alsama', cat: 'sweets', name: 'من السما', desc: 'حلوى موصلية بالهيل والجوز.', price: 4000, tag: 'موصلية' },
    { id: 'kunafa', cat: 'sweets', name: 'كنافة', desc: 'بالجبن، تُقدَّم ساخنة.', price: 4000 },
    { id: 'zunud', cat: 'sweets', name: 'زنود الست', desc: 'ثلاث قطع محشوة بالقيمر.', price: 4000 },
    { id: 'muhallabi', cat: 'sweets', name: 'محلبي', desc: 'بماء الورد والفستق.', price: 2500 },

    { id: 'chai', cat: 'drinks', name: 'شاي عراقي', desc: 'استكان، بالهيل.', price: 500 },
    { id: 'laban', cat: 'drinks', name: 'لبن', desc: 'بارد.', price: 1000 },
    { id: 'orange', cat: 'drinks', name: 'عصير برتقال', desc: 'طبيعي.', price: 3000 },
    { id: 'lemon-mint', cat: 'drinks', name: 'ليمون بالنعناع', desc: '', price: 3000 },
    { id: 'soda', cat: 'drinks', name: 'مشروب غازي', desc: '', price: 1000 },
    { id: 'water', cat: 'drinks', name: 'ماء', desc: 'قنينة صغيرة.', price: 500 }
  ]
};
