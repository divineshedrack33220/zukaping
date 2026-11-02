# Feed Screen — Pixel Specification (Flutter → React/MUI)

**Source of truth**

| File | Role |
|---|---|
| `mobile_app/lib/screens/feed_screen.dart` (1821 lines) | `FeedScreen`, app bar, nearby/story rail, post list, FAB, radar overlay, bottom nav wiring |
| `mobile_app/lib/widgets/post_card.dart` (134 lines) | Standalone `PostCard` (NOT used by `FeedScreen`; documented as alternate component) |
| `mobile_app/lib/widgets/room_carousel.dart` (295 lines) | `RoomCarousel` (NOT instantiated by `FeedScreen`; used at `chats_screen.dart:422`) |
| `mobile_app/lib/widgets/room_preview_sheet.dart` (432 lines) | `RoomPreviewSheet` modal opened by `RoomCarousel` |
| `mobile_app/lib/widgets/loading_widget.dart` (40 lines) | Generic `LoadingWidget` (NOT used by `FeedScreen`) |
| `mobile_app/lib/config/app_theme.dart` | Global theme defaults referenced below |
| `mobile_app/lib/widgets/custom_bottom_nav_bar.dart` | Bottom nav rendered by `FeedScreen` |
| `mobile_app/lib/models/post.dart`, `models/room.dart`, `services/api_service.dart`, `services/room_service.dart` | JSON shapes / API calls |

**Important literal fact:** `feed_screen.dart` imports and renders **neither** `PostCard` **nor** `RoomCarousel`. The feed builds its own post card inline (`_buildPostCard`) and its own "story bar" from nearby users. Sections 13–15 specify those widgets as standalone components, because the task requires them, but they are not part of the `FeedScreen` render tree unless explicitly added.

---

## 1. Render tree (exact order)

```
Scaffold
├─ appBar: AppBar
│  ├─ elevation: 0
│  ├─ automaticallyImplyLeading: false
│  ├─ leading: AppLogo (Image.asset assets/logo.png, 40×40, BoxFit.contain)
│  ├─ title: null
│  └─ actions:
│     ├─ IconButton(radar | radar_outlined, color #026AFD | Colors.grey)
│     └─ _buildStatusIndicator()  // pill
├─ body: Stack
│  ├─ Column
│  │  ├─ _buildStoryBar()        // 130 px tall, or SizedBox.shrink()
│  │  └─ Expanded(_buildBody())  // shimmer | error | empty | list
│  ├─ _buildLocationFab()        // Positioned(bottom: 90, right: 20)
│  └─ if (_showBroadcastOverlay) _buildBroadcastOverlay()  // Positioned.fill
└─ bottomNavigationBar: CustomBottomNavBar(currentRoute: '/feed')
```

No `SafeArea` widget anywhere. Status-bar inset is handled by `Scaffold`/`AppBar`; bottom inset is handled manually in `CustomBottomNavBar` via `MediaQuery.of(context).padding.bottom`.

`isDark = Theme.of(context).brightness == Brightness.dark` is evaluated in nearly every builder.

---

## 2. Global theme values that affect this screen

| Token | Light | Dark |
|---|---|---|
| `primary` | `#026AFD` | `#026AFD` |
| `scaffoldBackgroundColor` | `#FFFFFF` | `#121212` |
| `appBar.backgroundColor` | `#FFFFFF` | `#121212` |
| `appBar.foregroundColor` | `#000000` | `#FFFFFF` |
| `appBar.elevation` | `0` | `0` |
| `appBar.centerTitle` | `true` (title is null here) | `true` |
| Snackbar behavior | floating | floating |
| Snackbar shape | radius `20` | radius `20` |
| Snackbar background | `#026AFD` | `#026AFD` |
| Snackbar text | `#FFFFFF`, default body size (14) | same |
| ElevatedButton background | `#026AFD` | `#026AFD` |
| ElevatedButton foreground | `#FFFFFF` | `#FFFFFF` |
| ElevatedButton radius | `26` | `26` |
| ElevatedButton min size | `Size(double.infinity, 56)` | same |
| ElevatedButton elevation | `0` | `0` |

Default MD3 text theme otherwise. No custom font family is set anywhere (system font).

---

## 3. App bar — `_buildStatusIndicator`, radar action

### 3.1 App bar container

| Property | Value |
|---|---|
| Height | Material default `56` + top safe-area inset |
| Leading width | Material default `56` |
| Logo | `assets/logo.png`, width `40`, height `40`, `BoxFit.contain` (`AppLogo.size = 40.0` default) |
| Title | none (`title: null`) |
| Right padding of status pill | `16` |

### 3.2 Radar `IconButton`

| Property | Value |
|---|---|
| Icon | `_isRadarEnabled ? Icons.radar : Icons.radar_outlined` (Material icons `radar`, `radar_outlined`) |
| Icon size | default `24` |
| Color | enabled `#026AFD`; disabled `Colors.grey` = `#9E9E9E` |
| Button box | default IconButton `48×48`, default splash |
| Tap (turning on) | `_isRadarEnabled = true`, immediately `_broadcastScan()`, snackbar `Radar Activated 📡` |
| Tap (turning off) | `_isRadarEnabled = false`, `_showBroadcastOverlay = false`, `_isScanning = false`, snackbar `Radar Deactivated` |

### 3.3 Status pill

```
GestureDetector(onTap: _updateStatus)
└─ Container(margin right 16, padding h12 v6, radius 20,
             bg #1C1C1E dark / #F5F5F5 light,
             border 1 px #2C2C2E dark / #E0E0E0 light)
   └─ Row(min)
      ├─ 12×12 circle, dotColor
      ├─ SizedBox(width: 8)
      └─ Text(status.text, 14 px, w600, #FFFFFF dark / #000000 light)
```

| Status index | `text` | `class` | dotColor |
|---|---|---|---|
| 0 (default) | `Available` | `available` | `#026AFD` |
| 1 | `Busy` | `busy` | `Colors.yellow` = `#FFEB3B` |
| 2 | `Ghost` | `ghost` | `Colors.grey.withOpacity(0.5)` = `rgba(158,158,158,0.5)` |
| 3 | `Super` | `super` | `Colors.deepPurpleAccent` = `#7C4DFF` |
| 4 | `Offline` | `offline` | `Colors.grey` = `#9E9E9E` |

**Behavior:** tap cycles `newIndex = (current + 1) % 5` optimistically; `PUT /me` with `{ "status": "<value>" }`; on success snackbar `Status changed to <text>` and WebSocket send `{type:'status_update', status, userId}`; on failure index moves forward by 2 (`(current + 2) % 5`, i.e. one step back) and snackbar `Failed to update status`.

Initial status loaded from `GET /me` → `status` (fallback `available`).

---

## 4. Nearby "story" rail — `_buildStoryBar`

Rendered only when `_nearbyUsers.where(userId != currentUserId).take(15)` is non-empty; otherwise `SizedBox.shrink()` (0 height, no gap).

