# GCommunity - Production Build Guide for Google Play Store

## Pre-Submission Checklist

### ✅ Code Quality
- [ ] All console.logs removed or wrapped in development check
- [ ] No API keys or secrets in code
- [ ] All TypeScript errors resolved
- [ ] No unused imports or variables
- [ ] Proper error handling throughout

### ✅ Performance
- [ ] App startup time < 2 seconds
- [ ] Build size < 100MB
- [ ] No memory leaks in long sessions
- [ ] Smooth animations and transitions
- [ ] Images optimized and compressed

### ✅ Security
- [ ] API keys in environment variables only
- [ ] HTTPS enforced for all network requests
- [ ] Firebase security rules configured
- [ ] No sensitive data stored unencrypted
- [ ] Rate limiting implemented

### ✅ Compliance
- [ ] Privacy Policy included and linked
- [ ] Terms of Service included and linked
- [ ] Required permissions declared
- [ ] GDPR compliance checked (if EU users)
- [ ] CCPA compliance checked (if CA users)

### ✅ Testing
- [ ] Tested on Android 8, 10, 12, 14
- [ ] Tested on various screen sizes (4", 5", 6", 7")
- [ ] Tested offline/online switching
- [ ] All features work without crashes
- [ ] Crash logs reviewed

### ✅ Analytics
- [ ] Firebase Analytics integrated
- [ ] Crash reporting configured
- [ ] Key events tracked
- [ ] User ID tracking implemented
- [ ] Analytics dashboard verified

### ✅ Branding
- [ ] App icon created (192x192, 512x512)
- [ ] App name consistent everywhere
- [ ] App description compelling
- [ ] Screenshots high quality
- [ ] Feature graphic created

## Step-by-Step Build Instructions

### 1. Set Up Development Environment
```bash
# Install Node.js 18+ and Android SDK
npm install -g @capacitor/cli

# Install project dependencies
npm install

# Build the web app for production
npm run build
```

### 2. Initialize Capacitor for Android
```bash
# Add Android platform
npx cap add android

# Copy web assets to Android
npx cap copy

# Sync native code
npx cap sync android
```

### 3. Configure Android Build
**File: `android/app/build.gradle`**
```gradle
android {
    compileSdkVersion 34
    defaultConfig {
        applicationId "com.gcommunity.app"
        minSdkVersion 26      // Android 8.0
        targetSdkVersion 34   // Latest Android
        versionCode 1
        versionName "1.0.0"
    }
}

dependencies {
    // Firebase
    implementation 'com.google.firebase:firebase-core:21.1.1'
    implementation 'com.google.firebase:firebase-analytics:21.1.1'
    implementation 'com.google.firebase:firebase-auth:22.3.0'
    implementation 'com.google.firebase:firebase-firestore:24.10.0'
}
```

### 4. Generate Signing Key
```bash
# Generate keystore for signing APK
keytool -genkey -v -keystore gcommunity.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias gcommunity

# Store this keystore safely! You'll need it for future updates.
```

### 5. Configure Signing in build.gradle
```gradle
android {
    signingConfigs {
        release {
            storeFile file("gcommunity.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 6. Build Release Bundle
```bash
# Build Android App Bundle (AAB) for Play Store
cd android
./gradlew bundleRelease

# Output: android/app/build/outputs/bundle/release/app-release.aab
```

### 7. Verify Build
```bash
# Check APK size
# (Should be < 100MB uncompressed)

# Test on device
adb install android/app/build/outputs/apk/release/app-release.apk

# Run through critical user flows:
# - Sign in with Google
# - Browse gatherings
# - View map
# - Create gathering
# - Scan QR code
# - Export PDF
# - Check analytics
```

### 8. Prepare Play Store Assets

Create these files:
- `app_icon.png` (512x512)
- `feature_graphic.png` (1024x500)
- `screenshot_1.png` through `screenshot_8.png` (1080x1920)

### 9. Create Play Store Listing

On Google Play Console:
1. **App Name:** GCommunity
2. **Category:** Social
3. **Category (Alternate):** Lifestyle
4. **Content Rating:** Everyone (ESRB)
5. **Privacy Policy URL:** https://gcommunity.app/privacy
6. **Description:** (Use PLAYSTORE_LISTING.md)
7. **Screenshots:** Upload 5-8 screenshots
8. **Feature Graphic:** Upload 1024x500 image
9. **App Icon:** Upload 512x512 icon

### 10. Submit for Review

1. Upload AAB file
2. Fill all required metadata
3. Review store listing
4. Submit for review
5. Wait 2-4 hours for Google review

### Post-Launch

**Monitor:**
- Crash analytics
- User acquisition
- Rating trends
- Performance metrics

**Update Cycle:**
- Version 1.0.x: Bug fixes
- Version 1.1.0: New features (Q3 2026)
- Version 1.2.0: Community feedback (Q4 2026)

## Environment Variables (CI/CD)

For automated builds, set:
```
GEMINI_API_KEY=xxx
FIREBASE_PROJECT_ID=xxx
KEYSTORE_PASSWORD=xxx
KEY_ALIAS=xxx
KEY_PASSWORD=xxx
```

## Troubleshooting

**Build fails with "API key not found"**
- Ensure `.env.local` has `GEMINI_API_KEY`
- Set environment variables for CI/CD

**App crashes on launch**
- Check Firebase config in `firebase-applet-config.json`
- Verify Android permissions in `AndroidManifest.xml`
- Check Logcat for errors: `adb logcat | grep GCommunity`

**QR scanner not working**
- Check camera permission granted
- Test on device with camera
- Verify `jsqr` library is bundled

## Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Startup Time | < 2s | ? |
| Build Size | < 100MB | ? |
| Memory Usage | < 200MB | ? |
| Battery Drain | < 5%/hour | ? |
| Crash Rate | < 0.1% | ? |

## Versioning Strategy

```
Version: MAJOR.MINOR.PATCH
Example: 1.0.0

Increment:
- MAJOR: Major UI redesign or architecture change
- MINOR: New features or significant improvements
- PATCH: Bug fixes or minor improvements

versionCode (integer, always increment):
1.0.0 = 100
1.0.1 = 101
1.1.0 = 110
2.0.0 = 200
```

## Legal Compliance Checklist

- [ ] Privacy Policy reviewed by legal
- [ ] Terms of Service reviewed by legal
- [ ] GDPR compliance verified (if EU)
- [ ] CCPA compliance verified (if US West Coast)
- [ ] Data storage policy compliant
- [ ] Third-party licenses listed
- [ ] No copyright violations in content

## Questions? Contact

- **Build Issues:** dev@gcommunity.app
- **Legal Questions:** legal@gcommunity.app
- **Play Store Support:** https://support.google.com/googleplay

