

# تحديث GitHub Actions Workflow + التأكد من بناء APK بآخر كود

## المشكلة
التحذيرات في GitHub Actions هي فقط تنبيهات عن إصدار Node.js 20 — لا تؤثر على البناء حالياً. لكن السبب الأرجح إن الـ APK اتبنى من كود قديم قبل التعديلات.

## الحل

### 1. تحديث إصدارات Actions في `.github/workflows/main.yml`
- `actions/checkout@v4` → لا يحتاج تغيير (سيدعم Node 24 تلقائياً)
- إضافة `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` في environment للتخلص من التحذيرات
- التأكد إن الـ workflow يشتغل على `workflow_dispatch` عشان تقدر تشغله يدوي

### 2. إضافة خطوة تحقق من الكود
- إضافة خطوة `git log --oneline -5` بعد الـ checkout للتأكد إن آخر commit موجود

### التغييرات
- ملف واحد: `.github/workflows/main.yml` — إضافة env variable + خطوة تحقق

