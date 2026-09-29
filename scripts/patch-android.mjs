#!/usr/bin/env node
/**
 * Post-processing for the generated `android/` project:
 *  1. Installs the custom TaskService foreground-service plugin (Java).
 *  2. Registers it in MainActivity.
 *  3. Adds only the permissions the app really needs.
 *  4. Applies the Dark Aurora theme colors + Arabic RTL support.
 * Idempotent: safe to run on every build.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ANDROID = path.join(ROOT, 'android');
if (!fs.existsSync(ANDROID)) {
  console.error('[patch-android] android/ not found — run `npx cap add android` first.');
  process.exit(1);
}

const APP = path.join(ANDROID, 'app', 'src', 'main');
const JAVA_BASE = path.join(APP, 'java', 'ai', 'orchestrator', 'multiagent');
fs.mkdirSync(JAVA_BASE, { recursive: true });

const write = (p, content) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  console.log('[patch-android] wrote', path.relative(ROOT, p));
};

/* ---------------------------------------------------------------- plugin */
write(path.join(JAVA_BASE, 'TaskForegroundService.java'), `package ai.orchestrator.multiagent;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/** Keeps long agent runs alive with a persistent progress notification. */
public class TaskForegroundService extends Service {
    public static final String CHANNEL_ID = "maao-foreground";
    public static final int NOTIFICATION_ID = 4411;
    public static final String ACTION_STOP = "ai.orchestrator.multiagent.STOP";

    @Override
    public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "تشغيل المهام", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("إشعار دائم أثناء تنفيذ الوكلاء للمهام");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        String title = intent != null && intent.getStringExtra("title") != null
            ? intent.getStringExtra("title") : "منسّق الوكلاء يعمل";
        String text = intent != null && intent.getStringExtra("text") != null
            ? intent.getStringExtra("text") : "جارٍ تنفيذ المهمة…";
        int progress = intent != null ? intent.getIntExtra("progress", -1) : -1;

        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(this, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent stop = new Intent(this, TaskForegroundService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 1, stop,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openPi)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "إيقاف", stopPi);

        if (progress >= 0) b.setProgress(100, Math.min(100, progress), false);
        else b.setProgress(0, 0, true);

        Notification n = b.build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, n, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIFICATION_ID, n);
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    public static void start(Context ctx, String title, String text) {
        Intent i = new Intent(ctx, TaskForegroundService.class);
        i.putExtra("title", title);
        i.putExtra("text", text);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i);
        else ctx.startService(i);
    }

    public static void update(Context ctx, String text, int progress) {
        Intent i = new Intent(ctx, TaskForegroundService.class);
        i.putExtra("text", text);
        i.putExtra("progress", progress);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i);
        else ctx.startService(i);
    }

    public static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, TaskForegroundService.class));
    }
}
`);

write(path.join(JAVA_BASE, 'TaskServicePlugin.java'), `package ai.orchestrator.multiagent;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TaskService")
public class TaskServicePlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        String title = call.getString("title", "منسّق الوكلاء يعمل");
        String text = call.getString("text", "جارٍ تنفيذ المهمة…");
        TaskForegroundService.start(getContext(), title, text);
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        String text = call.getString("text", "جارٍ تنفيذ المهمة…");
        Integer progress = call.getInt("progress", -1);
        TaskForegroundService.update(getContext(), text, progress == null ? -1 : progress);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        TaskForegroundService.stop(getContext());
        call.resolve();
    }
}
`);

/* --------------------------------------------------------- MainActivity */
const mainActivity = path.join(JAVA_BASE, 'MainActivity.java');
write(mainActivity, `package ai.orchestrator.multiagent;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TaskServicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);

// Remove any MainActivity generated under a different package path.
const javaRoot = path.join(APP, 'java');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : [p];
});
for (const f of walk(javaRoot)) {
  if (f.endsWith('MainActivity.java') && f !== mainActivity) {
    fs.rmSync(f);
    console.log('[patch-android] removed duplicate', path.relative(ROOT, f));
  }
}

/* ------------------------------------------------------------- manifest */
const manifestPath = path.join(APP, 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');

const permissions = [
  '<uses-permission android:name="android.permission.INTERNET" />',
  '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />',
  '<uses-permission android:name="android.permission.VIBRATE" />',
  '<uses-permission android:name="android.permission.WAKE_LOCK" />',
];
for (const p of permissions) {
  if (!manifest.includes(p.split('"')[1])) {
    manifest = manifest.replace('</manifest>', `    ${p}\n</manifest>`);
  }
}

if (!manifest.includes('TaskForegroundService')) {
  manifest = manifest.replace(
    '</application>',
    `        <service
            android:name=".TaskForegroundService"
            android:exported="false"
            android:foregroundServiceType="dataSync" />
    </application>`,
  );
}

manifest = manifest.replace(/<application([^>]*?)>/, (m, attrs) => {
  let a = attrs;
  if (!a.includes('android:supportsRtl')) a += '\n        android:supportsRtl="true"';
  if (!a.includes('android:usesCleartextTraffic')) a += '\n        android:usesCleartextTraffic="true"';
  return `<application${a}>`;
});

fs.writeFileSync(manifestPath, manifest, 'utf8');
console.log('[patch-android] manifest patched');

/* --------------------------------------------------------------- theme */
write(path.join(APP, 'res', 'values', 'colors.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#7C3AED</color>
    <color name="colorPrimaryDark">#05050A</color>
    <color name="colorAccent">#06B6D4</color>
</resources>
`);

const stringsPath = path.join(APP, 'res', 'values', 'strings.xml');
write(stringsPath, `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">منسّق الوكلاء</string>
    <string name="title_activity_main">منسّق الوكلاء</string>
    <string name="package_name">ai.orchestrator.multiagent</string>
    <string name="custom_url_scheme">ai.orchestrator.multiagent</string>
</resources>
`);

write(path.join(APP, 'res', 'values', 'styles.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="android:background">#05050A</item>
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="android:statusBarColor">#05050A</item>
        <item name="android:navigationBarColor">#05050A</item>
    </style>
    <style name="AppTheme.NoActionBar" parent="AppTheme">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
    </style>
    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
        <item name="android:background">#05050A</item>
    </style>
</resources>
`);

console.log('[patch-android] done ✅');
