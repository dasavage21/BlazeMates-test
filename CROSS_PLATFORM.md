# Cross-Platform Compatibility

BlazeMates is fully compatible with web browsers and mobile devices (iOS and Android).

## Platform Support

### Web Browsers
- Modern browsers (Chrome, Firefox, Safari, Edge)
- All core features work on web
- Photo selection uses file picker instead of camera
- Maps show location list (native map on mobile only)

### Mobile Devices
- iOS (iPhone, iPad)
- Android phones and tablets
- Full camera access for profile photos
- Native map view with user location
- Optimized touch interactions

## Running the App

### Web Development
```bash
npm run web
```
Opens the app in your default browser at `http://localhost:8081`

### Mobile Development

#### iOS
```bash
npm run ios
```
Requires macOS and Xcode installed

#### Android
```bash
npm run android
```
Requires Android Studio and emulator or connected device

### Start Development Server
```bash
npm start
```
Opens Expo Dev Tools to choose platform

## Platform-Specific Features

### Camera & Photos

**Mobile:**
- Full camera access with front/back camera toggle
- Direct photo capture from within the app
- Photo library access

**Web:**
- File picker for image selection
- Supports drag-and-drop (browser dependent)
- All standard image formats

### Maps

**Mobile:**
- Interactive native maps with gestures
- Real-time location tracking
- Hotspot markers on map

**Web:**
- List view of nearby hotspots
- Location coordinates displayed
- Mobile-optimized experience recommended for maps

### File Storage

Both platforms use:
- Supabase for cloud storage
- Local AsyncStorage for offline data
- Automatic sync when online

## Technical Implementation

### Platform Detection
The app uses `Platform.OS` to detect the current platform:

```typescript
if (Platform.OS === "web") {
  // Web-specific code
} else {
  // Mobile-specific code
}
```

### Platform-Specific Files
Some components have separate implementations:

- `MapNative.native.tsx` - Mobile map with react-native-maps
- `MapNative.web.tsx` - Web map fallback with location list

### API Compatibility
All Expo and React Native APIs used are cross-platform compatible:

- `@react-native-async-storage/async-storage` - Works on web and mobile
- `expo-router` - Universal navigation
- `@supabase/supabase-js` - Cross-platform database client
- `react-native-reanimated` - Animations on all platforms

## Browser Requirements

For optimal web experience:
- Modern browser with ES6+ support
- JavaScript enabled
- Cookies enabled (for session management)
- LocalStorage available
- Minimum 1024x768 resolution recommended

## Mobile Requirements

### iOS
- iOS 13.4 or later
- Camera permission for profile photos
- Location permission for maps (optional)

### Android
- Android 5.0 (API 21) or later
- Camera permission for profile photos
- Location permission for maps (optional)

## Known Limitations

### Web Platform
- No native camera access (uses file picker instead)
- Maps feature shows list view only
- Some native animations may differ slightly

### All Platforms
- Requires internet connection for real-time features
- Profile data cached locally for offline viewing
- Photos require connection to upload

## Development Notes

When adding new features:
1. Always check if APIs are cross-platform
2. Use `Platform.select()` for minor differences
3. Create separate `.web.tsx` and `.native.tsx` files for major differences
4. Test on both web and mobile before deploying

## Deployment

### Web
```bash
npx expo export:web
```
Builds static files for hosting

### Mobile
Use EAS Build for app store deployment:
```bash
eas build --platform ios
eas build --platform android
```
