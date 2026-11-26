package org.bizsim.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Native Android in-app APK updater for BIZSIM.
 * Downloads only from official GitHub Releases over HTTPS, verifies SHA-256
 * against SHA256SUMS.txt, and launches Android's native Package Installer.
 */
@CapacitorPlugin(name = "BizsimUpdater")
public class AppUpdaterPlugin extends Plugin {

    private static final String REPO_PREFIX = "/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/";
    private static final Set<String> ALLOWED_HOSTS = new HashSet<>(Arrays.asList(
        "github.com",
        "objects.githubusercontent.com",
        "release-assets.githubusercontent.com"
    ));
    private static final Pattern SAFE_APK_RE = Pattern.compile("^BIZSIM-[A-Za-z0-9._-]+\\.apk$");
    private static final Pattern SHA_LINE_RE = Pattern.compile("^([a-fA-F0-9]{64})\\s+\\*?(.+?)\\s*$");
    private static final long MAX_APK_BYTES = 150L * 1024L * 1024L;
    private static final int MAX_REDIRECTS = 6;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean canceled = new AtomicBoolean(false);
    private volatile HttpURLConnection activeConn = null;
    private volatile File stagedApk = null;
    private volatile String stagedVersion = null;
    private volatile String stagedName = null;

    private boolean isValidInitialUrl(String raw) {
        try {
            URI u = new URI(raw == null ? "" : raw.trim());
            return "https".equalsIgnoreCase(u.getScheme())
                && "github.com".equalsIgnoreCase(u.getHost())
                && u.getUserInfo() == null
                && u.getPath() != null
                && u.getPath().startsWith(REPO_PREFIX);
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isValidRedirectUrl(String raw) {
        try {
            URI u = new URI(raw == null ? "" : raw.trim());
            String host = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.US);
            return "https".equalsIgnoreCase(u.getScheme())
                && u.getUserInfo() == null
                && ALLOWED_HOSTS.contains(host);
        } catch (Exception e) {
            return false;
        }
    }

    private HttpURLConnection openValidatedConnection(String initialUrl, int timeoutMs) throws Exception {
        String current = initialUrl;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            HttpURLConnection conn = (HttpURLConnection) new URL(current).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(timeoutMs);
            conn.setReadTimeout(timeoutMs);
            conn.setRequestProperty("User-Agent", "BIZSIM/1.7 (https://github.com/kmmohaimenulhaque-code/BIZSIM.tm; android-updater)");
            activeConn = conn;
            int status = conn.getResponseCode();
            if (status >= 300 && status < 400) {
                String loc = conn.getHeaderField("Location");
                conn.disconnect();
                if (loc == null || loc.isEmpty()) throw new Exception("Invalid redirect.");
                String next = new URL(new URL(current), loc).toString();
                if (!isValidRedirectUrl(next)) throw new Exception("Blocked redirect to non-GitHub host.");
                current = next;
                continue;
            }
            if (status < 200 || status >= 300) {
                conn.disconnect();
                throw new Exception("Download failed (HTTP " + status + ").");
            }
            return conn;
        }
        throw new Exception("Too many redirects while downloading update.");
    }