| Element | Numeric value |
|---|---|
| Outer height | `130` |
| Outer padding | `EdgeInsets.symmetric(vertical: 12)` |
| Background | `#1C1C1E` dark / `#FFFFFF` light |
| Bottom border | `1` px `#2C2C2E` dark / `#EEEEEE` light |
| Scroller | horizontal `ListView.builder`, padding `EdgeInsets.symmetric(horizontal: 16)` |
| Item count | max `15` |
| Item width | `80` |
| Item right margin | `12` |
| Ring padding | `3` |
| Ring shape | circle, `LinearGradient(begin: topLeft, end: bottomRight)` |
| Avatar inside ring | `60×60` circle |
| Avatar inner background | `#121212` dark / `#FFFFFF` light |
| Image fit | `BoxFit.cover`, clipped oval |
| Status badge | `Positioned(right: 0, bottom: 0)`, padding `2`, circle, background `#121212` dark / `#FFFFFF` light |
| Badge icon size | `12` |
| Name gap | `SizedBox(height: 4)` |
| Name style | `12` px, `w500`, `#FFFFFF` dark / `#000000` light, `TextOverflow.ellipsis`, first word only (`userName.split(' ')[0]`) |
| Distance style | `10` px, `#BDBDBD` dark / `#757575` light |
| Tap target | whole 80 px column → `/view-profile` with `{userId}` |

Status ring / badge matrix:

| `userStatus` | Gradient start | Gradient end | Badge icon (size 12) | Badge color |
|---|---|---|---|---|
| `available` (default) | `#026AFD` | `Colors.blue[200]` = `#90CAF9` | `Icons.flash_on` | `#026AFD` |
| `busy` | `Colors.amber` = `#FFC107` | `Colors.yellow[300]` = `#FFF176` | `Icons.remove_circle` | `#FFC107` |
| `ghost` | `Colors.grey[400]` = `#BDBDBD` | `Colors.grey[200]` = `#EEEEEE` | `Icons.visibility_off` | `#9E9E9E` |
| `super` | `Colors.purpleAccent` = `#E040FB` | `Colors.deepPurple[200]` = `#B39DDB` | `Icons.star` | `Colors.purple` = `#9C27B0` |
| anything else | `#026AFD` | `#90CAF9` | `Icons.flash_on` | `#026AFD` |

Avatar source priority: `userAvatar` (non-empty) → `userPhotos.first` → `images.first` → initial placeholder.
Placeholder (`_buildStoryPlaceholder`): background `#026AFD` at `0.1` opacity, centered initial (`name[0].toUpperCase()` or `?`), `20` px, `w700`, `#026AFD`.

Distance formatter (`_formatDistance`):

```
null                    → "Nearby"
value < 1000            → "<rounded>m away"     (e.g. "450m away")
value >= 1000           → "<1 decimal>km away"  (e.g. "2.3km away")
```

`Post.distance` is a `String?` parsed by `_formatDistance`; unparsable value → `0` → `"0m away"`.

Time formatter (`_formatTime`):

```
diff < 60 s   → "Just now"
diff < 60 m   → "<n>m ago"
diff < 24 h   → "<n>h ago"
otherwise     → "<n>d ago"
```

---

## 5. Body states — `_buildBody`

Evaluated in this exact order:

1. `_isLoading == true` → shimmer skeleton.
2. `_error != null` → error state.
3. `_posts.isEmpty` → empty state.
4. otherwise → refreshable list.

`_isLoading` starts `true`; cache load or first successful network load sets it `false`. On network error, `_error = 'Failed to load live requests'` is set **only if `_posts` is empty**. Auto-refresh every `30 s`; lifecycle `resumed` reloads feed.

### 5.1 Loading skeleton (`_buildShimmerLoading`)

| Part | Value |
|---|---|
| Shimmer wrapper | `Shimmer.fromColors`, default `period` `1500 ms`, default direction left→right |
| baseColor | `#2C2C2E` dark / `#EEEEEE` light |
| highlightColor | `#1C1C1E` dark / `#F5F5F5` light |
| boxColor (blocks) | `#1C1C1E` dark / `#FFFFFF` light |
| Story shimmer container | height `130`, padding `v12 / h16` |
| Story skeleton count | `6` |
| Story skeleton item | width `80`, right margin `12` |
| Story skeleton circle | `66×66` |
| Story skeleton gap | `8` |
| Story skeleton label bar | `40×10`, radius `4` |
| Post skeleton list | `Expanded(ListView.builder)`, padding `16`, count `3` |
| Post skeleton card | bottom margin `16`, padding `20`, radius `16`, 1 px border `#2C2C2E` dark / `#F5F5F5` light |
| Skeleton avatar | `64×64` circle |
| Avatar gap | `16` |
| Title bar | `120×16`, radius `4` |
| Subtitle gap/bar | `8` gap, `60×12`, radius `4` |
| Gap after header | `20` |
| Body bars | `14` px tall, full width; two full-width bars, then `150×14`; `8` px gaps |
| Media block | gap `16`, full width × `180`, radius `12` |

No text, no buttons in loading state.

### 5.2 Error state

Centered column:

| Element | Value |
|---|---|
| Message | `_error` = `Failed to load live requests` |
| Message style | `18` px, `Colors.grey` = `#9E9E9E` |
| Gap | `16` |
| Button | `ElevatedButton` label `Retry` |
| Button style | inherited theme: min `∞×56`, radius `26`, `#026AFD` fill, white label `14/w500`, elevation `0` |
| Action | `_loadFeed()` |

No pull-to-refresh in this state.

### 5.3 Empty state

`Center → Padding(all: 32) → Column(center)`:

| Element | Value |
|---|---|
| Icon | `Icons.explore_off`, size `96`, `Colors.grey[400]` = `#BDBDBD` |
| Gap | `24` |
| Title string | `No live requests right now` |
| Title style | `20` px, `Colors.grey[700]` = `#616161`, `w600` |
| Gap | `12` |
| Body string | `Be the first to post a request or check back soon — people are always looking to connect nearby.` (em dash U+2014) |
| Body style | `16` px, `Colors.grey[500]` = `#9E9E9E`, `height: 1.5`, centered |
| Alignment | centered horizontally and vertically; padding 32 all sides |

No pull-to-refresh in this state. Empty state is not scrollable.

### 5.4 Data state

```
RefreshIndicator(color: #026AFD, onRefresh: _onRefresh)
└─ ListView.builder(controller: _scrollController,
                    padding: EdgeInsets.all(16),
                    itemCount: _posts.length)
   └─ Container(key: GlobalKey) → inline post card
```

- No separator widgets; spacing comes from each card's `margin bottom 16`.
- No pagination / infinite scroll / load-more; `itemCount` is exactly the current in-memory list.
- No `CustomScrollView`, no slivers, no sticky headers.
- Pull-to-refresh: `_isRefreshing = true` (not visually consumed) → `_loadFeed()` → `false` → snackbar `🔄 Feed refreshed`.
- Refresh spinner uses `#026AFD`; default RefreshIndicator stroke/elevation/offset otherwise.

---

## 6. Inline feed post card — `_buildPostCard`

### 6.1 Entrance animation

| Property | Value |
|---|---|
| Type | `TweenAnimationBuilder<double>` |
| Duration | `300 + (index * 50)` ms — index 0 = 300 ms, index 1 = 350 ms, index 2 = 400 ms, … |
| Curve | default `Curves.linear` |
| Tween | `0.0 → 1.0` |
| Opacity | `0 → 1` |
| Translation | `Offset(0, 20 * (1 - value))` → 20 px up into place |
| Runs on every rebuild/new item | yes (no keyed animation state suppression) |

### 6.2 Card shell

