
# خطة تغيير نظام الاتصال: إزالة QR واستخدام كود نصي قصير

## حقيقة مهمة
WiFi Direct يحتاج native Android code (Java/Kotlin) لا يمكن كتابته من Lovable. لا يوجد Capacitor plugin مستقر لهذه الوظيفة. نفس الشيء لـ Nearby Connections و mDNS.

## البديل العملي الأفضل
**نظام كود غرفة نصي** بدون كاميرا ولا QR:
1. المضيف ينشئ غرفة → يظهر كود على الشاشة مع زر نسخ
2. الضيف يلصق/يكتب الكود → يظهر كود رد مع زر نسخ
3. المضيف يلصق/يكتب كود الرد → متصل!

يعمل بدون إنترنت 100%. الأكواد ستكون ~50-80 حرف (قابلة للنسخ واللصق عبر أي وسيلة: واتساب، بلوتوث، إلخ).

## التغييرات

### 1. ضغط SDP أقصى في `src/lib/sdpUtils.ts`
- استخراج فقط: `ice-ufrag`, `ice-pwd`, `fingerprint`, `candidate` (IP:port)
- تشفير بـ binary + base62 بدلاً من base64 JSON
- تقليل حجم الكود من ~2000 حرف إلى ~60-80 حرف

### 2. إعادة كتابة `src/components/MultiplayerLobby.tsx` بالكامل
- إزالة كل imports الـ QR (QRCodeDisplay, QRCodeScanner)
- واجهة جديدة:
  - زر "إنشاء غرفة" → يعرض كود نصي + زر نسخ
  - زر "انضمام" → حقل إدخال نص + زر لصق
  - الخطوة الثانية: نفس الشيء لكود الرد
- تصميم نظيف بدون كاميرا

### 3. تحديث `src/hooks/useP2PHost.ts` و `useP2PGuest.ts` و `useP2PConnection.ts`
- استخدام دوال الضغط الجديدة بدلاً من `compressSDP`/`decompressSDP`
- استخراج الحد الأدنى من SDP المطلوب للاتصال المحلي

### 4. حذف الملفات غير المطلوبة
- `src/components/QRCodeScanner.tsx` — لم نعد نحتاجه
- `src/components/QRCodeDisplay.tsx` — لم نعد نحتاجه
- إزالة dependencies: `html5-qrcode`, `qrcode.react`

### 5. تحديث صفحات الألعاب
- `ChessGame.tsx`, `XOGame.tsx`, `LudoGame.tsx`, `TournamentPage.tsx`, `LobbyTest.tsx`
- تحديث props المرسلة لـ MultiplayerLobby (إزالة QR-related props)

## تفاصيل ضغط SDP
لاتصال محلي بدون STUN، البيانات المطلوبة فقط:

```text
المطلوب:
- type: offer/answer (1 bit)
- ice-ufrag: ~4 chars
- ice-pwd: ~24 chars  
- fingerprint: 32 bytes (SHA-256)
- candidate IP: 4 bytes
- candidate port: 2 bytes
المجموع: ~70 bytes → base62 ≈ 60-80 حرف
```

هذا أقصر بـ 25x من الكود الحالي ويمكن كتابته يدوياً أو نسخه.
