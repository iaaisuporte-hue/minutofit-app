# OAuth Setup Guide for CoreFit

This guide walks you through setting up OAuth authentication with Google and Apple for the CoreFit frontend.

## Overview

CoreFit now supports OAuth login via:
- **Google Sign-In** 
- **Apple Sign-In**

Both providers supplement the existing email/password authentication. New OAuth users are automatically created and directed to complete their profile before accessing the app.

---

## Environment Variables

Create a `.env` file in the frontend root (`corefit-app/.env`) with these variables:

```env
# API Configuration
VITE_API_URL=http://localhost:3000/api

# Google OAuth
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here

# Apple OAuth
VITE_APPLE_CLIENT_ID=your_apple_client_id_here
VITE_APPLE_TEAM_ID=your_apple_team_id_here
VITE_APPLE_KEY_ID=your_apple_key_id_here
```

---

## Google OAuth Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a Project** → **New Project**
3. Name it "CoreFit" and click **Create**
4. Wait for the project to be created

### 2. Enable Google Sign-In API

1. In the console, search for **Google Identity Services API**
2. Click on it and press **Enable**
3. Do the same for **Google+ API** (legacy, still needed for some features)

### 3. Create OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type
3. Fill in the form:
   - **App name**: CoreFit
   - **User support email**: your-email@gmail.com
   - **Developer contact**: your-email@gmail.com
4. Add scopes:
   - `email`
   - `profile`
   - `openid`
5. Click **Save and Continue**
6. Review and click **Back to Dashboard**

### 4. Create OAuth 2.0 Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Add authorized redirect URIs:
   ```
   http://localhost:5173
   http://localhost:5173/login
   https://your-production-domain.com
   https://your-production-domain.com/login
   ```
5. Click **Create**
6. Copy your **Client ID** and paste it in `.env` as `VITE_GOOGLE_CLIENT_ID`

### 5. Add Google SDK to Frontend

Add this script tag to `public/index.html`, before the closing `</head>` tag:

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

---

## Apple OAuth Setup

### 1. Enroll in Apple Developer Program

1. Go to [Apple Developer Program](https://developer.apple.com/)
2. Sign in with your Apple ID or create one
3. Enroll in the program (requires membership fee)

### 2. Create App ID

1. Go to **Certificates, Identifiers & Profiles**
2. Click **Identifiers** → **+** (Add)
3. Select **App IDs** and click **Continue**
4. Configure:
   - **Bundle ID**: `com.corefitapp` (or similar)
   - Under **Capabilities**, enable **Sign in with Apple**
5. Click **Continue** → **Register**

### 3. Create Service ID

1. Go to **Identifiers** → **+** (Add)
2. Select **Service IDs** and click **Continue**
3. Configure:
   - **Bundle ID**: `com.corefitapp.service` (or similar)
   - **Primary App ID**: Select the App ID you created above
   - Enable **Sign in with Apple**
4. Click **Continue** → **Register**
5. Under **Configure** for Sign in with Apple:
   - **Domains and Subdomains**:
     ```
     localhost
     your-production-domain.com
     ```
   - **Return URLs**:
     ```
     http://localhost:5173/auth/apple-callback
     https://your-production-domain.com/auth/apple-callback
     ```

### 4. Create Private Key

1. Go to **Keys** → **+** (Add)
2. Configure:
   - **Key Name**: CoreFit Apple Sign-In
   - Enable **Sign in with Apple**
3. Click **Configure**
4. Select your App ID and click **Save**
5. Click **Continue** → **Register**
6. Click **Download** to get the `.p8` file
7. Save this file securely (needed for backend)

Note the displayed **Key ID** and your **Team ID** (visible in the top right). You'll need these for:
- Frontend: `VITE_APPLE_KEY_ID`, `VITE_APPLE_TEAM_ID`
- Backend: Store the downloaded `.p8` file

### 5. Add Apple SDK to Frontend

Add this script tag to `public/index.html`, before the closing `</head>` tag:

```html
<script src="https://appleid.apple.com/appclient/ls/..."></script>
```

Replace the `...` with your app configuration (dynamic versioning).

---

## Frontend Integration Summary

### For Email/Password Login (Already Working)
- Mock users are available by default for testing
- API endpoint: `POST /auth/login`

### For Google OAuth
1. ✅ SDK script added to `public/index.html`
2. ✅ `src/pages/login.tsx` has handlers
3. ✅ Google Sign-In button visible on login page
4. ⏳ Once VITE_GOOGLE_CLIENT_ID is set in `.env`, OAuth works

### For Apple OAuth
1. ✅ SDK script added to `public/index.html`
2. ✅ `src/pages/login.tsx` has handlers
3. ✅ Apple Sign-In button visible on login page
4. ⏳ Once VITE_APPLE_CLIENT_ID, VITE_APPLE_TEAM_ID, VITE_APPLE_KEY_ID are set in `.env`, OAuth works

---

## Profile Completion Flow

When a user logs in via OAuth:

1. **New User**: 
   - User is created in the database
   - An access token is issued
   - User is redirected to `/profile-completion`
   - User fills out profile form with:
     - Full name
     - Fitness goal (Weight loss, Muscle gain, Maintenance, Flexibility)
     - Experience level (Beginner, Intermediate, Advanced)
     - Height (cm) and Weight (kg)
     - Dietary restrictions (optional)

2. **Existing User** (OAuth linked):
   - User is logged in directly
   - User is sent to their dashboard (`/app/user`, etc.)
   - No profile completion required if already done

3. **Email/Password User**:
   - Flow unchanged
   - No profile completion required

---

## Testing

### Test Email/Password Login
```
Email: teste1@treinai.com
Password: 123456
```

### Test OAuth Flows (Local)

1. **Google**: Use your personal Google account or create a test account
2. **Apple**: Use your personal Apple ID or create a test account

### Production Notes

- Ensure your domain is registered in OAuth app settings
- Test callbacks work with your production domain
- Store credentials securely (never commit `.env` to version control)
- Use environment-specific configurations for staging/production

---

## Troubleshooting

### "SDK not loaded" error
- ✅ Check `public/index.html` for script tags
- ✅ Check browser DevTools Console for script loading errors
- ✅ Ensure scripts are loaded before your app initializes

### OAuth button doesn't respond
- ✅ Check `VITE_GOOGLE_CLIENT_ID` / `VITE_APPLE_CLIENT_ID` in `.env`
- ✅ Check browser console for JavaScript errors
- ✅ Verify redirect URIs match in OAuth provider settings
- ✅ Check CORS settings (backend should allow frontend origin)

### "Token validation failed"
- ✅ Verify token expiry (usually 1 hour for access tokens)
- ✅ Check backend is validating tokens correctly
- ✅ Ensure Google/Apple public keys are up to date

### User stuck on profile completion
- ✅ Check network tab (API call to `/auth/complete-profile` should succeed)
- ✅ Check token is being sent in Authorization header
- ✅ Check backend database for profile_completed flag

---

## Backend Integration

The backend supports OAuth via these endpoints:

- `POST /auth/oauth/google/callback` - Google token validation
- `POST /auth/oauth/apple/callback` - Apple token validation
- `PATCH /auth/complete-profile` - Complete user profile after OAuth

See `corefit-backend/README.md` for backend OAuth setup and credentials.

---

## References

- [Google Sign-In Documentation](https://developers.google.com/identity/sign-in/web)
- [Apple Sign in with Apple Documentation](https://developer.apple.com/sign-in-with-apple/)
- [CoreFit Backend README](../corefit-backend/README.md)