| Property | Normal | `userStatus == 'super'` |
|---|---|---|
| Bottom margin | `16` | `16` |
| Fill light | `Colors.grey[50]` = `#FAFAFA` | `#F0F7FF` |
| Fill dark | `#1C1C1E` | `#1C2C3E` |
| Border radius | `16` (all corners) | `16` |
| Border | `1` px `#EEEEEE` light / `#2C2C2E` dark | `2` px `#026AFD` at `0.3` alpha |
| Shadow | none | `rgba(2,106,253,0.1)`, blur `15`, spread `2`, offset `(0,0)` |
| Padding | `20` all sides | `20` |
| Ripple | `Material(transparent)` + `InkWell(borderRadius: 16)` | same |
| Tap | `/view-profile` with `{ userId: post.userId }` | same |

### 6.3 Header row (top → bottom, left → right)

| Element | Value |
|---|---|
| Avatar outer | `64×64`, circle, shadow `rgba(0,0,0,0.1)` blur `8`, offset `(0,2)` |
| Avatar clip | `ClipOval` around pulsing avatar |
| Avatar image | `CachedNetworkImage`, `BoxFit.cover` |
| Avatar placeholder (no URL) | background `#026AFD` @ `0.2`, initial `24` px `w700` `#026AFD`, centered |
| Image loading placeholder | flat `Colors.grey[300]` = `#E0E0E0` |
| Gap | `16` |
| Name | `post.userName`, `18` px, `w600`, `#000000` light / `#FFFFFF` dark |
| Gap | `4` |
| Distance | `_formatDistance(post.distance)`, `14` px, `#666666` light / `#BDBDBD` dark |
| Gap | `4` |
| Live label | verbatim `🔵 Live now`, `12` px, `#026AFD` |

Avatar pulse (`_PulseAvatar`):

| Property | Normal user | `super` user |
|---|---|---|
| Controller duration | `2 s`, `repeat()` | same |
| Pulse color | `#026AFD` | `Colors.deepPurpleAccent` = `#7C4DFF` |
| Shadow alpha | `1.0 - t` | same |
| Blur radius | `10 * t` | `15 * t` |
| Spread radius | `5 * t` | `8 * t` |
| Image priority | `userAvatar` → first non-empty `userPhotos` → first non-empty `postImages` → placeholder | same |

### 6.4 Category chip (only if `post.category != null`)

| Property | Value |
|---|---|
| Gap above | `12` |
| Padding | horizontal `12`, vertical `4` |
| Radius | `16` |
| Background | `Colors.grey[200]` = `#EEEEEE` light / `#2C2C2E` dark |
| Text | raw `post.category`, `14` px, `#000000` light / `#FFFFFF` dark |

### 6.5 Content

| Property | Value |
|---|---|
| Gap above | `12` |
| Sanitisation | `content.replaceAll(RegExp(r'\s*\(Duration:\s*\d+\s*mins?\)\s*'), '').trim()` |
| Font size | `16` |
| Color | `#333333` light / `Colors.grey[300]` = `#E0E0E0` dark |
| Line height | `1.4` |
| Max lines | unlimited; no ellipsis |
| Word break | Flutter default |

### 6.6 Footer

`SizedBox(height: 12)` then `Row(mainAxisAlignment: spaceBetween)`.

Left cluster:

| Element | Value |
|---|---|
| Icon | `Icons.access_time`, size `16`, color `#FFD700` |
| Gap | `8` |
| Text | `_formatTime(post.createdAt)` (`Just now` / `Nm ago` / `Nh ago` / `Nd ago`), `14` px, `#666666` light / `#BDBDBD` dark |

Right side — branch A, own post (`post.userId == _currentUserId`):

| Property | Value |
|---|---|
| Pill padding | horizontal `16`, vertical `8` |
| Radius | `20` |
| Background | `#026AFD` @ `0.1` |
| String | `✨ My Request` |
| Style | `14` px, `w600`, `#026AFD` |

Right side — branch B, other user: `Row` of 3 action buttons, gaps `12` between.

| # | Icon | Tooltip | Base bg | Icon color | Action |
|---|---|---|---|---|---|
| 1 | `Icons.close` | `Ignore` | `#F5F5F5` | `#757575` | remove locally, snackbar `👎 Request ignored`, WS `post_ignored` |
| 2 | `Icons.favorite_border` (active: `Icons.favorite`) | `Add to favorites` / active `Remove from favorites` | `#F5F5F5`; active `#FFECEF` | `#757575`; active `#E91E63` | toggle favorite, remove card, snackbar, WS |
| 3 | `Icons.check` | `Accept request` | `#E5F7FD` | `#026AFD` | create chat, remove card, navigate `/chat` |

Action button (`_FeedActionButton`) exact metrics:

| Property | Value |
|---|---|
| Hit box | `48×48` |
| Shape | circle |
| Icon size | `24` |
| Shadow | `rgba(0,0,0,0.04)`, blur `6`, spread `0`, offset `(0,3)` |
| Press scale | `1.0 → 0.85`, duration `150 ms`, curve `Curves.easeInOut` |
| Press trigger | `onTapDown` forward; `onTapUp` reverse + `HapticFeedback.mediumImpact()` + action; `onTapCancel` reverse |
| Color transition | `AnimatedContainer` duration `200 ms`, default curve |
| Tooltip | Material `Tooltip`, long-press/hover |

### 6.7 Favorite / accept / ignore side effects

- **Favorite:** `ApiService.toggleFavorite(post.userId, currentlyFavorited: isFavorited)` → `DELETE /favorite?targetUserId=<id>` if already favorited, else `POST /favorite {targetUserId}`. Removes card at `index`. `SoundService.playFavorite()` only on add. Snackbars: `❤️ Added to favorites`, `💔 Removed from favorites`, failure `Failed to update favorite`. WS send `post_favorited` with `postId`, `userId`, `targetUserId`.
- **Ignore:** optimistic local removal at `index`. Snackbar `👎 Request ignored`. WS send `post_ignored` with `postId`, `userId`, `targetUserId`. No API call.
- **Accept:** `POST /chats` body `{ "participants": [post.userId] }`; reads `id` then `_id`; snackbar `🤝 Chat created!`; WS send `post_accepted` with `postId`, `userId`, `targetUserId`, `chatId`; removes card; `Navigator.pushNamed('/chat', arguments: {'chatId': chatId})`. Failure snackbar `Failed to create chat`.
- **No comment action, no share action, no like count, no media gallery render** in the feed card. `post.images` is only used as an avatar fallback.

---

## 7. Floating location button + badge

```
Positioned(bottom: 90, right: 20)
└─ GestureDetector(onTap: _broadcastScan)
   └─ Container(56×56, circle, #026AFD,
                shadow rgba(2,106,253,0.3) blur 20 offset (0,6))
      ├─ Center(Icon(Icons.location_on, color: black, size: 28))
      └─ if _nearbyUsers.isNotEmpty:
         Positioned(top: -4, right: -4)
         └─ Container(padding 4, red circle, min 20×20)
            └─ Text('${count}', 11 px, bold, white, centered)
```

- Color `Colors.red` = `#F44336`.
- Badge protrudes 4 px beyond the 56 px circle top/right.
- Tap starts a broadcast scan and shows the overlay (same action as radar-on).
- This is not a `Scaffold.floatingActionButton`; it is stacked above the list and **overlaps** list content (bottom 90 from body bottom, which excludes the bottom nav).

---

## 8. Radar / broadcast overlay — `_buildBroadcastOverlay`

Shown when `_showBroadcastOverlay == true`; returned as `Positioned.fill` and painted last, so it covers app-bar body area (not the app bar itself, because it is inside `body`).

