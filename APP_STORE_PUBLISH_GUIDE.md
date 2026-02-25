# Publishing Riven to the Apple App Store

When you are ready to publish Riven to the Apple App Store, the process involves packaging the Capacitor web app into a production-ready iOS bundle and submitting it through Apple's developer portal.

## Prerequisites
* An active [Apple Developer Program](https://developer.apple.com/programs/) membership ($99/year).
* Your production backend deployed (e.g., Render for Node.js, Vercel for frontend/API, Supabase for Database).

## 1. Set the Production API URL
Right now, your app uses `localhost` or your Mac's Local IP (`172.21.26.129`) to talk to your development backend. Before publishing, you must configure the app to talk to your live production server.

1. Open `client/.env`.
2. Change the `VITE_API_URL` to point to your live server:
   ```env
   VITE_API_URL=https://your-live-backend-url.com/api
   ```
*(Note: Once you do this, running the app on your physical phone will connect to your real live database instead of your local testing database).*

## 2. Remove Development Network Bypasses
Apple will reject apps that leave development network security bypasses (like Cleartext HTTP traffic) enabled in production.

1. Open `client/capacitor.config.json`
2. Remove the `"server"` block that allows cleartext navigation.
   **Before:**
   ```json
   {
     "appId": "com.riven.app",
     "appName": "Riven",
     "webDir": "dist",
     "server": {
       "cleartext": true,
       "allowNavigation": ["localhost", "192.168.*.*"]
     }
   }
   ```
   **After:**
   ```json
   {
     "appId": "com.riven.app",
     "appName": "Riven",
     "webDir": "dist"
   }
   ```

## 3. Build for Production
Bundle the final React code and sync it to the native iOS project.

1. Open a terminal and navigate to the `client` directory.
2. Run the build and sync command:
   ```bash
   npm run build && npx cap sync ios
   ```

## 4. Archive the App in Xcode
This packages the app into a secure `.ipa` file that Apple accepts.

1. Open the project in Xcode:
   ```bash
   npx cap open ios
   ```
2. At the top-center toolbar (where you normally select an iPhone Simulator or your physical phone), scroll to the very top and select **Any iOS Device (arm64)**.
3. In the top Apple menu bar, click **Product** > **Archive**.
4. Xcode will take a few minutes to compile the final, optimized version of your app.

## 5. Upload to App Store Connect
Once the Archive finishes, a new "Archives" window will pop up automatically.

1. Select your new archive and click the **Distribute App** button on the right side.
2. Select **App Store Connect** and follow the on-screen prompts.
3. Xcode will automatically sign and upload the massive app bundle directly to Apple's distribution servers.

## 6. Submit for Review
The final step happens in your web browser.

1. Log into [App Store Connect](https://appstoreconnect.apple.com/).
2. Navigate to your app's dashboard (create a new App record if you haven't already, using your unique Bundle ID `com.yourname.riven.app`).
3. You will see your newly uploaded app bundle available to select under the "Build" section.
4. Fill out your app's store page details:
   * App Icon & Screenshots
   * App Description & Keywords
   * Privacy Policy URL
   * Support URL
5. Click **Submit for Review**. 

Apple's review team usually takes **24 to 48 hours** to test your app. Once approved, it will be live and downloadable by anyone on the App Store!
