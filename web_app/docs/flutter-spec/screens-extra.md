# Flutter → React/MUI pixel spec — extra screens

Source of truth (read-only):
- `mobile_app/lib/screens/signup_screen.dart` (1255 lines, 8-page onboarding wizard)
- `mobile_app/lib/screens/create_post_screen.dart` (443 lines)
- `mobile_app/lib/screens/nearby_screen.dart` (272 lines)
- `mobile_app/lib/screens/group_join_screen.dart` (336 lines)
- `mobile_app/lib/screens/room_chat_screen.dart` (746 lines)

Global theme comes from `mobile_app/lib/config/app_theme.dart` (used by `MaterialApp.theme` / `darkTheme`).

---

## 0. Global constants & Flutter defaults that these screens inherit

| Item | Light | Dark |
|---|---|---|
| Primary / seed | `#026AFD` | `#026AFD` |
| `scaffoldBackgroundColor` | `#FFFFFF` | `#121212` |
| AppBar background | `#FFFFFF` | `#121212` |
| AppBar foreground | `#000000` | `#FFFFFF` |
| AppBar elevation | 0 | 0 |
| AppBar `centerTitle` | true | true |
| AppBar height (Material default) | 56 dp + status-bar inset | same |
| AppBar title style (M3 `titleLarge`, default) | 22 px / w400 | same |
| Body text default | Roboto 14 px / w400, `#000000DE` | Roboto 14 px, `#FFFFFFDE` |
| ElevatedButton default | bg `#026AFD`, fg `#FFFFFF`, radius **26**, `minimumSize: Size(infinity, 56)`, elevation 0 | same |
| OutlinedButton | no theme override → radius 20 (M3 default), 1 px outline, fg primary | same |
| TextField `contentPadding` | 16 h / 16 v | 16 h / 16 v |
| TextField `filled` default | true, fill `#FFFFFF` | true, fill `#1E1E1E` |
| TextField enabledBorder default | 1 px `#8E8E8E`, radius 12 | 1 px `#333333`, radius 12 |
| TextField focusedBorder default | 2 px `#026AFD`, radius 12 | same |
| SnackBar theme | floating, radius **20**, bg `#026AFD`, text `#FFFFFF` | same |
| Icon default size | 24 | 24 |
| IconButton default tap target | 48 × 48 | 48 × 48 |
| ListTile default | contentPadding 16 h, minVerticalPadding 4, title 16, subtitle 14 | same |
| Navigation transition | MaterialPageRoute (platform default) | same |

Material color hexes used (Flutter swatch → hex):

| Token | Hex |
|---|---|
| `Colors.grey[50]` | `#FAFAFA` |
| `Colors.grey[100]` / `grey.shade100` | `#F5F5F5` |
| `Colors.grey[200]` / `grey.shade200` | `#EEEEEE` |
| `Colors.grey[300]` / `grey.shade300` | `#E0E0E0` |
| `Colors.grey[400]` / `grey.shade400` | `#BDBDBD` |
| `Colors.grey[500]` / `Colors.grey` / `grey.shade500` | `#9E9E9E` |
| `Colors.grey[600]` / `grey.shade600` | `#757575` |
| `Colors.grey[700]` | `#616161` |
| `Colors.black87` | `#000000DE` |
| `Colors.black54` | `#0000008A` |
| `Colors.black45` | `#00000073` |
| `Colors.black38` | `#00000061` |
| `Colors.white70` | `#FFFFFFB3` |
| `Colors.white54` | `#FFFFFF8A` |
| `Colors.red` | `#F44336` |
| `Colors.redAccent` | `#FF5252` |
| `Colors.amber[50]` | `#FFF8E1` |
| `Colors.amber[800]` | `#FF8F00` |

---

# 1. SignupScreen — 8-page onboarding wizard

**Route:** `/signup` via `onGenerateRoute`, optional arg `inviteCode: String`. State: `PageController`, `_currentScreen` 0..7.

## 1.1 Scaffold / AppBar (persistent across all 8 pages)

- `Scaffold` (no SafeArea wrapper; AppBar consumes top inset, page content does **not** pad the bottom home-indicator area).
- `AppBar`, `elevation: 0`, colors from theme (white/`#121212`), `centerTitle: true` (theme).
  - **leading:** `IconButton(icon: Icons.arrow_back)` — icon color `#FFFFFF` dark / `#000000` light, default size 24; `onPressed: _previousScreen` (go back one page; on page 0 → `Navigator.pop`).
  - **title:** `null` on page 0. On pages 1..7: `Row(mainAxisAlignment: center)` of **8** step dots generated `List.generate(8, ...)`:
    - each dot: `Container(margin: EdgeInsets.symmetric(horizontal: 4), width: 8, height: 8, shape: circle)`
    - filled color `#026AFD` when `_currentScreen >= index` (i.e. current + all previous filled)
    - unfilled `#DDDDDD` light / `#2C2C2E` dark
    - total row width = 8×8 + 8×(2×4) = **128 dp**.
  - **actions:** none.
- **body:** `PageView(physics: NeverScrollableScrollPhysics)` — swipe disabled, pages only change via buttons. Page change animation: **300 ms, `Curves.easeInOut`** (`animateToPage`).
- Page order: `0 _buildScreen1` (email/password) → `1 _buildAvatarScreen` → `2 _buildScreen2` (name/dob) → `3 _buildScreen3` (gender) → `4 _buildScreen4` (location) → `5 _buildScreen5` (photos) → `6 _buildScreen6` (bio) → `7 _buildScreen7` (status).
- Every page root: `SingleChildScrollView(padding: EdgeInsets.all(24))` + `Column` (default `crossAxisAlignment: center`, default `mainAxisSize: max`). No max-width constraint on any page (full-bleed to screen minus 24 left/right).
- Shared dark/light tokens per page: text `#FFFFFF`/`#000000`; input fill `#2C2C2E`/`#F5F5F5`; input border `#3A3A3C`/`#E0E0E0`; icon/hint greys as noted.

## 1.2 Page 0 — `_buildScreen1` (Email + password)

Top-down (`Column` children, exact order):

