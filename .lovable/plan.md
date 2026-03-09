

# إصلاح خطأ "WifiDirect plugin is not implemented on android"

## المشكلة
الخطوة `npx cap sync android` في سير العمل تعمل **بعد** تسجيل البلاجن، مما يعني أن `cap sync` قد يعيد كتابة `MainActivity.java` ويمسح التعديلات التي أضافها سكريبت التسجيل.

## الحل
تغيير واحد في `.github/workflows/main.yml`:

### 1. نقل خطوة تسجيل البلاجن لتكون **بعد** `cap sync`
الترتيب الحالي (خطأ):
```
cap add android → register-plugin → cap sync → build
```

الترتيب الصحيح:
```
cap add android → cap sync → register-plugin → build
```

هذا يضمن أن التعديلات على `MainActivity.java` ونسخ ملف البلاجن تبقى محفوظة ولا يتم الكتابة فوقها.

### 2. إضافة خطوة تحقق (debug)
إضافة خطوة تطبع محتوى `MainActivity.java` بعد التسجيل للتأكد أن البلاجن مسجل فعلاً، وتتحقق من وجود ملف الجافا في المكان الصحيح.

