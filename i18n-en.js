/* English layer for the legacy modules (CMM / Warehouse).
   When rostampour-lang = 'en', Persian UI text is translated in place (text nodes, placeholders, titles),
   including text added later (toasts, modals, tables). User data is not translated. */
(function () {
  var D = {
    'سامانه جامع مدیریت نگهداری و تعمیرات ایستگاه توزیع آب پارس':'Pars Water Distribution Station — Maintenance Management System',
    'مدیریت نگهداری و تعمیرات':'Maintenance Management','ایستگاه توزیع آب پارس':'Pars Water Distribution Station',
    'ورود به سامانه':'Sign in','نام کاربری':'Username','رمز عبور':'Password','ورود سریع':'Quick sign-in','خروج از سامانه':'Sign out',
    'اصلی':'Main','داشبورد':'Dashboard','عملیات':'Operations','تجهیزات':'Equipment','بازدید دوره‌ای':'Periodic inspections','تعمیرات':'Repairs',
    'پایش عملیاتی روزانه':'Daily operational monitoring','سطح مخازن':'Tank levels','تولید کارخانه‌ها':'Plant production','پمپاژ و بارگیری':'Pumping & loading',
    'گزارش‌ها':'Reports','حالت اتاق کنترل (نمایش تمام‌صفحه)':'Control-room mode (full screen)','خروج از حالت اتاق کنترل':'Exit control-room mode','کنترل و شبیه‌ساز':'Controls & simulator','سناریوهای رویداد':'Event scenarios','حذف سناریو':'Clear scenario','وضعیت، هشدار و پیش‌بینی':'Status, alerts & forecast','پیشنهاد چیدمان پمپ‌ها (۲۴ ساعت آینده)':'Pump arrangement suggestion (next 24 h)','تراز جرمی (تولید − پمپاژ − بارگیری)':'Mass balance (production − pumping − loading)','خودکار (از سابقه)':'Auto (from history)','دستی':'Manual','PFD (نقشه زنده)':'PFD (live map)','PFD · نقشه زنده ایستگاه':'PFD · Live station map','کارخانه‌ها، مخزن ایستگاه، پمپاژ GRP/PE، مخازن ۱۵۰۰۰ و ۲۰۰۰۰ و بارگیری تانکر با شبیه‌ساز سناریو':'Plants, station tank, GRP/PE pumping, 15,000 and 20,000 tanks and tanker loading with a what-if simulator','PFD · نقشه یکپارچه ایستگاه':'PFD · Integrated station map','وضعیت و سناریو':'Status & scenario','شروع بارگیری تانکر':'Start tanker loading','پایان بارگیری':'Stop loading','همگام‌سازی با آخرین ثبت‌ها':'Sync with latest records','منبع داده‌ها':'Data sources','مخزن ایستگاه':'Station tank','مخزن ۱۵۰۰۰':'15,000 tank','مخزن ۲۰۰۰۰':'20,000 tank','پمپاژ اصلی':'Main pumping','شیر باز / تجهیز در مدار':'Valve open / equipment on','شیر بسته / خارج از مدار':'Valve closed / equipment off','جریان فعال':'Active flow','گزارش سالانه':'Annual report','لاگ فعالیت':'Activity log','داده‌ها به‌صورت آنلاین ذخیره می‌شود':'Data is stored online',
    'وضعیت کلی تجهیزات ایستگاه، بازدیدهای دوره‌ای و تعمیرات':'Overall status of station equipment, inspections and repairs',
    'تعداد کل تجهیزات':'Total equipment','بازدیدهای معوق':'Overdue inspections','نیاز به رسیدگی فوری':'Needs immediate attention','تعمیرات باز':'Open repairs','در حال انجام':'In progress',
    'تعمیرات این ماه':'Repairs this month','سال جاری (شمسی)':'Current year (Jalali)','نرخ انطباق بازدیدهای دوره‌ای':'Inspection compliance rate',
    'میانگین انطباق بازدید دوره‌ای':'Average inspection compliance','به‌روز':'On time','نزدیک موعد':'Due soon','معوق':'Overdue',
    'تجهیزات بر اساس دسته':'Equipment by category','پراکندگی انواع تجهیزات':'Distribution of equipment types','روند تعمیرات ماهانه':'Monthly repairs trend',
    'نزدیک‌ترین بازدیدهای موعددار':'Nearest scheduled inspections','۵ مورد فوری':'Top 5 urgent','سطح لحظه‌ای مخازن آب':'Live water tank levels',
    'آخرین حجم و درصد پر بودن ثبت‌شده هر مخزن':'Latest volume and fill % of each tank','روند پمپاژ اصلی و بارگیری تانکر':'Main pumping & tanker loading trend','۱۴ روز اخیر (m³)':'Last 14 days (m³)',
    'همه دسته‌ها':'All categories','خروجی اکسل':'Excel export','افزودن تجهیز':'Add equipment','دسته':'Category','نام تجهیز':'Equipment name','شماره سریال / پلاک':'Serial / tag no.',
    'محل نصب':'Install location','تاریخ نصب':'Install date','همه وضعیت‌ها':'All statuses','تعریف بازدید دوره‌ای':'Define periodic inspection','وضعیت':'Status','تجهیز':'Equipment',
    'عنوان بازدید':'Inspection title','دوره تناوب':'Interval','آخرین انجام':'Last done','موعد بعدی':'Next due','باز':'Open','بسته‌شده':'Closed','ثبت تعمیر':'Log repair','تاریخ':'Date',
    'شرح مشکل':'Issue description','اقدام انجام‌شده':'Action taken','تکنسین':'Technician','پیوست‌ها':'Attachments','ثبت قرائت جدید':'New reading','تاریخ و ساعت':'Date & time',
    'مخزن':'Tank','حجم (m³)':'Volume (m³)','درصد پر بودن':'Fill %','گزارش روند سطح مخازن':'Tank level trend report','نمودار خطی و جدول بر اساس تاریخ شمسی':'Line chart and table by Jalali date',
    'ماهانه':'Monthly','سالانه':'Yearly','دریافت اکسل':'Download Excel','درصد':'Percent','ثبت تولید روزانه':'Log daily production','کارخانه':'Plant','حجم تولید (m³)':'Production volume (m³)',
    'گزارش تولید کارخانه‌ها':'Plant production report','تاریخ / ماه':'Date / month','مجموع (m³)':'Total (m³)','ثبت مقدار روزانه':'Log daily value','نوع':'Type',
    'گزارش پمپاژ اصلی و بارگیری تانکر':'Main pumping & tanker loading report','پمپاژ اصلی (m³)':'Main pumping (m³)','بارگیری تانکر (m³)':'Tanker loading (m³)',
    'گزارش سالانه تعمیرات':'Annual repairs report','سال گزارش':'Report year','دریافت گزارش PDF':'Download PDF report','دریافت گزارش اکسل':'Download Excel report',
    'پیش‌نمایش خلاصه سال انتخاب‌شده':'Selected year summary preview','اقدام':'Action','متریال مصرفی':'Materials used','همه نقش‌ها':'All roles','مدیر':'Admin','مسئول فنی':'Technical officer',
    'دریافت اکسل لاگ':'Download log (Excel)','نقش':'Role','جزئیات':'Details','طراحی و توسعه‌دهنده:':'Designed & developed by:','محمدرضا رستم‌پور':'Mohammadreza Rostampour',
    'افزودن':'Add','ذخیره':'Save','انصراف':'Cancel','تغییر تم':'Toggle theme','بروزرسانی':'Refresh','جستجو':'Search','ویرایش':'Edit','حذف':'Delete','بستن':'Close','تأیید عملیات':'Confirm action',
    'پمپ':'Pump','کمپرسور':'Compressor','دیزل ژنراتور':'Diesel generator','جرثقیل سقفی':'Overhead crane','الکتروموتور':'Electric motor','شیرآلات':'Valves','اکچویتور پنوماتیکی':'Pneumatic actuator',
    'لوله':'Pipe','خط انتقال':'Transmission line','فلومتر':'Flow meter','منهول':'Manhole','ابزاردقیق':'Instrumentation','برق':'Electrical','سایر':'Other','روزانه':'Daily','هفتگی':'Weekly',
    'فصلی (۳ ماه)':'Quarterly (3 months)','شش‌ماهه':'Semi-annual','فروردین':'Farvardin','اردیبهشت':'Ordibehesht','خرداد':'Khordad','تیر':'Tir','مرداد':'Mordad','شهریور':'Shahrivar',
    'مهر':'Mehr','آبان':'Aban','آذر':'Azar','دی':'Dey','بهمن':'Bahman','اسفند':'Esfand','مخزن ۲۰۰۰۰':'Tank 20000','مخزن ۱۵۰۰۰':'Tank 15000','کارخانه نورویژه':'Norouzeh plant','کارخانه بناب':'Bonab plant',
    'نورویژه':'Norouzeh','بناب':'Bonab','پمپاژ اصلی':'Main pumping','بارگیری تانکر':'Tanker loading','سطح مخازن آب':'Water tank levels','تعمیرات (CM)':'Repairs (CM)','بازدید دوره‌ای (PM)':'Periodic inspections (PM)',
    'برنامه‌ریزی و پایش بازدیدهای پیشگیرانه تجهیزات':'Planning and monitoring preventive equipment inspections','ثبت و پیگیری تعمیرات اصلاحی تجهیزات':'Log and follow up corrective repairs',
    'ثبت قرائت لحظه‌ای سطح مخازن و گزارش روند حجم ذخیره':'Log tank level readings and storage volume trend','تولید کارخانه‌های آب‌شیرین‌کن':'Desalination plants production',
    'ثبت حجم تولید روزانه کارخانه نورویژه و کارخانه بناب':'Log daily production of Norouzeh and Bonab plants','ثبت حجم روزانه پمپاژ اصلی و بارگیری تانکر':'Log daily main pumping and tanker loading volumes',
    'لاگ فعالیت کاربران':'User activity log','تاریخچه ورود، ثبت و ویرایش توسط مدیر و مسئول فنی':'History of sign-ins, entries and edits',
    'ثبت انجام امروز':'Mark done today','ثبت انجام بازدید':'Record inspection','ثبت بازدید دوره‌ای':'Save inspection','یادداشت':'Notes','روز':'days','دوره تناوب (روز)':'Interval (days)',
    'ثبت تعمیر جدید':'New repair record','ویرایش رکورد تعمیر':'Edit repair record','نام تکنسین':'Technician name','نام متریال':'Material name','مقدار':'Quantity','عدد':'pcs','متر':'m','کیلوگرم':'kg','لیتر':'L','ست':'set','بسته':'pack',
    'ثبت قرائت مخزن':'Save tank reading','ساعت قرائت':'Reading time','تاریخ (شمسی)':'Date (Jalali)','گزارش مخازن':'Tank report','بدون قرائت':'No reading','گزارش':'Report',
    'ویرایش تجهیز':'Edit equipment','افزودن تجهیز جدید':'Add new equipment','دسته‌بندی':'Category','تاریخ نصب (شمسی)':'Install date (Jalali)','مشاهده و کد QR':'View & QR code','جزئیات تجهیز و کد QR':'Equipment details & QR code',
    'تاریخ وقوع (شمسی)':'Date of occurrence (Jalali)','نام کاربری یا رمز عبور اشتباه است.':'Wrong username or password.','مهمان':'Guest',
    'تعداد کل تعمیرات':'Total repairs','تعمیرات بسته‌شده':'Closed repairs','تعداد اقلام متریال مصرفی':'Material items used','خلاصه':'Summary','جزئیات تعمیرات':'Repair details','شاخص':'Metric','دسته تجهیز':'Equipment category','تعداد تعمیرات':'Number of repairs',
    'گزارش سالانه تعمیرات - سال':'Annual repairs report — year','تاریخ تولید گزارش':'Report generated on','در حال تولید فایل PDF...':'Generating PDF...','فایل PDF با موفقیت دانلود شد.':'PDF downloaded.','فایل اکسل با موفقیت دانلود شد.':'Excel file downloaded.',
    'خطا در تولید PDF. دوباره تلاش کنید.':'PDF generation failed. Try again.','خطا در تولید فایل اکسل.':'Excel generation failed.','حافظه آنلاین مشترک واقعی (Firebase) - همه کاربران به‌روز':'Real shared online storage (Firebase) — everyone is up to date',
    'اتصال به حافظه آنلاین برقرار نشد':'Could not connect to online storage','در حال اتصال به حافظه مشترک...':'Connecting to shared storage...','اطلاعات به‌روزرسانی شد':'Data updated',
    'خطا در ذخیره‌سازی؛ اتصال اینترنت را بررسی کنید':'Save failed — check your connection','خطا در ذخیره‌سازی؛ اتصال اینترنت را بررسی کنید و دوباره تلاش کنید':'Save failed — check your connection and try again',
    'خطا در به‌روزرسانی؛ اتصال اینترنت را بررسی کنید':'Update failed — check your connection','خطا در حذف؛ اتصال اینترنت را بررسی کنید':'Delete failed — check your connection',
    'تجهیز جدید ثبت شد':'Equipment added','تجهیز به‌روزرسانی شد':'Equipment updated','تجهیز حذف شد':'Equipment deleted','بازدید حذف شد':'Inspection deleted','بازدید به‌روزرسانی شد':'Inspection updated','بازدید دوره‌ای ثبت شد':'Inspection saved',
    'تعمیر جدید ثبت شد':'Repair logged','رکورد تعمیر به‌روزرسانی شد':'Repair updated','رکورد تعمیر حذف شد':'Repair deleted','قرائت جدید ثبت شد':'Reading saved','قرائت به‌روزرسانی شد':'Reading updated','قرائت حذف شد':'Reading deleted',
    'تولید روزانه ثبت شد':'Daily production saved','رکورد حذف شد':'Record deleted','رکورد به‌روزرسانی شد':'Record updated','مقدار روزانه ثبت شد':'Daily value saved','ابتدا یک تجهیز اضافه کنید':'Add equipment first',
    'این تجهیز و ارجاعات آن حذف می‌شود. ادامه می‌دهید؟':'This equipment and its references will be deleted. Continue?','این بازدید دوره‌ای حذف شود؟':'Delete this inspection?','این رکورد تعمیر حذف شود؟':'Delete this repair record?','این قرائت حذف شود؟':'Delete this reading?','این رکورد حذف شود؟':'Delete this record?',
    'لطفاً «شرح مشکل» را تکمیل کنید':'Please fill in the issue description','هنوز بازدید دوره‌ای تعریف نشده است.':'No inspections defined yet.','تجهیزی یافت نشد':'No equipment found','تعمیری ثبت نشده است':'No repairs logged','بازدیدی یافت نشد':'No inspections found',
    'قرائتی ثبت نشده است':'No readings','لاگی ثبت نشده است':'No log entries','موردی ثبت نشده':'No entries','هنوز ثبت نشده':'Not recorded yet','ثبت شده (m³)':'Recorded (m³)','تولید امروز':'Today\'s production',
    'سامانه انبارداری قطعات صنعتی':'Industrial Spare-Parts Warehouse System','انبار قطعات پارس':'Pars Parts Warehouse','همگام‌سازی شده':'Synced','لیست قطعات و موجودی':'Parts & stock list','ثبت ورود / خروج':'Stock in / out',
    'کاردکس قطعه':'Part ledger','کاردکس':'Ledger','لاگ فعالیت‌ها':'Activity log','اتمام موجودی':'Out of stock','بیش از حداکثر':'Above maximum','نرمال':'Normal','موجودی کم (زیر':'Low stock (below',
    'داشبورد مدیریتی انبار قطعات':'Warehouse management dashboard','همه قطعات موجودی کافی دارند':'All parts are sufficiently stocked','لیست قطعات و موجودی انبار':'Warehouse parts & stock list',
    'جستجو بر اساس نام یا مشخصات فنی قطعه...':'Search by part name or specification...','هیچ قطعه‌ای یافت نشد':'No parts found','ویرایش مشخصات':'Edit specs','ویرایش مشخصات قطعه':'Edit part specs','نام قطعه':'Part name','مشخصات فنی':'Specifications',
    'گروه‌بندی':'Group','گروه':'Group','تعداد ماکزیمم':'Maximum quantity','توضیحات':'Notes','موجودی فعلی':'Current stock','لیست قطعات':'Parts list','حذف قطعه':'Delete part','قطعه حذف شد':'Part deleted',
    'ثبت ورود و خروج قطعه':'Log part in / out','ورودی':'In','خروجی':'Out','ثبت ورودی قطعه جدید':'Add new part (stock in)','افزایش موجودی قطعه موجود':'Increase stock of existing part','ثبت ورودی قطعه':'Save stock in','ثبت خروج قطعه':'Log stock out',
    'انتخاب قطعه':'Select part','تعداد':'Quantity','تعداد ورودی':'Quantity in','محل مصرف':'Place of use','نام خارج‌کننده':'Taken by','ثبت‌کننده':'Logged by','ورود قطعه':'Part in','خروج قطعه':'Part out',
    'گزارش ماهانه':'Monthly report','تراکنشی در این بازه ثبت نشده است':'No transactions in this period','در حال حاضر کسری موجودی وجود ندارد':'No stock shortages at the moment','هیچ رویدادی ثبت نشده است':'No events recorded',
    'مدیر سامانه':'System admin','انباردار':'Storekeeper','مکانیک':'Mechanic','نام قطعه الزامی است':'Part name is required','تعداد باید بزرگتر از صفر باشد':'Quantity must be greater than zero','ابتدا یک قطعه ثبت کنید':'Add a part first',
    'ورودی قطعه با موفقیت ثبت شد':'Stock in saved','خروج قطعه با موفقیت ثبت شد':'Stock out saved','مشخصات قطعه ذخیره شد':'Part specs saved','نام خارج‌کننده الزامی است':'“Taken by” is required','قطعه جدید و ورودی آن با موفقیت ثبت شد':'New part and stock-in saved',
    'در حال ذخیره...':'Saving...','خطا در اتصال':'Connection error','تاریخ باید معتبر باشد':'Date must be valid',
    'ریال':'IRR','هزینه:':'Cost:','تا':'to','از':'from','در':'in','سال':'Year','ماه':'Month','تعداد رکورد تعمیرات ثبت‌شده در سال جاری':'Repair records logged this year','پیوست':'attachment'
  };
  var EXTRA = {
    'فهرست پمپ، کمپرسور، دیزل ژنراتور، جرثقیل سقفی، الکتروموتور، شیرآلات و اکچویتور':'Register of pumps, compressors, diesel generators, overhead cranes, electric motors, valves and actuators',
    'جستجوی نام، شماره سریال یا محل نصب...':'Search name, serial number or location...',
    'جستجو بر اساس نام تجهیز یا عنوان بازدید...':'Search by equipment name or inspection title...',
    'جستجو در شرح مشکل، تجهیز یا تکنسین...':'Search issue, equipment or technician...',
    'جستجو در عملیات یا نام کاربری...':'Search action or username...',
    'این سامانه از فضای ذخیره‌سازی مشترک آنلاین استفاده می‌کند؛ هر کاربری که به این لینک دسترسی داشته باشد می‌تواند اطلاعات را مشاهده و ثبت کند و همه تغییرات برای همه کاربران به‌روزرسانی می‌شود.':'This system uses shared online storage; every user with access can view and enter data and all changes update for everyone.',
    'این سامانه به یک پایگاه‌داده آنلاین واقعی (Firebase Firestore) متصل است؛ هر کاربری با هر مرورگری از هر دستگاهی وارد شود، آخرین اطلاعات را می‌بیند و تغییرات به‌صورت آنی و زنده برای همه به‌روزرسانی می‌شود. تصاویر تعمیرات نیز در Firebase Storage با ظرفیت بالا نگهداری می‌شوند.':'This system is connected to a real online database (Firebase Firestore); any user on any device sees the latest data and changes update live for everyone. Repair photos are also kept in Firebase Storage.',
    'پمپ سیرکولاسیون آب خنک‌کننده':'Cooling water circulation pump',
    'دسترسی: مدیر سامانه':'Access: System admin','دسترسی: مسئول فنی':'Access: Technical officer','دسترسی: مهمان (فقط مشاهده)':'Access: Guest (view only)',
    'در حال تولید فایل PDF...':'Generating PDF...','تحلیل و آمار جامع':'Analytics & statistics','درصد بازدیدهایی که خارج از موعد نیستند':'Share of inspections that are not overdue','بازدید / ورود سالانه سامانه':'Annual system visits','پراکندگی انواع تجهیزات':'Distribution of equipment types','هزینه: ۰ ریال':'Cost: 0',
    'آخرین تاریخ انجام (شمسی)':'Last done date (Jalali)','افزودن ردیف متریال':'Add material row','انتخاب سال و دریافت فایل PDF شامل خلاصه و جزئیات تعمیرات':'Choose a year and download a PDF with the repair summary and details',
    'بارگیری تانکر امروز':'Tanker loading today','بناب (m³)':'Bonab (m³)','نورویژه (m³)':'Norouzeh (m³)','تصاویر به‌صورت خودکار فشرده می‌شوند. حجم کل پیوست‌ها را متعادل نگه دارید.':'Images are compressed automatically. Keep the total attachment size moderate.',
    'تعریف بازدید دوره‌ای جدید':'Define new periodic inspection','تولید امروز - کارخانه بناب':"Today's production — Bonab plant",'تولید امروز - کارخانه نورویژه':"Today's production — Norouzeh plant",
    'ثبت قرائت جدید مخزن':'New tank reading','خروجی PDF گزارش سالانه تعمیرات جهت آرشیو و ارائه':'PDF export of the annual repairs report for archive and presentation','عکس':'Photos','لیست متریال مصرفی':'Materials used list','متریال':'Materials',
    'هنوز متریالی اضافه نشده است':'No materials added yet','ورود به عنوان مهمان (فقط مشاهده)':'Continue as guest (view only)','پمپاژ اصلی امروز':'Main pumping today','پیوست عکس':'Attach photos','ظرفیت':'capacity','پمپاژ اصلی و بارگیری تانکر':'Main pumping & tanker loading','آخرین ثبت':'Last entry',
    '۰ تا ۳۰٪ (بحرانی)':'0–30% (critical)','۳۱ تا ۶۰٪ (متوسط)':'31–60% (medium)','۶۱ تا ۱۰۰٪ (مطلوب)':'61–100% (good)','طراحی و توسعه‌دهنده: محمدرضا رستم‌پور':'Designed & developed by: Mohammadreza Rostampour',
    'اختیاری':'Optional','تاریخچه کامل گردش هر قطعه':'Full movement history of each part','تعداد کل قطعات ثبت‌شده':'Total registered parts','ثبت خروج':'Log stock out','ثبت ورودی قطعه جدید یا موجود، و ثبت خروج از انبار':'Log stock in of new or existing parts, and stock out',
    'دسترسی مشاهده‌گر: با دکمه بالا یا با وارد کردن هر نام کاربری دلخواه (بدون رمز عبور)، صرفاً جهت مشاهده و جستجوی لیست قطعات و موجودی.':'Viewer access: use the button above or enter any username (no password) — view and search parts and stock only.',
    'رمز عبور (برای مهمان خالی بگذارید)':'Password (leave empty for guest)','قطعات دارای موجودی صفر':'Parts with zero stock','مثلاً: ایستگاه پمپاژ نوروزه':'e.g. Norouzeh pumping station','مجموع تعداد کل موجودی انبار':'Total warehouse stock quantity',
    'نام فرد دریافت‌کننده قطعه':'Name of the person receiving the part','نام کاربری خود را وارد کنید':'Enter your username','همه گروه‌ها':'All groups','هنوز تراکنشی ثبت نشده است':'No transactions yet','هیچ قطعه‌ای ثبت نشده':'No parts registered',
    'گزارش لحظه‌ای کسری موجودی و نیاز به تامین':'Live stock shortage & supply need report','گزارش ماهانه ورود و خروج قطعات':'Monthly parts in/out report','گزارش ماهانه گردش قطعات و گزارش کسری موجودی':'Monthly parts movement and stock shortage reports',
    '— انتخاب کنید —':'— Select —','⬇️ نصب برنامه':'⬇️ Install app','⬇️ نصب برنامه روی دستگاه':'⬇️ Install app on this device','🆕 ثبت ورودی قطعه جدید':'🆕 Add new part (stock in)','🌓 حالت روشن/تیره':'🌓 Light / dark mode',
    '👁️ ورود به‌عنوان مهمان (فقط مشاهده)':'👁️ Continue as guest (view only)','📤 ثبت خروج قطعه':'📤 Log stock out','📥 افزایش موجودی قطعه موجود':'📥 Increase stock of existing part','🖨️ چاپ':'🖨️ Print','موجودی کم':'Low stock','زیر':'below','قطعه':'part','قلم':'items','ثبت‌شده':'recorded'
  };
  for (var ek in EXTRA) D[ek] = EXTRA[ek];
  var RULES = [
    [/^در (\d+) دسته تجهیزاتی$/, 'In $1 equipment categories'],
    [/^سال (\d+) \(شمسی\)$/, 'Year $1 (Jalali)'],
    [/^عکس پیوست: (\d+) \| متریال: (\d+)$/, 'Photos: $1 | Materials: $2'],
    [/^(\d+) رویداد ثبت‌شده$/, '$1 events logged'],
    [/^(\d+) مورد$/, '$1 items'],
    [/^گزارش سالانه تعمیرات - سال (\d+)$/, 'Annual repairs report — year $1'],
    [/^ظرفیت (\d+) m³$/, 'capacity $1 m³'],
    [/^آخرین ثبت: (.*)$/, 'Last entry: $1'],
    [/^(\d+) قطعه ثبت‌شده$/, '$1 parts recorded'],
    [/^(\d+) قلم$/, '$1 items'],
    [/^قطعات با موجودی کمتر از (\d+)$/, 'Parts with stock below $1'],
    [/^موجودی کم \(زیر (\d+)\)$/, 'Low stock (below $1)'],
    [/^امروز: (.*?)\s*\|\s*خوش آمدید، مدیر سامانه$/, 'Today: $1  |  Welcome, System admin'],
    [/^(عکس|متریال): (\d+)$/, function (m, a, b) { return (a === 'عکس' ? 'Photos' : 'Materials') + ': ' + b; }]
  ];
  var FA = /[\u0600-\u06FF]/, MAP = '۰۱۲۳۴۵۶۷۸۹';
  var DN = {};
  function norm(s) { return s.replace(/[۰-۹]/g, function (d) { return MAP.indexOf(d); }).replace(/٪/g, '%').replace(/٫/g, '.'); }
  function tr(s) {
    var t = s.trim(); if (!t) return s;
    if (D[t] !== undefined) return s.replace(t, D[t]);
    if (t.slice(-1) === ':' && D[t.slice(0, -1).trim()] !== undefined) return s.replace(t, D[t.slice(0, -1).trim()] + ':');
    if (!FA.test(t)) { return /[۰-۹٪٫]/.test(t) ? s.replace(t, norm(t)) : s; }
    var n = norm(t);
    for (var i = 0; i < RULES.length; i++) { if (RULES[i][0].test(n)) return s.replace(t, n.replace(RULES[i][0], RULES[i][1])); }
    // segment-wise: translate recognised pieces separated by dashes / brackets / bars
    var parts = n.split(/( — | - | \| |\(|\)|، |: )/), changed = false;
    for (var p = 0; p < parts.length; p++) {
      var pc = parts[p].trim(); if (!pc || !FA.test(pc)) continue;
      var hit = D[pc] !== undefined ? D[pc] : DN[pc];
      if (hit === undefined) { for (var r = 0; r < RULES.length; r++) { if (RULES[r][0].test(pc)) { hit = pc.replace(RULES[r][0], RULES[r][1]); break; } } }
      if (hit !== undefined) { parts[p] = parts[p].replace(pc, hit); changed = true; }
    }
    if (changed) return s.replace(t, parts.join(''));
    return s; // user data / unknown text stays untouched (never produce half-translated mixes)
  }
  Object.keys(D).forEach(function (k) { DN[norm(k)] = D[k]; });
  var loadedLang = (function () { try { return localStorage.getItem('rostampour-lang') === 'en' ? 'en' : 'fa'; } catch (e) { return 'fa'; } })();
  function isEn() { try { return localStorage.getItem('rostampour-lang') === 'en'; } catch (e) { return false; } }
  var busy = false;
  function walk(n) {
    if (n.nodeType === 3) { var v = n.nodeValue; if (v && (FA.test(v) || /[۰-۹]/.test(v))) { var r = tr(v); if (r !== v) n.nodeValue = r; } return; }
    if (n.nodeType !== 1) return;
    var tag = n.tagName; if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CANVAS') return;
    ['placeholder', 'title', 'aria-label'].forEach(function (a) { var v = n.getAttribute && n.getAttribute(a); if (v && FA.test(v)) n.setAttribute(a, tr(v)); });
    if (tag === 'INPUT' && n.type === 'button' && n.value && FA.test(n.value)) n.value = tr(n.value);
    for (var c = n.firstChild; c; c = c.nextSibling) walk(c);
  }
  function apply() {
    var en = isEn();
    if (en && typeof window.toFa === 'function') { try { window.toFa = function (v) { return String(v); }; } catch (e) { } }
    document.documentElement.setAttribute('data-lang', en ? 'en' : 'fa');
    document.documentElement.lang = en ? 'en' : 'fa'; document.documentElement.dir = en ? 'ltr' : 'rtl';
    if (en) { busy = true; walk(document.body); busy = false; }
    window.dispatchEvent(new Event('rostampour-lang-changed'));
  }
  var pending = false;
  new MutationObserver(function (muts) {
    if (!isEn() || busy) return;
    busy = true;
    muts.forEach(function (m) { if (m.type === 'childList') m.addedNodes.forEach(walk); else if (m.type === 'characterData') walk(m.target); });
    busy = false;
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.rostampourLang && d.rostampourLang !== loadedLang) { try { localStorage.setItem('rostampour-lang', d.rostampourLang); } catch (x) { } location.reload(); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
  window.RostampourI18n = { tr: tr, apply: apply };
})();