| # | Widget | Values |
|---|---|---|
| 1 | `SizedBox` | height 40 |
| 2 | `TextField` email | hint `'Email address'`; `keyboardType: TextInputType.emailAddress`; text style color `#FFFFFF`/`#000000`, fontSize default (16, M3 bodyLarge); hint color `#9E9E9E` dark / `#757575` light; filled, fill per page table; border radius 12, 1 px `#3A3A3C`/`#E0E0E0`; focused 2 px `#026AFD`; contentPadding 16/16; no label, no errorText |
| 3 | `SizedBox` | height 16 |
| 4 | `TextField` password | hint `'Password'`; `obscureText: _obscurePassword` (initially true); same decoration; suffixIcon `IconButton` with `Icons.visibility_off` when obscured else `Icons.visibility`, color `#BDBDBD` dark / `#9E9E9E` light (default 24) toggling |
| 5 | `SizedBox` | height 24 |
| 6 | `SizedBox(width: infinity, height: 52)` → `ElevatedButton` | bg `#026AFD`, radius **26**, elevation default 0; label `'Sign Up'` fontSize **17**, `FontWeight.w600`, `#FFFFFF`; while loading replaces label with `SizedBox(24,24)` → `CircularProgressIndicator(strokeWidth: 2, color: #FFFFFF)`; `onPressed: null` while loading |
| 7 | `SizedBox` | height 16 |
| 8 | `Row` | `Expanded(Divider(color: #3A3A3C/#E0E0E0))` + `Padding(horizontal: 16)` `Text('or')` color `#9E9E9E`/`#757575` (14) + `Expanded(Divider)`; Divider default thickness 1, height 16 |
| 9 | `SizedBox` | height 16 |
| 10 | `SizedBox(width: infinity, height: 52)` → `OutlinedButton` | border 1 px `#E0E0E0`/`#3A3A3C`, radius **26**, no fill; content `Row(mainAxisAlignment: center)`: `Image.network('https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Google_Favicon_2025.svg/250px-Google_Favicon_2025.svg.png', width: 20, height: 20)`, `SizedBox(width: 12)`, `Text('Continue with Google')` 17 / w600 / textColor |
| 11 | `SizedBox` | height 24 |
| 12 | `Row(mainAxisAlignment: center)` | `Text('Already have an account? ')` color `#BDBDBD` dark / `#757575` light (14) + `GestureDetector` → `Text('Log in')` `#026AFD` w600 (14); tap = `Navigator.pop(context)` |

Validation (on Sign Up tap), `_isValidEmail` regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`:
- invalid → SnackBar `'Please enter a valid email'`
- `password.length < 6` → SnackBar `'Password must be at least 6 characters'`
- neither shown inline; no `errorText` anywhere.

API: `POST {base}/api/signup` JSON `{ email, password, inviteCode? }` (`inviteCode` only if non-empty). 201 → reads `token`, `userId`, persists in SharedPreferences (`token`, `userId`), advances to page 1. Non-201 → SnackBar `error['error']` ?? `'Signup failed'`. Network exception → SnackBar `'Connection error'`.

## 1.3 Page 1 — `_buildAvatarScreen`

| # | Widget | Values |
|---|---|---|
| 1 | `SizedBox` | height 40 |
| 2 | `Text('Upload a Profile Picture')` | fontSize **24**, `bold`, textColor |
| 3 | `SizedBox` | height 12 |
| 4 | `Text` center | verbatim: `'Choose a clear photo of yourself. A profile picture is mandatory to help keep the community authentic and safe.'`; fontSize **15**, color `#BDBDBD` dark / `#9E9E9E` light |
| 5 | `SizedBox` | height 50 |
| 6 | `GestureDetector` → `_uploadPhoto(0)` | child `Stack` |
| 6a | circle uploader `Container` | **160 × 160**, `BoxShape.circle`, bg `#1E1E1E` dark / `#F5F5F5` light; border **4 px** (`#026AFD` if photo set, else `#3A3A3C`/`#E0E0E0`); boxShadow `black` alpha **0.30** dark / **0.05** light, `blurRadius: 15`, `spreadRadius: 2` |
| 6b | uploader content | uploading → `CircularProgressIndicator(strokeWidth: 3, color: #026AFD)` centered; photo → `ClipOval(Image.network(cover))`; empty → centered Column: `Icon(Icons.add_a_photo_rounded, size: 40, #026AFD)`, `SizedBox(height: 8)`, `Text('Upload', color: #8E8E8E, w600, 14)` |
| 6c | if photo set | `Positioned(right: 4, bottom: 4)` → `Container(padding: 6, circle, bg #026AFD)` → `Icon(Icons.check, #FFFFFF, size: 20)` |
| 7 | `SizedBox` | height 60 |
| 8 | `SizedBox(width: infinity, height: 52)` → `ElevatedButton` | bg `#026AFD`; `disabledBackgroundColor: #026AFD` @ 30 % (`#026AFD4D`); radius 26; `elevation: 2` when enabled else 0; label `'Next Step'` 17 w600, color `#FFFFFF` enabled / `#FFFFFF8A` dark `#00000073` light disabled; `onPressed: avatar != null ? _nextScreen : null` |

Interaction: tap circle → `ImagePicker().pickImage(source: ImageSource.gallery)`; if no token → SnackBar `'Please sign up first'`; uploads via `POST /api/upload-photo` (multipart field `photo`) reading `{ url }`; success SnackBar `'Photo uploaded'`; failure SnackBar `'Failed to upload photo'`; per-slot loading flag.

## 1.4 Page 2 — `_buildScreen2` (Name + birth date)

| # | Widget | Values |
|---|---|---|
| 1 | `SizedBox` | 40 |
| 2 | `Text('What should we call you?')` | 24, **w600**, textColor |
| 3 | `SizedBox` | 40 |
| 4 | `TextField` name | hint `'Full name'`; same input decoration as page 0 (fill/border/radius 12/focus 2 px `#026AFD`); text color textColor |
| 5 | `SizedBox` | 16 |
| 6 | `TextField` DOB | `readOnly: true`; hint `'Birth date (YYYY-MM-DD)'`; suffix `Icon(Icons.calendar_today, color: #026AFD)` (24); same decoration; `onTap` → date picker |
| 7 | `SizedBox` | 24 |
| 8 | `SizedBox(infinity, 52)` `ElevatedButton` | label `'Next'` 17 w600 `#FFFFFF`; bg `#026AFD`; radius 26 |

Date picker (`showDatePicker`): `initialDate: 2000-01-01`, `firstDate: 1950-01-01`, `lastDate: DateTime.now()`. Wrapped in `Theme` override: `ColorScheme.light(primary: #026AFD, onPrimary: #FFFFFF, onSurface: #FFFFFF dark / #000000 light, surface: #1E1E1E dark / #FFFFFF light)`. On pick: `_birthDate = yyyy-MM-dd` (`toIso8601String().split('T')[0]`), written into the field.

## 1.5 Page 3 — `_buildScreen3` (Gender + interested-in)

| # | Widget | Values |
|---|---|---|
| 1 | `SizedBox` | 40 |
| 2 | `Text('Who are you?')` | 24 w600 textColor |
| 3 | `SizedBox` | 24 |
| 4 | `Row` | 3 × `_buildGenderButton` `Expanded`, gaps `SizedBox(width: 12)` between. Labels/values: `'Male'`/`male`, `'Female'`/`female`, `'Other'`/`other`. Default `_gender = 'male'` |
| 5 | `SizedBox` | 40 |
| 6 | `Text('Who are you interested in?')` | 24 w600 textColor |
| 7 | `SizedBox` | 24 |
| 8 | `Row` | 3 × `_buildInterestButton` `Expanded`, gap 12. `'Men'`/`men`, `'Women'`/`women`, `'Everyone'`/`everyone`. Default `_interestedIn = 'men'` |
| 9 | `SizedBox` | 40 |
| 10 | `SizedBox(infinity, 52)` `ElevatedButton` | `'Next'` 17 w600 white, bg `#026AFD`, radius 26 |

Selector chip anatomy (gender **and** interest identical):
- height **52**, width = (screenWidth − 48 − 24) / 3 (equal thirds), `BorderRadius.circular(26)`, `Border.all(width 1)`
- selected: bg `#026AFD`, border `#026AFD`, label `#FFFFFF`
- unselected: bg `#F5F5F5` light / `#2C2C2E` dark, border `#E0E0E0` light / `#3A3A3C` dark, label `#000000` light / `#FFFFFF` dark
- label: default fontSize (14) **w700** for gender/interest buttons; centered; `GestureDetector(behavior: HitTestBehavior.opaque)` selects immediately (no confirm).