    private String fetchExpectedSha256(String checksumUrl, String assetName) throws Exception {
        if (!isValidInitialUrl(checksumUrl)) throw new Exception("Invalid checksum URL.");
        HttpURLConnection conn = openValidatedConnection(checksumUrl, 15000);
        try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                Matcher m = SHA_LINE_RE.matcher(line.trim());
                if (m.matches()) {
                    String file = new File(m.group(2).trim()).getName();
                    if (assetName.equals(file)) return m.group(1).toLowerCase(Locale.US);
                }
            }
            return null;
        } finally {
            conn.disconnect();
            activeConn = null;
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format(Locale.US, "%02x", b));
        return sb.toString();
    }

    private void emitProgress(String phase, int percent, long received, long total, String version, String assetName, boolean verified, String error) {
        JSObject p = new JSObject();
        p.put("phase", phase);
        p.put("percent", percent);
        p.put("received", received);
        p.put("total", total);
        if (version != null) p.put("version", version);
        if (assetName != null) p.put("assetName", assetName);
        p.put("verified", verified);
        p.put("canAutoRestart", false);
        if (error != null) p.put("error", error);
        notifyListeners("updateProgress", p);
    }

    @PluginMethod
    public void cancelUpdate(PluginCall call) {
        canceled.set(true);
        HttpURLConnection c = activeConn;
        if (c != null) {
            try {
                c.disconnect();
            } catch (Exception ignored) {}
        }
        emitProgress("canceled", 0, 0, 0, stagedVersion, stagedName, false, null);
        JSObject ret = new JSObject();
        ret.put("canceled", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void downloadUpdate(PluginCall call) {
        final String url = call.getString("url", "");
        final String assetName = call.getString("assetName", "");
        final String version = call.getString("version", "");
        final String checksumUrl = call.getString("checksumUrl", null);

        if (!isValidInitialUrl(url)) {
            call.reject("Blocked update URL: only official GitHub release downloads are allowed.");
            return;
        }
        if (assetName == null || !SAFE_APK_RE.matcher(assetName.trim()).matches()) {
            call.reject("Invalid APK filename.");
            return;
        }
        final String safeName = assetName.trim();
        canceled.set(false);
        stagedApk = null;
        stagedVersion = version;
        stagedName = safeName;

        executor.execute(() -> {
            File updatesDir = new File(getContext().getCacheDir(), "updates");
            if (!updatesDir.exists()) updatesDir.mkdirs();
            File[] old = updatesDir.listFiles();
            if (old != null) {
                for (File f : old) {
                    if (!f.getName().equals(safeName)) f.delete();
                }
            }
            File finalFile = new File(updatesDir, safeName);
            File partFile = new File(updatesDir, safeName + ".part");
            if (partFile.exists()) partFile.delete();

            emitProgress("downloading", 0, 0, 0, version, safeName, false, null);
            HttpURLConnection conn = null;
            try {
                conn = openValidatedConnection(url, 30000);
                long total = conn.getContentLengthLong();
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long received = 0;
                long lastEmit = 0;

                try (InputStream in = new BufferedInputStream(conn.getInputStream());
                     FileOutputStream out = new FileOutputStream(partFile)) {
                    byte[] buf = new byte[16384];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        if (canceled.get()) throw new Exception("Update download canceled.");
                        received += n;
                        if (received > MAX_APK_BYTES) throw new Exception("APK exceeded maximum allowed size.");
                        digest.update(buf, 0, n);
                        out.write(buf, 0, n);
                        long now = System.currentTimeMillis();
                        if (now - lastEmit >= 150) {
                            lastEmit = now;
                            int pct = total > 0 ? (int) Math.min(99, (received * 100L) / total) : 0;
                            emitProgress("downloading", pct, received, Math.max(total, 0), version, safeName, false, null);
                        }
                    }
                    out.flush();
                }
                conn.disconnect();
                activeConn = null;

                if (canceled.get()) {
                    partFile.delete();
                    JSObject ret = new JSObject();
                    ret.put("ok", false);
                    ret.put("canceled", true);
                    call.resolve(ret);
                    return;
                }

                String actualHex = toHex(digest.digest());
                boolean verified = false;
                if (checksumUrl != null && !checksumUrl.trim().isEmpty()) {
                    emitProgress("verifying", 100, received, total > 0 ? total : received, version, safeName, false, null);
                    String expectedHex = fetchExpectedSha256(checksumUrl, safeName);
                    if (expectedHex == null) {
                        partFile.delete();
                        throw new Exception("Could not find " + safeName + " in SHA256SUMS.txt.");
                    }
                    if (!MessageDigest.isEqual(actualHex.getBytes(StandardCharsets.UTF_8), expectedHex.getBytes(StandardCharsets.UTF_8))) {
                        partFile.delete();
                        throw new Exception("Integrity check failed: APK SHA-256 mismatch.");
                    }
                    verified = true;
                }

                if (finalFile.exists()) finalFile.delete();
                if (!partFile.renameTo(finalFile)) throw new Exception("Could not stage verified APK.");
                stagedApk = finalFile;

                emitProgress("ready", 100, received, total > 0 ? total : received, version, safeName, verified, null);
                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("verified", verified);
                ret.put("version", version);
                ret.put("assetName", safeName);
                call.resolve(ret);
            } catch (Exception e) {
                if (conn != null) conn.disconnect();
                activeConn = null;
                partFile.delete();
                if (canceled.get()) {
                    JSObject ret = new JSObject();
                    ret.put("ok", false);
                    ret.put("canceled", true);
                    call.resolve(ret);
                    return;
                }
                String msg = e.getMessage() != null ? e.getMessage() : "Update download failed.";
                emitProgress("error", 0, 0, 0, version, safeName, false, msg);
                call.reject(msg);
            }
        });
    }

    @PluginMethod
    public void installUpdate(PluginCall call) {
        File apk = stagedApk;
        if (apk == null || !apk.exists()) {
            call.reject("No downloaded APK is ready to install.");
            return;
        }
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !ctx.getPackageManager().canRequestPackageInstalls()) {
            Intent permIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            permIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(permIntent);
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("needsPermission", true);
            call.resolve(ret);
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("mode", "android-installer");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Could not launch Android package installer.");
        }
    }
}