| Element | Value |
|---|---|
| Background | `#121212` dark / `#FFFFFF` light at `0.98` opacity |
| Close button position | `top: 20`, `right: 20` |
| Close button size | `40×40` circle |
| Close bg | `#1C1C1E` dark / `#F5F5F5` light |
| Close border | `1` px `#2C2C2E` dark / `#E0E0E0` light |
| Close icon | `Icons.close`, default size `24`, `#FFFFFF` dark / `#333333` light |
| Close action | hides overlay, clears `_broadcastResults`; leaves `_isRadarEnabled` unchanged |
| Content | `Center → Column(mainAxisAlignment: center)` |

### 8.1 No results branch (`_broadcastResults.isEmpty`)

| Element | Value |
|---|---|
| Radar box | `300×300`, `Stack(alignment: center)` |
| Center dot | `30×30` circle `#026AFD`, shadow `rgba(2,106,253,0.8)` blur `20` |
| Center dot icon | `Icons.location_on`, size `18`, `Colors.black` |
| Gap | `40` |
| Primary text | `_broadcastText`, `20` px, `w600`, `#000000` light / `#FFFFFF` dark, centered |
| Gap | `16` |
| Secondary text | `_broadcastSubtext`, `16` px, `#666666` light / `#BDBDBD` dark, centered |
| Gap | `32` |

State strings:

| Moment | `_broadcastText` | `_broadcastSubtext` |
|---|---|---|
| Scan start | `Broadcasting signal...` | `Searching for users in your area` |
| Results after 3rd poll | `N user found nearby` / `N users found nearby` (plural when N > 1) | `Scroll to browse` |
| No results after 3rd poll | `No signals detected` | `No users found in your immediate area` |
| Position/scan exception | `Broadcast failed` | `Signal transmission interrupted` |

Polling: up to **3** attempts, `700 ms` delay before each, each calls `GET /users/nearby?lat=<lat>&lng=<lng>`. During scanning `_isScanning = true` (radar waves animate). Toast on outer failure: `Failed to scan nearby users`.

### 8.2 Empty-after-scan block

Rendered if `_broadcastResults.isEmpty && !_isScanning`, below the secondary text (still inside centered column):

| Element | Value |
|---|---|
| Padding | `32` all |
| Icon | `Icons.location_off`, size `64`, `#BDBDBD` |
| Gap | `16` |
| Title | `No users nearby`, `18` px, `w600`, `#616161` light / `#E0E0E0` dark |
| Gap | `8` |
| Body | `Try moving to a different location or check back later`, default size `14`, `#9E9E9E`, centered |

### 8.3 Results list

If `_broadcastResults.isNotEmpty`: `Expanded → ListView.builder(padding: horizontal 16)`.

Result item:

| Element | Value |
|---|---|
| Bottom margin | `12` |
| Padding | `16` |
| Radius | `12` |
| Background | `#FAFAFA` light / `#1C1C1E` dark |
| Border | `1` px `#EEEEEE` light / `#2C2C2E` dark |
| Avatar | `48×48` circle, `ClipOval`, `BoxFit.cover` |
| Avatar placeholder bg | `#026AFD` @ `0.2`, initial `28` px `w700` `#026AFD` |
| Gap | `12` |
| Name | `16` px, `w600`, black/white |
| Gap | `4` |
| Distance | `14` px, `#666666` / `#BDBDBD` |
| Right action 1 | `36×36` circle, bg `#EEEEEE` light / `#2C2C2E` dark, icon `Icons.chat_bubble_outline` size `18`, color `#333333` light / white dark |
| Gap | `8` |
| Right action 2 | `36×36` circle, same bg, icon `Icons.visibility` size `18`, same color |
| Chat tap | `POST /chats {participants:[userId]}`; on success hide overlay and push `/chat {chatId}`; failure snackbar `Failed to create chat` |
| View tap | `/view-profile {userId}` |

### 8.4 Radar animation (CustomPainter)

| Property | Value |
|---|---|
| Canvas | `Size(300, 300)` |
| Center | `(150,150)` |
| Max radius | `150` |
| Controller | `2 s`, `repeat()` while `isScanning`; stopped otherwise |
| Crosshair color | `#026AFD` @ `0.2`, stroke `1` |
| Crosshair lines | horizontal, vertical, and both diagonals at `0.7 × maxRadius` endpoints (4 lines total) |
| Waves | `3` concentric expanding circles |
| Wave phase | `(t + i*0.33) % 1.0`, `i = 0..2` |
| Wave radius | `150 × phase` |
| Wave color | `#026AFD` @ `(1 - phase) × 0.8` |
| Wave stroke | `2` |

---

## 9. Snackbars

`_showToast`:

| Property | Value |
|---|---|
| Behavior | `SnackBarBehavior.floating` (also theme default) |
| Duration | `2 s` |
| Shape | `RoundedRectangleBorder(borderRadius: 20)` |
| Background | theme `#026AFD` |
| Text | message verbatim, white, default body `14` |

Strings: `📢 New request from <name>`, `🤝 <name|Someone> accepted a request`, `Status changed to <text>`, `Failed to update status`, `🔄 Feed refreshed`, `Radar Activated 📡`, `Radar Deactivated`, `🤝 Chat created!`, `Failed to create chat`, `💔 Removed from favorites`, `❤️ Added to favorites`, `Failed to update favorite`, `👎 Request ignored`, `Failed to scan nearby users`, `Could not find post location` (only in unused `_scrollToPost`).

Room-sheet snackbar is separate: background `#FFFF453A`, default floating/radius 20 from theme, default duration `4 s`, text = exception string with `Exception: ` stripped.

---

## 10. Bottom navigation — `CustomBottomNavBar(currentRoute: '/feed')`

| Property | Value |
|---|---|
| Container height | `60 + MediaQuery.padding.bottom` |
| Bottom padding | `MediaQuery.padding.bottom` |
| Background | `#1C1C1E` dark / `#FFFFFF` light |
| Top border | `1` px `#2C2C2E` dark / `Colors.grey[300]` = `#E0E0E0` light |
| Layout | `Stack(clipBehavior: none)` over a `Row` |

Row children, left→right:

| # | Label | Icon (active / inactive) | Icon size | Route |
|---|---|---|---|---|
| 1 | `Live` | `Icons.explore` (same icon; color changes) | `26` | `/feed` |
| 2 | `Favorites` | `Icons.favorite` / `Icons.favorite_border` | `26` | `/favorites` |
| — | spacer | `Expanded(SizedBox())` for center FAB | — | — |
| 3 | `Chats` | `Icons.chat_bubble` / `Icons.chat_bubble_outline` | `26` | `/chats` |
| 4 | `Profile` | avatar `28×28` circle or `Icons.person` / `Icons.person_outline` when no avatar | avatar border `2` | `/profile` |

Nav item:

| Property | Value |
|---|---|
| Flex | `Expanded` (equal quarters, minus center spacer) |
| Tap | if not active → `Navigator.pushReplacementNamed(route)`; active → no-op |
| Active color | `#026AFD` |
| Inactive color | `#666666` light / `Colors.grey[400]` = `#BDBDBD` dark |
| Icon→label gap | `2` |
| Label size | `11` |
| Label weight | active `w600`, inactive `w400` |
| Badge (optional favorite/chat counts) | `Positioned(right:-6, top:-4)`, padding `4`, red circle, min `16×16`, text `9+` if >9 else count, `10` px bold white; feed passes no badge counts |
| Profile avatar border | active `#026AFD`; inactive `#3A3A3C` dark / `#E0E0E0` light; width `2` |
| Profile monogram | background `#026AFD` @ `0.15`, initial `12` px bold `#026AFD` |

