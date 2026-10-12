# Travel Companion — Supabase connection

This ZIP preserves your current HTML/CSS/JS design and connects itinerary, expenses, and food/bookmarks to a shared Supabase row. The website continues to keep a local browser cache as a fallback.

## 1. Create the Supabase table

1. Open your Supabase project.
2. Open **SQL Editor** → **New query**.
3. Open `supabase_setup.sql` from this folder, copy all SQL into the editor, and click **Run**.
4. In **Database → Tables**, confirm `trip_shared_state` exists.
5. In **Database → Replication** (or **Integrations → Realtime**, depending on the dashboard layout), confirm `trip_shared_state` is enabled for Realtime if the SQL did not enable it automatically.

## 2. Get the connection values

In Supabase, open **Project Settings → API** (or **Connect**, depending on your dashboard UI):
- Project URL
- Publishable key, or legacy `anon` public key

Do **not** use `service_role`, `secret`, or any private server key in browser code.

Open `config.js` and replace the placeholders:

```js
window.TRAVEL_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabaseAnonKey: "YOUR_PUBLISHABLE_OR_ANON_KEY",
  tripId: "china-trip-2026"
};
```

Keep the `tripId` identical on every device that should share this trip.

## 3. Run with XAMPP

1. Put the whole extracted `Travel_Companion_Supabase` folder in `C:\xampp\htdocs\`.
2. Start Apache in XAMPP.
3. Visit `http://localhost/Travel_Companion_Supabase/`.
4. Check the bottom footer status. It should say **云端已连接** or **已载入云端资料**.
5. Add a test expense or bookmark, then open the same site on another device/browser to check sync.

## 4. First-time data behavior

- If the cloud row already exists, its state is loaded and takes precedence over the browser's local cache.
- If the row does not exist yet, the first connected browser seeds Supabase with its current local data.
- Changes are saved to localStorage immediately and then sent to Supabase; open devices receive Realtime updates.
- This implementation stores the app state as JSON in one row, which keeps the existing front-end behavior intact. It is a lightweight shared-trip prototype, not a normalized multi-user database.

## Security note — please read

The included SQL deliberately grants anonymous read/write access so a group can test sharing without a login screen. **Anyone who obtains your Supabase project URL and public key can potentially read or modify this shared trip data.** RLS is enabled, but these permissive policies are not private access control. Do not store passport details, account credentials, or other sensitive data. Before making the site public, tell me and I can help switch it to Supabase Auth + restricted policies.

## Troubleshooting

- **“尚未连接 Supabase”**: placeholders in `config.js` have not been replaced, or the Supabase JS CDN did not load.
- **“连接失败：请检查 URL、Key、SQL”**: check Project URL/key and confirm the SQL ran successfully. Open browser DevTools → Console for the exact error.
- **Data does not appear on other devices**: make sure every device uses the same `tripId`, has internet access, and the Realtime table publication is enabled.
- **A browser has old local data**: once a cloud row exists, cloud state takes precedence. Back up important local data before connecting the first time.
- This project uses a public exchange-rate API; exchange rates require internet access and are not guaranteed to update every second.

## Files

- `index.html`: page structure and Supabase JS CDN
- `style.css`: existing visual design (preserved)
- `app.js`: current app behavior plus cloud load/save/realtime sync
- `data.js`: initial itinerary and starter bookmarks
- `config.js`: Supabase Project URL, public key, and shared trip ID
- `supabase_setup.sql`: SQL table and policies
- `assets/images/`: travel illustrations
