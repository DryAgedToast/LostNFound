# LostNFound - Expo Go Testing Guide

## ✅ Demo Mode Configuration Complete

Your app is now configured to run in **demo mode** without any external dependencies:

- ✅ No database connection required
- ✅ No ID analyzer service needed
- ✅ Mock authentication enabled
- ✅ Mock data for items and hotspots
- ✅ All screens functional in offline mode

When you add connection strings later (.env file), everything will work with real services with no code changes needed.

---

## 📱 Installing Expo Go

### On iPhone (iOS):

1. Open the **App Store** on your iPhone
2. Search for **"Expo Go"**
3. Download and install the app (it's free)

### On Android:

1. Open the **Google Play Store** on your Android device
2. Search for **"Expo Go"**
3. Download and install the app (it's free)

### On Mac (for iOS Simulator):

**Note:** Expo Go doesn't run directly on Mac. Instead:

- For **mobile testing**: Use Expo Go on your iPhone (see above)
- For **iOS Simulator**: You'll need Xcode installed (not required for basic testing)
- For **web testing**: Use your regular web browser (Chrome, Safari, etc.)

---

## 🚀 Starting the Development Server

### Prerequisites

Make sure you have dependencies installed (one-time setup):

```bash
cd /Users/suvilkaushik/Documents/Sem8/CISC499/LostNFound
npm install
```

### Start Expo

```bash
npm start
```

This will:

1. Start the Metro bundler
2. Show a QR code in your terminal
3. Display options for opening different platforms

You'll see something like:

```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web

› Press r │ reload app
› Press m │ toggle menu
```

---

## 📱 Testing on Mobile (Recommended for Full Demo)

### On iPhone:

1. Make sure your iPhone is on the **same Wi-Fi network** as your Mac
2. Open **Expo Go** app on your iPhone
3. Tap **"Scan QR code"** at the bottom
4. Point your camera at the QR code in your terminal
5. The app will load automatically

**Alternative:** In the Expo Go app, look for your project under "Recently in development"

### On Android:

1. Make sure your Android device is on the **same Wi-Fi network** as your Mac
2. Open **Expo Go** app
3. Tap **"Scan QR code"**
4. Scan the QR code from your terminal
5. The app will load automatically

---

## 💻 Testing on Web (Quick Testing)

### Option 1: From Terminal

After running `npm start`, press **`w`** to open in web browser

### Option 2: Direct Command

```bash
npm run web
```

This will:

- Bundle the web version
- Open your default browser automatically
- URL will be: http://localhost:8081

**Note:** Web version has some limitations (no camera access, different UI feel), but great for quick testing!

---

## 🎯 Demo Flow - What to Test

### 1. **Login Screen** (Any credentials work in demo mode)

- Enter any email (e.g., `test@test.com`)
- Enter any password (6+ characters, e.g., `password123`)
- Tap "Log In" → You'll be logged in as "Test User"

### 2. **Home/Feed Tab**

- See 4 demo items:
  - Black iPhone 13 (at hotspot)
  - Student ID Card (unclaimed)
  - Keys with Red Keychain (at hotspot)
  - Blue Backpack (unclaimed)
- Try the search bar
- Test category filters (Electronics, Keys, Bags, etc.)
- Tap on any item to see details

### 3. **Item Details**

- View item information
- See custom claim questions
- Try the "Claim This Item" button (will show questionnaire)
- Note: Image upload will work but won't persist in demo mode

### 4. **Hotspots Tab**

- See 2 demo hotspots:
  - Main Library Front Desk (2 items)
  - Student Center Info Desk (0 items)
- Tap on a hotspot to see items stored there
- View hotspot details and contact info

### 5. **Messages Tab**

- Will show empty (no claims in demo mode)
- UI demonstrates the inbox structure

### 6. **Profile Tab**

- See mock user: "Test User"
- Role badge: "Student"
- "Log Out" button works (returns to login)

### 7. **Post Item Tab** (+ button)

- Test the form for posting a found item
- Note: Submissions won't persist in demo mode but form validation works

---

## 🔧 Troubleshooting

### QR Code Not Working on Mobile?

- Ensure both devices are on the same Wi-Fi network
- Try typing the URL manually in Expo Go (shown in terminal)
- If using a VPN, disable it temporarily

### App Won't Load?

```bash
# Stop the server (Ctrl+C) and clear cache:
npx expo start --clear
```

### Port Already in Use?

```bash
# Kill the process using port 8081:
lsof -ti:8081 | xargs kill -9
# Then restart:
npm start
```

### Web Version Issues?

- Try a different browser (Chrome recommended)
- Clear browser cache
- Check browser console for errors (F12 → Console)

### Can't Find Expo Go App?

- Ensure your device has internet connection
- Search exactly: "Expo Go" (not "Expo")
- It's published by "650 Industries, Inc."

---

## 🎨 What Works in Demo Mode

### ✅ Fully Functional:

- User authentication (mock)
- Viewing items feed
- Searching and filtering items
- Viewing item details
- Browsing hotspots
- Navigating between screens
- Form validation
- UI theming (light/dark mode)
- Profile viewing
- Image picker (won't upload but UI works)

### ⚠️ Limited (No Real Backend):

- Claims won't persist after refresh
- Messages won't be saved
- Posted items won't be stored
- ID verification will show "not configured" message

### 🔌 Will Work When Connected:

When you add these to `.env` file:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
EXPO_PUBLIC_IDANALYZER_KEY=your_idanalyzer_key
```

Then change in `src/lib/auth.ts`:

```typescript
export const DEV_MODE = false; // Set to false
```

Everything will automatically work with real backend - no other code changes needed!

---

## 📊 Performance Tips

### For Best Mobile Experience:

1. Use a real device (not simulator) when possible
2. Keep devices on same network
3. Close other apps to free up memory

### For Best Web Experience:

1. Use Chrome or Safari
2. Enable browser dev tools (F12) to see console logs
3. Use responsive mode (Cmd+Opt+I on Mac) to simulate mobile

---

## 🎬 Quick Start Commands Reference

```bash
# Start development server
npm start

# Start and open web browser
npm run web

# Clear cache and restart
npx expo start --clear

# Check for issues
npx expo-doctor

# View all Expo commands
npx expo --help
```

---

## 📝 Next Steps After Testing

1. **Development Database**: Set up Supabase and add credentials to `.env`
2. **ID Verification**: Sign up for ID Analyzer and add API key
3. **Disable Demo Mode**: Set `DEV_MODE = false` in `src/lib/auth.ts`
4. **Test with Real Data**: Create real items, claims, and messages
5. **Deploy**: Build production app with `eas build`

---

## 💡 Demo Tips

- **Show off the UI**: The design is polished even in demo mode
- **Test all tabs**: Navigate between Feed, Hotspots, Messages, Profile
- **Try search/filters**: Demonstrate the category filtering
- **View item details**: Show the claim flow (even if it doesn't persist)
- **Check both themes**: Device settings → toggle light/dark mode
- **Profile screen**: Show role badges and user info

---

## 🆘 Need Help?

If you encounter issues:

1. **Check terminal output** for error messages
2. **Verify network**: Both devices on same WiFi
3. **Restart everything**:
   ```bash
   # Stop server (Ctrl+C)
   # Close Expo Go app completely
   # Restart: npm start
   ```
4. **Check Expo status**: https://status.expo.dev/

---

**Your app is ready for demo! 🎉**

The demo mode provides a fully functional UI experience without requiring any backend services. When you're ready to go live, just add your connection strings and disable DEV_MODE - everything is already wired up!