Center create button:

| Property | Value |
|---|---|
| Position | `Positioned(top: -24, left: 0, right: 0)`, centered |
| Size | `56×56` circle |
| Fill | `#026AFD` |
| Shadow | `rgba(2,106,253,0.3)`, blur `12`, offset `(0,4)` |
| Icon | `Icons.add`, size `32`, `Colors.black` |
| Tap | `Navigator.pushNamed('/create-post')`; if result `== true` then `pushReplacementNamed('/feed')` |
| Overlap | protrudes `24` px above the 60 px bar |

Profile data: `GET /me`, uses `avatar` (ignored if empty or contains `Portrait_Placeholder.png`), then first valid `photos[]`, and `name`.

---

## 11. Interactions & navigation map

| Trigger | Effect |
|---|---|
| Radar icon tap | toggle radar; ON starts scan + overlay; snackbar `Radar Activated 📡` / `Radar Deactivated` |
| Status pill tap | cycle status, `PUT /me`, snackbar, WS |
| Story avatar tap | `/view-profile`, args `{'userId': userId}` |
| Post card tap (anywhere except buttons) | `/view-profile`, args `{'userId': userId}` |
| Ignore button | local remove + snackbar + WS |
| Favorite button | API toggle + remove + sound/snackbar + WS |
| Accept button | `POST /chats`, remove, snackbar, WS, `/chat {chatId}` |
| Location FAB tap | broadcast scan + overlay |
| Broadcast close | hide overlay |
| Broadcast result chat | `POST /chats`, hide overlay, `/chat {chatId}` |
| Broadcast result view | `/view-profile {userId}` |
| Pull down on list | reload feed + snackbar `🔄 Feed refreshed` |
| Bottom nav | replace route to `/feed`, `/favorites`, `/chats`, `/profile` |
| Center + button | `/create-post` |
| Auto timer | `_loadFeed()` every `30 s` |
| Location timer | every `10 min`, if current status value `available`, get position + `PUT /me {latitude, longitude}` + reload feed |
| App resumed | `_loadFeed()` |
| App paused | `WebSocketService.disconnect()` |
| Missing token on init | `pushReplacementNamed('/login')` |

Dialogs: **none** on FeedScreen. Bottom sheets: only `RoomPreviewSheet` via `RoomCarousel` (not mounted here).

`_scrollToPost(postId)` exists but is never called; it would use `Scrollable.ensureVisible(duration: 1 s, curve: Curves.easeInOut)` or snackbar `Could not find post location`.

---

## 12. API calls & JSON fields

Base URL: `String.fromEnvironment('API_URL')` → active pinged URL → debug `http://localhost:10005/api` (web) / `http://10.0.2.2:10005/api` (Android) → production `https://zukaping.onrender.com/api`.

| Call | Method / path | Body / query | Fields consumed |
|---|---|---|---|
| Feed | `GET /feed` | — | Response may be a JSON array or `{ "posts": [...] }` |
| Favorites | `GET /favorites` | — | Array or `{ "favorites": [...] }`; each `targetUserId` |
| Add favorite | `POST /favorite` | `{ "targetUserId": "<id>" }` | — |
| Remove favorite | `DELETE /favorite?targetUserId=<id>` | — | — |
| Create chat | `POST /chats` | `{ "participants": ["<userId>"] }` | `id` or `_id` |
| Profile | `GET /me` | — | `status`, `name`, `avatar`, `photos[]` |
| Update status / location | `PUT /me` | `{ "status": "<value>" }` or `{ "latitude": n, "longitude": n }` | — |
| Nearby users | `GET /users/nearby?lat=<lat>&lng=<lng>` | — | Array or `{ "users": [...] }` |
| Device position | Geolocator | accuracy `low`, time limit `4 s`, fallback last-known | `latitude`, `longitude` |

`Post.fromJson` fields:

| Field | Source keys / fallback |
|---|---|
| `id` | `id` → `_id` → `''` |
| `userId` | `user.id` → `user._id` → `userId` → `id` → `''` |
| `userName` | `user.name` → `name` → `'User'` |
| `userAvatar` | `user.avatar` → `avatar`; empty or containing `Portrait_Placeholder.png` → `null` |
| `userPhotos` | `user.photos[]` (strings) |
| `content` | `content` → `''` |
| `images` | `media[]` (strings) |
| `category` | `category` |
| `distance` | `distance` stringified |
| `isFavorited` | always `false` (ignored) |
| `userStatus` | `user.status` → `status` |
| `createdAt` | int seconds (`*1000`), numeric string, or ISO string; else now |

Cache: `_loadFeed` first reads SharedPreferences key **`cached_feed`** (legacy; `ApiService.getFeed` writes `cached_feed_<userId>`), renders it if `_posts` empty and sets `_isLoading = false`. Network response then replaces the list silently.

WebSocket events (`WebSocketService.stream`, `{type, payload}`):

| type | Effect |
|---|---|
| `new_request` | if `payload.userId != currentUserId`: `Post.fromJson(payload)` inserted at index 0; toast `📢 New request from <userName>` |
| `request_update` | replace post with matching `payload.id` |
| `request_removed` | remove post where id == `payload.requestId ?? payload.id` |
| `user_status_update` | reads `userId`, `status`; no-op today |
| `nearby_users` | only while `_isScanning`; replace `_nearbyUsers` from `payload.users[]`; update broadcast text/subtext |
| `post_ignored` | if `payload.userId != currentUserId` and `postId != null`, remove that post |
| `post_favorited` | no UI effect |
| `post_accepted` | if `payload.userId != currentUserId`, toast `🤝 <userName|Someone> accepted a request` |

Outgoing WS: `status_update`, `post_accepted`, `post_favorited`, `post_ignored` (shapes above).

---

## 13. `RoomCarousel` (component spec; mounted in Chats, not Feed)

Empty `rooms` → `SizedBox.shrink()`.

```
Column(crossAxisAlignment: start)
├─ Padding(left 16, top 12, bottom 8)
│  └─ DefaultTextStyle(15, w700, #000000DE light / #FFFFFF dark, letterSpacing 0.3)
│     └─ Row
│        ├─ Text('🔥 Public Rooms Discovery')
│        ├─ SizedBox(width: 4)
│        └─ Icon(Icons.explore_outlined, size 16, #026AFD)
├─ SizedBox(height: 112)
│  └─ horizontal ListView.builder(controller, padding: h16, infinite modulo)
│     └─ _RoomCard (width 72, margin right 16)
└─ Divider(height: 1, color #EEEEEE light / #2C2C2E dark)
```

- Initial scroll offset: `rooms.length * 100 * (72 + 16)` = `rooms.length * 8800` px, enabling bidirectional looping; index mapped with `index % rooms.length`.
- Header text color uses `Colors.black87` = `rgba(0,0,0,0.87)`.
- No page indicator, no snapping, no arrows.

### 13.1 Room card

