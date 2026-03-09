

# إصلاح مشكلة الأذونات في WiFi Direct

## المشكلة الأساسية
البلاجن يُعلن عن الأذونات في الكود (`@Permission`) لكن **لا يطلبها من المستخدم أبداً في وقت التشغيل (Runtime)**. على أندرويد 6+ الأذونات الخطيرة (الموقع، الأجهزة القريبة) يجب طلبها من المستخدم بنافذة منبثقة قبل استخدامها.

## التغييرات المطلوبة

### 1. إضافة دوال طلب الأذونات في البلاجن الجافا (`WifiDirectPlugin.java`)
- إضافة method `checkPermissions` و `requestPermissions` باستخدام نظام Capacitor المدمج
- في دوال `createGroup` و `discover` — التحقق من الأذونات أولاً وطلبها إن لم تكن ممنوحة قبل تنفيذ أي عملية WiFi Direct
- إضافة `@PermissionCallback` لمعالجة نتيجة طلب الإذن وإكمال العملية أو رفضها

### 2. تحديث TypeScript Plugin interface (`WifiDirectPlugin.ts`)
- إضافة `checkPermissions()` و `requestPermissions()` للواجهة

### 3. تحديث `useWifiDirect.ts` لطلب الأذونات تلقائياً
- قبل `createGroup` أو `discover`، استدعاء `requestPermissions()` أولاً
- عرض رسالة خطأ واضحة بالعربي إذا رفض المستخدم الأذونات

### 4. إضافة إذن `ACCESS_COARSE_LOCATION` في سكريبت البناء (`register-plugin.cjs`)
- إضافته لقائمة الأذونات في `AndroidManifest.xml` (مطلوب على بعض إصدارات أندرويد)

## التفاصيل التقنية

في الجافا، الدوال الجديدة ستستخدم نظام Capacitor المدمج:
```java
@PluginMethod
public void checkPermissions(PluginCall call) {
    // يستخدم super.checkPermissions(call) المدمج في Capacitor
}

@PluginMethod  
public void requestPermissions(PluginCall call) {
    // يستخدم super.requestAllPermissions(call, "permissionCallback")
}

@PermissionCallback
private void permissionCallback(PluginCall call) {
    // يتحقق من النتيجة ويكمل أو يرفض
}
```

في TypeScript قبل كل عملية:
```typescript
const createGroup = async () => {
    await WifiDirect.requestPermissions(); // يطلب الإذن أولاً
    await WifiDirect.createGroup();
};
```

