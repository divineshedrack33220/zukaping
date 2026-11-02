# Profile Cluster — Pixel Spec (Flutter → React/MUI)

Source files (read-only reference):

| Screen | Dart file | Widget |
|---|---|---|
| My Profile | `mobile_app/lib/screens/profile_screen.dart` | `ProfileScreen` (1394 lines) |
| Edit Profile | `mobile_app/lib/screens/edit_profile_screen.dart` | `EditProfileScreen` (660 lines) |
| Favorites | `mobile_app/lib/screens/favorites_screen.dart` | `FavoritesScreen` (913 lines) |
| View Profile | `mobile_app/lib/screens/view_profile_screen.dart` | `ViewProfileScreen` (1051 lines) |

Supporting files that define rendered geometry (also quoted below):
`mobile_app/lib/config/app_theme.dart`, `mobile_app/lib/widgets/custom_bottom_nav_bar.dart`,
`mobile_app/lib/widgets/app_logo.dart`, `mobile_app/lib/services/theme_service.dart`,
`mobile_app/lib/models/user.dart`, `mobile_app/lib/models/profile_image.dart`,
`mobile_app/lib/services/api_service.dart`.

---

## 0. Global shell (applies to all 4 screens)

### 0.1 Theme constants (`config/app_theme.dart`)

| Token | Light | Dark |
|---|---|---|
| `primaryColor` | `#026AFD` | `#026AFD` |
| `scaffoldBackgroundColor` | `#FFFFFF` | `#121212` |
| AppBar `backgroundColor` | `#FFFFFF` | `#121212` |
| AppBar `foregroundColor` | `#000000` | `#FFFFFF` |
| AppBar `elevation` | `0` | `0` |
| AppBar `centerTitle` | `true` | `true` |
| ElevatedButton bg / fg | `#026AFD` / `#FFFFFF` | `#026AFD` / `#FFFFFF` |
| ElevatedButton shape | `RoundedRectangleBorder(26)` | `RoundedRectangleBorder(26)` |
| ElevatedButton `minimumSize` | `Size(infinity, 56)` | `Size(infinity, 56)` |
| ElevatedButton `elevation` | `0` | `0` |
| OutlinedButton theme | none defined (Material defaults) | none defined |
| input `border` radius | `12` | `12` |
| input `enabledBorder` | `1px #8E8E8E`, radius 12 | `1px #333333`, radius 12 |
| input `focusedBorder` | `2px #026AFD`, radius 12 | `2px #026AFD`, radius 12 |
| input `errorBorder` | `1px #FF453A` | `1px #FF453A` |
| input `focusedErrorBorder` | `2px #FF453A` | `2px #FF453A` |
| input `contentPadding` | `h16 v16` | `h16 v16` |
| input `filled` / `fillColor` | `true` / `#FFFFFF` | `true` / `#1E1E1E` |
| TextButton `foregroundColor` | `#026AFD` | `#026AFD` |
| snackBar shape | radius `20`, floating | radius `20`, floating |
| snackBar bg / text | `#026AFD` / `#FFFFFF` | `#026AFD` / `#FFFFFF` |
| Material | Material 3 (Flutter default `useMaterial3: true`) | same |

`themeNotifier` default = `ThemeMode.dark` → **the app boots in dark mode**; light mode is opt-in via the AppBar toggle on My Profile.

### 0.2 AppBar default metrics (Material 3, not overridden anywhere in these screens)

- Toolbar height: `56` dp. Status-bar inset comes from `MediaQuery.padding.top`.
- `leading` slot: `56` wide; `IconButton` hit box `48×48`; default icon size `24`.
- Title: `titleLarge` = `22px / 28px line-height / w400` **unless overridden per screen** (all 4 screens override where a title exists).
- `actions` spacing: 0; each `IconButton` is `48×48`, icon `24`, padding `8`.
- No `systemOverlayStyle` override, no shadow (`elevation 0`), no bottom border on any AppBar.

### 0.3 Logo widget (`widgets/app_logo.dart`)

```
Image.asset('assets/logo.png', width: 40, height: 40, fit: BoxFit.contain)
```
Used as AppBar `leading` on **My Profile** and **Favorites**. (`leadingWidth` default 56 → 40px logo centered in 56px slot.)

### 0.4 Bottom nav (`widgets/custom_bottom_nav_bar.dart`) — My Profile + Favorites only

- Outer container: `height = 60 + MediaQuery.padding.bottom`, `padding.bottom = MediaQuery.padding.bottom` (iOS home-indicator safe area).
- Background: light `#FFFFFF`, dark `#1C1C1E`; top border `1px` light `#E0E0E0` (grey300) / dark `#2C2C2E`.
- Row of 5 slots, each `Expanded` (20% width): Live → Favorites → **empty spacer (FAB)** → Chats → Profile.
- Nav item: `Column(mainAxisAlignment: center)`: icon `26px` (or profile avatar), `SizedBox(height: 2)`, label `11px`, `w600` when active else `w400`.
- Color: active `#026AFD`; inactive light `#666666`, dark `#BDBDBD` (grey400).
- Icons: Live `Icons.explore`; Favorites `Icons.favorite` (active) / `Icons.favorite_border`; Chats `Icons.chat_bubble` / `Icons.chat_bubble_outline`; Profile = avatar.
- Profile slot: `28×28` circle, border `2px` (`#026AFD` active / light `#E0E0E0` / dark `#3A3A3C`), image `BoxFit.cover`; fallback monogram `12px bold #026AFD` on `#026AFD @ 0.15`.
- Badge (favorites count / chats count) when `> 0`: `Positioned(right: -6, top: -4)`, `padding 4`, red `#F44336` circle, `minWidth/minHeight 16`, text `10px bold #FFFFFF`, `9+` cap.
- Floating create FAB: `Positioned(top: -24, left: 0, right: 0)` centered, `56×56` circle `#026AFD`, shadow `#026AFD @ 0.3`, `blurRadius 12`, `offset (0,4)`, `Icons.add 32 #000000`.
- Tap non-active item → `Navigator.pushReplacementNamed(route)`; tap FAB → `pushNamed('/create-post')`, on `true` result → `pushReplacementNamed('/feed')`.

### 0.5 Snackbar (identical in all 4 files, private `_showToast`)

`SnackBar(content: Text(msg), duration: 2s, behavior: floating, shape: RoundedRectangleBorder(20), backgroundColor: #026AFD)` + theme `contentTextStyle: #FFFFFF (default 14px)`.
MUI equivalent: `Snackbar` + `Alert`/`Paper` with `borderRadius: 20px`, `background: #026AFD`, `color: #fff`, `fontSize: 14px`, floating (16px side/bottom margin), auto-hide 2000 ms.

### 0.6 Breakpoints / responsiveness

- **No** `LayoutBuilder`, `MediaQuery.size` check, `OrientationBuilder`, or width breakpoint exists in any of the four files.
- All layouts are a single column sized by screen width minus fixed horizontal padding (20 or 24 or 16). There is no max-width container, no desktop layout, no multi-column row layout at any width.
- Grid cells are derived purely from `crossAxisCount` + `crossAxisSpacing` + default `childAspectRatio: 1.0` (square).
- `SafeArea` widget is **not** used anywhere; only the AppBar (top) and bottom-nav `padding.bottom` (bottom) handle insets.

### 0.7 Scroll behavior summary

| Screen | Scroll container | Physics | Padding |
|---|---|---|---|
| My Profile | `SingleChildScrollView` inside `RefreshIndicator` | `AlwaysScrollableScrollPhysics` | `EdgeInsets.all(20)` |
| My Profile (loading) | `SingleChildScrollView` | default (`Clamping`) | `EdgeInsets.all(20)` |
| My Profile (error) | none (centered `Column`) | — | — |
| Edit Profile | `SingleChildScrollView` inside `Form` | default | `EdgeInsets.all(20)` |
| Favorites | fixed search bar + `Expanded(ListView.builder)` | `AlwaysScrollableScrollPhysics` | `EdgeInsets.all(16)` on list; `all(16)` on search bar |
| View Profile | `SingleChildScrollView` | default | `EdgeInsets.all(24)` |
| Photo grids (all) | `GridView.builder(shrinkWrap: true, physics: NeverScrollableScrollPhysics)` | never | inherited |

Pull-to-refresh `RefreshIndicator` color `#026AFD`, on:
- My Profile → `_loadProfile()` (also `RefreshIndicator` wraps content only, not error/loading states).
- Favorites → `_onRefresh()` → reload + toast `Favorites refreshed!`.

---

# 1. My Profile — `ProfileScreen`

Route `/profile`. Has AppBar + bottom nav. **There is NO cover photo, NO stats row, NO tabs/segmented control, NO settings list on this screen** (settings are in a bottom sheet). Top-most content element is the avatar.

## 1.1 Widget tree (top → bottom)