| Element | Value |
|---|---|
| Width | `72` |
| Right margin | `16` |
| Press animation | `AnimatedContainer` `150 ms`, curve `Curves.easeOut`, scale `0.95` on tap-down, `1.0` on up/cancel |
| Stack alignment | center |
| Ring | `66×66` circle |
| Ring border joined | `#026AFD`, width `2.5` |
| Ring border not joined | `#424242` dark / `#EEEEEE` light, width `1.5` |
| Joined shadow | `#026AFD` @ `0.2`, blur `6`, spread `1` |
| Ring inner padding | `2` |
| Inner circle bg | `#1C1C1E` dark / `#F5F5F5` light |
| Image | `CachedNetworkImage`, `BoxFit.cover`, oval clip |
| Loading spinner | `16×16`, stroke `1.5`, `#026AFD`, on `#1C1C1E` dark / `#F5F5F5` light |
| Error initial | bg `#026AFD` @ `0.1`, initial (`room.name[0]` or `R`), `20` px bold `#026AFD` |
| Full + not joined overlay | `Positioned.fill` circle, `rgba(0,0,0,0.35)`, `Icons.lock_rounded` size `20` white |
| Green live dot | if `!joined && !full && currentMembers > 0`: `14×14` @ `bottom: 2, right: 2`, `#34C759`, 2 px border `#121212` dark / white light |
| Joined badge | `bottom: 0, right: 0`, padding `1.5`, circle `#026AFD`, `Icons.check_rounded` size `11` white |
| Trending badge | if `isTrending || currentMembers >= 10`: `top: -1, right: -1`, padding `2.5`, circle `Colors.deepOrange` = `#FF5722`, text `🔥` size `10` |
| Gap below ring | `5` |
| Name | max 2 lines, centered, ellipsis, `11` px, `height: 1.1`; joined `w700` + `#026AFD`; otherwise `w500` + `#FFFFFF` dark / `rgba(0,0,0,0.87)` light |

Tap → `showModalBottomSheet(isScrollControlled: true, backgroundColor: Colors.transparent, builder: RoomPreviewSheet(room, onJoinSuccess: refresh))`.

---

## 14. `RoomPreviewSheet` (modal bottom sheet)

Root: `Container` with background `#1C1C1E` dark / `#FFFFFF` light, **top corners radius 28**, `padding: top 8, bottom 24`, `Column(mainAxisSize: min)`. No `SafeArea`, no scroll view; content can exceed viewport on small screens.

| Order | Element | Numeric |
|---|---|---|
| 1 | Drag handle | `44×5`, radius `10`, `#424242` dark / `#E0E0E0` light |
| 2 | Gap | `16` |
| 3a | Loading branch (`_isLoading && previews empty`) | `Padding(vertical: 40)` + `CircularProgressIndicator` (`#026AFD`, default stroke 4) |
| 3b | Error branch | `Padding(vertical: 40)` + `_error` = `Failed to load details`, `Colors.grey` = `#9E9E9E`, default size 14 |
| 3c | Content branch | below |

Content branch:

**Room header `ListTile`**

| Element | Value |
|---|---|
| Leading | `60×60` circle, bg `#212121` dark / `#F5F5F5` light, border `1` px `#424242` / `#EEEEEE` |
| Leading image | `BoxFit.cover`, oval clip |
| Leading error | bg `#026AFD` @ `0.1`, initial `24` px bold `#026AFD` |
| Title | room name, `18` px, `w800`, `#000000` / `#FFFFFF` |
| Trending pill | padding h8 v4, radius `20`, bg `rgba(255,152,0,0.12)` dark / `#FFF3E0` light, border `0.5` px `rgba(255,152,0,0.3)` dark / `#FFCC80` light |
| Trending content | `🔥` `12` px, gap `2`, `Trending` `11` px `w700` `Colors.orange` = `#FF9800` |
| Subtitle | padding top `4`, `👥 N / M members • Category: CATEGORY` — count/max/category are dynamic, category uppercased; `13` px `w600` `#BDBDBD` dark / `#757575` light |
| ListTile defaults | horizontal content padding `16`, leading-title gap `16` |

**Gap `12` → description** — padding horizontal `20`, `_detailedRoom.description`, left aligned, `14` px, `#E0E0E0` dark / `rgba(0,0,0,0.54)` light, `height: 1.3`.

**Gap `12` → tags** (only if `tags.isNotEmpty`) — container height `32`, vertical margin `4`, horizontal `ListView.builder` padding h20. Chip: right margin `8`, padding h12 v6, radius `16`, bg `#026AFD` @ `0.06`, border `0.5` px `#026AFD` @ `0.15`, text `#<tag>` `12` px `w600` `#026AFD`.

**Gap `20` → live preview panel** — full width, horizontal margin `20`, padding `16`, radius `20`, bg `#2C2C2E` dark / `#FAFAFA` light, border `0.5` px `#424242` dark / `#EEEEEE` light.

| Element | Value |
|---|---|
| Header icon | `Icons.blur_on_rounded`, size `18`, `#BDBDBD` dark / `#9E9E9E` light |
| Header gap | `6` |
| Header text | `💬 Live Room Preview`, `13` px, bold, `#BDBDBD` dark / `#9E9E9E` light |
| Gap | `12` |
| Empty message block | `Padding(vertical: 12)` + `No messages in this room yet. Be the first to start the vibe!`, `13` px, grey, `FontStyle.italic`, no center alignment |
| Message row | padding bottom `8`, `Row(crossAxisAlignment: start)` |
| Sender | `<sender_name>: `, `13` px, bold, `rgba(255,255,255,0.7)` dark / `rgba(0,0,0,0.87)` light |
| Content | `<content>`, `13` px, `#E0E0E0` dark / `rgba(0,0,0,0.54)` light |
| Blur | `Positioned.fill` → `ClipRRect(radius 4)` → `BackdropFilter(ImageFilter.blur(sigmaX: 4.5, sigmaY: 4.5))` over transparent container; applied to every message content |

**Gap `24` → actions** — padding horizontal `20`, `Column`.

| State | Button | Exact content |
|---|---|---|
| Joined | `ElevatedButton` bg `#026AFD` | `Icons.chat_bubble_outline_rounded` size `20`, gap `8`, `Open Chat Room` `16` px bold |
| Not joined, not full | `ElevatedButton` bg `#026AFD` | `Icons.login_rounded` size `20`, gap `8`, `Join Room & Start Chatting` `16` px bold |
| Not joined, full | `ElevatedButton` **disabled**, bg `Colors.grey` = `#9E9E9E` | `Icons.lock_outline` size `20`, gap `8`, `Room is Full` `16` px bold |
| Theme | — | full width min height `56`, radius `26`, elevation `0`, white label |
| Gap | `8` | |
| Dismiss | `TextButton` | `Maybe Later`, `14` px, `w600`, `#BDBDBD` dark / `#9E9E9E` light |

Behaviors:

- Initial values come from the passed `Room`: `memberCount = currentMembers`, `isJoined = room.isJoined`.
- `GET /rooms/<id>` on open; reads `preview_messages[]`, `member_count` (int or numeric string), `is_joined`, `room`.
- Full test: `_detailedRoom.currentMembers >= _detailedRoom.maxMembers`.
- Trending test: `_detailedRoom.isTrending || _memberCount >= 10`.
- Joined tap: pop sheet, push `RoomChatScreen(roomId)` via `MaterialPageRoute`.
- Join tap: `_isLoading = true`, `POST /rooms/<id>/join` body `{}`; on success calls `onJoinSuccess()` (refresh carousel/rooms), pops, pushes `RoomChatScreen`; on failure `_isLoading = false` + red snackbar `#FFFF453A` with server error text.
- "Maybe Later" pops.

---

## 15. `PostCard` standalone widget (alternate, unused by feed)

