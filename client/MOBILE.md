# ArtBeat — Mobile Build Guide

ArtBeat uses [Capacitor](https://capacitorjs.com/) to wrap the React/Vite web app as a native iOS and Android application.

---

## Prerequisites

| Tool | Required for | Install |
|------|-------------|---------|
| Node.js 18+ | All | [nodejs.org](https://nodejs.org) |
| Xcode 15+ | iOS | Mac App Store |
| CocoaPods | iOS | `sudo gem install cocoapods` |
| Android Studio | Android | [developer.android.com/studio](https://developer.android.com/studio) |
| Android SDK (API 22+) | Android | via Android Studio SDK Manager |
| Java 17+ | Android | bundled with Android Studio |

> **Note:** iOS builds require a Mac with Xcode. You can develop and test Android on any platform.

---

## Environment Setup

Before building, update `.env` (or `.env.production` for release builds):

```
VITE_API_URL=http://localhost:3001          # used in web/dev mode
VITE_PROD_API_URL=https://api.your-server.com  # used when running natively
```

Set `VITE_PROD_API_URL` to your deployed backend URL — this is what the native app
will call at runtime since `localhost` is not reachable on a real device.

---

## Build commands

```bash
# One-step build + sync to both platforms
npm run build:mobile

# Or run the steps separately:
npm run build          # TypeScript check + Vite production build → dist/
npx cap sync           # copies dist/ into ios/ and android/ native projects
```

`cap sync` also installs any new Capacitor plugins into the native projects.
Run it any time you install a new `@capacitor/*` package.

---

## iOS

### Run on the Simulator (Mac required)

```bash
npm run build:mobile
npx cap open ios        # opens Xcode
```

In Xcode:
1. Select a simulator from the device picker (top toolbar).
2. Press **⌘R** (or click the ▶ Run button).

### Live Reload on a physical device

1. Find your Mac's local IP (`System Preferences → Network`).
2. In `capacitor.config.ts`, uncomment and update:
   ```ts
   server: {
     url: 'http://192.168.1.X:5173',
     cleartext: true,
   }
   ```
3. Run `npm run dev` to start the Vite dev server.
4. Run `npx cap sync && npx cap open ios`, then build to your device in Xcode.
5. **Revert the server block before building for production.**

### Production build for the App Store

1. Make sure `server.url` is commented out in `capacitor.config.ts`.
2. Run `npm run build:mobile`.
3. In Xcode:
   - Select **Any iOS Device (arm64)** as the target.
   - Choose **Product → Archive**.
   - Once archived, click **Distribute App → App Store Connect**.
   - Follow the upload wizard.

---

## Android

### Run on the Emulator

```bash
npm run build:mobile
npx cap open android    # opens Android Studio
```

In Android Studio:
1. Create a virtual device via **Device Manager** if you don't have one (Pixel 7, API 34 recommended).
2. Click the ▶ **Run** button.

### Run on a physical device

1. Enable **Developer Options** and **USB Debugging** on your Android phone.
2. Connect via USB.
3. Select your device from the run target dropdown in Android Studio and click ▶.

### Live Reload on a physical device

Same as iOS above — uncomment the `server.url` in `capacitor.config.ts`, start
the dev server, sync, and run from Android Studio.

### Production build for Google Play

1. Ensure `server.url` is commented out in `capacitor.config.ts`.
2. Run `npm run build:mobile`.
3. In Android Studio:
   - Choose **Build → Generate Signed Bundle / APK**.
   - Select **Android App Bundle (.aab)** (required by Google Play).
   - Create or select your keystore file (keep the keystore and passwords safe — losing them means you can't update the app).
   - Follow the wizard to produce a signed release `.aab`.
4. Upload the `.aab` to the [Google Play Console](https://play.google.com/console).

---

## Manual Xcode setup (required before first iOS release)

These cannot be automated — you must configure them once in Xcode:

### 1. Bundle Identifier
- Open the project in Xcode: `npx cap open ios`
- Select the **App** target → **Signing & Capabilities** tab.
- Change **Bundle Identifier** from `io.artbeat.app` to your actual reverse-domain ID (e.g. `com.example.artbeat`). This must match your App Store Connect record.

### 2. Code Signing
- Under **Signing & Capabilities**, select your **Team** (requires an Apple Developer account — $99/year).
- Xcode will auto-manage provisioning profiles if you tick **Automatically manage signing**.

### 3. App version & build number
- Select **App** target → **General** tab.
- Set **Version** (e.g. `1.0.0`) and **Build** (integer, e.g. `1`).
- Increment the build number for every upload to App Store Connect.

### 4. App icon
- The placeholder icon at `ios/App/App/Assets.xcassets/AppIcon.appiconset/` needs replacing.
- Use a 1024×1024 PNG and let Xcode (or a tool like [appicon.co](https://www.appicon.co)) generate all required sizes.

### 5. Display name
- Already set to `ArtBeat` in `Info.plist` (`CFBundleDisplayName`).
- Change it here if you rebrand.

---

## Manual Android setup (required before first Play Store release)

### 1. App ID
- Update `applicationId` in `android/app/build.gradle` to match your actual package name:
  ```gradle
  android {
      defaultConfig {
          applicationId "com.example.artbeat"
      }
  }
  ```

### 2. Version
- In the same `build.gradle`, set `versionCode` (integer, increment per release) and `versionName` (e.g. `"1.0.0"`).

### 3. App icon
- Replace the mipmap drawables in `android/app/src/main/res/` with your actual icon.
- Android Studio's **Image Asset Studio** (right-click `res` → New → Image Asset) can generate all densities from a single 1024×1024 source.

### 4. Signing keystore
- Create once with:
  ```bash
  keytool -genkey -v -keystore artbeat-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias artbeat
  ```
- Reference it in `android/app/build.gradle` under `signingConfigs`. Store the keystore and passwords securely — they are permanent.

---

## Project structure overview

```
client/
├── capacitor.config.ts   — Capacitor configuration
├── dist/                 — Vite build output (git-ignored); synced to native projects
├── ios/                  — Xcode project (commit to git)
│   └── App/App/Info.plist
└── android/              — Android Studio project (commit to git)
    └── app/build.gradle
```

Commit both `ios/` and `android/` to source control — they contain native project
files that `cap sync` updates but does not recreate from scratch.