```
Scaffold
├─ AppBar  (elevation 0, automaticallyImplyLeading: false, centerTitle: true)
│  ├─ leading: AppLogo (40×40)
│  ├─ title: Text('My Profile', 18 / w600)   ← color inherits AppBar fg
│  └─ actions:
│     ├─ ValueListenableBuilder<ThemeMode> → IconButton
│     │    icon: isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded  (24, default)
│     │    onPressed: themeNotifier.value = isDark ? light : dark
│     └─ IconButton(icon: Icons.settings 24)  → _showSettingsModal
├─ body: _isLoading ? shimmer : _error != null ? errorState : content
└─ bottomNavigationBar: CustomBottomNavBar(currentRoute '/profile')
```

## 1.2 Loaded content (exact order, `Column` inside `SingleChildScrollView(padding: all(20))`, default `crossAxisAlignment: center`)

| # | Element | Metrics |
|---|---|---|
| 1 | **Avatar** `GestureDetector` (onTap → `_changeAvatar`) → `Stack` | `Container 120×120`, `BoxShape.circle`, border `3px #026AFD`, shadow `#026AFD @ 0.10`, `blurRadius: 0`, `spreadRadius: 4` (creates a 3px+4px double ring), `ClipOval` inside |
| 1a | Avatar image | `CachedNetworkImage(fit: BoxFit.cover)`; placeholder = `Container(#E0E0E0)` (grey300); error → placeholder avatar |
| 1b | Placeholder avatar | `Container(#026AFD @ 0.20)` centered `Text(firstInitial.toUpperCase() or '?')`, `48px`, `bold`, `#026AFD` |
| 2 | `SizedBox(height: 12)` | |
| 3 | **Name** `Text(_user.name)` | `24px / w700`; light `#000000`, dark `#FFFFFF`; no maxLines/ellipsis (wraps) |
| 4 | `SizedBox(height: 4)` | |
| 5 | **Handle** `Text('@' + name.toLowerCase().replaceAll(' ', ''))` | `16px`, `#8E8E8E` |
| 6 | `SizedBox(height: 24)` | |
| 7 | **Bio card** `Stack` | container `width: infinity`, `padding: all(16)`, `color` light `#FAFAFA` (grey50) / dark `#1C1C1E`, `borderRadius: 12`, border `1px` light `#EEEEEE` (grey200) / dark `#2C2C2E` |
| 7a | Bio text | `bio ?? 'No bio yet'`, `16px`, `height: 1.5`, light `#666666`, dark `#E0E0E0` (grey300) |
| 7b | Edit pencil | `Positioned(top: 8, right: 8)` → `Icons.edit`, `#9E9E9E` (`Colors.grey`), `size: 20`; tap → `pushNamed('/edit-profile')` await → `_loadProfile()` |
| 8 | `SizedBox(height: 32)` | |
| 9 | **Action buttons** `Row` | two `Expanded`, gap `12` |
| 9a | `ElevatedButton('Edit Profile')` | bg `#026AFD`; fg = dark ? `#000000` : `#FFFFFF`; radius `12`; `padding: symmetric(vertical: 12)`; text `16px w600`; **min height 56 from theme**; tap → `pushNamed('/edit-profile')` await → `_loadProfile()` |
| 9b | `OutlinedButton('Share Profile')` | fg light `#000000` / dark `#FFFFFF`; side `1px` light `#E0E0E0` / dark `#2C2C2E`; radius `12`; `padding: symmetric(vertical: 12)`; bg light `#FAFAFA` / dark `#1C1C1E`; text `16px w600`; **min height 40 (OutlinedButton default) → visually ~48px, shorter than the 56px ElevatedButton; both are vertically centered (`Row` crossAxisAlignment.center)** |
| 10 | `SizedBox(height: 32)` | |
| 11 | **Photos grid** (see 1.3) | last cell = Upload card |

## 1.3 Photos grid (`_buildPhotosGrid`)

- `GridView.builder(shrinkWrap: true, physics: NeverScrollableScrollPhysics)`
- `SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 8, mainAxisSpacing: 8)`; `childAspectRatio` **default 1.0 → square cells**.
- Cell side = `(viewportWidth − 40 − 8) / 2` → 360dp screen: **156**; 390dp: **171**; 414dp: **183**; 430dp: **191**.
- `itemCount = profileImagesCount + legacyPhotosNotDuplicated + 1` (upload card always last).
- Order: `profileImages` (public **and** exclusive, owner sees all) → legacy `photos` URLs not present in `profileImages` → upload card.

### Cell A — ProfileImage

| Layer | Detail |
|---|---|
| Container | radius `12`, border `1px`: dark `#3A3A3C`, light `#EEEEEE` (grey200) |
| Image | `ClipRRect(12)` + `CachedNetworkImage(fit: cover)`; placeholder light `#F5F5F5` (grey100) / dark `#2C2C2E`; error bg light `#EEEEEE` / dark `#2C2C2E` + `Icons.broken_image` `#9E9E9E` (default size 24) |
| Badge | `Positioned(bottom: 8, left: 8, right: 8)`; `Row(mainAxisAlignment: exclusive ? spaceBetween : start)`; inner `Container(padding: h6 v3, borderRadius: 6)`, color `Colors.deepOrange @ 0.85` (`#FF5722` @ .85) when exclusive, else `Colors.black54` (`rgba(0,0,0,.54)`) |
| Badge text | exclusive: `'🔒 ₦${price.toStringAsFixed(0)}'`; public: `'🔓 Public'`; `9px`, `bold`, `#FFFFFF`, `maxLines: 1`, `ellipsis` |
| Tap | `_manageProfileImage(img)` → bottom sheet (1.7) |

### Cell B — Legacy photo

Same container/border/radius as A; `ClipRRect(12)` image; **no badge**. Tap → full-screen viewer seeded with the legacy-only list.

### Cell C — Upload card (last)

`GestureDetector` → `_pickAndUploadProfileImage`.
- `Container`: bg light `#FAFAFA` / dark `#1C1C1E`, radius `12`, border `1.5px #026AFD @ 0.30`, `BorderStyle.solid`.
- `Column(center)`: `Icons.add_a_photo_rounded` `#026AFD` `size: 32`; `SizedBox(height: 8)`; `Text('Upload Photo')` `13px`, `w700`, `#026AFD`.

## 1.4 Loading state (shimmer) — static, **no animation**

`SingleChildScrollView(padding: all(20))` → centered `Column`:

| Child | Metrics |
|---|---|
| Avatar block | `120×120` circle |
| gap | `12` |
| Name block | `180×28`, radius `8` |
| gap | `8` |
| Handle block | `120×18`, radius `8` |
| gap | `24` |
| Bio block | `width: infinity × 60`, radius `12` |
| gap | `32` |
| Button row | two `Expanded` `height: 48`, radius `12`, gap `12` |
| gap | `32` |
| Grid | 2 cols, `8`/`8`, `6` items, radius `12` |

Block color: dark `#2C2C2E`, light `#EEEEEE` (grey200).

## 1.5 Error state

Centered `Column`: `Icons.error_outline 64 #BDBDBD` (grey400) → `16` → `Text(_error)` `16px #9E9E9E` → `16` → `ElevatedButton('Retry')` → `_loadProfile()`. `_error` value: `'Failed to load profile'`.

## 1.6 Settings bottom sheet (`_SettingsModal`)

`showModalBottomSheet`: bg light `#FFFFFF` / dark `#1C1C1E`, `RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: 20))`.
Content `Column(mainAxisSize: min)`:

| # | Element | Metrics |
|---|---|---|
| 1 | `SizedBox(height: 12)` | |
| 2 | Drag handle | `40×4`, radius `2`, light `#E0E0E0` / dark `#3A3A3C` |
| 3 | `SizedBox(height: 16)` | |
| 4 | `Text('Settings')` | `18px w600`, black/white |
| 5 | `SizedBox(height: 20)` | |
| 6 | `ListTile` leading `Icons.person_add` (dark `rgba(255,255,255,.7)`, light `#000000`) title `'Refer a Friend'` | default tile height `56`, leading 24, title `16px`; **no trailing chevron** |
| 7 | `ListTile` leading `Icons.logout` `#F44336`, title `'Logout'` `#F44336` | |
| 8 | `ListTile` leading `Icons.delete_forever` `#F44336`, title `'Delete Account'` `#F44336` | |
| 9 | `SizedBox(height: 20)` | |

Taps: `Refer a Friend` → pop sheet → referral sheet (1.8). `Logout` → pop → logout dialog. `Delete Account` → pop → delete dialog.

## 1.7 Photo manage bottom sheet (`_manageProfileImage`)

`showModalBottomSheet`: bg light `#FFFFFF`/dark `#1C1C1E`, top radius `24`.

