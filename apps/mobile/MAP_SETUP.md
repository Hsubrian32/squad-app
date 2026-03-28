# Meetup Map — Setup Guide

## 1. Install packages

```bash
cd apps/mobile
npx expo install react-native-maps expo-location
```

## 2. Google Maps API key (required for Android + dark style)

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an API key and enable:
   - Maps SDK for Android
   - Maps SDK for iOS
3. Add the key to your environment:

**`apps/mobile/.env.local`** (create if it doesn't exist)
```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
```

### iOS — add to `app.json`
```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "your_key_here"
      }
    }
  }
}
```

### Android — add to `app.json`
```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "your_key_here"
        }
      }
    }
  }
}
```

## 3. Location permissions — add to `app.json`

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Squad uses your location to show the meetup map and let you check in at the venue."
      }
    },
    "android": {
      "permissions": [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION"
      ]
    }
  }
}
```

## 4. Run the Supabase migration

```bash
cd supabase
supabase db reset
# or push if connected to a remote project:
supabase db push
```

Migration `20260101000006_meetup_map.sql` adds:
- `lat` / `lng` columns to `venues`
- `meetup_locations` table (one active location per group)
- `venue_switch_proposals` table (15-min voting window)
- `venue_switch_votes` table (one vote per member per proposal)
- `group_arrival_stats` view
- Check-in lat/lng columns on `group_members`
- Full RLS policies

## 5. Deploy the Edge Function

```bash
supabase functions deploy process-venue-vote
```

Set the environment variables on your Supabase project:
```bash
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 6. Usage

The map is accessed from the **Group** tab via the "Open meetup map" button (only visible when the group is `forming` or `active`).

### Flow
1. User opens map → sees dark Google Maps with venue marker + 200m proximity circle
2. Arrival status grid in bottom sheet (On my way / I'm here / Running late / Can't make it)
3. Check-in button activates once the user is within 200m of the venue
4. "Propose a venue switch" link → choose nearby venue or drop a pin → 15-min group vote
5. 2/3 majority → location switches live for all members via Realtime

### Check-in radius
The `CHECK_IN_RADIUS_METERS` constant in `lib/utils/location.ts` defaults to **200m**. Adjust as needed.

### Venue switch rules
- Cannot propose a switch if another vote is already open
- Cannot propose if more than 2 members have already arrived
- Proposed location must be within **2km** of the original venue
- Voting window: **15 minutes** (set by `expires_at` default in DB)
- Threshold: **2/3 of active members** must vote yes