## 1.6 Page 4 — `_buildScreen4` (Location permission)

`hintColor` on this page = `#BDBDBD` dark / `#666666` light.

| # | Widget | Values |
|---|---|---|
| 1 | `SizedBox` | **100** |
| 2 | `Text('Enable Location', textAlign: center)` | 24 w600 textColor |
| 3 | `SizedBox` | 8 |
| 4 | `Text('We use your location to show nearby people', textAlign: center)` | default 14, color hintColor |
| 5 | `SizedBox` | 40 |
| 6 | `SizedBox(infinity, 52)` `ElevatedButton` | label `'Allow location'` 17 w600 white; bg `#026AFD`; radius 26; tap runs `_getLocation()` then `_nextScreen()` |
| 7 | `SizedBox` | 16 |
| 8 | `SizedBox(infinity, 52)` `OutlinedButton` | label `'Skip'` 17 w600 textColor; 1 px border `#E0E0E0`/`#3A3A3C`; radius 26; tap `_nextScreen()` |

Location flow: `Geolocator.isLocationServiceEnabled()` / `checkPermission()`; denied → SnackBar `'Location permission denied. Continue without location?'` and advance with null lat/lng; otherwise `getCurrentPosition(desiredAccuracy: high, timeLimit: 10 s)`; failures silently continue. (`ApiService.getCurrentPosition()` — used by Nearby — uses `low` accuracy, 4 s timeout, then `getLastKnownPosition()`.)

## 1.7 Page 5 — `_buildScreen5` (Photo grid, 6 slots)

| # | Widget | Values |
|---|---|---|
| 1 | `SizedBox` | 40 |
| 2 | `Text('Add photos')` | 24 w600 textColor |
| 3 | `SizedBox` | 24 |
| 4 | `GridView.builder` | `shrinkWrap: true`, `SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, crossAxisSpacing: 12, mainAxisSpacing: 12)` → square cells, cell width ≈ (screenWidth − 48 − 24)/3 (**106 dp** at 390-wide), `itemCount: 6` |
| 5 | `SizedBox` | 24 |
| 6 | `SizedBox(infinity, 52)` `ElevatedButton` | `'Next'` 17 w600 white, bg `#026AFD`, `disabledBackgroundColor: #026AFD4D` (button is always enabled), radius 26 |

Grid cell 0 (main photo, **not tappable**):
- `Container` bg `#F5F5F5` light / `#1E1E1E` dark; border **2 px `#026AFD`**; radius **16**
- image → `ClipRRect(radius 14)` + `Image.network(cover, width/height infinity)`
- empty → `Center(Icon(Icons.person, color: #026AFD))` (24)
- badge `Positioned(top: 4, left: 4)`: `Container(padding: h 6 / v 2, bg #026AFD, radius 8)` → `Text('Main', #FFFFFF, fontSize 10, bold)`

Grid cells 1–5 (tappable → `_uploadPhoto(index)`):
- bg `#F5F5F5` light / `#2C2C2E` dark; border 1 px `#E0E0E0`/`#3A3A3C`; radius **16**
- uploading → `CircularProgressIndicator(strokeWidth: 2, color: #026AFD)`
- image → `ClipRRect(radius 16)` cover
- empty → `Center(Icon(Icons.add_a_photo_outlined, color: #8E8E8E light / #BDBDBD dark))` 24

## 1.8 Page 6 — `_buildScreen6` (Bio)

| # | Widget | Values |
|---|---|---|
| 1 | `SizedBox` | 40 |
| 2 | `Text('Your Bio')` | 24 w600 textColor |
| 3 | `SizedBox` | 40 |
| 4 | `TextField` bio | `maxLines: 4`, hint `'Describe yourself...'`, same fill/border/radius 12/focus 2 px; no maxLength |
| 5 | `SizedBox` | 24 |
| 6 | `SizedBox(infinity, 52)` `ElevatedButton` | `'Next'` 17 w600 white, `#026AFD`, radius 26 |

## 1.9 Page 7 — `_buildScreen7` (Status + submit)