| # | Element | Metrics |
|---|---|---|
| 1 | `SizedBox(height: 12)` | |
| 2 | Handle | `40×4`, radius `2`, light `#E0E0E0`/dark `#3A3A3C` |
| 3 | `SizedBox(height: 16)` | |
| 4 | Title | `'🔒 Exclusive Content'` if exclusive else `'🔓 Public Photo'`; `16px bold`, black/white |
| 5 | `SizedBox(height: 8)` | |
| 6 | Subtitle (exclusive only) | `'Unlocks for ₦${price.toStringAsFixed(0)}'`, `14px`, light `#757575` (grey600) / dark `#BDBDBD` |
| 7 | `SizedBox(height: 16)` | |
| 8 | `ListTile` `Icons.fullscreen_rounded` (dark `rgba(255,255,255,.7)`, light `rgba(0,0,0,.87)`) `'View Fullscreen'` | → pop → full-screen viewer with all `profileImages`, `initialIndex` = index of this image |
| 9 | `ListTile` `Icons.lock_open_rounded` (if exclusive) / `Icons.lock_rounded`, `#026AFD`, title `'Make Public'` / `'Make Exclusive'` | Make Public → `_toggleExclusivity(id, false, 0)`; Make Exclusive → price dialog |
| 10 | `ListTile` `Icons.delete_forever_rounded` `#F44336`, `'Delete Photo'` `#F44336` | → delete confirm dialog |
| 11 | `SizedBox(height: 20)` | |

## 1.8 Referral bottom sheet (`_ReferralModal`)

`showModalBottomSheet`: bg light `#FFFFFF` / dark `#1C1C1E`, top radius `20` (sheet) **and** inner container `BorderRadius.vertical(top: 24)` + `padding: only(bottom: 30)`.

| # | Element | Metrics |
|---|---|---|
| 1 | `SizedBox(height: 12)` | |
| 2 | Handle | `48×5`, radius `2.5`, light `#E0E0E0`/dark `#3A3A3C` |
| 3 | `SizedBox(height: 24)` | |
| 4 | Gift circle | `80×80` circle `#026AFD @ 0.10` + `Icons.card_giftcard_rounded` `size: 40` `#026AFD` |
| 5 | `SizedBox(height: 20)` | |
| 6 | Title | `'Invite Friends, Get Rewarded'`, `22px`, `w800`, black/white, single line |
| 7 | `SizedBox(height: 8)` | |
| 8 | Body `Padding(h: 32)` | `'Share your unique link. When your friends join, you both unlock premium features!'`, `15px`, `height: 1.4`, center, light `#757575` / dark `#BDBDBD` |
| 9 | `SizedBox(height: 32)` | |
| 10 | Code card `Padding(h: 24)` | `width: infinity`, `padding: all(20)`, gradient `LinearGradient(colors: [#026AFD, #026AFD], begin: topLeft, end: bottomRight)` (solid blue — no visual gradient), radius `20`, shadow `#026AFD @ 0.30`, `blurRadius: 15`, `offset (0, 8)` |
| 10a | Label | `'YOUR REFERRAL CODE'`, `rgba(255,255,255,.7)`, `12px`, `bold`, `letterSpacing: 1.5` |
| 10b | `SizedBox(height: 8)` | |
| 10c | Code | `referralCode ?? '------'`, `#FFFFFF`, `32px`, `w900`, `letterSpacing: 4` |
| 11 | `SizedBox(height: 24)` | |
| 12 | Buttons `Padding(h: 24)` `Row` | gap `16`, both `Expanded` |
| 12a | `OutlinedButton.icon(Icons.copy_rounded 20, 'Copy Link')` | fg `#026AFD`, side `2px #026AFD`, `padding: symmetric(vertical: 16)`, radius `16`, label `16px w700`; tap → copy `referralUrl` to clipboard, toast `Referral link copied!`; if null → toast `Referral link not available` |
| 12b | `ElevatedButton.icon(Icons.share_rounded 20, 'Share Now')` | bg `#026AFD`, fg `#FFFFFF`, `elevation: 0`, `padding: symmetric(vertical: 16)`, radius `16`, label `16px w700`; tap → share sheet |

## 1.9 Dialogs

All `AlertDialog`: bg light `#FFFFFF` / dark `#1C1C1E`; **no custom shape** → M3 default radius `28`; title `24px` (`headlineSmall`), content `14px`, actions right-aligned `TextButton` (`#026AFD` unless overridden).

| Dialog | Title | Content (verbatim) | Actions |
|---|---|---|---|
| Logout (`_showLogoutConfirmation`) | `Logout` | `Are you sure you want to logout?` | `Cancel` → **`Navigator.pushReplacementNamed('/feed')`** (does *not* pop the dialog first — reproduces a visible quirk); `Logout` (`#F44336`) → pop → `_logout()` |
| Set Unlock Price (`_promptSetPrice`) | `Set Unlock Price` | Column(min, start): description `Set the amount in Nigerian Naira (₦) other users must pay to unlock this exclusive photo.` `13px`, light `rgba(0,0,0,.54)` / dark `#BDBDBD`; `16`; `TextField` prefilled `500`, `keyboardType: number`, `prefixText: '₦ '`, `labelText: 'Unlock Price'`, `border: OutlineInputBorder()` (default radius **4**, overrides theme) | `Cancel`; `Confirm` (`bold`) → parse double (fallback `500.0`) → `_toggleExclusivity(id, true, price)` |
| Delete Photo (`_confirmDeleteImage`) | `Delete Photo?` | `Are you sure you want to delete this photo permanently?` | `Cancel`; `Delete` (`#F44336`, `bold`) |
| Delete Account (`_confirmDeleteAccount`) | `Delete Account` | `This will permanently delete your account and all associated data. Are you sure you want to continue?` | `Cancel`; `Delete` (`#F44336`) → `ApiService.deleteAccount()` |

Price dialog shape override: `RoundedRectangleBorder(borderRadius: 20)` (both price + delete-photo dialogs).

## 1.10 Full-screen viewer (`_FullscreenViewer`)

- `Scaffold(backgroundColor: #000000)`; `PageView.builder(initialPage: initialIndex)`.
- Each page: `InteractiveViewer` → `Center` → `CachedNetworkImage(fit: BoxFit.contain)`; placeholder `CircularProgressIndicator` (centered, default size 36, color scheme primary); error `Icons.broken_image size 80 #9E9E9E`.
- Close button: `Positioned(top: 48, right: 16)`, `40×40` circle `rgba(0,0,0,.5)`, `Icons.close #FFFFFF` (24).
- No page indicator, no swipe hint, no caption, no hero animation.

## 1.11 Interactions & side effects

| Trigger | Behavior | Toast/dialog |
|---|---|---|
| Tap avatar (120 circle) | `ImagePicker.pickImage(source: gallery, imageQuality: 85)` (no crop, no confirm) → `ApiService.uploadImage` → `updateProfile({'avatar': url})` → reload | `Profile photo updated!` / `Failed to update photo` |
| Tap pencil / Edit Profile | `pushNamed('/edit-profile')`, await, reload | — |
| Tap Share Profile | `Share.share('Check out my profile on Zukaping!\nLet's connect: $shareUrl', subject: "${name}'s Profile on Zukaping")`, `shareUrl = 'https://zukaping.app/@${name.toLowerCase().replaceAll(' ', '')}'` | `Profile not loaded yet` if `_user == null`; `Failed to share profile` |
| Share Now (referral) | `Share.share('🎁 Join me on Zukaping!\nUse my referral link to unlock premium perks instantly:\n$referralUrl', subject: "You're invited to Zukaping!")` | `Referral link not available` / `Failed to share` |
| Copy Link | `Clipboard.setData(referralUrl)` | `Referral link copied!` |
| Settings → Logout → Logout | remove `token` from SharedPreferences | `Logged out` then `pushReplacementNamed('/login')` |
| Settings → Delete Account → Delete | `DELETE /me`; if `result['message'] != null` → `CustomBottomNavBar.clearCache()` | `Account deleted` → `/login`; else `Failed to delete account` |
| Upload card tap | gallery pick, `imageQuality: 85`, `uploadProfileImage`, sets `_isLoading = true` (whole screen flips to shimmer while uploading) | `Image uploaded successfully!` / `Failed to upload image: $e` |
| Make Public / Make Exclusive | `PATCH /users/me/images/{id}` | `Photo is now Exclusive!` / `Photo is now Public!` / `Failed to update photo status` |
| Delete Photo | `DELETE /users/me/images/{id}` | `Photo deleted successfully` / `Failed to delete photo` |
| WebSocket `new_message` (sender ≠ me) | toast | `📩 New message from {senderName|Someone}` |
| WebSocket `post_accepted` | toast | `🤝 Request accepted by {userName|Someone}` |
| WebSocket `post_favorited` | toast | `⭐ Someone favorited your request` |
| Pull-to-refresh | reload profile | — |

## 1.12 API calls & fields read

