# nrmaOS Shell

واجهة سطح مكتب تجريبية بملء الشاشة مبنية بـ Qt 6 Quick/QML. المضيف صغير بـ C++، وملفات الواجهة موجودة في `qml/` وتُثبّت افتراضيًا إلى `/usr/lib/nrmaos/`.

## المتطلبات

- CMake 3.21 أو أحدث، ومترجم C++17.
- Qt 6.2 أو أحدث مع وحدات Core وGui وQml وQuick وQuickControls2، وبيئة تشغيل رسومية (X11 أو Wayland).
- وحدات QML وقت التشغيل `QtQuick` و`QtQuick.Controls` و`QtQuick.Templates` و`QtQuick.Layouts` و`QtQml.WorkerScript` (قد توزّعها الحزم منفصلة).
- `xterm` و`pcmanfm` لعمل زري Terminal وFiles على التوالي.

## البناء والتشغيل

```sh
cmake -S . -B build -DCMAKE_PREFIX_PATH=/path/to/Qt/6.x/<kit>
cmake --build build
./build/nrmaos-shell
```

للتثبيت (قد يتطلب صلاحيات مناسبة):

```sh
cmake --install build --prefix /usr
```

يُثبّت البرنامج التنفيذي إلى `/usr/bin/nrmaos-shell` وملف QML إلى `/usr/lib/nrmaos/Main.qml`. للتثبيت المرحلي/الحزم يمكن تعيين `-DNRMAOS_QML_INSTALL_DIR=/مسار/مرحلي/usr/lib/nrmaos` عند التهيئة.

اختبار العقد الساكن:

```sh
python3 tests/test_shell_contract.py
# أو: ctest --test-dir build --output-on-failure
```

## الحدود

- `LauncherBridge.openApp()` يقبل فقط المعرّفين `terminal` و`files`، ويربطهما مباشرةً بـ `xterm` و`pcmanfm` عبر `QProcess::startDetached` مع قائمة معاملات فارغة. لا يُمرّر نص حر إلى shell ولا يتيح تشغيل أوامر عامة.
- يلزم وجود التطبيقين في `PATH`؛ فشل التشغيل يظهر داخل الواجهة. لا يُضمّن المشروع الطرفية أو مدير الملفات.
- زر الإعدادات يبدّل المظهر الفاتح/الداكن محليًا؛ لا توجد بعد صفحة إعدادات أو تخزين دائم للتفضيل.
- هذا نموذج قشرة بواجهة نافذة ملء شاشة، وليس بديلًا لمدير نوافذ أو جلسة سطح مكتب كاملة.
