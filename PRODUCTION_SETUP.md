# 🚀 Production Setup Guide

Complete guide to deploy BrailleTutor App to production.

## Table of Contents
1. [Backend Setup (Supabase)](#1-backend-setup-supabase)
2. [AI Configuration (Gemini)](#2-ai-configuration-gemini)
3. [Environment Configuration](#3-environment-configuration)
4. [Building for Production](#4-building-for-production)
5. [App Store Deployment](#5-app-store-deployment)
6. [Monitoring & Analytics](#6-monitoring--analytics)

---

## 1. Backend Setup (Supabase)

### Create Supabase Project (Free Tier)
1. Go to [supabase.com](https://supabase.com) and create an account
2. Click "New Project"
3. Choose a name and strong database password
4. Select region closest to your users
5. Wait for project to provision (~2 minutes)

### Run Database Schema
1. Go to **SQL Editor** in Supabase dashboard
2. Copy contents of `supabase/schema.sql`
3. Paste and click "Run"
4. Verify tables are created in **Table Editor**

### Get API Credentials
1. Go to **Settings > API**
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_ANON_KEY`

### Enable Authentication Providers
1. Go to **Authentication > Providers**
2. Enable **Email** (already enabled by default)
3. Optional: Enable Google, Apple OAuth

### Configure Email Templates
1. Go to **Authentication > Email Templates**
2. Customize confirmation and reset password emails

### Free Tier Limits
- 500 MB database
- 1 GB file storage
- 2 GB bandwidth/month
- Unlimited API requests
- Pauses after 1 week inactivity (upgrade to keep alive)

---

## 2. AI Configuration (Gemini)

### Get Gemini API Key (Free Tier)
1. Go to [ai.google.dev](https://ai.google.dev/)
2. Click "Get API key in Google AI Studio"
3. Sign in with Google account
4. Click "Create API key"
5. Copy the key → `GEMINI_API_KEY`

### Free Tier Limits
- 60 requests per minute
- 1,500 requests per day
- 1 million tokens per minute

### Rate Limiting
The app includes built-in rate limiting to stay within free tier:
```typescript
// In aiTutorService.ts
private checkRateLimit(): boolean {
  // Limits to 55 requests per minute (leaves buffer)
  if (this.rateLimitCounter >= 55) {
    return false;
  }
  this.rateLimitCounter++;
  return true;
}
```

---

## 3. Environment Configuration

### Create .env File
```bash
cp .env.example .env
```

### Fill in Values
```env
# Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...your-key-here

# Gemini AI
GEMINI_API_KEY=AIza...your-key-here

# App Config
APP_ENV=production
ENABLE_ANALYTICS=true
```

### Secure Your Keys
⚠️ **Never commit .env to git!**

The `.gitignore` already includes:
```
.env
.env.local
.env.production
```

For production builds, use EAS Secrets:
```bash
eas secret:create --name SUPABASE_URL --value "https://..."
eas secret:create --name SUPABASE_ANON_KEY --value "eyJ..."
eas secret:create --name GEMINI_API_KEY --value "AIza..."
```

---

## 4. Building for Production

### Install EAS CLI
```bash
npm install -g eas-cli
eas login
```

### Configure EAS Build
Create `eas.json`:
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Build for Android
```bash
# Development build
eas build --platform android --profile development

# Production build (AAB for Play Store)
eas build --platform android --profile production
```

### Build for iOS
```bash
# Development build
eas build --platform ios --profile development

# Production build (IPA for App Store)
eas build --platform ios --profile production
```

### Build Both Platforms
```bash
eas build --platform all --profile production
```

---

## 5. App Store Deployment

### Google Play Store

1. **Create Developer Account** ($25 one-time fee)
   - [play.google.com/console](https://play.google.com/console)

2. **Create App**
   - New app → Enter details
   - Upload AAB from EAS build

3. **Store Listing**
   - Title: "BrailleTutor - Learn Braille"
   - Description, screenshots, feature graphic
   - Category: Education

4. **Content Rating**
   - Complete questionnaire
   - Typically rated "Everyone"

5. **Submit for Review**
   - Usually 1-7 days for first review

### Apple App Store

1. **Apple Developer Account** ($99/year)
   - [developer.apple.com](https://developer.apple.com)

2. **App Store Connect**
   - Create new app
   - Bundle ID must match app.json

3. **Submit via EAS**
```bash
eas submit --platform ios
```

4. **App Information**
   - Name, subtitle, description
   - Screenshots for all device sizes
   - Age rating, pricing

5. **Submit for Review**
   - Usually 24-48 hours

---

## 6. Monitoring & Analytics

### Error Tracking (Sentry - Free)
1. Create account at [sentry.io](https://sentry.io)
2. Create React Native project
3. Install SDK:
```bash
npx expo install @sentry/react-native
```
4. Add to app:
```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  environment: APP_ENV,
});
```

### Analytics (Supabase)
User analytics are automatically tracked in `user_analytics` table:
- Lessons completed per day
- Practice minutes
- Accuracy scores
- Streak data

### View Analytics
```sql
-- Daily active users
SELECT date, COUNT(DISTINCT user_id) 
FROM user_analytics 
GROUP BY date 
ORDER BY date DESC;

-- Average lesson completion
SELECT AVG(lessons_completed) 
FROM user_analytics 
WHERE date > NOW() - INTERVAL '7 days';
```

---

## 7. Free Tier Resource Summary

| Service | Free Limit | Monthly Cost to Upgrade |
|---------|------------|------------------------|
| Supabase | 500MB DB, 2GB bandwidth | $25/mo Pro |
| Gemini AI | 60 req/min, 1500/day | Pay-per-use |
| Expo/EAS | 30 builds/month | $99/mo for more |
| Sentry | 5K errors/month | $26/mo |
| **Total** | **$0/month** | ~$150/mo at scale |

---

## 8. Checklist

### Before Launch
- [ ] All API keys configured
- [ ] Database schema deployed
- [ ] Email templates customized
- [ ] App icons and splash screen
- [ ] Store screenshots ready
- [ ] Privacy policy URL
- [ ] Support email configured

### Post-Launch
- [ ] Monitor Sentry for errors
- [ ] Check Supabase usage
- [ ] Review Gemini API usage
- [ ] Respond to user reviews
- [ ] Plan regular updates

---

## Need Help?

- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Gemini Docs**: [ai.google.dev/docs](https://ai.google.dev/docs)
- **Expo Docs**: [docs.expo.dev](https://docs.expo.dev)
- **EAS Build**: [docs.expo.dev/build](https://docs.expo.dev/build)