| Call | Endpoint | Fields used |
|---|---|---|
| `ApiService.getProfile()` | `GET {baseUrl}/me` (Bearer) → also writes `cached_profile`; on error falls back to cached; 401 → clears token+caches | `id`/`_id`, `email`, `name` (fallback: email prefix, else `'User'`), `username`, `bio`, `avatar` (null if empty or contains `Portrait_Placeholder.png`), `photos[]` (strings, filtered empty/placeholder), `gender` (default `'Other'`), `interestedIn[]`, `status` (default `'offline'`), `profile_images[]` → `{id|_id, url, thumbnail_url|thumbnailUrl, is_exclusive|isExclusive, price, currency (default 'NGN'), is_unlocked|isUnlocked (default true), blur_hash|blurHash, created_at}` |
| `_loadReferralLink()` | `GET {baseUrl}/me/referral` (raw `http.get`, Bearer) status 200 | `referralCode`, `referralUrl` |
| `uploadImage` | `POST {baseUrl}/upload-photo` multipart field name **`photo`**, Bearer | response `url` |
| `uploadProfileImage` | `POST {baseUrl}/users/me/images` multipart `photo` | full JSON (ignored) |
| `updateProfile` | `PUT {baseUrl}/me` JSON | `{avatar}` / `{status}` |
| `updateProfileImage` | `PATCH {baseUrl}/users/me/images/{imageId}` | body `{is_exclusive, price, currency: 'NGN'}` |
| `deleteProfileImage` | `DELETE {baseUrl}/users/me/images/{imageId}` | — |
| `deleteAccount` | `DELETE {baseUrl}/me` (200 → removes token + caches) | `message` |
| Favorites count for nav badge | not fetched here (null) | — |

Avatar resolution on this screen: `avatar` if non-empty → else `photos.first` → else placeholder initial. Note `User.fromJson` already substitutes the first `profile_images[0].url` before `photos[0]`, so effective order is `avatar` → `profile_images[0].url` → `photos[0]`.

---

# 2. Edit Profile — `EditProfileScreen`

No bottom nav. AppBar has back button only.

## 2.1 Widget tree

```
Scaffold
├─ AppBar (elevation 0, centerTitle: true)
│  ├─ leading: IconButton(Icons.arrow_back, color: dark ? #FFFFFF : #000000) → Navigator.pop(context)
│  └─ title: Text('Edit Profile', 18 / w600, dark ? #FFFFFF : #000000)
└─ body: _isLoading
   ? Center(CircularProgressIndicator())          // default size, theme primary
   : SingleChildScrollView(padding: all(20))
     └─ Form(key)
        └─ Column(crossAxisAlignment: start)
```

## 2.2 Form layout (exact order & spacing)

| # | Element | Metrics / strings |
|---|---|---|
| 1 | `Center` → `GestureDetector(_pickAvatar)` → `Stack` | avatar `120×120`, circle, border **`2px #026AFD`** (note: 2px here vs 3px on My Profile), shadow `#026AFD @ 0.10`, `blurRadius 0`, `spreadRadius 4` |
| 1a | Avatar content priority | new picked file (`Image.file`, or `Image.network` on web, `fit: cover`) → `_currentAvatar` → first non-empty `_photos` URL → placeholder |
| 1b | Placeholder | `#026AFD @ 0.20` bg, initial from `_nameController.text` (or `'?'`), `48px bold #026AFD` |
| 1c | Camera badge | `Positioned(bottom: 0, right: 0)`, `36×36` circle `#026AFD`, `Icons.camera_alt size 18 color #000000` |
| 2 | `SizedBox(height: 16)` | |
| 3 | `Center(TextButton('Change Avatar'))` | text color `#026AFD` (theme), default text style `14px`; tap → `_pickAvatar` |
| 4 | `SizedBox(height: 32)` | |
| 5 | Label `'Name'` | `14px`, `w500`, light `#666666`, dark `#BDBDBD` |
| 6 | `SizedBox(height: 8)` | |
| 7 | `TextFormField` hint `'Your name'` | filled light `#FAFAFA` / dark `#1C1C1E`; radius `12`; border `1px` light `#E0E0E0` / dark `#2C2C2E`; focus `2px #026AFD`; padding `h16 v12`; validator `'Name is required'` |
| 8 | `SizedBox(height: 24)` | |
| 9 | Label `'Username'` + `8` + field hint `'@username'` | validator `'Username is required'`; saved value strips all `@` |
| 10 | `SizedBox(height: 24)` | |
| 11 | Label `'Bio'` + `8` + field hint `'Tell others about yourself...'` | `maxLines: 4`, `maxLength: 150` (shows `0/150` counter, `12px`, theme hint color) |
| 12 | `SizedBox(height: 24)` | |
| 13 | Label `'Gender'` + `12` + `Wrap(spacing: 16)` | `Radio<String>` (`activeColor #026AFD`, default 20px + 8 padding) + `Text` `16px`; labels `Male`, `Female`, `Other` |
| 14 | `SizedBox(height: 24)` | |
| 15 | Label `'Interested In'` + `12` + `Wrap(spacing: 16, runSpacing: 8)` | `Checkbox(activeColor #026AFD)` + `Text` `16px`; labels `Men`, `Women`, `Everyone` |
| 16 | `SizedBox(height: 32)` | |
| 17 | Label `'Additional Photos'` | |
| 18 | `SizedBox(height: 4)` | |
| 19 | Helper `'You can add or replace up to 6 photos.'` | `12px`, `#9E9E9E` (grey500) |
| 20 | `SizedBox(height: 12)` | |
| 21 | Photo grid (2.3) | |
| 22 | `SizedBox(height: 24)` | |
| 23 | Label `'Status'` + `12` + `DropdownButtonFormField<String>` | decoration hint `'No status'`; items: `null → 'No status'`, `'available' → 'Available'`, `'busy' → 'Busy'` |
| 24 | `SizedBox(height: 32)` | |
| 25 | Save button (2.4) | |
| 26 | `SizedBox(height: 40)` | |

## 2.3 Photo grid (edit)

- `GridView.builder(shrinkWrap: true, physics: NeverScrollableScrollPhysics)`
- `SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, crossAxisSpacing: 12, mainAxisSpacing: 12)`; `childAspectRatio` default `1.0` (square).
- Cell side = `(W − 40 − 24) / 3` → 360dp: **98.67**; 390dp: **108.67**; 414dp: **116.67**.
- `itemCount: 6` (always 6 slots).

Slot (`_buildPhotoSlot`):
- `Container`: bg light `#FAFAFA` / dark `#1C1C1E`; radius `16`; border `1px` — `#026AFD` if slot has a photo, else light `#E0E0E0` / dark `#2C2C2E`.
- **Filled:** `ClipRRect(16)` + image `cover`, `width/height: infinity`; placeholder / error bg light `#EEEEEE` / dark `#2C2C2E`, error icon `Icons.broken_image #9E9E9E` (default 24).
- Remove button: `Positioned(top: 8, right: 8)`, `24×24` circle `rgba(255,255,255,.9)`, border `1px #E0E0E0` (grey300), shadow `rgba(0,0,0,.1)` `blurRadius 4` `offset (0,2)`, `Icons.close size 16 #000000`; tap → clear slot (no confirm).
- **Empty:** centered `Column`: `Icons.add_photo_alternate_outlined` `#BDBDBD` `size: 32`; `SizedBox(height: 4)`; `Text('Add photo')` `12px #9E9E9E`.
- Tap anywhere in slot → gallery pick (`imageQuality: 85`) → **upload immediately** via `uploadImage`; success sets URL + toast `Photo uploaded`; on exception stores local `XFile` for upload during save (no toast).

## 2.4 Save button

- `SizedBox(width: double.infinity)` → `ElevatedButton`
- bg `#026AFD`, fg `#000000` (**black text on blue**), radius `12`, `padding: symmetric(vertical: 14)`, theme `minimumSize` → **height ≥ 56**.
- Label `'Save Changes'` `16px w600`.
- Saving state: `SizedBox(20×20, child: CircularProgressIndicator(strokeWidth: 2, color: #000000))`; button `onPressed: null` while saving.
- On success: toast `'Profile updated successfully!'`, `CustomBottomNavBar.clearCache()`, `Navigator.pop(context, true)`.

## 2.5 Interactions / validation / errors

| Trigger | Result |
|---|---|
| Load failure (`GET /me` throws) | toast `Failed to load profile`, `_isLoading=false` (empty form) |
| Save with blank name | inline validator `Name is required`, no request |
| Save with blank username | inline validator `Username is required`, no request |
| Save flow | upload new avatar (if any) → upload any queued photo slots (loop 6) → `PUT /me` |
| Save failure | toast `Failed to update profile: $e` |
| Back button | `Navigator.pop(context)` (no unsaved-changes guard) |

`PUT /me` payload (JSON):
```json
{
  "name": "<trimmed>",
  "username": "<trimmed, '@' removed>",
  "bio": "<trimmed>",
  "avatar": "<url, only if non-null>",
  "gender": "<only if non-null: male|female|other>",
  "interestedIn": ["men"|"women"|"everyone"],
  "status": "<only if non-empty: available|busy>",
  "photos": ["<non-null urls>"]
}
```
Fields read on load: `name`, `username`, `bio`, `avatar` (ignored if contains `Portrait_Placeholder.png`), `gender`, `status`, `interestedIn[]`, `photos[]` (first 6 non-empty, non-placeholder).

## 2.6 Loading state

`Center(child: CircularProgressIndicator())` — Material default: 36×36, 4px stroke, `colorScheme.primary` (`#026AFD`), indeterminate ~1333 ms rotation.

---

# 3. Favorites — `FavoritesScreen`

Route `/favorites`. AppBar with logo + status pill, **no title**. Bottom nav with `favoritesCount = _favorites.length` (shows badge).

## 3.1 Widget tree