| # | Widget | Values |
|---|---|---|
| 1 | `SizedBox` | **100** |
| 2 | `Text('Ready to connect')` | 24 w600 textColor |
| 3 | `SizedBox` | 40 |
| 4 | `Row` | 2 × `Expanded` chips height **52**, radius **26**, gap `SizedBox(width: 12)`. Labels `'Available'` / `'Busy'` (values `available`/`busy`), label **w600** (lighter than page 3's w700), selected bg/border `#026AFD` + white text; unselected `#F5F5F5`/`#2C2C2E` + border `#E0E0E0`/`#3A3A3C` + black/white text. Default `_status = 'available'` |
| 5 | `SizedBox` | 40 |
| 6 | `SizedBox(infinity, 52)` `ElevatedButton` | `'Go Live'` 17 w600 white, bg `#026AFD`, radius 26; loading → `24×24` spinner strokeWidth 2 white; disabled while loading |

Submit (`PUT {base}/api/me`, Bearer token):
```json
{ "name": "<trim>", "birthDate": <unix seconds>|null, "gender": "male|female|other",
  "interestedIn": ["men","women"] | ["men"] | ["women"], "bio": "<trim>",
  "status": "available|busy", "photos": ["<url>", ...] }
```
- `interestedIn`: `'everyone'` → `['men','women']`; else single-element array.
- no token → SnackBar `'Session expired. Please sign up again.'`
- 200 → SnackBar `'Welcome to Zukaping!'`, `WebSocketService.connect()`, `Navigator.pushNamedAndRemoveUntil('/feed')`
- else SnackBar `error['error']` ?? `'Failed to save profile'`; exception → `'Failed to save profile'`

## 1.10 Google-auth failure bottom sheet (`_showGoogleFallbackOption`)

`showModalBottomSheet(backgroundColor: #FFFFFF light / #1C1C1E dark, shape: vertical top radius 24)`.

Contents (`Container(padding: EdgeInsets.all(28))`, `Column(mainAxisSize: min, crossAxisAlignment: start)`):

| # | Widget | Values |
|---|---|---|
| 1 | `Row` | `Container(padding: 10, circle, bg #FFF8E1)` → `Icon(Icons.warning_amber_rounded, #FF8F00, size 28)`; `SizedBox(width: 16)`; `Text('Google Auth Failed')` 20 bold textColor |
| 2 | `SizedBox` | 16 |
| 3 | `Text` | `'Google authentication failed or is not configured for this environment.\n\nError: $originalError'`; 14, `height: 1.5`, color `#BDBDBD` dark / `#616161` light |
| 4 | `SizedBox` | 28 |
| 5 | `Row` | 2 × `Expanded` + `SizedBox(width: 12)` |
| 5a | `OutlinedButton 'Cancel'` | `padding: EdgeInsets.symmetric(vertical: 14)`, border 1 px `#E0E0E0`/`#3A3A3C`, radius **16**, label textColor w600 (14) |
| 5b | `ElevatedButton 'Use Demo Account'` | bg `#026AFD`, `padding vertical 14`, `elevation: 0`, radius **16**, label **`#000000`** w600 (14) — black on blue, verbatim |

Demo login: `ApiService.login('demo@zukaping.com','password123')`; on `error:true` → `ApiService.signup({email, password, name:'Demo User', gender:'Other', interestedIn:['everyone']})` then re-login. Success SnackBar `'Logged in with Demo Account!'` → `/feed` removeUntil. Failure SnackBar `'Demo login failed: <error>'`.

## 1.11 Other signup strings / states

- Google sign-in success SnackBar: `'Google account linked successfully!'`
- Google: `ApiService.googleAuth(idToken)` → `POST /api/google-auth {credential}`; reads `error`, `message`, `token`, `userId`, `isNewUser`, `hasCompletedOnboarding`.
- If `isNewUser == true || hasCompletedOnboarding == false` → continue wizard; else `pushNamedAndRemoveUntil('/feed')`.
- Throw when idToken null: `'Failed to retrieve Google token'`; auth throw: `result['message'] ?? 'Authentication failed'`.

---

# 2. CreatePostScreen — `/create-post`

State: `_selectedCategory` (default `_categories[0]` = `'Hangout'`), `_selectedDuration` (default `30`), `_selectedImages` (max 4), `_isPosting`.

## 2.1 AppBar

`elevation: 0`; **leading** `IconButton(Icons.arrow_back)` color `#FFFFFF`/`#000000` (24), pops; **title** `Text('Post Request')` 18 / **w600** / textColor; `centerTitle: true`; no actions.

## 2.2 Body `SingleChildScrollView(padding: EdgeInsets.all(24))`, `Column(crossAxisAlignment: start)`

Order and spacing:

1. **Section label** `Text('Category')` — 14 / w600 / `#666666` light, `#BDBDBD` dark.
2. `SizedBox(height: 12)`
3. **`Wrap(spacing: 12, runSpacing: 12)`** of 5 category chips, order: `'Hangout'`, `'Date'`, `'Show me around'`, `'Networking'`, `'Casual Chat'`.
4. `SizedBox(height: 32)`
5. **Section label** `'Your request'` (same style)
6. `SizedBox(height: 12)`
7. **Input card** `Container`:
   - bg `#1C1C1E` dark / `#FAFAFA` light; radius **16**; border 1 px, color = `#026AFD` **when text non-empty**, else `#2C2C2E` dark / `#E0E0E0` light.
   - `Stack`: `TextField(controller, maxLines: 5, maxLength: 120)`, hint `'Write a short message (max 120 chars)'`, hint color `#8E8E8E`, `border: InputBorder.none`, `contentPadding: EdgeInsets.all(16)`, `counterText: ''` (default counter hidden), text 18 / textColor.
   - `Positioned(bottom: 12, right: 16)` → `'${text.length}/120'` 14 / `#8E8E8E` (live).
8. `SizedBox(height: 32)`
9. **Section label** `'Duration'`
10. `SizedBox(height: 12)`
11. `Row` of duration chips, each wrapped in `Padding(right: 12)`: `'30 mins'`→30, `'1 hr'`→60, `'2 hrs'`→120.
12. `SizedBox(height: 32)`
13. **Section label** `'Photos (optional)'`
14. `SizedBox(height: 12)`
15. `Row`: selected image thumbs (each `Padding(right: 12)`), then add tile if `< 4`.
16. `SizedBox(height: 40)`
17. `ValueListenableBuilder` → `SizedBox(infinity, 52)` `ElevatedButton` (see below).
18. `SizedBox(height: 16)`
19. `Center(Text('Your request will be visible to nearby users immediately.'))` — 14, `height: 1.4`, `#666666` light / `#BDBDBD` dark, center.
20. `SizedBox(height: 40)` (bottom spacer).

**Chip anatomy (category + duration identical):**
- `Container(padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12))`
- radius **26**, border 1 px
- selected: bg `#026AFD`, border `#026AFD`, label **`#000000`** (black text on blue)
- unselected: bg `#1C1C1E` dark / `#F5F5F5` (`grey[100]`) light; border `#2C2C2E` dark / `#E0E0E0` (`grey[300]`) light; label `#FFFFFFB3` dark / `#000000DE` light
- label: fontSize **16**, **w600**
- No checkmark / icons. Tap selects immediately (single-select).

**Image thumbnails (selected):**
- 80 × 80 `Container`, radius **12**, border 1 px `#E0E0E0`, clipped `Image` cover (web: `Image.network(path)`, mobile: `Image.file`), 12 px right gap between items.
- remove button `Positioned(top: -6, right: -6)`: 24 × 24 white circle, border 1 px `#E0E0E0`, shadow `black` alpha **0.10**, blur 4, offset **(0, 2)**; `Icon(Icons.close, size: 14, #000000)`.

**Add tile:** 80 × 80, radius 12, bg `#1C1C1E` dark / `#FAFAFA` light, border 1 px `#2C2C2E` dark / `#E0E0E0` light, `Icon(Icons.add_photo_alternate_outlined, size: 32, #8E8E8E)`.

**Submit button:**
- width infinity, height **52**, radius **26**, `elevation: 0`
- bg `#026AFD`, foreground `#000000`; disabled bg `#026AFD4D`, disabled fg `#00000061`
- label `'Post Request'` 17 / w600 (inherits black fg)
- loading → 20 × 20 spinner, strokeWidth 2, `#000000`
- enabled only when: category != null && duration != null && content.trim() not empty && length <= 120 && !isPosting (category/duration default non-null → effectively "text non-empty, ≤ 120").

## 2.3 Interactions / pickers / API

- Tap add tile → `ImagePicker().pickMultiImage(imageQuality: 85, limit: 4 − count)`; if already 4 → SnackBar `'Maximum 4 images allowed'`.
- Tap existing thumb → navigate down; tap × → remove.
- Submit: upload each image `POST /api/upload-photo` (multipart `photo`) → `url`; on error SnackBar `'Failed to upload image'`, stop, `_isPosting = false`. Then `POST /api/post` JSON:
  ```json
  { "content": "<trim>", "category": "<label>", "duration": 30|60|120, "media": ["<url>", ...] }
  ```
  (`media` omitted when empty.) Success SnackBar `'Request posted successfully!'`, then `Navigator.pop(context, true)`. Failure SnackBar `'Failed to post request'`.
- All snackbars here: duration **2 s**, `floating`, radius **20**, bg `#026AFD`, white text (theme shape).
- No date picker, no dialogs, no bottom sheets. No image preview/enlarge. No SafeArea. No width breakpoint.

---

# 3. NearbyScreen — `/nearby`

## 3.1 AppBar

- `elevation: 0`, `automaticallyImplyLeading: false`
- **leading:** `AppLogo()` → `Image.asset('assets/logo.png', width: 40, height: 40, fit: BoxFit.contain)`
- **title:** `Text('Nearby Users')` `FontWeight.w600` (default 22 M3 / 20 M2), centered
- **actions:** `IconButton(Icons.refresh)` default 24, color appbar foreground; tap = `_loadUsers()`

## 3.2 Body state machine (exclusive)

| State | UI |
|---|---|
| loading (initial) | `Center(child: CircularProgressIndicator())` — theme primary `#026AFD` |
| error (`_error = 'Failed to load users'`) | `Center(Column(mainAxisAlignment: center))`: `Text('Failed to load users')` fontSize **18**, `#9E9E9E`; `SizedBox(height: 16)`; `ElevatedButton('Retry')` (theme: bg `#026AFD`, radius 26, min height 56) → `_loadUsers` |
| empty | `Center(Text('No users nearby'))` fontSize **18**, `#9E9E9E` |
| list | `RefreshIndicator(onRefresh: _loadUsers)` → `ListView.builder(padding: EdgeInsets.all(16), itemCount: users.length)` |

## 3.3 List item anatomy (exact)

`Container` per user:
- `margin: EdgeInsets.only(bottom: 12)` (last item also has bottom 12)
- bg `#1C1C1E` dark / `#FAFAFA` light
- `borderRadius: 16`
- `Border.all(1 px)` color `#2C2C2E` dark / `#EEEEEE` light
- child `ListTile`:
  - **leading:** `SizedBox(56, 56)` → `ClipOval`:
    - image: `CachedNetworkImage(fit: cover)`; placeholder = `Container(color: #E0E0E0)` + centered `CircularProgressIndicator(strokeWidth: 2)`; error → letter avatar
    - fallback letter avatar: `Container(color: #026AFD @ 20 % = #026AFD33)` centered `Text(firstLetterUppercase)` fontSize **24**, **bold**, `#026AFD`; `'?'` when name empty
  - **title:** `Text(name)`, `FontWeight.w600`, default 16, `overflow: ellipsis` (1 line)
  - **subtitle:** `Text(distance)`, default 14, theme subtitle color (`#00000099` light / `#FFFFFFB3` dark); distance string is the raw API value or `'Nearby'` when null (**no unit formatting**)
  - **trailing:** `IconButton` whose icon is a `Container(40 × 40, circle, bg #026AFD)` containing `Icon(Icons.chat_bubble_outline, color: #000000, size: 20)`; tap → `ApiService.createChat(userId)` → reads `id` ?? `_id` → `Navigator.push(MaterialPageRoute(ChatScreen(chatId)))` on success; errors swallowed.
  - **tile onTap:** if `userId` non-empty → `Navigator.pushNamed('/view-profile', arguments: {'userId': userId})`.
- ListTile default padding (16 horizontal) and 56 leading height give ≈ 88 dp tall card; no explicit `contentPadding`/`minLeadingWidth` override.

Name resolution: `user['name']`; if it equals `'User'`, `'Unknown User'` or is empty → use `user['email']` if non-empty, else `'User'`.
Avatar resolution: `user['avatar']` unless empty or contains `Portrait_Placeholder.png`; else first of `user['photos']` filtered the same way; else letter avatar.

## 3.4 Bottom navigation (`CustomBottomNavBar(currentRoute: '/nearby')`)

- Outer `Container(height: 60 + MediaQuery.padding.bottom, padding bottom = safe-area inset)`
- bg `#1C1C1E` dark / `#FFFFFF` light; top border 1 px `#2C2C2E` dark / `#E0E0E0` light
- `Row` of 4 `Expanded` items + center spacer `Expanded(SizedBox)`: **Live** (`Icons.explore`, `/feed`), **Favorites** (`Icons.favorite_border` / `Icons.favorite` when active, `/favorites`), spacer, **Chats** (`Icons.chat_bubble_outline` / `Icons.chat_bubble`, `/chats`), **Profile** (`Icons.person_outline` / `Icons.person`, `/profile` — replaced by 28×28 circular avatar with 2 px border `#026AFD` when active else `#E0E0E0`/`#3A3A3C`, monogram 12 bold `#026AFD` on `#026AFD26`).
- Item icon size **26**; label 11 px, active w600 / inactive w400; active color `#026AFD`, inactive `#666666` light / `#BDBDBD` dark; `SizedBox(height: 2)` between icon and label.
- Badge (if count > 0): `Positioned(right: -6, top: -4)` red circle (`#F44336`), padding 4, min 16 × 16, text 10 bold white, shows `'9+'` above 9.
- Floating center FAB `Positioned(top: -24)` centered: **56 × 56** circle `#026AFD`, shadow `#026AFD` @ 30 % blur 12 offset (0, 4), `Icon(Icons.add, color: #000000, size: 32)`; tap → `Navigator.pushNamed('/create-post')`, and if result `true` → `pushReplacementNamed('/feed')`.
- Inactive tab tap → `pushReplacementNamed(route)`.

## 3.5 API / realtime

- `ApiService.getCurrentPosition()` → lat/lng default `0, 0` on null.
- `GET {base}/api/users/nearby?lat=<lat>&lng=<lng>`; response list **or** `{users: [...]}`; reads per item: `id`, `email`, `name`, `avatar`, `photos[]`, `distance`. Cached in SharedPreferences as `cached_nearby_users_<userId>`; on HTTP failure falls back to cache then `[]`.
- `GET /api/me` (bottom-nav avatar): reads `avatar`, `photos`, `name`.
- `POST /api/chats` body `{ "participants": [userId] }`.
- JWT payload parsed for `userId`/`sub`/`id` (used to filter own WebSocket events).
- WebSocket events → snackbar (2 s, floating, radius 20, `#026AFD`):
  - `new_message` → `'📩 New message from {senderName ?? 'Someone'}'`
  - `post_accepted` → `'🤝 Request accepted by {userName ?? 'Someone'}'`
  - `post_favorited` → `'⭐ Someone favorited your request'`
  - Local notifications: title senderName / body `payload['content'] ?? 'Sent you a message'`; `'Request Accepted'` / `'{userName} accepted your request!'`; `'New Favorite'` / `'Someone favorited your request!'`.
- No SafeArea wrapper around body (bottom nav handles bottom inset). No width breakpoint.

---

# 4. GroupJoinScreen — `/join-group` (arg `inviteCode`)

## 4.1 AppBar

`title: Text('Group Invitation')` (default 22/w400, centered per theme), `elevation: 0`, `foregroundColor: #FFFFFF` dark / `#000000` light. Leading = default back arrow. No actions.

## 4.2 Body states

1. **Loading:** `Center(CircularProgressIndicator())` (primary).
2. **Error:** `Center` → `Padding(horizontal: 32)` → `Column(mainAxisAlignment: center)`:

| # | Widget | Values |
|---|---|---|
| 1 | `Icon(Icons.error_outline_rounded)` | `#FF5252` (`Colors.redAccent`), size **64** |
| 2 | `SizedBox` | 16 |
| 3 | `Text('Invalid Invite Link')` | **20**, bold |
| 4 | `SizedBox` | 8 |
| 5 | `Text(message)` | center, 14, `#BDBDBD` dark / `#757575` light. Message = API error text (`Exception: ` prefix stripped) or fallback `'This invite code is expired or invalid. Please check the URL and try again.'` |
| 6 | `SizedBox` | 24 |
| 7 | `ElevatedButton('Back to Home')` | bg `#026AFD`, radius **16**, `padding: h 32 / v 12`, default label white 14 w500; tap → `Navigator.pushReplacementNamed('/feed')` |

3. **Details:** `Center` → `SingleChildScrollView(padding: EdgeInsets.all(24))` → card `Container`:
   - `width: double.infinity`, `constraints: BoxConstraints(maxWidth: 450)` ← **the only width breakpoint in these five screens** (card caps at 450 dp, centered)
   - `padding: EdgeInsets.all(32)`
   - bg `#1C1C1E` dark / `#FFFFFF` light
   - `borderRadius: 28`
   - shadow: `black` alpha **0.20** dark / **0.04** light, `blurRadius: 20`, `offset: (0, 10)`
   - card child `Column(mainAxisSize: min)`:

| # | Widget | Values |
|---|---|---|
| 1 | Badge pill | `Container(padding: h 16 / v 6, bg #026AFD @ 10 % = #026AFD1A, radius 20)` → `Row(mainAxisSize: min)`: `Icon(Icons.stars, #026AFD, 16)`, `SizedBox(w 6)`, `Text('You are Invited!')` 13 / bold / `#026AFD` |
| 2 | `SizedBox` | 24 |
| 3 | Group avatar | `CircleAvatar(radius: 54)` → **108 × 108**; `backgroundImage: CachedNetworkImageProvider(avatar)` when `groupAvatar` non-null; `backgroundColor: #EEEEEE`; if no image: initial letter 36 / bold / `#026AFD` (fallback `'G'`) |
| 4 | `SizedBox` | 20 |
| 5 | Group name | 24 / bold / `letterSpacing: -0.5` / center; default `'Group Chat'` |
| 6 | `SizedBox` | 8 |
| 7 | Member row | `Row(center)`: `Icon(Icons.people_alt_rounded, 16, #BDBDBD dark / #757575 light)`, `SizedBox(w 6)`, `Text('{memberCount} members')` 14 / w600 / same grey |
| 8 | `SizedBox` | 20 |
| 9 | Divider bar | `Container(width: 60, height: 3, bg #026AFD @ 30 % = #026AFD4D, radius 1.5)` — not a real Divider |
| 10 | `SizedBox` | 20 |
| 11 | Description | 15, `height: 1.4`, center, `#BDBDBD` dark / `#757575` light; default `'No description provided.'` |
| 12 | `SizedBox` | 32 |
| 13a | If logged in | `SizedBox(infinity, height: 54)` `ElevatedButton` bg `#026AFD`, radius **16**, elevation 0, label `'Accept Invitation'` 16 / bold; disabled while joining and replaced by `CircularProgressIndicator(color: #FFFFFF)` (default ~36 × 36) |
| 13b | If logged out | `Column`: `SizedBox(infinity, 54)` `ElevatedButton` `'Sign Up & Join Group'` 16 / bold / bg `#026AFD` / radius 16 → `pushNamed('/signup', {'inviteCode': code})`; `SizedBox(height: 12)`; `SizedBox(infinity, **52**)` `OutlinedButton` `'Log In & Join'` 15 / bold, fg `#026AFD`, side 1 px `#026AFD`, radius **16** → `pushNamed('/login', {'inviteCode': code})` |

## 4.3 API / interactions

- Auth check: `ApiService.getToken()` → `_isLoggedIn = token != null && token.isNotEmpty`.
- `GET {base}/api/groups/invite/{code}` (no auth header) → reads `groupName`, `groupAvatar`, `groupDescription`, `memberCount` (int), or `error`.
- Join: `POST {base}/api/groups/join` JSON `{"inviteCode": "<code>"}` (Bearer) → reads `chatId`, `error`. `chatId` null/empty → error `'Failed to retrieve chat session'`.
- Success SnackBar `'Successfully joined group chat!'` (default theme snackbar), then `pushNamedAndRemoveUntil('/feed', (r)=>false)` followed by `pushNamed('/chat', {'chatId': chatId})`.
- Failure SnackBar: stripped exception message (`'Exception: '` removed), `_isJoining = false`.
- No SafeArea (Scaffold + AppBar). Scroll: card scrolls vertically inside centered SingleChildScrollView.

---

# 5. RoomChatScreen — `RoomChatScreen(roomId)`

State defaults: `_roomName = 'Room Chat'`, `_roomAvatar = null`, `_roomDescription = ''`, `_memberCount = 0`, `_isLoading = true`.

## 5.1 AppBar

`titleSpacing: 0`, `elevation: 0` (theme).

- **leading:** `IconButton(Icons.arrow_back_ios_new_rounded, size: 20)` color `#FFFFFF` dark / `#000000DE` light; pop.
- **title:** `Row`:
  1. avatar `Container(38 × 38, circle, bg #F5F5F5)` → `ClipOval`:
     - `CachedNetworkImage(fit: cover)` when `_roomAvatar != null`
     - else `Container(color: #026AFD @ 10 % = #026AFD1A, alignment: center)` + `Text(initial)` bold `#026AFD` (inherits AppBar title size ≈22), fallback `'R'`
  2. `SizedBox(width: 10)`
  3. `Expanded(Column(crossAxisAlignment: start, mainAxisAlignment: center))`:
     - `Text(_roomName)` **15 / w800**, `maxLines: 1`, ellipsis
     - `SizedBox(height: 2)`
     - `Row`: online dot `Container(8 × 8, circle, #34C759)`, `SizedBox(width: 4)`, `Text('👥 $_memberCount members online')` **11 / w600 / #757575**
- **actions:**
  - `PopupMenuButton<String>` icon `Icons.more_horiz_rounded`, color `#000000DE` (hard-coded, stays dark in dark mode); one item value `'leave'`: `Row` → `Icon(Icons.logout_rounded, color: #F44336, size: 20)`, `SizedBox(width: 8)`, `Text('Leave Room')` `#F44336` bold.
  - `SizedBox(width: 8)`.

## 5.2 Body `Column`

1. **Info banner** (only if `_roomDescription.isNotEmpty`):
   - full width `Container(padding: h 16 / v 10, color #026AFD @ 4 % = #026AFD0A)`
   - `Text('💡 Info: $_roomDescription')` 12 / `#0000008A` / `height: 1.2` / `maxLines: 2` / ellipsis
2. **`Expanded`** message area:
   - loading → `Center(CircularProgressIndicator(valueColor: AlwaysStoppedAnimation(#026AFD)))`
   - `_messages.isEmpty` → empty state
   - else → message list
3. **Typing indicator** (only while `_isTyping`, lasts 5 s after `typing_start`): `Container(alignment: centerLeft, padding: left 24 / bottom 8)` → `Text('Someone is typing...')` 12 / `#9E9E9E` / italic.
4. **Input bar** (`_buildInputBar`).

### Empty state

`Center` → `Column(center)`:
1. `Text('🌱')` fontSize **50**
2. `SizedBox(height: 12)`
3. `Text('Welcome to $_roomName!')` 16 / bold
4. `SizedBox(height: 4)`
5. `Padding(horizontal: 40)` → `Text('Be respectful, vibe out, and say hi to the room members!')` 13 / `#9E9E9E` / center

### Message list

`ListView.builder(controller, reverse: true, padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12))`.

**System message** (`type == 'system'`): `Center` → `Container(margin: v 8, padding: h 12 / v 4, bg #F5F5F5, radius 12, border 0.5 px #EEEEEE)` → `Text(content)` 12 / w600 / `#757575`.

**Message bubble** (`_RoomMessageBubble`), per message:
- outer `Container(margin: EdgeInsets.symmetric(vertical: 6))`
- `Row(crossAxisAlignment: start, mainAxisAlignment: end if self else start)`
- **other user:** avatar 32 × 32 circle (bg `#2C2C2E` dark / `#F5F5F5` light) → `ClipOval`: image or monogram container (`#026AFD1A`) with letter 14 / bold / `#026AFD` (`'?'` fallback); `SizedBox(width: 8)`
- `Flexible(Column(crossAxisAlignment: end/start))`:
  - non-self only: `Padding(left: 4, bottom: 2)` → `Text(senderName)` **11 / bold / `#BDBDBD` dark / `#757575` light**; default `'User'`
  - bubble `Container(padding: h 14 / v 10)`:
    - bg: self `#026AFD`; other `#1C1C1E` dark / `#F5F5F5` light
    - radius: topLeft 16, topRight 16, bottomLeft **16 if self else 4**, bottomRight **4 if self else 16** (tail toward avatar side)
    - text: 14.5, color self `#FFFFFF`, other `#FFFFFF` dark / `#000000DE` light
    - image type: `ClipRRect(radius 12)` + `CachedNetworkImage`; placeholder `200 × 150`, bg `#1C1C1E` dark / `#EEEEEE` light + spinner strokeWidth 2; error `200 × 150` + `Icon(Icons.broken_image, #9E9E9E)`; JSON parse failure → `Text('[Image Content]')`
- **self:** `SizedBox(width: 8)` + same 32 × 32 avatar on the right.

Optimistic messages: text `id = 'opt_<epochMs>'`, image `'opt_img_<epochMs>'` with content `'[Image uploading...]'`; reconciled by matching content on incoming `new_message`.

### Input bar

`Container(padding: EdgeInsets.all(12), bg #1C1C1E dark / #FFFFFF light, border top 1 px #2C2C2E dark / #EEEEEE light)` → `SafeArea` → `Row`:
1. `IconButton(Icons.photo_library_outlined, color #026AFD)` (24) → `_sendImage`
2. `Expanded(TextField)`:
   - hint `'Type your message...'` (theme hint style)
   - `textCapitalization: TextCapitalization.sentences`
   - `OutlineInputBorder(radius 24, borderSide: none)`
   - filled, fill `#2C2C2E` dark / `#F5F5F5` light
   - `contentPadding: h 16 / v 10`
   - text color `#FFFFFF` dark / `#000000` light
3. `SizedBox(width: 8)`
4. send `GestureDetector(onTap: text non-empty ? _sendMessage : null)` → `Container(padding: 12, circle)`:
   - bg `#026AFD` when text non-empty, else `#2C2C2E` dark / `#EEEEEE` light
   - `Icon(Icons.send_rounded, size: 20)` color `#FFFFFF` enabled / `#757575` dark `#BDBDBD` light disabled
   - resulting circle ≈ 44 × 44.

## 5.3 Dialogs / snackbars / interactions

**Leave-room `AlertDialog`** (`showDialog<bool>`): `shape: radius 20`; title `'Leave $_roomName?'`; content `"You'll stop receiving messages."`; actions:
- `TextButton('Cancel')` — text button theme color `#026AFD`, pops `false`
- `TextButton('Leave')` — `TextStyle(color: Colors.red = #F44336, fontWeight: bold)`, pops `true`

Confirmed → `RoomService.leaveRoom` = `DELETE {base}/api/rooms/{roomId}/leave` → SnackBar `'Left "$_roomName" successfully'` then `Navigator.pop(context)`. Failure → SnackBar `'Failed to leave room'`.
(Note: leave dialog title uses the interpolated room name; no "Leave Room" literal in the dialog.)

Other snackbars (plain `SnackBar`, theme: floating, radius 20, `#026AFD`, white text): `'Failed to send message'`, `'Failed to upload photo'`.

**Image send:** `ImagePicker().pickImage(gallery, imageQuality: 85)` → optimistic bubble → `POST /api/upload-photo` → `ApiService.sendMessage(roomId, jsonEncode([url]), type: 'image')` → remove optimistic on success.

## 5.4 API / realtime / cache

| Purpose | Call | Reads |
|---|---|---|
| Auth token | `ApiService.getToken()` | token string |
| Room metadata | `RoomService.getRoomDetails` → `GET /api/rooms/{roomId}` (Bearer) | `room` object → `id`, `name`, `description`, `avatar_url`, `current_members` (+ unused `category`, `max_members`, `created_by`, `is_trending`, `tags`, `is_joined`, `is_full`) |
| Cache | SharedPreferences key `'cached_messages_{roomId}'` | list of message JSON, reversed (`[0]` = newest) |
| History | `GET /api/messages/{roomId}` (Bearer) | list **or** `{messages: [...]}`, reversed |
| Send text | `POST /api/message` `{chatId, content, type:'text', replyToId, replyToContent, replyToSenderName}` | — |
| Send image | `POST /api/upload-photo` then `POST /api/message` `{chatId, content: '["url"]', type:'image'}` | `{url}` |
| Leave | `DELETE /api/rooms/{roomId}/leave` (Bearer) | `error` |

Message JSON fields mapped: `_id` or `id`, `senderId` or `sender._id`, `content`, `type` (default `'text'`), `createdAt` (unix **seconds** int or ISO string), `isRead`, `reactions` (map), `replyToId`, `replyToContent`, `replyToSenderName`, `senderName` or `sender.name`, `senderAvatar` or `sender.avatar`.

WebSocket (RoomService chat channel keyed by roomId):
- out: `subscribe_chat {chatId}`, `typing_start`/`typing_end` `{chatId}` on every text change (non-empty vs empty), `message_read {chatId, messageIds:[id]}` for incoming others' messages.
- in: `new_message` (same chatId; dedupe optimistic; plays received sound + read receipt when not self), `room_update` (sets `_memberCount` from `currentMembers`, int or string), `typing_start` (other user; shows indicator, auto-hides after **5 s**), `typing_end`, `message_reaction` (replace message with same id + reactions map).

Scroll behavior: `reverse: true` list, `jumpTo(0.0)` (no animation) after load/send/receive. Input bar wrapped in `SafeArea`; body is not.

---

# 6. Cross-screen layout notes

- **Scroll:** Signup = vertical SingleChildScrollView per page inside a swipe-locked horizontal PageView; CreatePost = vertical scroll; Nearby = always-scrollable ListView (RefreshIndicator); GroupJoin = vertical scroll inside centered card (max 450); RoomChat = reverse ListView + fixed input bar (no page scroll).
- **Safe areas:** Only `RoomChat` input bar (`SafeArea`), `CustomBottomNavBar` (manual `padding.bottom`), and AppBar top insets. Signup/CreatePost/GroupJoin bodies add no bottom inset.
- **Width breakpoints:** only GroupJoin card `maxWidth: 450`; everything else is full-width minus 24 (or 16) horizontal padding.
- **Elevation/shadows inventory:** signup avatar circle (black 5 %/30 %, blur 15, spread 2); create-post remove-thumb (black 10 %, blur 4, y+2); group card (black 4 %/20 %, blur 20, y+10); floating nav FAB (`#026AFD` 30 %, blur 12, y+4). All other surfaces are flat (elevation 0, no shadow).
- **Animations inventory:** page transition 300 ms `easeInOut`; typing indicator 5 s timer; snackbars 2 s (CreatePost only — others use default 4 s); list refresh uses spinner; everything else instant.

---

# 7. Copy-ready tokens

## 7.1 Colors (CSS)

```css
/* brand */
--zk-primary: #026AFD;
--zk-primary-4:  rgba(2,106,253,0.04);
--zk-primary-10: rgba(2,106,253,0.10);
--zk-primary-15: rgba(2,106,253,0.15);
--zk-primary-20: rgba(2,106,253,0.20);
--zk-primary-30: rgba(2,106,253,0.30);
/* light neutrals */
--zk-white: #FFFFFF;
--zk-grey-50: #FAFAFA;
--zk-grey-100: #F5F5F5;
--zk-grey-200: #EEEEEE;
--zk-grey-300: #E0E0E0;
--zk-grey-400: #BDBDBD;
--zk-grey-500: #9E9E9E;
--zk-grey-600: #757575;
--zk-grey-700: #616161;
--zk-grey-inactive-dot: #DDDDDD;
--zk-hint-grey: #8E8E8E;
--zk-text-muted: #666666;
/* dark surfaces */
--zk-dark-bg: #121212;
--zk-dark-surface-1: #1C1C1E;
--zk-dark-surface-2: #1E1E1E;
--zk-dark-surface-3: #2C2C2E;
--zk-dark-border: #3A3A3C;
--zk-dark-input-border: #333333;
/* functional */
--zk-green-online: #34C759;
--zk-red: #F44336;
--zk-red-accent: #FF5252;
--zk-amber-50: #FFF8E1;
--zk-amber-800: #FF8F00;
--zk-black: #000000;
--zk-black-87: rgba(0,0,0,0.87);
--zk-black-54: rgba(0,0,0,0.54);
--zk-black-45: rgba(0,0,0,0.45);
--zk-black-38: rgba(0,0,0,0.38);
--zk-white-70: rgba(255,255,255,0.70);
--zk-white-54: rgba(255,255,255,0.54);
```

## 7.2 Typography (CSS)

```css
/* default body */
font-family: Roboto, -apple-system, "Segoe UI", sans-serif; /* Flutter default; no custom family declared */
body            { font-size: 14px; font-weight: 400; }
/* appbar title (M3 titleLarge) */
.appbar-title   { font-size: 22px; font-weight: 400; }
/* signup page headings */
.h24-w600       { font-size: 24px; font-weight: 600; }
.h24-bold       { font-size: 24px; font-weight: 700; }
/* signup avatar subtitle */
.body-15        { font-size: 15px; font-weight: 400; }
/* buttons */
.btn-17-w600    { font-size: 17px; font-weight: 600; }  /* all 52px wizard/submit buttons */
.btn-16-bold    { font-size: 16px; font-weight: 700; }  /* group: Accept / Sign Up & Join */
.btn-15-bold    { font-size: 15px; font-weight: 700; }  /* group: Log In & Join */
.btn-14-w600    { font-size: 14px; font-weight: 600; }  /* sheet Cancel / Demo */
/* chips / selectors */
.chip-label     { font-size: 16px; font-weight: 600; }  /* create-post chips */
.chip-label-14  { font-size: 14px; font-weight: 700; }  /* signup gender + interest */
.chip-label-14b { font-size: 14px; font-weight: 600; }  /* signup Available/Busy */
/* section labels */
.section-label  { font-size: 14px; font-weight: 600; color: #666666; }
/* sheet */
.sheet-title    { font-size: 20px; font-weight: 700; }
.sheet-body     { font-size: 14px; line-height: 1.5; }
/* post note */
.note-14        { font-size: 14px; line-height: 1.4; color: #666666; }
/* nearby */
.nearby-title   { font-size: 16px; font-weight: 600; }
.nearby-sub     { font-size: 14px; }
.nearby-state   { font-size: 18px; color: #9E9E9E; }
.nearby-monogram{ font-size: 24px; font-weight: 700; color: #026AFD; }
/* group join */
.group-name     { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
.group-badge    { font-size: 13px; font-weight: 700; color: #026AFD; }
.group-members  { font-size: 14px; font-weight: 600; }
.group-desc     { font-size: 15px; line-height: 1.4; }
.group-error-t  { font-size: 20px; font-weight: 700; }
.group-error-b  { font-size: 14px; }
/* room chat */
.room-name      { font-size: 15px; font-weight: 800; }
.room-members   { font-size: 11px; font-weight: 600; color: #757575; }
.room-info      { font-size: 12px; line-height: 1.2; color: rgba(0,0,0,0.54); }
.msg-text       { font-size: 14.5px; }
.msg-sender     { font-size: 11px; font-weight: 700; color: #757575; }
.msg-system     { font-size: 12px; font-weight: 600; color: #757575; }
.typing         { font-size: 12px; font-style: italic; color: #9E9E9E; }
.empty-emoji    { font-size: 50px; }
.empty-title    { font-size: 16px; font-weight: 700; }
.empty-body     { font-size: 13px; color: #9E9E9E; }
.avatar-letter  { font-size: 14px; font-weight: 700; color: #026AFD; }  /* 32px chat avatar */
```

## 7.3 Geometry tokens

| Token | Value | Used by |
|---|---|---|
| Page padding | 24 | signup pages, create-post, group card wrapper |
| List padding | 16 | nearby list |
| Form gap (field→field) | 16 | signup page 0/2 |
| Form gap (last field→button) | 24 | signup pages 0/2/5/6 |
| Title→first field | 40 | signup pages 2/3/6 |
| Primary button | h 52, radius 26 | signup all, create-post submit |
| Group primary button | h 54, radius 16 | group join |
| Group secondary button | h 52, radius 16 | group join |
| Chip | padding 20 h / 12 v, radius 26, font 16 w600 | create-post |
| Selector chip | h 52, radius 26, equal thirds, gap 12 | signup gender/interests/status |
| Input field | radius 12, 1 px border, focus 2 px `#026AFD`, padding 16/16 | signup, (create-post card radius 16) |
| Post text area | radius 16, min 5 lines, padding 16, counter at bottom 12 / right 16 | create-post |
| Post thumb | 80 × 80, radius 12 | create-post |
| Signup avatar | 160 dia, border 4, shadow blur 15 spread 2 | signup page 1 |
| Photo grid | 3 cols, gaps 12, radius 16 (image clip 14/16), main badge radius 8 font 10 | signup page 5 |
| Nearby card | radius 16, border 1, margin-bottom 12, avatar 56 dia, chat bubble 40 dia + icon 20 | nearby |
| Bottom nav | h 60 + safe inset, icon 26, label 11, FAB 56 dia at top −24 | nearby |
| Group card | padding 32, radius 28, max-width 450, shadow blur 20 y+10; avatar 108 dia; divider 60 × 3 | group join |
| Chat appbar avatar | 38 dia; online dot 8; back icon 20 | room chat |
| Chat bubble | padding 14 h / 10 v; radius 16/16/16or4/4or16; avatar 32; gap 8; row margin 6 v | room chat |
| Chat list | padding 16 h / 12 v, reverse | room chat |
| Chat input | bar padding 12, radius 24, padding 16 h / 10 v, send circle padding 12 / icon 20 | room chat |
| Image placeholder | 200 × 150 | room chat |
| SnackBar | radius 20, floating (2 s in create-post) | all |
| Step dots | 8 × 8, margin 4 h, 8 dots (128 total) | signup appbar |
| Animation | 300 ms easeInOut | signup page change |
