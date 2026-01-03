# BlazeMates

[![Netlify Status](https://api.netlify.com/api/v1/badges/273bb4be-742f-47fe-9fd2-09b96bc48ce4/deploy-status)](https://app.netlify.com/projects/blazemates/deploys)

BlazeMates is an Expo/React Native social discovery app built around cannabis-friendly connections. The project uses [Expo Router](https://docs.expo.dev/router/introduction/) for navigation and Supabase for authentication and data access.

## Platform Support

BlazeMates works on:
- **Web browsers** - Chrome, Firefox, Safari, Edge
- **iOS** - iPhone and iPad (iOS 13.4+)
- **Android** - Phones and tablets (API 21+)

See [CROSS_PLATFORM.md](./CROSS_PLATFORM.md) for detailed compatibility information.

## Development

### Install Dependencies
```bash
npm install
```

### Run on Different Platforms

**Web Browser:**
```bash
npm run web
```
Opens at http://localhost:8081

**iOS Simulator:**
```bash
npm run ios
```
Requires macOS with Xcode

**Android Emulator:**
```bash
npm run android
```
Requires Android Studio

**Choose Platform:**
```bash
npm start
```
Opens Expo Dev Tools

### Additional Commands
- Lint code: `npm run lint`

The app source lives inside the `app/` directory and follows Expo Router's file-based routing conventions.

## Policy & Compliance

BlazeMates includes matchmaking features and must comply with Google Play's **Age-Restricted Content and Functionality** policy. The codebase now enforces an in-app age gate (`app/age-check.tsx`) and blocks any account identified as underage (`app/underage-blocked.tsx`), but you must also finish the required steps in Play Console so distribution is limited to verified adults.

### Configure Google Play to block minors

1. Sign in to the [Google Play Console](https://play.google.com/console) and select the BlazeMates application.
2. Navigate to **Policy > App content > Age-restricted content and functionality** and complete the new declaration. Answer **Yes** for matchmaking functionality and select **Block users below the legal age**.
3. Still within **App content**, open **Target audience and content**, choose **Adults only (18+)**, and add a note under **Age-restricted content details** that BlazeMates is restricted to users 21 and older in supported regions.
4. Under **Store presence > Main store listing**, highlight the 21+ restriction so the storefront clearly communicates it to users.
5. In **Publishing overview**, submit the updated declarations after Google Play confirms that the age-based block is enabled.

Document proof of compliance (screenshots or policy confirmation emails) alongside `child-safety.html` whenever you submit new builds.

## Legal

This project is Copyright 2025 Benjamin Hawk. All rights reserved. See `LICENSE` for additional details.
