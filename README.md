# Setting up Ledger (synced across devices)

This app uses **Firebase** (free tier) for login + data storage, and **GitHub Pages** to host it as a real website.

## Files in this folder
- `index.html` — the page structure
- `style.css` — all styling (now mobile-responsive)
- `app.js` — all the app logic (expense + income tracking, auth, export)
- `firebase-config.js` — **the only file you need to edit** with your own Firebase keys

All four files need to sit in the same folder when you deploy — `index.html` loads the other three by relative path.

## 1. Create a Firebase project (~5 min)
1. Go to https://console.firebase.google.com → **Add project** → give it any name → finish the wizard (you can skip Google Analytics).
2. In the left sidebar: **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save**.
3. In the left sidebar: **Build → Firestore Database → Create database → Start in production mode → choose a location → Enable**.
4. Click the gear icon (top left) → **Project settings → General**, scroll to "Your apps" → click the **</> (Web)** icon → register an app (any nickname, no need for Firebase Hosting) → you'll get a `firebaseConfig` object.

## 2. Add your config
Open `firebase-config.js` and paste your real values in place of the placeholders. This is the only file you should need to touch.

## 3. Lock down Firestore so only you can read/write your data
In Firebase Console → **Firestore Database → Rules**, replace the default rules with:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
Click **Publish**. This is what actually protects your data — without it, anyone could read/write any user's document.

## 4. Push to GitHub Pages
1. In your GitHub repo, add all four files (`index.html`, `style.css`, `app.js`, `firebase-config.js`) to the root — or to a `/docs` folder, together in the same folder.
2. Go to repo **Settings → Pages** → under "Build and deployment", set **Source: Deploy from a branch**, pick your branch and folder → **Save**.
3. GitHub will give you a URL like `https://yourusername.github.io/your-repo/` — that's your permanent link.

## 5. Use it
- Open that URL on your laptop, **create an account** (any email + password).
- Open the same URL on your phone, **sign in** with the same email + password.
- Both devices read/write the same Firestore document, so your data stays in sync.
- Forgot your password? Use the **"Forgot password?"** link on the sign-in screen — Firebase emails you a reset link.

## What's new in this version
- **Split into separate files** (HTML/CSS/JS) instead of one big file — easier to find and edit things.
- **Forgot password** flow using Firebase's built-in password reset email.
- **Two new transaction types**: Investments and Savings, alongside Need/Want — available everywhere a Type appears (Add Expense form, Budgets, Dashboard, Log badges). The "Investments" category now defaults to type "Investments" rather than "Want".
- **Mobile-friendly layout**: tables scroll horizontally on narrow screens, the top bar and tabs adapt, text/padding shrink slightly on phones.
- **Income tracking**: a new Expense/Income switch at the top of the app. Income has its own categories (Wages, Other) and subcategories, its own Add/Log/Summary tabs, and its own sheet in the Excel export. It doesn't have budgets, since income isn't something you "spend down" — just a monthly total + category/subcategory breakdown.
- **Profile menu**: the avatar circle in the top-right replaces the old sign-out button. Click it for your first/last name (editable right there, with a Save button), your email, when you joined, your last sign-in, your entry counts, and Sign out. The avatar shows the first letter of your first name + first letter of your last name once you've set them — falls back to initials from your email until you do.
- **Category/subcategory selection — now in the profile menu**: click "Manage categories" in the profile dropdown to get one combined screen for both **Expense categories** and **Income categories**, each with their own check/uncheck list and Select all / Deselect all buttons. Add Expense, Budgets, Dashboard, Breakdown, Add Income, and Income Summary only show what you've selected. Nothing is deleted when you uncheck something — it's just held at 0 and excluded from totals, and the Excel export still lists every category/subcategory (with a "Selected" column) so the full picture is always there if you need it.

## Notes
- Firebase's free "Spark" tier covers this kind of personal use comfortably.
- "Export to Excel" still works entirely in your browser — no Firebase involved, and now includes both Expense and Income sheets.
- If something doesn't load, open your browser's dev console (F12) — Firebase will print a clear error if the config or rules are wrong.