`GestureDetector(onTap)` → `Container(margin bottom 16, padding 20, radius 16, 1 px border, bg #FAFAFA light / #1C1C1E dark, border #EEEEEE / #2C2C2E)`.

| Element | Value |
|---|---|
| Avatar | `CircleAvatar(radius: 24)` = `48×48`, background `#026AFD` @ `0.1` |
| Avatar image | `CachedNetworkImage` `48×48`, `BoxFit.cover`, oval |
| Avatar fallback | initial `20` px bold `#026AFD` |
| Gap | `12` |
| Name | `16` px, `w600`, black/white |
| Gap | `2` |
| Meta | `"$distance · $timeAgo"` (middle dot U+00B7), `12` px, `#757575` light / `#BDBDBD` dark |
| Category gap | `12` |
| Category chip | padding h12 v4, radius `16`, bg `#EEEEEE` / `#2C2C2E`, text `13` px |
| Content gap | `12` |
| Content | `15` px (vs 16 inline), `#333333` / `#E0E0E0`, `height: 1.4` |
| Missing vs feed card | no live label, no distance/time icon, no action buttons, no footer, no super styling, no entrance animation, no pulse |

---

## 16. `LoadingWidget` (generic, unused by feed)

| Element | Value |
|---|---|
| Layout | `Center → Column(center)` |
| Spinner box | `32×32` |
| Spinner | `CircularProgressIndicator`, stroke `3`, color `color ?? #026AFD` |
| Gap (if message) | `16` |
| Message | `message`, `14` px, `Colors.grey.shade500` = `#9E9E9E` |

---

## 17. Scroll behavior, safe areas, media queries

| Concern | Behavior |
|---|---|
| Root scroll | `ListView.builder`, vertical, `padding: 16` all sides |
| Pull-to-refresh | `RefreshIndicator` wraps only the data list; indicator color `#026AFD`; disabled for loading/error/empty |
| Scroll controller | single `ScrollController` attached to feed list; no listeners, no pagination triggers |
| Story rail | independent horizontal `ListView.builder`, no snap, no controller |
| Broadcast results | independent vertical `ListView.builder` inside overlay |
| Keyboard | no text fields; no `viewInsets` handling |
| Width breakpoints | none; no `MediaQuery.size`, `LayoutBuilder`, max-width, or responsive grid |
| Safe area | no `SafeArea`; top inset via AppBar, bottom inset via `MediaQuery.padding.top`-equivalent in bottom nav only |
| Bottom nav overlap | custom bar is `bottomNavigationBar`, so list/body end above it; FAB is positioned `bottom: 90` inside body |
| App bar overlap | body starts below AppBar; broadcast overlay covers body only |
| Text scale | no `textScaler` clamps; system text scaling applies |
| Orientation | no handling; wide screens stretch cards edge-to-edge minus 32 px |

---

## 18. Animation inventory

| Animation | Duration | Curve / behavior |
|---|---|---|
| Post card entrance | `300 + index*50` ms | linear tween, opacity 0→1, translateY 20→0 |
| Avatar pulse | `2 s` loop | linear controller, blur/spread/alpha derived |
| Radar sweep | `2 s` loop | linear, 3 waves phase `+0.33` |
| Action button press | `150 ms` | `Curves.easeInOut`, scale 1→0.85 |
| Action button color | `200 ms` | default linear |
| Room card press | `150 ms` | `Curves.easeOut`, scale 0.95 |
| Shimmer | `1500 ms` default | left→right default |
| Scroll-to-post (unused) | `1 s` | `Curves.easeInOut` |
| Snackbar | `2 s` visible | platform animation defaults |
| Bottom sheet | platform default | — |
| Pull-to-refresh | platform default | — |

No hero animations, no page transitions customized, no skeleton cross-fade.

---

## 19. Exact user-visible strings (verbatim)

Feed/status: `Available`, `Busy`, `Ghost`, `Super`, `Offline`, `Radar Activated 📡`, `Radar Deactivated`, `Status changed to `, `Failed to update status`.
Story: `Nearby`, `<n>m away`, `<n>km away`.
Post card: `🔵 Live now`, `✨ My Request`, `Just now`, `<n>m ago`, `<n>h ago`, `<n>d ago`.
Empty/error: `Failed to load live requests`, `Retry`, `No live requests right now`, `Be the first to post a request or check back soon — people are always looking to connect nearby.`
Toasts: `📢 New request from `, `🤝 ` + ` accepted a request`, `🔄 Feed refreshed`, `🤝 Chat created!`, `Failed to create chat`, `💔 Removed from favorites`, `❤️ Added to favorites`, `Failed to update favorite`, `👎 Request ignored`, `Failed to scan nearby users`, `Could not find post location`.
Radar: `Broadcasting signal...`, `Searching for users in your area`, `<n> user found nearby` / `<n> users found nearby`, `Scroll to browse`, `No signals detected`, `No users found in your immediate area`, `Broadcast failed`, `Signal transmission interrupted`, `No users nearby`, `Try moving to a different location or check back later`.
Bottom nav: `Live`, `Favorites`, `Chats`, `Profile`.
Rooms: `🔥 Public Rooms Discovery`, `🔥`, `Trending`, `👥 `, ` / `, ` members • Category: `, `💬 Live Room Preview`, `No messages in this room yet. Be the first to start the vibe!`, `Open Chat Room`, `Join Room & Start Chatting`, `Room is Full`, `Maybe Later`, `Failed to load details`.

---

## 20. Copy-ready tokens

### 20.1 Colors (CSS)

```css
:root {
  /* brand */
  --primary: #026AFD;
  --primary-06: rgba(2,106,253,0.06);
  --primary-10: rgba(2,106,253,0.10);
  --primary-15: rgba(2,106,253,0.15);
  --primary-20: rgba(2,106,253,0.20);
  --primary-30: rgba(2,106,253,0.30);
  --primary-80: rgba(2,106,253,0.80);

  /* surfaces — light */
  --bg: #FFFFFF;
  --surface: #FFFFFF;
  --surface-50: #FAFAFA;
  --surface-100: #F5F5F5;
  --surface-200: #EEEEEE;
  --surface-300: #E0E0E0;
  --super-surface: #F0F7FF;

  /* surfaces — dark */
  --dark-bg: #121212;
  --dark-surface: #1C1C1E;
  --dark-elevated: #2C2C2E;
  --dark-super: #1C2C3E;
  --dark-grey-800: #424242;
  --dark-grey-900: #212121;
  --dark-profile-border: #3A3A3C;

  /* text */
  --text: #000000;
  --text-dark: #FFFFFF;
  --text-body: #333333;
  --text-body-dark: #E0E0E0;
  --text-secondary: #666666;
  --text-secondary-dark: #BDBDBD;
  --text-muted: #9E9E9E;
  --text-muted-dark: #757575;
  --text-disabled: #616161;
  --text-black-87: rgba(0,0,0,0.87);
  --text-black-54: rgba(0,0,0,0.54);
  --text-white-70: rgba(255,255,255,0.70);

  /* accents */
  --gold: #FFD700;
  --pink: #E91E63;
  --pink-soft: #FFECEF;
  --mint: #E5F7FD;
  --green: #34C759;
  --red: #F44336;
  --danger: #FF453A;
  --yellow: #FFEB3B;
  --yellow-300: #FFF176;
  --amber: #FFC107;
  --blue-200: #90CAF9;
  --purple-accent: #E040FB;
  --deep-purple-accent: #7C4DFF;
  --deep-purple-200: #B39DDB;
  --purple: #9C27B0;
  --deep-orange: #FF5722;
  --orange: #FF9800;
  --orange-50: #FFF3E0;
  --orange-200: #FFCC80;
}
```

