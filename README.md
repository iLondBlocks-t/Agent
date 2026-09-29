# منسّق الوكلاء — Multi-AI Agent Orchestrator

تطبيق أندرويد (APK) يشغّل **فريقًا من وكلاء الذكاء الاصطناعي** بمفاتيحك الخاصة.
تكتب هدفًا واحدًا، فيقوم **المنسّق** بفهمه، وبناء خطة مهام، وتوزيعها على وكلاء متخصصين
(مخطط، مبرمج، مراجع، DevOps، باحث، مصمم، مختبِر، كاتب، مدير Discord)، ثم ينفّذون المهمة
باستخدام **أدوات حقيقية** (GitHub، Discord، الملفات، الطرفية، الويب) في حدود الصلاحيات التي تمنحها أنت.

> كل شيء يعمل **داخل التطبيق** على هاتفك. لا يوجد خادم وسيط، ولا تُرسل مفاتيحك لأي طرف غير مزوّدها.

---

## المحتويات
1. [أسرع طريقة: بناء APK بدون كمبيوتر](#1-أسرع-طريقة-بناء-apk-بدون-كمبيوتر)
2. [أول تشغيل: إضافة مزوّد وإنشاء الوكلاء](#2-أول-تشغيل)
3. [الحصول على الرموز (GitHub / Discord)](#3-الحصول-على-الرموز)
4. [خادم التنفيذ الاختياري (الطرفية)](#4-خادم-التنفيذ-الاختياري)
5. [البنية المعمارية وشجرة الملفات](#5-البنية-المعمارية)
6. [الأمان والصلاحيات](#6-الأمان-والصلاحيات)
7. [التطوير محليًا](#7-التطوير-محليًا)
8. [حل المشاكل الشائعة](#8-حل-المشاكل-الشائعة)
9. [القرارات الهندسية](#9-القرارات-الهندسية)

---

## 1. أسرع طريقة: بناء APK بدون كمبيوتر

### الخطوة أ — ارفع المشروع إلى GitHub
1. افتح <https://github.com/new> وأنشئ مستودعًا جديدًا (مثلاً `agent-orchestrator`).
2. ارفع كل ملفات هذا المشروع إليه (اسحب وأفلت من واجهة GitHub، أو `git push`).

### الخطوة ب — شغّل عملية البناء
1. من المستودع افتح تبويب **Actions**.
2. اضغط **I understand my workflows, go ahead and enable them** إن ظهرت.
3. اختر **Build Android APK** من القائمة اليمنى ← **Run workflow** ← **Run workflow**.
4. انتظر 5–15 دقيقة.

### الخطوة ج — نزّل الـ APK وثبّته
- من صفحة التشغيل، انزل إلى **Artifacts** ← نزّل `multi-ai-agent-orchestrator-apk`.
- أو من تبويب **Releases** ← أحدث إصدار ← ملف `.apk`.
- على الهاتف: **الإعدادات ← الأمان ← السماح بالتثبيت من مصادر غير معروفة**، ثم افتح الملف.

> **البناء لا يفشل بسبب التوقيع أبدًا.** إن لم تضبط مفاتيح التوقيع، يبني الـ workflow نسخة **debug** قابلة للتثبيت تمامًا.

### (اختياري) بناء نسخة موقّعة للإصدار
أنشئ keystore على أي جهاز فيه Java:
```bash
keytool -genkey -v -keystore release.keystore -alias maao \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.keystore > keystore.b64   # على macOS: base64 -i release.keystore
```
ثم في المستودع: **Settings ← Secrets and variables ← Actions ← New repository secret** وأضف:

| اسم السر | القيمة |
|---|---|
| `KEYSTORE_BASE64` | محتوى ملف `keystore.b64` كاملًا |
| `KEYSTORE_PASSWORD` | كلمة مرور الـ keystore |
| `KEY_ALIAS` | `maao` |
| `KEY_PASSWORD` | كلمة مرور المفتاح |

أعد تشغيل الـ workflow → ستحصل على `app-release.apk` موقّع.

---

## 2. أول تشغيل

1. **المزوّدون** (تبويب المفتاح 🔑) ← **إضافة مزوّد**:
   - اختر النوع (OpenRouter / Gemini / Anthropic / Groq / DeepSeek / Arena / OpenCode / Ollama / OpenAI-compatible مخصص).
   - الصق **مفتاح API**، واختر **النموذج الافتراضي**.
   - اضغط **حفظ** ثم **اختبار الاتصال** (يجب أن تظهر رسالة خضراء)، ثم **النماذج** لجلب قائمة النماذج.
2. **الوكلاء** (تبويب الروبوت 🤖) ← **وكلاء جاهزون** لإنشاء الفريق الكامل بضغطة واحدة.
   - عدّل أي وكيل: النموذج، النموذج الاحتياطي، درجة الحرارة، حد الإنفاق، الصلاحيات، والأدوات المسموحة.
3. **الرئيسية** ← اكتب هدفك في الصندوق المتوهّج، اختر الوضع:
   - **يدوي**: تُوافق على كل استدعاء أداة.
   - **نصف آلي** (موصى به): موافقة على أدوات الكتابة/التعديل فقط.
   - **آلي كامل**: موافقة فقط على الإجراءات المدمّرة.
4. اضغط **نفّذ** وتابع شجرة المهام والبث المباشر لكل وكيل.
5. **المشاريع** ← نزّل نتائج العمل كملف **ZIP** أو شاركها عبر قائمة المشاركة في أندرويد.

### أفضل مزوّد للبداية
**OpenRouter** — مفتاح واحد يعطيك عشرات النماذج (OpenAI، Anthropic، Google، Llama…) مع نماذج رخيصة جدًا.

---

## 3. الحصول على الرموز

### رمز GitHub (Personal Access Token)
1. <https://github.com/settings/tokens?type=beta> ← **Generate new token**.
2. **Repository access**: اختر المستودعات المطلوبة.
3. **Permissions → Repository**: `Contents: Read and write`، `Pull requests: Read and write`،
   `Issues: Read and write`، `Actions: Read and write`، `Workflows: Read and write`.
4. انسخ الرمز والصقه في **الإعدادات ← التكاملات ← GitHub token**.

### رمز بوت Discord
1. <https://discord.com/developers/applications> ← **New Application**.
2. تبويب **Bot** ← **Reset Token** ← انسخ الرمز.
3. فعّل **MESSAGE CONTENT INTENT** إذا أردت قراءة الرسائل.
4. تبويب **OAuth2 → URL Generator**: اختر `bot` + `applications.commands`، ثم افتح الرابط وأضف البوت لسيرفرك.
5. الصق الرمز في **الإعدادات ← التكاملات ← Discord bot token**.
6. للحصول على معرّف القناة: فعّل **Developer Mode** في Discord ثم انقر يمينًا على القناة ← **Copy Channel ID**.

---

## 4. خادم التنفيذ الاختياري

أداة الطرفية تحتاج خادم Node.js صغير (موجود في مجلد `server/`). شغّله على أي VPS أو على جهازك:

```bash
cd server
EXEC_TOKEN=ضع-رمزًا-سريًا-هنا PORT=8787 node index.js
```

ثم في التطبيق: **الإعدادات ← خادم التنفيذ** ← ضع الرابط (`https://…`) والرمز السري.

الخادم يعزل كل التنفيذ داخل مجلد مؤقت، ويطبّق مهلة زمنية، ويحدّ حجم المخرجات، ويحظر الأوامر المدمّرة.
**بدون ضبط الرابط، أداة الطرفية معطّلة تمامًا** ولا تؤثر على بقية التطبيق.

---

## 5. البنية المعمارية

```
.
├── .github/workflows/build-apk.yml   # بناء APK موقّع + Release + fallback إلى debug
├── capacitor.config.ts               # إعدادات تطبيق أندرويد
├── index.html
├── scripts/patch-android.mjs         # يحقن خدمة المقدمة والثيم والصلاحيات في مشروع أندرويد
├── server/                           # خادم التنفيذ الاختياري (Node.js)
│   ├── index.js
│   └── package.json
├── src
│   ├── App.tsx                       # التوجيه + الحالة العامة + ورقة الموافقات
│   ├── main.tsx                      # نقطة الدخول + ErrorBoundary
│   ├── index.css                     # طبقة Tailwind + مكوّنات الزجاج والتدرّجات
│   ├── types/index.ts                # كل الأنواع (Provider, Agent, Run, Tool, …)
│   ├── theme/tokens.ts               # رموز التصميم في ملف واحد
│   ├── i18n/strings.ts               # نصوص عربية/إنجليزية
│   ├── hooks/useT.ts
│   ├── store/useStore.ts             # Zustand: التخزين، المزوّدون، الوكلاء، التشغيلات
│   ├── components
│   │   ├── AuroraBackground.tsx      # الخلفية المتدرّجة المتحرّكة
│   │   ├── GlassCard.tsx  GradientButton.tsx  AgentOrb.tsx
│   │   ├── StepTimeline.tsx  ApprovalSheet.tsx  BottomNav.tsx
│   │   ├── Sparkles.tsx  Header.tsx  Toast.tsx
│   ├── screens
│   │   ├── Dashboard.tsx  TaskScreen.tsx  Agents.tsx  Providers.tsx
│   │   ├── ToolsScreen.tsx  Projects.tsx  History.tsx  SettingsScreen.tsx
│   └── core
│       ├── providers                 # مزوّد واحد = ملف واحد
│       │   ├── http.ts               # fetch + إعادة محاولة أسّية + SSE
│       │   ├── pricing.ts            # تقدير التكلفة والتوكنات
│       │   ├── openaiCompatible.ts   # الأساس لكل المزوّدين المتوافقين
│       │   ├── openrouter.ts  groq.ts  deepseek.ts  arena.ts
│       │   ├── opencode.ts  ollama.ts  custom.ts
│       │   ├── gemini.ts  anthropic.ts
│       │   ├── registry.ts           # الكتالوج + المصنع
│       │   └── providers.test.ts
│       ├── agents/presets.ts         # 9 وكلاء جاهزين
│       ├── orchestrator
│       │   ├── router.ts             # الموجّه الذكي (جودة/سرعة/تكلفة) + سلسلة البدائل
│       │   ├── memory.ts             # ذاكرة المشروع + التلخيص التلقائي
│       │   ├── engine.ts             # فهم ← خطة ← توزيع ← تنفيذ ← مراجعة ← إصلاح ← تسليم
│       │   └── router.test.ts
│       ├── tools                     # أداة = مخطط JSON + معالج + صلاحية
│       │   ├── types.ts  registry.ts
│       │   ├── files.ts  github.ts  discord.ts  terminal.ts  web.ts
│       ├── security
│       │   ├── permissions.ts        # مصفوفة الصلاحيات + كشف الإجراءات المدمّرة
│       │   ├── sanitize.ts           # حماية من حقن الأوامر + إخفاء الأسرار
│       │   ├── rateLimit.ts          # token bucket
│       │   └── permissions.test.ts  sanitize.test.ts
│       ├── storage
│       │   ├── secure.ts             # AES-GCM + تخزين محمي بالجهاز
│       │   └── db.ts                 # تخزين المستندات (يعمل أوفلاين)
│       └── platform/native.ts        # خدمة المقدمة، الإشعارات، الاهتزاز
```

### تدفّق التنفيذ
```
هدف المستخدم
   ↓ المخطط (LLM) → JSON خطة مهام (أو خطة احتياطية ثابتة إن فشل)
   ↓ الموجّه يختار لكل مهمة أنسب وكيل (دور + جودة + سرعة + تكلفة)
   ↓ تنفيذ متوازٍ للمهام المستقلة (حسب الاعتماديات)
        ↳ حلقة الوكيل: بث → استدعاء أدوات → فحص صلاحيات → موافقة عند الحاجة → نتيجة → تكرار
   ↓ أي فشل → حلقة إصلاح (المراجع يستلم الخطأ ويعيد المحاولة، جولتان)
   ↓ تسليم: ملخّص + قائمة الملفات + التكلفة والتوكنات
```

### إضافة مزوّد جديد (ملف واحد)
```ts
// src/core/providers/myprovider.ts
import type { ProviderConfig } from '@/types';
import { OpenAICompatibleProvider } from './openaiCompatible';

export class MyProvider extends OpenAICompatibleProvider {
  constructor(config: ProviderConfig) {
    super(config, { kind: 'openai-compatible', defaultBaseUrl: 'https://api.example.com/v1' });
  }
}
```
ثم أضف سطرًا في `PROVIDER_CATALOG` و`createProvider` داخل `registry.ts`.

### إضافة أداة جديدة
```ts
export const myTool: Tool = {
  schema: {
    name: 'my_tool', description: 'وصف واضح للنموذج',
    permission: 'web', minLevel: 'read',
    parameters: { type: 'object', properties: { q: { type: 'string', description: '…' } }, required: ['q'] },
  },
  async handler(args, ctx) { return { ok: true, output: '…' }; },
};
```
ثم أضفها إلى المصفوفة المناسبة في `tools/registry.ts`.

---

## 6. الأمان والصلاحيات

- **المفاتيح**: تُشفَّر بـ AES-GCM بمفتاح مشتق (PBKDF2، 120 ألف دورة) من قيمة عشوائية مخزّنة في
  مخزن تفضيلات النظام المحمي، ثم تُحفظ مشفّرة. لا تُسجَّل في أي سجل، وتظهر مقنّعة (`sk-a••••••••1234`)،
  وتُرسل حصريًا إلى نطاق مزوّدها.
- **مصفوفة صلاحيات لكل وكيل**: `github`، `discord`، `files`، `terminal`، `web` بمستويات
  `off / read / write / admin`. كل استدعاء أداة يمر عبر `checkPermission` قبل التنفيذ.
- **الموافقات**: كل إجراء مدمّر (حذف مستودع، force push، حذف ملفات، حذف جماعي) يوقف التنفيذ
  ويعرض **ورقة موافقة سفلية** بلون خطورة (أخضر/برتقالي/أحمر) مع عرض كامل للمعاملات.
- **مفتاح الإيقاف العام**: يوقف كل الأدوات فورًا من الإعدادات.
- **حدود الإنفاق**: حد يومي لكل وكيل + حد عام، مع احتساب التكلفة لحظيًا لكل استدعاء.
- **تحديد المعدل**: token bucket لكل وكيل ولكل أداة.
- **الحماية من حقن الأوامر**: كل محتوى خارجي (ويب، ملفات، GitHub، Discord، مخرجات الطرفية)
  يُغلّف داخل سياج بيانات `UNTRUSTED_DATA` مع تحييد صيغ الحقن المعروفة وإخفاء أي أسرار.
- **سجل تدقيق كامل**: كل استدعاء (منفّذ / مرفوض / خطأ) يُسجَّل مع الوقت والوكيل والتفاصيل، ويظهر في تبويب السجل.

---

## 7. التطوير محليًا

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 39 اختبار وحدة
npm run typecheck
npm run build

# أندرويد (يتطلب Java 17 + Android SDK)
npx cap add android
npx cap sync android
node scripts/patch-android.mjs
cd android && ./gradlew assembleDebug
```

مجلد `android/` غير محفوظ في Git عمدًا — يُولَّد آليًا في كل بناء، فلا يتعارض أبدًا.

---

## 8. حل المشاكل الشائعة

| المشكلة | الحل |
|---|---|
| `Actions` معطّل في المستودع | افتح تبويب Actions واضغط زر تفعيل سير العمل. |
| البناء يفشل عند `npm ci` | احذف `package-lock.json` وارفع المستودع مجددًا؛ الـ workflow يعود تلقائيًا إلى `npm install`. |
| البناء يفشل عند التوقيع | تأكد من صحة الأسرار الأربعة. إن فشل التوقيع فالـ workflow يبني نسخة debug تلقائيًا ولا يتوقف. |
| `SDK location not found` | لا شيء عليك فعله — `android-actions/setup-android@v3` تضبطها في CI. محليًا اضبط `ANDROID_HOME`. |
| `Could not find method assembleRelease` | تأكد أن خطوة `npx cap add android` نُفّذت قبل Gradle. |
| لا يظهر APK في Artifacts | افتح سجل الخطوة **Collect APKs**؛ غالبًا فشل Gradle لسبب مذكور فيه. |
| التطبيق لا يثبّت على الهاتف | فعّل "مصادر غير معروفة"، وتأكد أن نسخة أندرويد ≥ 6.0، واحذف أي نسخة قديمة موقّعة بمفتاح مختلف. |
| "فشل الاتصال" عند اختبار المزوّد | تحقق من المفتاح، من الرابط الأساسي (يجب أن ينتهي بـ `/v1` للمتوافقين مع OpenAI)، ومن اتصال الإنترنت. |
| النماذج لا تظهر | بعض المزوّدين لا يدعمون `/models` — اكتب اسم النموذج يدويًا في حقل النموذج. |
| Anthropic يرفض الطلب من التطبيق | التطبيق يرسل ترويسة `anthropic-dangerous-direct-browser-access`؛ إن استمر الرفض استخدم OpenRouter. |
| أداة الطرفية ترجع "معطّلة" | اضبط رابط خادم التنفيذ في الإعدادات (قسم 4). |
| المهمة توقفت وتنتظر | تحقق من ورقة الموافقة السفلية، أو من أن مفتاح الإيقاف العام غير مفعّل، أو أن حد الإنفاق لم يُستنفد. |
| بطء أو استهلاك بطارية | فعّل "تقليل الحركة"، وقلّل "أقصى تنفيذ متوازٍ" إلى 1. |

---

## 9. القرارات الهندسية

- **React + Vite + TypeScript + Tailwind + Capacitor**: أسرع مسار لتطبيق أندرويد أصلي التوزيع مع
  واجهة عالية الجودة، وكل منطق الوكلاء يعمل داخل الجهاز بمفاتيح المستخدم.
- **Zustand بدل Redux**: حالة عامة بسيطة بدون قوالب زائدة، مع اشتراكات دقيقة تحافظ على 60fps.
- **تخزين مستندي مشفّر بدل SQLite الأصلي**: `@capacitor/preferences` مدعوم على كل الأجهزة ولا يضيف
  مكتبات أصلية قد تُفشل البناء الأول، والمفاتيح فوقه مشفّرة بـ AES-GCM. الأداء ممتاز لحجم بيانات
  التطبيق (مهام وسجلات وملفات نصية)، وكل شيء متاح أوفلاين.
- **`HashRouter`**: مسارات موثوقة داخل WebView بدون إعدادات خادم.
- **خدمة مقدمة مخصّصة (Java)** تُحقن عبر `scripts/patch-android.mjs` بدلاً من الاعتماد على مكتبة خارجية:
  صفر تبعيات إضافية، وتحكّم كامل في نص الإشعار وزر الإيقاف.
- **الطرفية عبر خادم اختياري**: أندرويد لا يسمح بتنفيذ Shell عام بأمان داخل التطبيق؛ الفصل يجعل
  الميزة اختيارية وآمنة ولا تعطّل بقية التطبيق إن لم تُستخدم.
- **كل محتوى خارجي بيانات لا أوامر**: أبسط دفاع فعّال ضد حقن الأوامر، مطبَّق في طبقة الأدوات نفسها.
- **fallback للتوقيع في CI**: ضمان ألا يفشل البناء أبدًا بسبب أسرار ناقصة.

---

## الترخيص
MIT — استخدمه وعدّله بحرية.
