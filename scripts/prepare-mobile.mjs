// Applies BIZSIM branding and permissions to the generated native projects.
// Run after `npx cap add android` / `npx cap add ios` (CI does this automatically).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const copyDir = (from, to) => {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyDir(s, d);
    } else fs.copyFileSync(s, d);
  }
};

// ---------- Android ----------
const android = path.join(root, 'android');
if (fs.existsSync(android)) {
  const res = path.join(android, 'app/src/main/res');
  copyDir(path.join(root, 'mobile/android-res'), res);
  // Use one splash image everywhere.
  for (const d of fs.readdirSync(res).filter((d) => d.startsWith('drawable-'))) {
    if (fs.existsSync(path.join(res, d, 'splash.png'))) fs.copyFileSync(path.join(root, 'mobile/android-res/drawable/splash.png'), path.join(res, d, 'splash.png'));
  }
  fs.writeFileSync(path.join(res, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B0C0E</color>\n</resources>\n');
  const mf = path.join(android, 'app/src/main/AndroidManifest.xml');
  let m = fs.readFileSync(mf, 'utf8');
  if (!m.includes('android.permission.CAMERA')) m = m.replace('<uses-permission android:name="android.permission.INTERNET" />', '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />');
  if (!m.includes('REQUEST_INSTALL_PACKAGES')) m = m.replace('<uses-permission android:name="android.permission.INTERNET" />', '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />');
  if (!m.includes('usesCleartextTraffic')) m = m.replace('<application', '<application\n        android:usesCleartextTraffic="true"');
  // Open .bizsim season packages from file managers and other apps.
  if (!m.includes('application/vnd.bizsim+json')) {
    m = m.replace(
      /(<category android:name="android.intent.category.LAUNCHER" \/>\s*<\/intent-filter>)/,
      `$1

            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:scheme="content" android:mimeType="application/vnd.bizsim+json" />
                <data android:scheme="file" android:mimeType="application/vnd.bizsim+json" />
            </intent-filter>`,
    );
  }
  fs.writeFileSync(mf, m);
  // App version from package.json (versionCode: 1.1.0 -> 10100).
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const [a, b, c] = version.split('.').map(Number);
  const gradle = path.join(android, 'app/build.gradle');
  fs.writeFileSync(gradle, fs.readFileSync(gradle, 'utf8').replace(/versionCode \d+/, `versionCode ${a * 10000 + b * 100 + c}`).replace(/versionName "[^"]*"/, `versionName "${version}"`));
  console.log('Android project prepared.');
}

// ---------- iOS ----------
const ios = path.join(root, 'ios/App/App');
if (fs.existsSync(ios)) {
  // Edit Info.plist with the `plist` package (installed with @capacitor/cli), so this
  // works on Linux and Windows as well as macOS.
  const plistFile = path.join(ios, 'Info.plist');
  const plistLib = createRequire(import.meta.url)('plist');
  const info = plistLib.parse(fs.readFileSync(plistFile, 'utf8'));
  info.NSCameraUsageDescription = 'BIZSIM uses the camera to scan QR codes when you move progress between devices or pair with your computer.';
  info.NSLocalNetworkUsageDescription = 'BIZSIM connects to BIZSIM on your computer over Wi-Fi when you pair them.';
  // Only local-network exceptions: pairing uses http:// to a computer on the
  // same Wi-Fi. Everything else must use HTTPS.
  info.NSAppTransportSecurity = { NSAllowsLocalNetworking: true };
  // .bizsim season packages open in BIZSIM.
  info.UTExportedTypeDeclarations = [
    { UTTypeIdentifier: 'org.bizsim.package', UTTypeDescription: 'BIZSIM season', UTTypeConformsTo: ['public.json', 'public.data'], UTTypeTagSpecification: { 'public.filename-extension': ['bizsim'], 'public.mime-type': ['application/vnd.bizsim+json'] } },
  ];
  info.CFBundleDocumentTypes = [{ CFBundleTypeName: 'BIZSIM season', CFBundleTypeRole: 'Viewer', LSHandlerRank: 'Owner', LSItemContentTypes: ['org.bizsim.package'] }];
  info.LSSupportsOpeningDocumentsInPlace = false;
  info.UIStatusBarStyle = 'UIStatusBarStyleLightContent';
  info.UIViewControllerBasedStatusBarAppearance = false;
  info.ITSAppUsesNonExemptEncryption = false;
  fs.writeFileSync(plistFile, plistLib.build(info));
  const iconDir = path.join(ios, 'Assets.xcassets/AppIcon.appiconset');
  for (const f of fs.readdirSync(iconDir).filter((f) => f.endsWith('.png'))) fs.copyFileSync(path.join(root, 'mobile/ios/AppIcon-512@2x.png'), path.join(iconDir, f));
  const splashDir = path.join(ios, 'Assets.xcassets/Splash.imageset');
  if (fs.existsSync(splashDir)) for (const f of fs.readdirSync(splashDir).filter((f) => f.endsWith('.png'))) fs.copyFileSync(path.join(root, 'mobile/ios/splash-2732.png'), path.join(splashDir, f));
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const pbx = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');
  if (fs.existsSync(pbx)) fs.writeFileSync(pbx, fs.readFileSync(pbx, 'utf8').replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`));
  console.log('iOS project prepared.');
}