```
Scaffold
├─ AppBar (elevation 0, automaticallyImplyLeading: false, title: null)
│  ├─ leading: AppLogo (40×40)
│  └─ actions: [_buildStatusIndicator]
├─ body: Column
│  ├─ _buildSearchBar()
│  └─ Expanded(_buildBody()) → shimmer | error | empty | RefreshIndicator(ListView)
└─ bottomNavigationBar: CustomBottomNavBar(currentRoute '/favorites', favoritesCount: _favorites.length)
```

## 3.2 Status pill (AppBar action)

- `GestureDetector(onTap: _updateStatus)` → `Container`
- `margin: only(right: 16)`; `padding: symmetric(horizontal: 12, vertical: 6)`; radius `20`.
- bg light `#F5F5F5` (grey100) / dark `#1C1C1E`; border `1px` light `#E0E0E0` (grey300) / dark `#2C2C2E`.
- `Row(mainAxisSize: min)`: dot `12×12` circle → `8` → `Text` `14px w600` (black/white).
- States cycle `Available → Busy → Offline → Available` (index +1 mod 3, optimistic; on API error index +2 mod 3 to revert).
- Dot colors: `available` `#026AFD`; `busy` `#FFFF00`; `offline` `#9E9E9E` (`Colors.grey`).
- Labels: `Available`, `Busy`, `Offline`.
- Toast on success: `'Status changed to {Available|Busy|Offline}'`; on failure `'Failed to update status'`.

## 3.3 Search bar

- `Container(padding: all(16))`, bg light `#FFFFFF` / dark `#121212`, bottom border `1px` light `#E0E0E0` / dark `#2C2C2E`.
- `TextField`: hint `'🔍 Search favorites by name...'`; `prefixIcon: Icon(Icons.search, color: #9E9E9E)` (24 default); `filled: true`; fill light `#F5F5F5` (grey100) / dark `#1C1C1E`; `border: OutlineInputBorder(borderRadius: 25, borderSide: none)`; `contentPadding: h20 v12`. No explicit enabled/focused border → `BorderSide.none` collapsed look (pill, 25 radius).
- Filtering: case-insensitive `contains` over `fav.user.name` **or** `fav.user.bio`; recomputes on every keystroke.

## 3.4 List

- `RefreshIndicator(color: #026AFD)` → `ListView.builder(controller, physics: AlwaysScrollableScrollPhysics, padding: all(16))`.
- `itemCount = _filteredFavorites.length`.

Card (`_buildFavoriteCard`), wrapped in `TweenAnimationBuilder<double>`:

| Property | Value |
|---|---|
| Animation duration | `300 + index * 50` ms (index 0 → 300ms, 1 → 350, 2 → 400…) |
| Tween | `0.0 → 1.0`, linear (no curve) |
| Opacity | `value` (fade in) |
| Translate | `Offset(0, 20 * (1 - value))` → slides up 20px |
| Outer container margin | `only(bottom: 16)` |
| Container | bg light `#FAFAFA` (grey50) / dark `#1C1C1E`; radius `20`; border `1px` light `#EEEEEE` (grey200) / dark `#2C2C2E` |
| Ink | `Material(color: transparent)` → `InkWell(borderRadius: 20, onTap: _startChat(targetUserId))` |
| Padding | `all(20)` |
| Layout | `Row(crossAxisAlignment: center)` |

### Row children

| # | Element | Metrics |
|---|---|---|
| 1 | **Avatar** | `72×72` circle; shadow `rgba(0,0,0,.1)` `blurRadius 8` `offset (0,2)`; `ClipOval` + `CachedNetworkImage(fit: cover)`; placeholder `#E0E0E0` with centered `CircularProgressIndicator(strokeWidth: 2)`; error/absent → placeholder initial `32px bold #026AFD` on `#026AFD @ 0.20` |
| 2 | `SizedBox(width: 16)` | |
| 3 | `Expanded` `Column(crossAxisAlignment: start)` | |
| 3a | `Row`: name `Flexible(Text 20px w700, ellipsis)` + `SizedBox(8)` + distance chip | chip: `padding h8 v4`, bg `#026AFD @ 0.10`, radius `12`, text `12px w500 #026AFD` |
| 3b | `SizedBox(height: 8)` | |
| 3c | Bio | `15px`, light `#666666` / dark `#BDBDBD`; `maxLines: 1`, ellipsis; default `'No bio yet'` |
| 3d | `SizedBox(height: 8)` | |
| 3e | Meta `Row`: `'⭐ Favorited'` `14px #8E8E8E` + `SizedBox(12)` + status dot + `SizedBox(6)` + status label `Online`/`Busy`/`Offline` `14px #8E8E8E` | dot `12×12` circle: available `#026AFD` + shadow `#026AFD @ 0.5 blur 8`; busy `#FFFF00` + shadow `#FFFF00 @ 0.5 blur 8`; offline `#9E9E9E` no shadow |
| 4 | `SizedBox(width: 12)` | |
| 5 | `_FavoriteActionButton` | `48×48` circle bg `#FFECEF`; shadow `rgba(0,0,0,.04)` `blurRadius 6` `spread 0` `offset (0,3)`; `Icons.favorite` `size 24` `#E91E63` |
| 5a | Button animation | press: `scale 1.0 → 0.85` over `150ms`, `Curves.easeInOut`; reverse on tap-up/cancel; `HapticFeedback.mediumImpact()` on tap; `AnimatedContainer` duration `200ms`; `Tooltip('Remove from favorites')` |

Row height: driven by padding 20×2 + max(avatar 72, text block ≈ 20*1.17 + 8 + 15*1.17 + 8 + 14*1.17 ≈ 72) → **content ~72**, card ≈ **112 + 16 margin = 128** per row (visual, at default line heights).

### Name resolution
`user['name']`; if `'User' | 'Unknown User' | ''` → `user['email']` if non-empty → else `'User'`.
Avatar: `user['avatar']`; if empty or contains `Portrait_Placeholder.png` → first of `user['photos']`.
Distance chip: `null` → `'Nearby'`; `< 1000` → `'{rounded}m away'`; else `'{x/1000 toFixed(1)}km away'`.
Status default `'offline'`.

## 3.5 Empty state

`Center` → `Padding(all(32))` → `Column(center)`:

| Element | Metrics |
|---|---|
| `Icons.favorite_border` | `size: 120`, `#BDBDBD` (grey400) |
| gap | `32` |
| `'No favorites yet'` | `20px`, `#616161` (grey700), `w600` |
| gap | `12` |
| `'You haven\'t saved anyone yet. Explore live requests and add people you like!'` | `16px`, `#9E9E9E` (grey500), `height: 1.5`, centered |
| gap | `24` |
| `ElevatedButton('Explore Live Requests →')` | theme bg `#026AFD`, fg `#FFFFFF`, radius `26`, min `56` → `Navigator.pushReplacementNamed('/feed')` |

## 3.6 Error state

`Center` → `Padding(all(32))` → Column: `Icons.error_outline size 120 #BDBDBD` → `32` → `'Failed to load favorites'` `20px #616161 w600` → `12` → `Text(_error)` `16px #9E9E9E` centered → `24` → `ElevatedButton('Retry')` (resets `_isLoading`, clears error, reloads).
`_error` string: `'Failed to load favorites. Pull to refresh.'`

## 3.7 Loading state (Shimmer package)

`ListView.builder(padding: all(16), itemCount: 3)`, each `Shimmer.fromColors(baseColor: #E0E0E0 (grey300), highlightColor: #F5F5F5 (grey100))`:

| Element | Metrics |
|---|---|
| Wrapper container | `margin: only(bottom: 16)`, `padding: all(20)`, `color: #FFFFFF`, radius `20`, border `1px #EEEEEE` (grey200) |
| Row | avatar `72×72` circle `#9E9E9E`; `SizedBox(16)`; Expanded column: `120×20` r8 → `12` → `200×15` r8 → `12` → `100×14` r8; `28×28` r8 trailing |
| Shimmer animation | default package timing: gradient sweep `1600ms`, `ShimmerDirection.ltr` |

> Note: shimmer block colors are hard-coded light (`#FFFFFF` card) even in dark mode — reproduce as-is.

## 3.8 Interactions

| Trigger | Behavior | Toast |
|---|---|---|
| Tap card body | `POST {baseUrl}/chats {targetUserId}` → `id ?? _id` → `Navigator.push(MaterialPageRoute(ChatScreen(chatId)))` | `Chat opened! 🚀` / `Failed to open chat` |
| Tap heart | `DELETE {baseUrl}/favorite?targetUserId={id}` then removes row locally | `Removed from favorites 💔` / `Failed to remove favorite` |
| Tap status pill | cycle status via `PUT /me {status}` | see 3.2 |
| Pull to refresh | reload favorites | `Favorites refreshed!` |
| No token at init | `Navigator.pushReplacementNamed('/login')` | — |
| WS `new_message` | `SoundService.playReceived()` + toast | `📩 New message from {name|Someone}` |
| WS `post_accepted` / `post_favorited` | toast | see 1.11 strings |

