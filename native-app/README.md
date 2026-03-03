# Personal Cart Manager (Native App)

This is a true React Native app (Expo) using the same Appwrite backend as the web app.

## What it includes
- Native Sign In / Sign Up screens
- Native Cart, Price List, Profile pages
- Per-user cloud data sync to the same Appwrite collection (`retail_cart_states`)
- Multi-cart support and quick-add item flow

## Run locally
1. Install dependencies:
   ```bash
   cd native-app
   npm install
   ```
2. Start Expo:
   ```bash
   npm run start
   ```
3. Run iOS simulator:
   ```bash
   npm run ios
   ```

## Appwrite config
Configured in:
- `src/config/appwrite.ts`

Current values:
- Endpoint: `https://syd.cloud.appwrite.io/v1`
- Project ID: `69a42ae4000b179052cc`
- Database ID: `69a42d9300336b242511`
- Collection ID: `retail_cart_states`

If your Appwrite web platform settings are strict, add this bundle id under Appwrite platforms:
- `com.jobit.personalcartmanager.native`
