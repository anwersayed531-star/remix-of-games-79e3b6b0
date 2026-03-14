

# إصلاح 3 مشاكل: الكاميرا + WiFi Direct + فشل الاتصال

## المشاكل المكتشفة

### 1. ماسح QR صغير جداً
`qrbox: { width: 220, height: 220 }` — المربع صغير والكود لازم يكون جواه بالظبط. الحل: تكبير منطقة المسح لتغطي معظم الكاميرا.

### 2. WiFi Direct
الكود الأصلي (Java) يبدو سليم. لكن `requestDeviceInfo()` يحتاج API 29+. هنضيف fallback. وهنتأكد إن الـ status notifications شغالة صح.

### 3. فشل الاتصال بالكود (المشكلة الأساسية)
**السبب**: `RTC_CONFIG_LOCAL` فيه `iceServers: []` — يعني مفيش STUN server. على أندرويد كثير من الأجهزة مش بتلاقي host candidates بدون STUN. كمان `extractEssentials` بيجيب candidate واحد بس من نوع `host`، لو مفيش بيبقى فاضي والاتصال بيفشل.

**الحل**:
- إضافة STUN servers لـ `RTC_CONFIG_LOCAL`
- جمع كل الـ candidates مش واحد بس
- زيادة timeout الـ ICE gathering لـ 10 ثواني
- إضافة retry logic عند الفشل

## التغييرات

### `src/components/QRCodeScanner.tsx`
- تكبير `qrbox` ليكون 85% من عرض الحاوية (بدل 220px ثابت)
- إزالة المربع الصغير المقيد

### `src/lib/sdpUtils.ts`
- تغيير `RTC_CONFIG_LOCAL` ليشمل STUN servers (Google)
- تعديل `extractEssentials` لجمع كل candidates (host + srflx + relay)
- تعديل `reconstructSDP` لإضافة كل الـ candidates
- زيادة `iceCandidatePoolSize` لـ 5

### `src/hooks/useP2PHost.ts`
- زيادة ICE timeout من 5000 لـ 10000
- إضافة `icecandidate` event listener للتأكد من وجود candidates قبل إنشاء الكود

### `src/hooks/useP2PGuest.ts`
- نفس التعديلات: زيادة timeout + التحقق من candidates

### `android-plugins/WifiDirectPlugin.java`
- إضافة fallback لـ `getDeviceName` للأجهزة الأقدم من API 29
- إضافة `try-catch` أفضل حول `requestDeviceInfo`