Favorites load: 3 attempts max, `Future.delayed(2s)` between; fast cache key `cached_favorites` (legacy, un-namespaced) is read on first paint; write uses `cached_favorites_{userId}` in ApiService.

## 3.9 API & fields

| Call | Endpoint | Fields |
|---|---|---|
| `getFavorites()` | `GET {baseUrl}/favorites` → list or `{favorites: []}` | per item: `targetUserId`, `user{ name, email, bio, avatar, photos[], distance, status }` |
| `getProfile()` | `GET {baseUrl}/me` | `status` (default `'available'`) |
| `updateProfile()` | `PUT {baseUrl}/me` | `{status}` |
| `createChat()` | `POST {baseUrl}/chats` body `{targetUserId}` | `id` / `_id` |
| `removeFavorite()` | `DELETE {baseUrl}/favorite?targetUserId=` | — |

---

# 4. View Profile — `ViewProfileScreen`

Public profile of another user (`userId` param). No bottom nav. **No cover photo, no tabs, no settings list.** The hero is a `380` dp photo carousel.

## 4.1 Widget tree

```
Scaffold
├─ AppBar (elevation 0, title: null)
│  └─ leading: IconButton(Icons.arrow_back, dark ? #FFFFFF : #000000) → Navigator.pop
└─ body: _isLoading ? _buildShimmerLoading() : _buildContent()
   └─ SingleChildScrollView(padding: all(24))
      └─ Column (default center alignment)
```

## 4.2 Content order (exact)

| # | Element | Metrics |
|---|---|---|
| 1 | **Photo carousel** (only if `effectiveImages.isNotEmpty`) | `Container(height: 380)` — width fills `screen − 48`; radius `20`; border `1px` light `#E0E0E0` (grey300) / dark `#2C2C2E`; `ClipRRect(20)` + `PageView.builder` |
| 1a | Page — unlocked | `CachedNetworkImage(fit: cover)`; placeholder light `#EEEEEE` (grey200) / dark `#1C1C1E`; error light `#E0E0E0` / dark `#2C2C2E` + `Icons.person size 80 #9E9E9E` |
| 1b | Page — locked (`isExclusive && !isUnlocked`) | `ImageFiltered(ImageFilter.blur(sigmaX: 25, sigmaY: 25))` around the image, then `Container(rgba(0,0,0,.35))` overlay |
| 1c | Lock cluster (centered `Column(min)`) | circle `padding 16`, `rgba(0,0,0,.54)`, border `1.5px rgba(255,255,255,.24)`, `Icons.lock_rounded #FFFFFF size 36`; `SizedBox(12)`; chip `padding h14 v6`, bg `#FF5722` (deepOrange), radius `20`, shadow `rgba(0,0,0,.3)` `blur 6` `offset (0,2)`, text `'🔒 Exclusive Content'` `#FFFFFF bold 13px` |
| 2 | Page dots (only if `length > 1`) | `SizedBox(12)` then `Row(center)` of `8×8` circles, `margin: symmetric(horizontal: 4)`; active `#026AFD`; inactive light `#E0E0E0` / dark `#2C2C2E`. **No dots when exactly 1 image.** |
| 2b | No-image fallback | `Container(height: 380)`, bg light `#EEEEEE` / dark `#1C1C1E`, radius `20`, centered `Icons.person size 80 #9E9E9E` |
| 3 | `SizedBox(height: 32)` | |
| 4 | **Name + age** | `'$name${age != null ? ', $age' : ''}'`, `28px w700`, white/black, centered |
| 5 | Bio (if non-empty) | `SizedBox(8)` + text `16px`, light `#666666` / dark `#BDBDBD`, `height: 1.5`, centered |
| 6 | `SizedBox(height: 24)` | |
| 7 | **Distance & status** `Row(center)` | distance text `16px` light `#666666`/dark `#BDBDBD`, format `'{distance.toStringAsFixed(1)} km away'` (num) or `'{distance} km away'` (string), hidden when `distance == null`; `SizedBox(16)`; dot `12×12` circle `available #026AFD` / `busy #FFFF00` / else `#F44336`; `SizedBox(8)`; label `Available` / `Busy` / `Offline` `16px` same gray |
| 8 | **Rating** (if `rating != null`) | `SizedBox(32)`; `Row(center)`: `Icons.star #FFD700 size 24`; `SizedBox(8)`; `'$rating'` `18px` white/black; if `verified`: `SizedBox(8)` + `'✓ Verified'` `14px #026AFD` |
| 9 | `SizedBox(height: 32)` | |
| 10 | **Chat button** | `SizedBox(width: infinity)` → `ElevatedButton`: bg `#026AFD` (disabled `#EEEEEE`), fg `#000000` (disabled `#9E9E9E`), theme shape radius `26`, min height `56`; label `'Chat'` `17px w600`; disabled when `name == 'Unknown User'` |
| 11 | `SizedBox(height: 16)` | |
| 12 | **Secondary actions** `Row(center)` | `IconButton` (48×48 target): `Icons.favorite` / `Icons.favorite_border` `size 28`, color `#F44336` when favorited else `#8E8E8E`; `SizedBox(32)`; `Icons.report_gmailerrorred` `28 #8E8E8E`; `SizedBox(32)`; `Icons.block` `28 #8E8E8E`; `disabledColor: #BDBDBD` |
| 13 | `SizedBox(height: 32)` | |
| 14 | Photos section (only if images) | `SizedBox(32)`; `Align(centerLeft)` `Text('Photos')` `20px w700`; `SizedBox(16)`; grid (4.3) |
| 15 | `SizedBox(height: 32)` | |
| 16 | Additional info (if `lastActive != null` or `interests` non-empty) | `Text('Last active {formatted}')` `14px #666666` centered; `Text('Mutual interests: {interests.join(', ')}')` `14px #666666` centered — **no spacing between the two lines** |

`_formatTime`: `<60s` → `just now`; `<60min` → `{n} minutes ago`; else `{n} hours ago`.
`_formatDistance`: `null` → `''`; num → `'{x.toStringAsFixed(1)} km away'`; string → `'{x} km away'`.

## 4.3 Photos grid

- `GridView.builder(shrinkWrap: true, physics: NeverScrollableScrollPhysics)`
- `SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 8, mainAxisSpacing: 8)`, `childAspectRatio` default `1.0`.
- Cell side = `(W − 48 − 8) / 2` → 360dp: **152**; 390dp: **167**; 414dp: **179**.
- Tile: `ClipRRect(borderRadius: 12)` → `Stack(fit: expand)`; **no border** (unlike My Profile grid).
- `itemCount = effectiveImages.length` (**no upload card**).

| State | Layers |
|---|---|
| Unlocked | image `cover`; placeholder `#F5F5F5` (grey100); error `#EEEEEE` + `Icons.broken_image #9E9E9E`; bottom-left chip `Positioned(bottom: 8, left: 8)` bg `rgba(0,0,0,.54)`, radius `6`, `padding h6 v4`, text `'🔓 Public'` `10px bold #FFFFFF` |
| Locked | image under `ImageFiltered(blur sigma 15)`; `Container(rgba(0,0,0,.2))`; centered white circle `padding 8`, shadow `#00000026` `blur 4`, `Icons.lock_rounded #FF5722 size 20`; bottom chip `Positioned(bottom: 8, left: 8, right: 8)` bg `rgba(0,0,0,.87)`, radius `6`, `padding h6 v4`, text `'🔒 Exclusive (₦${price.toStringAsFixed(0)})'` `10px bold #FFFFFF` centered, 1 line, ellipsis |

## 4.4 Loading shimmer (static, gray `#EEEEEE` / grey200 blocks)

`SingleChildScrollView(padding: all(24))` → centered column:

| Block | Metrics |
|---|---|
| Carousel | full width × `380`, radius `20` |
| gap | `44` |
| Name | `200×32`, radius `12` |
| gap | `16` |
| Bio | `280×60`, radius `12` |
| gap | `32` |
| Meta row | `100×20` r12 + `32` + `100×20` r12 |
| gap | `40` |
| Rating | `120×28` r12 |
| gap | `40` |
| Chat button | full width × `52`, radius `26` |
| gap | `24` |
| Secondary | 3 × `52×52` circles, `Padding(horizontal: 16)` each |

## 4.5 Pay-to-unlock bottom sheet

`showModalBottomSheet(backgroundColor: transparent, isScrollControlled: true)` → container `BorderRadius.vertical(top: 24)`, bg light `#FFFFFF` / dark `#1C1C1E`, `padding: symmetric(horizontal: 24, vertical: 20)`.