Dark-mode mapping: `--bg → #121212`; card `#FAFAFA/#FFFFFF → #1C1C1E`; chip `#EEEEEE → #2C2C2E`; divider `#EEEEEE → #2C2C2E`; body text `#333333 → #E0E0E0`; secondary `#666666 → #BDBDBD`; nav inactive `#666666 → #BDBDBD`; story inner `#FFFFFF → #121212`.

### 20.2 Text styles (CSS)

```css
/* font-family: system default (Roboto on Android, SF on iOS); no custom family */
.t-appbar-status   { font-size: 14px; font-weight: 600; line-height: 1.43; }
.t-story-name      { font-size: 12px; font-weight: 500; line-height: 1.33; }
.t-story-distance  { font-size: 10px; font-weight: 400; line-height: 1.4;  }
.t-post-name       { font-size: 18px; font-weight: 600; line-height: 1.33; }
.t-post-distance   { font-size: 14px; font-weight: 400; line-height: 1.43; }
.t-post-live       { font-size: 12px; font-weight: 400; line-height: 1.33; }
.t-category-feed   { font-size: 14px; font-weight: 400; line-height: 1.43; }
.t-post-body       { font-size: 16px; font-weight: 400; line-height: 1.4;  }
.t-post-time       { font-size: 14px; font-weight: 400; line-height: 1.43; }
.t-my-request      { font-size: 14px; font-weight: 600; line-height: 1.43; }
.t-empty-title     { font-size: 20px; font-weight: 600; line-height: 1.4;  }
.t-empty-body      { font-size: 16px; font-weight: 400; line-height: 1.5;  }
.t-error           { font-size: 18px; font-weight: 400; line-height: 1.33; }
.t-radar-title     { font-size: 20px; font-weight: 600; line-height: 1.4;  }
.t-radar-sub       { font-size: 16px; font-weight: 400; line-height: 1.5;  }
.t-radar-empty     { font-size: 18px; font-weight: 600; line-height: 1.33; }
.t-result-name     { font-size: 16px; font-weight: 600; line-height: 1.5;  }
.t-result-distance { font-size: 14px; font-weight: 400; line-height: 1.43; }
.t-badge           { font-size: 11px; font-weight: 700; line-height: 1;    }
.t-nav-label       { font-size: 11px; font-weight: 400; line-height: 1.18; }
.t-nav-label--active { font-size: 11px; font-weight: 600; line-height: 1.18; }

/* standalone PostCard */
.t-standalone-name { font-size: 16px; font-weight: 600; line-height: 1.5;  }
.t-standalone-meta { font-size: 12px; font-weight: 400; line-height: 1.33; }
.t-standalone-cat  { font-size: 13px; font-weight: 400; line-height: 1.38; }
.t-standalone-body { font-size: 15px; font-weight: 400; line-height: 1.4;  }

/* rooms */
.t-room-header     { font-size: 15px; font-weight: 700; line-height: 1.27; letter-spacing: 0.3px; }
.t-room-name       { font-size: 11px; font-weight: 500; line-height: 1.1;  }
.t-room-name--joined { font-size: 11px; font-weight: 700; line-height: 1.1; }
.t-sheet-title     { font-size: 18px; font-weight: 800; line-height: 1.33; }
.t-sheet-subtitle  { font-size: 13px; font-weight: 600; line-height: 1.38; }
.t-sheet-description { font-size: 14px; font-weight: 400; line-height: 1.3; }
.t-tag             { font-size: 12px; font-weight: 600; line-height: 1.33; }
.t-preview-header  { font-size: 13px; font-weight: 700; line-height: 1.38; }
.t-preview-message { font-size: 13px; font-weight: 400; line-height: 1.38; }
.t-sheet-cta       { font-size: 16px; font-weight: 700; line-height: 1.5;  }
.t-sheet-later     { font-size: 14px; font-weight: 600; line-height: 1.43; }
.t-loading-message { font-size: 14px; font-weight: 400; line-height: 1.43; }
```

### 20.3 Spacing / radii / elevation scale (observed)

```css
:root {
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 5px;
  --space-4: 6px;
  --space-5: 8px;
  --space-6: 12px;
  --space-7: 16px;
  --space-8: 20px;
  --space-9: 24px;
  --space-10: 32px;
  --space-11: 40px;

  --radius-xs: 4px;     /* skeleton bars, blur clip */
  --radius-sm: 10px;    /* drag handle */
  --radius-md: 12px;    /* radar result card, skeleton media */
  --radius-lg: 16px;    /* post card, category chip */
  --radius-xl: 20px;    /* snackbar, status pill, preview panel */
  --radius-2xl: 26px;   /* ElevatedButton */
  --radius-sheet: 28px; /* sheet top corners */

  --shadow-avatar: 0 2px 8px rgba(0,0,0,0.10);
  --shadow-action: 0 3px 6px rgba(0,0,0,0.04);
  --shadow-fab: 0 6px 20px rgba(2,106,253,0.30);
  --shadow-nav-fab: 0 4px 12px rgba(2,106,253,0.30);
  --shadow-super: 0 0 15px 2px rgba(2,106,253,0.10);
  --shadow-joined: 0 0 6px 1px rgba(2,106,253,0.20);
  --shadow-radar-dot: 0 0 20px rgba(2,106,253,0.80);
}
```

### 20.4 Key fixed dimensions

| Token | Value |
|---|---|
| Story rail height | `130` |
| Story avatar | `60` (+3 padding ring = 66 visual) |
| Story item width | `80`, gap `12` |
| Post card avatar | `64` |
| Post card padding | `20`, radius `16`, gap `16` |
| Action button | `48` circle, icon `24` |
| Feed list padding | `16` |
| FAB | `56` circle, bottom `90`, right `20`, icon `28` |
| Bottom nav | `60` + safe bottom; icon `26`; center FAB `56` at `top:-24`; add icon `32` |
| Radar canvas | `300`; center dot `30` |
| Broadcast close | `40` |
| Room card | width `72`, avatar `66`, gap `5` |
| Room carousel | header text `15`, rail height `112` |
| Sheet handle | `44×5`; sheet radius `28`; preview panel radius `20` |
| PostCard standalone avatar | `48` (radius 24) |
| LoadingWidget spinner | `32`, stroke `3` |

### 20.5 MUI translation hints

- Card: `<Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', p: '20px', mb: '16px' }}>`; super variant `bgcolor: '#F0F7FF', border: '2px solid rgba(2,106,253,.3)', boxShadow: '0 0 15px 2px rgba(2,106,253,.1)'`.
- Story rail: fixed `height: 130`, `display:flex`, `overflow-x:auto`, `gap:12px`, `px:2`, `py:1.5`.
- Status dot + label exactly `12px` dot, `8px` gap, `14/600` text.
- Action buttons: `width/height:48px`, `borderRadius:'50%'`, `display:grid`, `placeItems:center`, `transition:'background-color .2s linear, transform .15s ease-in-out'`.
- Bottom nav: `height: 60px + env(safe-area-inset-bottom)`, `padding-bottom: env(safe-area-inset-bottom)`, top border 1px.
- Keep hard-coded hex values above rather than MUI palette defaults; MUI primary must be overridden to `#026AFD`.