| # | Element | Metrics |
|---|---|---|
| 1 | Handle | `40×5`, radius `10`, color `Colors.grey[350]` → **invalid Material shade → resolves to `null` ⇒ handle renders invisible/transparent** (reproduce as `transparent` or omit) |
| 2 | `SizedBox(height: 24)` | |
| 3 | Preview | `ClipRRect(16)` → `SizedBox(140×140)`: image `cover` with `ImageFiltered(blur sigma 15)`, placeholder `#EEEEEE`, error `#E0E0E0` + `Icons.person size 40 #9E9E9E`; `Container(rgba(0,0,0,.12))`; centered `Icons.lock_rounded #FFFFFF size 40` |
| 4 | `SizedBox(height: 20)` | |
| 5 | Title | `'🔒 Exclusive Content'` `22px w800` black/white |
| 6 | `SizedBox(height: 8)` | |
| 7 | Subtitle | `'Unlock this premium photo by @{username}'` `15px` light `#757575` / dark `#BDBDBD`, centered |
| 8 | `SizedBox(height: 24)` | |
| 9 | CTA | full width `height: 54`, bg `#FF5722`, fg `#FFFFFF`, `elevation: 0`, radius `27`; label `'Unlock for ₦{price.toFixed(0)}'` `16px bold`; tap → pop → `POST /content/{id}/unlock` → toast `"Payment coming soon! Content unlocked instantly for testing."` → reload |
| 10 | `SizedBox(height: 16)` | |
| 11 | Legal | `'By unlocking, you agree to our Terms of Service. Purchases are final and directly support the creator.'` `11px #BDBDBD` `height: 1.4` centered |
| 12 | `SizedBox(height: 16)` | |
| 13 | `TextButton('Cancel')` | `15px bold #757575` (grey600) → pop |
| 14 | `SizedBox(height: 12)` | |

Failure toast: `'Failed to unlock content: $e'`.

## 4.6 Lightbox (`_PhotoLightbox`)

- `Scaffold(backgroundColor: #000000)`; `PageView.builder(initialPage)`; per page `InteractiveViewer` → `Center` → `CachedNetworkImage(fit: contain)`; loader centered `CircularProgressIndicator`; error `Icons.broken_image size 80 #9E9E9E`.
- Close: `Positioned(top: 40, right: 20)`, `40×40` circle `rgba(0,0,0,.5)`, border `1px rgba(255,255,255,.24)`, `Icons.close #FFFFFF` (24).
- No caption/counter/actions.

## 4.7 Interactions

| Trigger | Behavior | Toast / nav |
|---|---|---|
| Tap unlocked carousel page / unlocked grid tile | build list of non-locked images, open lightbox at tapped index | — |
| Tap locked tile/page | open pay-to-unlock sheet | — |
| Tap Chat | `POST {baseUrl}/chats {targetUserId: userId}` → `id/_id` | `Chat created!` then `Navigator.pushReplacementNamed('/chat', arguments: {'chatId': chatId})`; failures `Failed to create chat`; no-op if `name == 'Unknown User'` |
| Tap heart | `toggleFavorite` (`POST /favorite` or `DELETE /favorite?targetUserId=`) | `Added to favorites` / `Removed from favorites` (+ `SoundService.playFavorite()` on add) / `Failed to update favorite` |
| Tap report | nothing implemented | `Report action not implemented` |
| Tap block | nothing implemented | `Block action not implemented` |
| Load error | sets fallback user: name `'Unknown User'`, status `'offline'`, bio `'This profile is no longer available or has been deleted.'`; `_error = 'This profile is no longer available'` | empty state text via `Center(Text(_error))` only when `_userData == null` |

## 4.8 API & fields

| Call | Endpoint | Fields |
|---|---|---|
| `getUserProfile(userId)` | `GET {baseUrl}/users/{userId}/profile` | `name` (default `'Unknown User'`), `age`, `bio` (default `''`), `status` (default `'offline'`), `distance`, `rating`, `verified` (default `false`), `lastActive`, `interests[]`, `photos[]`, `avatar`, `username`, `profile_images[]` → `ProfileImage` (`id/_id`, `url`, `thumbnail_url|thumbnailUrl`, `is_exclusive|isExclusive`, `price`, `currency`, `is_unlocked|isUnlocked`, `blur_hash|blurHash`, `created_at`) |
| `getFavorites()` | `GET {baseUrl}/favorites` | matching `targetUserId` **or** `userId` **or** `id` == `widget.userId` → `_isFavorited` |
| `toggleFavorite(userId, currentlyFavorited)` | `POST {baseUrl}/favorite` `{targetUserId}` / `DELETE {baseUrl}/favorite?targetUserId=` | — |
| `createChat(userId)` | `POST {baseUrl}/chats` `{targetUserId}` | `id` / `_id` |
| `unlockContent(imageId)` | `POST {baseUrl}/content/{imageId}/unlock` body `{}` | — |

Photos resolution: `profile_images[]` if non-empty; else `photos[]` (filtered, non-empty, non-`Portrait_Placeholder.png`); else `[avatar]`; else `[]` — legacy URLs are wrapped as `ProfileImage(isExclusive:false, price:0, currency:'NGN', isUnlocked:true, createdAt: now)`.

---

# 5. Cross-screen delta table (do not accidentally unify these)

| Property | My Profile | Edit Profile | Favorites | View Profile |
|---|---|---|---|---|
| Content padding | `20` | `20` | `16` (search + list) | `24` |
| Avatar size | `120` | `120` | `72` | — |
| Avatar border | `3px` | `2px` | none (shadow only) | — |
| Avatar shadow | `#026AFD .1 / 0 / 4` | `#026AFD .1 / 0 / 4` | `black .1 / 8 / (0,2)` | — |
| Name size | `24 w700` | — | `20 w700` | `28 w700` |
| Grid columns | `2` | `3` | — | `2` |
| Grid gap | `8/8` | `12/12` | — | `8/8` |
| Grid cell radius | `12` | `16` | — | `12` |
| Hero height | — | — | — | `380` |
| Scroll padding-y art | none | none | none | none |

---

# 6. Copy-ready tokens

## 6.1 Colors (CSS)

```css
:root {
  /* brand */
  --primary: #026AFD;
  --primary-05: rgba(2,106,253,0.05);
  --primary-10: rgba(2,106,253,0.10);
  --primary-15: rgba(2,106,253,0.15);
  --primary-20: rgba(2,106,253,0.20);
  --primary-30: rgba(2,106,253,0.30);
  --primary-50: rgba(2,106,253,0.50);
  --primary-85: rgba(2,106,253,0.85);

  /* dark surfaces */
  --dark-bg: #121212;          /* scaffold + appbar + favorites search bar */
  --dark-surface: #1C1C1E;     /* cards, sheets, inputs, snackbar-adjacent surfaces */
  --dark-surface-2: #1E1E1E;   /* dark input fill from theme (overridden to #1C1C1E by edit form) */
  --dark-border: #2C2C2E;      /* 1px borders / inactive dots */
  --dark-border-2: #3A3A3C;    /* grid border, drag handle, nav avatar ring */
  --dark-elevated: #333333;    /* theme dark enabledBorder (unused in these 4 screens) */

  /* light surfaces */
  --white: #FFFFFF;
  --light-bg: #FFFFFF;
  --grey-50: #FAFAFA;
  --grey-100: #F5F5F5;
  --grey-200: #EEEEEE;
  --grey-300: #E0E0E0;
  --grey-350: transparent;     /* Colors.grey[350] is undefined -> null */
  --grey-400: #BDBDBD;
  --grey-500: #9E9E9E;
  --grey-600: #757575;
  --grey-700: #616161;
  --grey: #9E9E9E;             /* Material Colors.grey */

  /* borders / text */
  --border-light: #E0E0E0;
  --border-light-2: #EEEEEE;
  --text-primary-light: #000000;
  --text-primary-dark: #FFFFFF;
  --text-secondary: #666666;
  --text-muted: #8E8E8E;
  --text-hint: rgba(0,0,0,0.54);

  /* semantic */
  --black: #000000;
  --black-12: rgba(0,0,0,0.12);
  --black-20: rgba(0,0,0,0.20);
  --black-26: rgba(0,0,0,0.26);
  --black-35: rgba(0,0,0,0.35);
  --black-54: rgba(0,0,0,0.54);
  --black-87: rgba(0,0,0,0.87);
  --white-24: rgba(255,255,255,0.24);
  --white-70: rgba(255,255,255,0.70);
  --white-90: rgba(255,255,255,0.90);
  --red: #F44336;
  --red-error: #FF453A;
  --deep-orange: #FF5722;
  --busy-yellow: #FFFF00;
  --star-gold: #FFD700;
  --favorite-icon: #E91E63;
  --favorite-bg: #FFECEF;
}
```

## 6.2 Gradients & shadows

```css
--gradient-referral: linear-gradient(135deg, #026AFD 0%, #026AFD 100%); /* visually flat */
--shadow-avatar-ring: 0 0 0 4px rgba(2,106,253,0.10);   /* blur 0, spread 4 */
--shadow-avatar-card: 0 2px 8px rgba(0,0,0,0.10);        /* favorites 72px avatar */
--shadow-fab: 0 4px 12px rgba(2,106,253,0.30);
--shadow-referral-card: 0 8px 15px rgba(2,106,253,0.30);
--shadow-heart-btn: 0 3px 6px rgba(0,0,0,0.04);
--shadow-remove-btn: 0 2px 4px rgba(0,0,0,0.10);
--shadow-lock-chip: 0 2px 6px rgba(0,0,0,0.30);
--shadow-grid-lock: 0 0 4px rgba(0,0,0,0.26);
--glow-status-available: 0 0 8px rgba(2,106,253,0.50);
--glow-status-busy: 0 0 8px rgba(255,255,0,0.50);
```

## 6.3 Radii

```css
--r-2: 2px;    /* modal handles */
--r-2_5: 2.5px;
--r-4: 4px;    /* price-dialog TextField OutlineInputBorder() */
--r-6: 6px;    /* photo badges */
--r-8: 8px;    /* shimmer bars */
--r-10: 10px;
--r-12: 12px;  /* bio card, buttons, grid cells, inputs */
--r-16: 16px;  /* referral buttons, edit photo slots */
--r-20: 20px;  /* sheets, favorite cards, bio/hero, snackbar, price-pill, error dialogs(28) */
--r-24: 24px;  /* sheet tops (photo manage, referral, unlock) */
--r-25: 25px;  /* favorites search pill */
--r-26: 26px;  /* theme ElevatedButton, chat button, shimmer chat bar */
--r-27: 27px;  /* unlock CTA */
--r-28: 28px;  /* default M3 AlertDialog */
```

## 6.4 Type scale (CSS)

```css
.t-48-b  { font-size:48px; font-weight:700; line-height:1.0;  }  /* avatar initial */
.t-32-w9 { font-size:32px; font-weight:900; letter-spacing:4px; }  /* referral code */
.t-32-b  { font-size:32px; font-weight:700; }                    /* favorites avatar initial */
.t-28-w7 { font-size:28px; font-weight:700; }                    /* view profile name */
.t-24-w7 { font-size:24px; font-weight:700; }                    /* my profile name */
.t-22-w8 { font-size:22px; font-weight:800; }                    /* referral title / unlock title */
.t-20-w7 { font-size:20px; font-weight:700; }                    /* favorites card name / Photos heading */
.t-20-w6 { font-size:20px; font-weight:600; }                    /* favorites empty/error title */
.t-18-w6 { font-size:18px; font-weight:600; }                    /* appbar titles, settings title */
.t-18    { font-size:18px; font-weight:400; }                    /* rating value */
.t-17-w6 { font-size:17px; font-weight:600; }                    /* Chat button */
.t-16-w6 { font-size:16px; font-weight:600; }                    /* primary/secondary buttons */
.t-16-w7 { font-size:16px; font-weight:700; }                    /* referral buttons */
.t-16-b  { font-size:16px; font-weight:700; }                    /* sheet titles */
.t-16    { font-size:16px; font-weight:400; }                    /* handle, bio, radios, meta */
.t-15-w7 { font-size:15px; font-weight:700; }                    /* unlock Cancel */
.t-15    { font-size:15px; font-weight:400; }                    /* card bio, referral body, unlock subtitle */
.t-14-w6 { font-size:14px; font-weight:600; }                    /* status pill */
.t-14-w5 { font-size:14px; font-weight:500; }                    /* form labels */
.t-14    { font-size:14px; font-weight:400; }                    /* meta lines, Verified, dialog body */
.t-13-w7 { font-size:13px; font-weight:700; }                    /* 'Upload Photo' */
.t-13-b  { font-size:13px; font-weight:700; }                    /* '🔒 Exclusive Content' carousel chip */
.t-13    { font-size:13px; font-weight:400; }                    /* price-dialog help */
.t-12-w5 { font-size:12px; font-weight:500; }                    /* distance chip */
.t-12-b  { font-size:12px; font-weight:700; }                    /* 'YOUR REFERRAL CODE' (+1.5 letter-spacing) */
.t-12    { font-size:12px; font-weight:400; }                    /* helper text, 'Add photo', counters */
.t-11-w6 { font-size:11px; font-weight:600; }                    /* active nav label */
.t-11    { font-size:11px; font-weight:400; }                    /* unlock legal */
.t-10-b  { font-size:10px; font-weight:700; }                    /* grid lock/public chips, nav badge */
.t-9-b   { font-size:9px;  font-weight:700; }                    /* owner photo badges */
/* line-heights explicitly set in code: 1.5 (bio, empty body, view-profile bio), 1.4 (referral body, unlock legal) */
```

## 6.5 Spacing primitives used (dp)

`2, 3, 4, 5, 6, 8, 12, 14, 16, 20, 24, 30, 32, 40, 44` (also padding pairs `h6 v3`, `h6 v4`, `h8 v4`, `h12 v6`, `h14 v6`, `h20 v12`, `h16 v12`, `h24 v20`, `v12`, `v14`, `v16`).

## 6.6 Icon inventory (exact Material names + size)

| Icon | Size | Where |
|---|---|---|
| `Icons.settings` | 24 | My Profile AppBar |
| `Icons.light_mode_rounded` / `Icons.dark_mode_rounded` | 24 | My Profile AppBar theme toggle |
| `Icons.edit` | 20 | bio card pencil, `#9E9E9E` |
| `Icons.add_a_photo_rounded` | 32 | upload grid card, `#026AFD` |
| `Icons.broken_image` | 24 (default) | grid/broken images, `#9E9E9E` |
| `Icons.broken_image` | 80 | fullscreen/lightbox error |
| `Icons.error_outline` | 64 / 120 | profile error / favorites error |
| `Icons.favorite_border` | 120 | favorites empty |
| `Icons.close` | 24 / 16 | fullscreen close (white) / edit slot remove (black 16) |
| `Icons.fullscreen_rounded` | 24 | photo sheet |
| `Icons.lock_open_rounded` / `Icons.lock_rounded` | 24 | photo sheet toggle |
| `Icons.delete_forever_rounded` | 24 | photo sheet delete |
| `Icons.person_add` | 24 | settings sheet |
| `Icons.logout` | 24 | settings sheet |
| `Icons.delete_forever` | 24 | settings sheet |
| `Icons.card_giftcard_rounded` | 40 | referral hero, `#026AFD` |
| `Icons.copy_rounded` / `Icons.share_rounded` | 20 | referral buttons |
| `Icons.camera_alt` | 18 | edit avatar badge, black |
| `Icons.arrow_back` | 24 | edit + view profile AppBar |
| `Icons.add_photo_alternate_outlined` | 32 | edit empty slot |
| `Icons.add` | 32 | nav FAB, black |
| `Icons.explore` | 26 | nav Live |
| `Icons.favorite` / `favorite_border` | 26 / 24 / 28 | nav 26; card heart 24; view profile 28 |
| `Icons.chat_bubble` / `chat_bubble_outline` | 26 | nav Chats |
| `Icons.person` / `person_outline` | 26 | nav Profile |
| `Icons.search` | 24 | favorites search prefix, `#9E9E9E` |
| `Icons.star` | 24 | rating, `#FFD700` |
| `Icons.report_gmailerrorred` | 28 | view profile, `#8E8E8E` |
| `Icons.block` | 28 | view profile, `#8E8E8E` |
| `Icons.person` | 80 | view profile placeholders; 40 in unlock sheet |
| `Icons.lock_rounded` | 36 / 20 / 40 | carousel 36 white; grid 20 deepOrange; unlock sheet 40 white |
| `Icons.favorite` (heart badge) | 24 | favorites card, `#E91E63` |

## 6.7 Animation tokens

| Animation | Duration | Curve / easing | Notes |
|---|---|---|---|
| Favorites card enter | `300 + index*50` ms | linear (`Tween(begin:0,end:1)`) | opacity 0→1, translateY 20→0 |
| Heart press scale | `150` ms | `Curves.easeInOut` | scale 1.0→0.85→1.0 |
| Heart button container | `200` ms | default (`linear`) | `AnimatedContainer` (no visual property changes in code) |
| Shimmer sweep (golden `Shimmer.fromColors`) | package default `1600` ms | ltr | light-only colors |
| Snackbar | show ~250ms / visible `2000` ms / hide ~250ms | M3 default | floating |
| Bottom sheet | M3 default (`~250–300` ms, ease-out) | default | no custom `AnimationStyle` |
| Page transitions | M3 default `MaterialPageRoute` | default | — |
| Ripple (`InkWell`, buttons) | Material default | default | — |

## 6.8 Route map

| From | Action | Target |
|---|---|---|
| My Profile | Edit Profile / pencil | `pushNamed('/edit-profile')` (await → reload) |
| My Profile | Delete Account success / Logout | `pushReplacementNamed('/login')` |
| My Profile | Logout dialog `Cancel` | `pushReplacementNamed('/feed')` (bug-compatible) |
| My Profile | Manage photo → View Fullscreen | `MaterialPageRoute(_FullscreenViewer)` |
| My Profile | Legacy photo tile | `MaterialPageRoute(_FullscreenViewer)` |
| Favorites | Empty CTA | `pushReplacementNamed('/feed')` |
| Favorites | Card tap | `MaterialPageRoute(ChatScreen(chatId))` |
| Favorites | No token | `pushReplacementNamed('/login')` |
| View Profile | Chat | `pushReplacementNamed('/chat', arguments: {'chatId'})` |
| View Profile | Photo tap | `MaterialPageRoute(_PhotoLightbox)` |
| Edit Profile | Save success | `Navigator.pop(context, true)` |
