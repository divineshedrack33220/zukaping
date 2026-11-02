# Chats — Pixel Spec (extracted from Flutter)

Source of truth (read in full):

| File | Lines | Role |
|---|---|---|
| `mobile_app/lib/screens/chats_screen.dart` | 1379 | Chat-list screen (`/chats`) |
| `mobile_app/lib/screens/chat_screen.dart` | 2931 | 1:1 + group conversation screen (`/chat`) |
| `mobile_app/lib/widgets/message_bubble.dart` | 162 | Standalone bubble widget (defined but **not** referenced by either screen; `chat_screen.dart` renders its own bubble at `_buildMessageBubble`) |

Supporting widgets pulled in by the tree (numbers included because they render on these screens):
`widgets/app_logo.dart`, `widgets/room_carousel.dart`, `widgets/custom_bottom_nav_bar.dart`.
Models: `models/chat.dart`, `models/message.dart`. Services: `services/api_service.dart`, `services/websocket_service.dart`.

Font: Flutter default (`Roboto` on Android, SF on iOS). Nothing overrides `fontFamily`. Material 3 defaults for anything not listed (`AppBar` height 56 + status bar, `FAB` 56×56, `IconButton` 48×48 tap target, `ListTile` min height 56, `SnackBar` elevation 6).

---

## 0. Global tokens

### Colors used verbatim in these files

| Name | Value | Where |
|---|---|---|
| Primary blue | `#026AFD` | send, self bubble, unread badge, active tab, icons, FAB, snackbar |
| Light page bg | `#F8F9FA` | `_LiquidBackground` light |
| Dark page bg | `#121212` | `_LiquidBackground` dark, composer dark base, app bar dark base |
| Dark surface | `#1C1C1E` | cards, sheets, other-bubble dark, search fill dark |
| Dark border | `#2C2C2E` | borders/dividers dark, avatar placeholder dark |
| Avatar placeholder light | `#F5F5F5` | 60×60 slot, shimmer |
| Composer input fill | `#F0F2F5` @ 0.8 | light input pill; reply preview bg (opaque) |
| Reply quote (other, light) | `#F1F5F9` | nested reply container |
| Composer text light | `#1A1A2E` | input text |
| Hint text | `#9E9E9E` | “Type a message…” |
| Divider light | `#EEEEEE` | room carousel divider; grey[200] |
| Grey 50/100/200/300/400/500/600/700/800 | `#FAFAFA` / `#F5F5F5` / `#EEEEEE` / `#E0E0E0` / `#BDBDBD` / `#9E9E9E` / `#757575` / `#616161` / `#424242` | Material `Colors.grey[n]` |
| black87 | `rgba(0,0,0,.87)` | body text light |
| black54 | `rgba(0,0,0,.54)` | reply preview content light |
| black45 | `rgba(0,0,0,.45)` | “+N” image overlay |
| black26 (`Colors.black54` container) | `rgba(0,0,0,.54)` | staged-image remove chip, close chip |
| white70 | `rgba(255,255,255,.7)` | icebreaker dark text, close icon dark |
| Status online/available | `#026AFD` | dot |
| Status busy | `#FFFF00` | dot |
| Status super | `#7C4DFF` (`Colors.deepPurpleAccent`) | dot |
| Status ghost | `rgba(158,158,158,.5)` (`Colors.grey @ 0.5`) | dot |
| Status offline/default | `#9E9E9E` | dot |
| Danger / red | `#F44336` (`Colors.red`) | block, remove, clear-all, badges |
| Room live dot | `#34C759` | 14×14 |
| Trending flame bg | `#FF5722` (`Colors.deepOrange`) | 10px 🔥 chip |
| Group sender palette | `#EC4899`, `#F59E0B`, `#10B981`, `#6366F1`, `#8B5CF6`, `#EF4444`, `#06B6D4`, `#14B8A6` | group sender name |

Primary-blue alpha variants in use: `.05` (unread row tint), `.08` (empty-state halo, reply quote tint), `.1` (avatar placeholder fill), `.12` (active icon chip), `.2` (self bubble shadow, joined room ring), `.3` (bottom-nav FAB shadow, admin chip border), `.35` (send button shadow).

### Typography scale actually used

| Token | Size / weight / height / letter-spacing | Usage |
|---|---|---|
| T1 | 22 / bold | group-info sheet title |
| T2 | 20 / w700 (chats sheet), bold (chat sheets) | sheet titles: “Find Friends”, “New Group Chat”, “Edit Group Info”, “Add Members to Group” |
| T3 | 18 / bold | “No chats yet”, “No messages yet”, invite dialog title |
| T4 | 16 / bold | list-item name, chat appbar title, “Find Friends” list name (w600/16), media appbar title |
| T5 | 16 / bold | “Create Group (n)”, “Save Changes” |
| T6 | 15 / w400, height 1.3 | composer input |
| T7 | 15 / w700, ls 0.3 | “🔥 Public Rooms Discovery” |
| T8 | 14 / w400 default | chat message text (no explicit size), typing dots `...`, status chip text is 14/w600 |
| T9 | 14.5 | `MessageBubble` body |
| T10 | 13 | reply preview content, invite description / invite URL, “Member” trailing |
| T11 | 12.5 / bold, ls 0.1 | group sender name inside bubble |
| T12 | 12 / w600 | status chip label (14 actually), admin action labels, timestamp, icebreaker card text, edit-details note, group member subtitle, “N image(s) selected”, “Clear all”, “You” in reply preview |
| T13 | 12 / w600 (system bubble) | `MessageBubble` system message |
| T14 | 11.5 | reply-quote content in bubble |
| T15 | 11 / bold | reply-quote author; `MessageBubble` sender name |
| T16 | 11 / w500–w700, height 1.1 | room card label; bottom-nav label 11 |
| T17 | 10 / bold | unread count, uploading labels/percent, “Admin” chip, icon badge count |
| T18 | emoji | 48 (1 emoji), 38 (≤3), 32 (>3), 32 (reaction-picker emoji), 26 (emoji grid), 24/20 fallbacks |

---

## 1. Screen: Chats (`ChatsScreen`, route `/chats`)

### 1.1 Top-level widget tree (render order)

```
Scaffold
├─ appBar: AppBar
│   ├─ elevation: 0
│   ├─ automaticallyImplyLeading: false
│   ├─ titleSpacing: 0
│   ├─ leading: AppLogo()                         → Image.asset('assets/logo.png'), 40×40, BoxFit.contain
│   └─ actions: [ _buildStatusIndicator() ]
├─ body: Column
│   ├─ _buildSearchBar()                          → padding 16, height ≈ 16+48+16 = 80
│   ├─ RoomCarousel(rooms: _rooms, onRefresh: _loadChats)
│   │   ├─ if rooms.isEmpty → SizedBox.shrink()    (zero height)
│   │   └─ else Column
│   │       ├─ Padding(l16,t12,b8) Row: '🔥 Public Rooms Discovery' + 4px + explore icon
│   │       ├─ SizedBox(height: 112) → horizontal ListView of 72px room cards
│   │       └─ Divider(height: 1)
│   └─ Expanded
│       ├─ _isLoading          → _buildShimmerLoading()   (4 skeleton rows)
│       ├─ _error != null      → _buildErrorState()
│       ├─ _filteredChats.isEmpty → _buildEmptyState()
│       └─ else                → _buildChatList()
├─ bottomNavigationBar: CustomBottomNavBar(currentRoute: '/chats', chatsCount: Σ unreadCount)
└─ floatingActionButton: FAB (heroTag 'searchUsers') → _showGlobalSearchModal
```

Notes
- No `RefreshIndicator`, no pull-to-refresh, no swipe actions, no `SafeArea` wrapper (AppBar + bottom nav handle insets).
- Refresh happens: 60 s periodic timer, on `AppLifecycleState.resumed`, after returning from a chat (`Navigator.push(...).then((_) => _loadChats())`), and on WS `chat_created` / `message_read`.
- `_loadChats` sorts by `lastMessageTime` descending.

### 1.2 App bar

| Property | Value |
|---|---|
| background | theme default (no override) |
| elevation | 0 |
| back button | none (`automaticallyImplyLeading: false`); logo occupies leading, left inset = AppBar default (16 with `titleSpacing:0`) |
| leading | `AppLogo` 40×40 (`assets/logo.png`, `BoxFit.contain`) |
| actions | single status chip (below) |

### 1.3 Status chip (`_buildStatusIndicator`) — right side of app bar

```
GestureDetector(onTap: _updateStatus)             // cycles status
└─ Container margin: EdgeInsets.only(right:16)
              padding: EdgeInsets.symmetric(horizontal:12, vertical:6)
              decoration: color = dark ? #1C1C1E : #F5F5F5 (grey[100])
                          borderRadius: 20
                          border: Border.all(color = dark ? #2C2C2E : #E0E0E0 (grey[300]))
   └─ Opacity(opacity: ghost ? 0.6 : 1.0)
      └─ Row(mainAxisSize.min)
         ├─ Container 12×12, circle, color = status dot
         ├─ SizedBox(width: 8)
         └─ Text( ghost ? 'Stealth' : '<Status>', 14, w600, color = dark ? #FFFFFF : #000000 )
```

Content height ≈ 12 + 12 = 24 → chip ≈ 24×~90, pill 20 radius.

Status cycle (tap advances index `(_currentStatusIndex + 1) % 5`, wrap):

| index | value | label | dot |
|---|---|---|---|
| 0 | available | `Available` | `#026AFD` |
| 1 | busy | `Busy` | `#FFFF00` |
| 2 | ghost | `Ghost` → rendered `Stealth` | grey @ .5 |
| 3 | super | `Super` | `#7C4DFF` |
| 4 | offline | `Offline` | `#9E9E9E` |

On success: `PUT /me {status}` then snackbar `Status changed to <Text>` (2 s, fixed, bg `#026AFD`) and WS `{type:'status_update', status, userId}`. On failure: index rolls forward 2 (`+2 % 5`) and snackbar `Failed to update status`.

### 1.4 Search bar

```
Container
  padding: EdgeInsets.all(16)
  color: dark ? #1C1C1E : #FFFFFF
  border: bottom BorderSide(color: dark ? #2C2C2E : #E0E0E0)   // 1px
  └─ TextField
       controller: _searchController (listener → _filterChats)
       style.color: dark ? #FFFFFF : rgba(0,0,0,.87)
       decoration:
         hintText: '🔍 Search chats by name or message...'
         prefixIcon: Icon(Icons.search, color: Colors.grey)       // 24 default
         filled: true, fillColor: dark ? #2C2C2E : #F5F5F5
         border: OutlineInputBorder(borderRadius: 25, borderSide: none)
         contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 12)
```

Filter rule: lowercase+trim query; empty → all; else `partnerName.contains(q) || lastMessage.contains(q)`. Matches are case-insensitive substring, no debounce (fires on every keystroke).

### 1.5 Room carousel (`RoomCarousel`) — shown only when `_rooms` non-empty

| Part | Spec |
|---|---|
| Header padding | `EdgeInsets.only(left:16, top:12, bottom:8)` |
| Header row | `Text('🔥 Public Rooms Discovery')` 15/w700/ls 0.3, color dark ? white : black87 · `SizedBox(width:4)` · `Icon(Icons.explore_outlined, size:16, color:#026AFD)` |
| Strip | `SizedBox(height:112)`, horizontal `ListView.builder`, `padding: EdgeInsets.symmetric(horizontal:16)` |
| Card | width `72`, `margin: EdgeInsets.only(right:16)`; `AnimatedContainer` 150 ms `Curves.easeOut`, pressed scale `0.95` |
| Avatar ring | `Container 66×66` circle; border `#026AFD` 2.5 when joined else `grey.shade800` dark / `grey.shade200` light 1.5; joined shadow `#026AFD@.2`, blur 6, spread 1 |
| Avatar | inner `Padding(all:2)` → circle bg `#1C1C1E` dark / `#F5F5F5` light → `ClipOval` CachedNetworkImage cover. Placeholder: 16×16 spinner stroke 1.5 `#026AFD` on `#1C1C1E`/`grey.shade100`. Error: `#026AFD@.1` + initial 20 bold `#026AFD` |
| Full lock | `Positioned.fill`, `rgba(0,0,0,.35)`, `Icon(Icons.lock_rounded, white, 20)` |
| Live dot | 14×14 `#34C759`, border white (dark `#121212`) 2, bottom 2 / right 2 |
| Joined badge | padding 1.5, `#026AFD` circle, `Icon(Icons.check_rounded, white, 11)`, bottom 0 / right 0 |
| Trending badge | padding 2.5, `#FF5722` circle, `Text('🔥', 10)`, top −1 / right −1 (when trending or `currentMembers >= 10`) |
| Gap | `SizedBox(height:5)` |
| Label | `Text(room.name)` maxLines 2, center, ellipsis, 11, `height:1.1`, weight joined ? w700 : w500, color joined ? `#026AFD` : dark ? white : black87 |
| Divider | `Divider(height:1, color: dark ? #2C2C2E : #EEEEEE)` |
| Scroll | infinitely circular (`index % rooms.length`, initial offset `rooms.length*100*88.0`) |
| Tap | opens `RoomPreviewSheet` bottom sheet (`isScrollControlled`, transparent bg) → on join success calls `onRefresh` (`_loadChats`) |

### 1.6 Loading / error / empty states

**Shimmer (loading)** — no shimmer animation, flat blocks:
```
ListView.builder(padding: EdgeInsets.symmetric(horizontal:24), itemCount: 4)
└─ Container padding: EdgeInsets.symmetric(vertical:12)
   └─ Row
      ├─ 56×56 circle, color dark ? #1C1C1E : #F5F5F5
      ├─ SizedBox(width:16)
      └─ Expanded Column(start)
         ├─ 120×16, radius 8, same color
         ├─ SizedBox(height:8)
         └─ 200×14, radius 8, same color
```
Row height = 12+56+12 = 80.

**Error**
```
Center → Column(center)
  Icon(Icons.error_outline, size:60, color: Colors.grey)
  SizedBox(height:16)
  Text(_error ?? 'Unknown error', color: Colors.grey)   // 14 default; text is 'Failed to load chats'
  TextButton('Retry') → _loadChats()
```

**Empty**
```
Center → Column(center)
  Text('💬', fontSize:60)
  SizedBox(height:16)
  Text( hasSearch ? 'No results found' : 'No chats yet', 18, bold )
  if hasSearch: TextButton('Clear search') → _searchController.clear()
```
`hasSearch` = controller text non-empty.

### 1.7 Chat list (has-data)

```
ListView.builder(padding: EdgeInsets.symmetric(horizontal:24), itemCount: filtered.length)
└─ InkWell(onTap: _navigateToChat(chat))
   └─ Container
        padding: EdgeInsets.symmetric(vertical:12)                  // row height 12+60+12 = 84
        color: unreadCount > 0 ? #026AFD @0.05 : transparent
        borderRadius: 16
      └─ Row
         ├─ GestureDetector(onTap: avatar → if !isGroup && partnerId ≠ '' :
         │      HapticFeedback.lightImpact(); pushNamed('/view-profile', {userId: partnerId}))
         │  └─ Stack
         │     ├─ Container 60×60, circle, bg dark ? #1C1C1E : #F5F5F5
         │     │  └─ ClipOval
         │     │     ├─ isOnline → _PulseAvatar(imageUrl/avatar, photos, name)
         │     │     ├─ avatar non-empty → CachedNetworkImage(cover)  [error → placeholder]
         │     │     ├─ else photos.first non-empty → CachedNetworkImage(cover)
         │     │     └─ else _buildPlaceholderAvatar(name)
         │     └─ if isOnline && !isTyping: Positioned(bottom:2, right:2)
         │        Container 14×14 circle, color = status color,
         │                  border: 2px dark ? #121212 : #FFFFFF
         ├─ SizedBox(width:16)
         ├─ Expanded → Column(start)
         │  ├─ Text(partnerName, 16, bold, maxLines 1, ellipsis)
         │  ├─ SizedBox(height:4)
         │  └─ isTyping ? _buildTypingIndicator()
         │             : Text(_getLastMessagePreview(chat),
         │                    14 default, color dark ? grey[400] : grey[600], maxLines 1, ellipsis)
         └─ Column(end)
            ├─ Text(_formatTimestamp(lastMessageTime), 12, color dark ? grey[400] : Colors.grey)
            └─ if unreadCount > 0:
               Container(margin: only(top:8), padding: symmetric(h:8,v:2),
                         color: #026AFD, borderRadius: 10)
                 Text('$unreadCount', 10, bold, white)       // pill height 10+2+2 ≈ 16–18
```

- `_formatTimestamp`: `<60 s` → `Just now`; `<60 min` → `'${inMinutes}m'`; `<24 h` → `'${inHours}h'`; else `'${day}/${month}'` (no zero-pad).
- `_getLastMessagePreview`: empty → `No messages yet`; `lastMessageType == 'image'` → `📷 Photo`; else truncate to 30 chars + `...`.
- `Chat.fromJson` hard-codes `unreadCount: 0` — the unread tint/pill is effectively unreachable until an unread source is wired.
- No timestamp/status on the right other than the above; no divider between rows; no swipe.
- Tap navigation: if `chat.id` matches a `Room.id` → `RoomChatScreen(roomId)`; else `ChatScreen(chatId)`; both reload list on return.

`_buildTypingIndicator`:
```
Row
├─ Text('Typing', color:#026AFD, fontWeight:bold)     // 14 default
├─ SizedBox(width:4)
└─ _TypingDots: 3× Container 4×4 circle #026AFD, margin horizontal 1
   AnimationController 1200 ms, repeat(); opacity 0.3→1.0→0.3 per dot, phase-shifted
```

`_buildPlaceholderAvatar`:
```
Container(color: #026AFD@0.1, alignment:center)
└─ Text(name[0].toUpperCase() or '?', 24, bold, #026AFD)
```

`_PulseAvatar` (list): controller 2 s repeat; `BoxShadow(color:#026AFD.withOpacity(1−v), blurRadius:v*10, spreadRadius:v*5)` on a circular container; image → CachedNetworkImage cover, else `#026AFD@0.1` + initial 24 bold `#026AFD`.

### 1.8 FAB

| Property | Value |
|---|---|
| position | default `endFloat` (right 16, above bottom nav 16) |
| size/shape | default FAB (56×56, M3 rounded-rect r=16) |
| color | `#026AFD` |
| foreground | `#FFFFFF` |
| elevation | 4 |
| icon | `Icons.person_add_alt_1_rounded` (24 default) |
| heroTag | `searchUsers` |
| tap | `showModalBottomSheet(isScrollControlled:true, backgroundColor: transparent)` → `_GlobalUserSearchModal` |

### 1.9 Bottom navigation (`CustomBottomNavBar`, currentRoute `/chats`)

```
Container height: 60 + MediaQuery.padding.bottom; padding bottom: padding.bottom
  color: dark ? #1C1C1E : #FFFFFF; border top: 1px dark ? #2C2C2E : #E0E0E0
  └─ Stack(clip none)
     ├─ Row: [Live] [Favorites] [Expanded spacer] [Chats] [Profile]
     └─ Positioned(top:-24, centered) 56×56 circle #026AFD
        shadow #026AFD@.3 blur 12 offset(0,4); Icon(Icons.add, color:#000000, size:32)
```
Nav item: `Expanded > InkWell` (pushReplacementNamed if not active) → Column(center): icon 26 (`Icons.explore` / `favorite`|`favorite_border` / `chat_bubble`|`chat_bubble_outline` / profile avatar 28×28 with 2px border) + `SizedBox(height:2)` + label (`Live`, `Favorites`, `Chats`, `Profile`) 11, w600 active / w400 idle, color active `#026AFD` else dark `grey[400]` else `#666666`.
Badge (chatsCount = Σ unread, red circle): `Positioned(right:-6, top:-4)`, padding 4, min 16×16, `Colors.red`, text 10 bold white, value `>9 ? '9+' : '$n'`.
Profile monogram: `#026AFD@0.15`, initial 12 bold `#026AFD`.

### 1.10 Global user search sheet (`_GlobalUserSearchModal`)

```
Container height: 85% of screen height; color #FFFFFF; borderRadius top 24
└─ Column
   ├─ SizedBox(height:12)
   ├─ drag handle 48×5, grey[300], radius 2.5
   ├─ SizedBox(height:16)
   ├─ Text('Find Friends', 20, w700)
   ├─ SizedBox(height:16)
   ├─ Padding(h:20) TextField
   │    autofocus: true
   │    hintText: 'Search by name...'
   │    prefixIcon: Icon(Icons.search, grey)
   │    filled: grey[100]; OutlineInputBorder radius 25, no side
   │    contentPadding: symmetric(h:20, v:12)
   ├─ SizedBox(height:16)
   └─ Expanded
      ├─ _isSearching → Center(CircularProgressIndicator())        // default size 36, primary
      ├─ results empty → Center(Text(text.isEmpty ? 'Type a name to search globally' : 'No users found',
      │                              color: grey[600]))
      └─ ListView.builder(padding: symmetric(h:20))
         └─ ListTile
              contentPadding: EdgeInsets.symmetric(vertical:8)
              leading: CircleAvatar(radius:26, bg:#F5F5F5, image from avatar/photos[0],
                                    fallback Text(initial, #026AFD, bold))
              title: Text(name, 16, w600)
              subtitle: Text('@' + name.toLowerCase().replaceAll(' ',''), grey[600])
              trailing: ElevatedButton('Chat', bg #026AFD, fg white, radius 20,
                                       padding: symmetric(h:16), minimumSize: Size(0,36))
              onTap: pushNamed('/view-profile', {userId: id})
```
Search: 500 ms debounce; `GET /users/search?q=`; empty query clears results. `Chat` button → `POST /chats {participants:[userId]}`; then pop sheet + `pushNamed('/chat', {chatId: response['chatId']})`. Failure snackbar: `Failed to start chat` (default snackbar styling).

Fields read per result: `name` (default `Unknown`), `avatar` (ignored if contains `Portrait_Placeholder.png`), `photos[]`, `id` ?? `_id`.

### 1.11 `_CreateGroupModal` (defined, currently unreferenced — call site commented out)

Rendered spec for parity:

| Part | Spec |
|---|---|
| Sheet | height 90% screen, `#FFFFFF`, top radius 24, transparent modal bg |
| Handle | `SizedBox(12)` + 48×5 grey[300] r2.5 |
| Title | `Text('New Group Chat', 20, w700)` + 20 |
| Avatar picker | `CircleAvatar(radius:40, bg:grey[200])`; empty → `Icon(Icons.add_a_photo, size:30, grey)`; tap → gallery pick (quality 70) |
| Name field | h20 padding; hint `Group Name`; prefix `Icons.group` grey; filled grey[100]; radius 16 |
| Desc field | maxLines 2; hint `Group Description (Optional)`; prefix `Icons.description` grey; radius 16 |
| Selected chips | `SizedBox(height:80)` horizontal list, padding h16; per user: `Padding(h:4)`; avatar 26 (bg grey[200]); 4px; name 12 truncated to 8 chars + `...`; remove button top-right: red circle padding 2, `Icon(Icons.close, 14, white)` → toggles selection |
| Divider | `Divider()` default (height 16, 1px) |
| Member search | hint `Search members to add...`, prefix search grey, radius 16, padding h20, 500 ms debounce, `GET /users/search?q=`; empty list revert = recent partners |
| Result tile | `ListTile` padding v8; avatar radius 26 (`#F5F5F5`); title w600 (14 default); subtitle `@slug` grey[600]; trailing `Icons.check_circle` `#026AFD` if selected else `Icons.circle_outlined` grey |
| Empty text | `Type to search users` / `No users found`, grey[600] |
| Submit | `Padding(all:20)`; `SizedBox(width:∞, height:50)`; `ElevatedButton` bg `#026AFD`, fg white, radius 25, elevation 0; label `Create Group (${n})` 16 bold; loading → 20×20 spinner white strokeWidth 2 |
| Validation toasts | `Please enter a group name`, `Please select at least one member`, `Failed to create group: <e>` |
| Success | pop + `pushNamed('/chat', {chatId: response['id']})` |

### 1.12 API + WebSocket + cache (Chats)

| Call | Method / path | Reads |
|---|---|---|
| `ApiService.getToken` | local (`SharedPreferences`) | token → JWT payload `userId` ?? `sub` ?? `id` |
| `ApiService.getProfile` | `GET /me` | `status` (default `available`) |
| `ApiService.updateProfile` | `PUT /me` | body `{status}` |
| `RoomService.getRooms` | rooms endpoint | `Room` list |
| `ApiService.getChats` | `GET /chats` | list or `{chats:[]}` |
| `ApiService.searchUsers` | `GET /users/search?q=` | list or `{users:[]}` |
| `ApiService.createChat` | `POST /chats {participants:[id]}` | `chatId` |
| `ApiService.createGroupChat` | `POST /chats {participants, isGroup:true, groupName, groupDescription, groupAvatar}` | `id` |
| `ApiService.uploadImage` | `POST /upload-photo` multipart field `photo` | `url` |
| `SharedPreferences` | keys `cached_chats`, `cached_rooms` | JSON lists (see note) |

`Chat.fromJson` fields: `id`, `partner{id,name,email,avatar,photos[],status,isOnline}`, `groupName`, `groupAvatar`, `groupDescription`, `adminIds[]`, `participantsProfiles[]`, `lastMessage` (string or `{content,type}`), `lastMessageAt` (Unix **seconds**), `isGroup`. Name fallback: name → email → `'User'`; group name fallback `'Group Chat'`; avatar fallback for groups = Unsplash placeholder.

WS envelope `{type, payload}`; handlers on this screen:

| `type` | payload fields used | effect |
|---|---|---|
| `new_message` | `chatId`, `content`, `createdAt` (s), `senderId` | move chat to top, replace preview/time, else `_loadChats`; sound + local notification when `senderId != me` (`title` = partner name or `New Message`, body = content or `New message`/`You received a new message`, payload `chat_<id>`) |
| `message_read` | `chatId` | `_loadChats()` |
| `typing_start` | `chatId`, `userId` (ignored if self) | typing=true, auto-clear after **3 s** |
| `typing_end` | `chatId` | typing=false |
| `user_status_update` | `userId`, `status`, `isOnline` | update matching `partnerId` rows |
| `chat_created` | — | `_loadChats()` |

Sends: `{type:'status_update', status, userId}`.

Cache note: `ApiService` writes `cached_chats_<userId>` / `cached_messages_<chatId><userId>` but the screens read `cached_chats` / `cached_messages_<chatId>` — the fast-cache branch never hits. Reimplement as one consistent key.

---

## 2. Screen: Chat (`ChatScreen`, route `/chat`, args `chatId` or `userId`)

### 2.1 Top-level tree

```
Scaffold                                   // resizeToAvoidBottomInset: default true
└─ body: Stack
   ├─ _LiquidBackground                     // Container, full bleed, dark ? #121212 : #F8F9FA
   ├─ Column
   │  ├─ _buildAppBar()
   │  ├─ Expanded
   │  │  ├─ _isLoading → _buildShimmerLoading()          (8 skeleton bubbles)
   │  │  ├─ _messages.isEmpty → _buildEmptyState()
   │  │  └─ else ListView.builder
   │  │        controller: _scrollController
   │  │        reverse: true
   │  │        padding: EdgeInsets.symmetric(horizontal:16, vertical:20)
   │  │        itemCount: _messages.length + (_isTyping ? 1 : 0)
   │  │        index 0 = typing bubble when _isTyping, then message[index-1]
   │  ├─ if (!_isLoading && _isIcebreakerVisible && _messages.isEmpty) _buildIcebreakerHub()
   │  └─ _buildInputArea()
   └─ if (_activeEffect != null) _buildEffectOverlay()   // CustomPaint, full screen, ignores pointer? no — paints over
```

Scroll: reversed list; “bottom” = offset 0. `_scrollToBottom()` = `jumpTo(0.0)` (instant, no animation). Jump-to-replied-message = `animateTo(index * 80.0, 500 ms, Curves.easeInOutCubic)` clamped to max extent — note this is wrong for a reversed list (offset 0 = newest), but that is the implemented behavior.

### 2.2 App bar (custom, not `AppBar`)

```
ClipRect → BackdropFilter(ImageFilter.blur(sigmaX:10, sigmaY:10)) → Container
  padding: EdgeInsets.only(top: max(12.0, MediaQuery.padding.top), bottom: 12)
  color: (dark ? #121212 : #FFFFFF) @ 0.7
  border: bottom 1px (dark ? #FFFFFF : #000000) @ 0.08
  └─ Row
     ├─ IconButton(Icon(Icons.arrow_back_ios, size:20)) → HapticFeedback.lightImpact(); pop
     ├─ _isLoading
     │   ? Shimmer.fromColors(base: grey[300], highlight: grey[100])
     │       └─ Container 40×40, white, circle
     │   : Expanded → InkWell(onTap: only if _partnerStatus=='group' → group info sheet)
     │       └─ Row
     │          ├─ _PulseAvatar(radius:20 default, isOnline, status, image, photos, name)
     │          ├─ SizedBox(width:12)
     │          └─ Expanded → Column(start)
     │             ├─ Text(_partnerName ?? '...', 16, bold, 1 line, ellipsis)
     │             └─ Text(subtitle, 12, color: typing ? #026AFD : grey[600],
     │                        weight: typing ? bold : normal, 1 line, ellipsis)
     ├─ PopupMenuButton<String>(icon: Icon(Icons.more_vert, color:#026AFD))
     │    item 'media'  → Text('Shared Media')
     │    item 'block'  → Row(Icon(Icons.block, red, 20), SizedBox(12),
     │                            Text('Block Contact', red, w600))
     └─ SizedBox(width:8)
```
Subtitle priority: `typing...` → `'${_groupParticipants.length} members'` (group) → `online` (isPartnerOnline) → `_partnerStatus ?? 'offline'`.
Bar height ≈ max(12, statusBar)+40+12 ≈ 64 on notched devices (56 + inset).

`_PulseAvatar` (chat variant): default `radius 20` (40×40); circle bg `grey[200]`; image via `CachedNetworkImageProvider`; fallback `Text(name[0])` default 14; when `isOnline` pulsing shadow `#026AFD` opacity `1−v`, blur `v*10`, spread `v*5`, 2 s repeat.

### 2.3 Icebreaker hub (empty conversation only)

```
Container height: 90, margin: EdgeInsets.symmetric(vertical:10)
└─ ListView(horizontal, padding: EdgeInsets.symmetric(horizontal:16))
   └─ per card: GestureDetector(onTap: set text + _sendMessage())
      Container width:150, margin: only(right:12), padding: all(12)
        color: dark ? #1C1C1E : #FFFFFF
        borderRadius: 20
        border: 1px dark ? grey[800] : grey[200]
      └─ Column(start)
         ├─ Text(emoji, 18)
         └─ Text(label, 12, color dark ? rgba(255,255,255,.7) : rgba(0,0,0,.87), 1 line, ellipsis)
```
| emoji | label (sent verbatim) |
|---|---|
| 👋 | `Hey! How are you?` |
| ✨ | `Love your profile!` |
| 🍕 | `Best food in town?` |

Hidden after: first send, first staged image, or when a message exists.

### 2.4 Message list item (`_buildMessageBubble`)

```
SwipeToReply(isMe)                        // see 2.4.4
└─ Align(alignment: isMe ? centerRight : centerLeft)
   └─ (non-self only) TweenAnimationBuilder 300 ms, 0→1, Curves.easeOutCubic
        → Opacity(v) + Transform.translate(Offset(-30*(1−v), 0))
      └─ GestureDetector(onLongPress: lightImpact + _showReactionPicker(m))
         └─ Stack(clipBehavior: none)
            ├─ Container
            │    margin: EdgeInsets.only(bottom:12, top:4)
            │    padding: EdgeInsets.symmetric(horizontal:16, vertical:10)
            │    constraints: BoxConstraints(maxWidth: screenWidth * 0.75)
            │    decoration:
            │      gradient (self): LinearGradient([#026AFD,#026AFD], topLeft→bottomRight)
            │      color (other): dark ? #1C1C1E : #FFFFFF
            │      borderRadius: topLeft 20, topRight 20,
            │                    bottomLeft isMe ? 20 : 4,
            │                    bottomRight isMe ? 4 : 20
            │      boxShadow: [
            │        BoxShadow(color: isMe ? #026AFD@.2 : rgba(0,0,0,.04),
            │                  blurRadius: 12, offset: Offset(0,6)),
            │        if isMe: BoxShadow(color: rgba(255,255,255,.2),
            │                  blurRadius: 0, offset: Offset(0,-1), spreadRadius: -1)
            │      ]
            │    child: _buildMessageContent(m, isMe)
            └─ if reactions non-empty: _buildReactionBadge(m)
```
No avatar and no timestamp are rendered per message in this screen (unlike `message_bubble.dart`). Timestamps only exist in the list screen.

Bubble geometry: text line-height default (~1.17 for 14px) → single-line bubble ≈ 14×1.17 + 20 = ~36–38 px tall.

#### 2.4.1 Content variants

| `m.type` / condition | Render |
|---|---|
| `group` + not me | `Padding(bottom:5)` → `Text(senderName, 12.5, bold, letterSpacing .1, color = palette[hash(senderId) % 8])`. Name from `senderName` → `_groupParticipants` match → `'Member'` |
| has `replyToId` | quote block: `Container(margin: bottom 8, padding: symmetric(h:12,v:8))`, color me ? `rgba(0,0,0,.08)` : dark ? `rgba(255,255,255,.08)` : `#F1F5F9`; radius 8; left border 3.5 (`rgba(255,255,255,.9)` me / `#026AFD` other); Row: `Icon(Icons.reply_rounded, 12, same border color)`, 4px, `Text(replyToSenderName ?? 'Partner', 11, bold, me ? white : #026AFD)`; 3px; `Text(replyToContent ?? '', 11.5, 1 line, ellipsis, me ? rgba(255,255,255,.85) : dark ? grey[300] : rgba(0,0,0,.54))`. Tap → jump to `replyToId` message (see scroll formula) |
| `emoji` | `Text(content)`: 48 if 1 grapheme, 38 if ≤3, else 32. Computed with `_isOnlyEmoji` on send (len ≤10 + emoji regex) |
| `image` or `_isImageMessage` | image grid (2.4.2); caption line `Padding(top:8) Text(content)` only if content contains `"` and does not start with `[` |
| text | `Text(content)` — **no explicit fontSize** (default 14), color me ? white : dark ? white : `rgba(0,0,0,.87)` |

Order inside bubble when both exist: sender name → reply quote → main content.

#### 2.4.2 Image grids (`totalWidth = 240`, `totalHeight = 240`, radius 12)

| Count | Layout |
|---|---|
| 1 | `ClipRRect(radius 12)` 240×240 cover, tap → carousel index 0 |
| 2 | `ClipRRect` 240 × 240/1.4 = **171.43**; Row: two `Expanded`, `SizedBox(width:2)` gap |
| 3 | 240×240: left `Expanded` full height; 2px gap; right Column: two `Expanded` with 2px gap |
| ≥4 | 240×240 `GridView` 2 cols, `mainAxisSpacing:2`, `crossAxisSpacing:2`, `NeverScrollable`, `shrinkWrap`, only **4** cells; cell 4 shows `Container(rgba(0,0,0,.45))` + `Text('+${n-4}', 20, bold, white)` when n>4 |

Image widget: local pending bytes → `Image.memory(cover, gaplessPlayback)`; `http…` → CachedNetworkImage cover, placeholder `#1C1C1E` dark / `grey[200]` light + centered spinner stroke 2, error same bg + `Icon(Icons.broken_image, grey)`; unknown → same bg + `Icon(Icons.image, grey)`.

`_isImageMessage`: `type=='image'`, or content is JSON array starting with `http`, or content starts `http` and contains `cloudinary` or ends `.jpg`/`.png`.
`_parseImageUrls`: JSON list → list; JSON string → `[s]`; `http…` → `[s]`; else `[]`.

#### 2.4.3 Reaction badge (`_buildReactionBadge`)

```
Positioned(bottom: -4, right: isMe ? 4 : null, left: !isMe ? 4 : null)
└─ Container padding: all(4), circle,
   color: dark ? #2C2C2E : #FFFFFF,
   border: 1px dark ? grey[800] : grey[100]
   └─ Text(first reaction value, 12)      // one emoji only (values.first), even if many
```

#### 2.4.4 Swipe-to-reply (`SwipeToReply`)

| Property | Value |
|---|---|
| Gesture | horizontal drag, right only; `HitTestBehavior.translucent` |
| Offset | `clamp(0, 90)`; translation = `Offset(dragOffset, 0)` on the child |
| Trigger | `>= 55` → `HapticFeedback.mediumImpact()` once, `onReply()` on drag end |
| Icon | `Positioned(left: -35 + dragOffset*0.45)`, opacity `clamp(dragOffset/55, 0, 1)`, `Container(padding 8, #026AFD, circle)` + `Icon(Icons.reply_rounded, white, 16)` |
| Return | 200 ms, `Curves.easeOutBack`, 0 |
| Stack | `clipBehavior: Clip.none`, `alignment: centerLeft` |

### 2.5 Typing bubble (list index 0 when `_isTyping`)

```
Padding(bottom:20)
└─ Row
   ├─ _PulseAvatar(radius:15 (30×30), isOnline:true, status:'available')
   ├─ SizedBox(width:8)
   └─ _TypingDots: Container(padding: symmetric(h:12,v:8), color: dark ? #1C1C1E : white,
                             borderRadius:20)
                    └─ Text('...', bold, #026AFD)     // static, no animation here
```
Driven by WS `typing_start` (auto-off after **5 s**) / `typing_end`.

### 2.6 Empty state

```
Center → Column(center)
├─ Container(padding: all(24), circle, color: #026AFD@0.08)
│   └─ Icon(Icons.forum_rounded, size:48, color:#026AFD)      // outer disc = 48+48 = 96
├─ SizedBox(height:20)
├─ Text('No messages yet', 18, bold, dark ? white : grey[800])
├─ SizedBox(height:8)
└─ Padding(h:40) Text( _partnerName != null
                      ? 'Start a conversation with $_partnerName'
                      : 'Say hello to start the chat!',
                     center, 14, grey[500])
```

### 2.7 Loading shimmer (8 bubbles)

```
Shimmer.fromColors(base: grey[200], highlight: white)
└─ ListView.builder(itemCount: 8, padding: symmetric(h:16, v:20))
   └─ Align(i even ? centerRight : centerLeft)
      └─ Container(margin: only(bottom:12),
                   width: 100 + rand*100, height: 40 + rand*20,
                   color white,
                   radius: topLeft 16, topRight 16,
                           bottomLeft i even ? 16 : 4, bottomRight i even ? 4 : 16)
```

### 2.8 Composer (`_buildInputArea`) — bottom → up

```
ClipRect → BackdropFilter(blur 12) → Container
  color: (dark ? #121212 : #FFFFFF) @ 0.75
  boxShadow: [BoxShadow(rgba(0,0,0,.04), blurRadius:15, offset: Offset(0,-5))]
  border: top 1px (dark ? #FFFFFF : #000000) @ 0.05
  └─ SafeArea(top:false)
     └─ Column(min)
        ├─ if uploading: SizedBox(height:2) → LinearProgressIndicator(value: done/total,
        │                 backgroundColor: transparent, color: #026AFD)
        ├─ if uploading: Container(padding: symmetric(h:16,v:4)) Row(spaceBetween)
        │                 'Uploading $done of $total...'   10, bold, #026AFD
        │                 '${(pct*100).toInt()}%'          10, bold, #026AFD
        ├─ if staged images: AnimatedContainer(300 ms, Curves.easeOutBack,
        │        padding: EdgeInsets.fromLTRB(12,8,12,0))
        │     ├─ Row: '$n image${n>1?'s':''} selected' 12 bold #026AFD
        │     │        Spacer
        │     │        'Clear all' 12, red, w600  → clears tray
        │     ├─ SizedBox(height:8)
        │     └─ SizedBox(height:85) horizontal ListView of staged items:
        │           80×80, margin right 12, radius 12,
        │           shadow rgba(0,0,0,.1) blur 4 offset(0,2), clip hardEdge, Image.memory cover
        │           remove chip: Positioned(top:2, right:14) 22×22, black54 circle,
        │                        Icon(Icons.close, white, 14)
        ├─ if replying: Container(padding: symmetric(h:16,v:10),
        │        margin: symmetric(h:12,v:4),
        │        color: dark ? #1C1C1E : #F0F2F5, radius 16,
        │        border left 4px #026AFD)
        │     Row: Icon(reply_rounded, #026AFD, 18) · 8
        │          Expanded Column: Text('You'|partnerName, 12, bold, #026AFD) · 2
        │                           Text(content, 13, dark ? grey[300] : grey[700], 1 line, ellipsis)
        │          close: circle padding 4, bg dark ? grey[800] : grey[300],
        │                 Icon(Icons.close, 14, dark ? rgba(255,255,255,.7) : grey)
        ├─ Padding(fromLTRB(8,10,8,12)) Row
        │  ├─ prefix drawer (2.8.1)
        │  ├─ SizedBox(width:4)
        │  ├─ Expanded → ConstrainedBox(minHeight:46, maxHeight:150)
        │  │   └─ Container(padding: symmetric(h:16,v:11),
        │  │        color: (dark ? #1C1C1E : #F0F2F5) @0.8, radius 23)
        │  │      └─ TextField(maxLines: null, textCapitalization: sentences,
        │  │           cursorColor: #026AFD,
        │  │           style: 15, height 1.3, color dark ? white : #1A1A2E,
        │  │           hint 'Type a message...', hintStyle 15 #9E9E9E,
        │  │           isDense: true, contentPadding: zero, all borders none,
        │  │           onTap: hides emoji picker)
        │  ├─ SizedBox(width:8)
        │  └─ Send: GestureDetector(disabled while uploading) → AnimatedContainer(200 ms)
        │           42×42 circle; active (staged images or text) → gradient #026AFD→#026AFD
        │           + shadow #026AFD@.35 blur 10 offset(0,4); inactive → dark ? grey[800] : grey[200]
        │           Icon(Icons.send_rounded, size:18,
        │                active ? white : dark ? grey[600] : grey[400])
        └─ if _showEmojiPicker: _buildEmojiPicker()   (2.8.2)
```
Input pill min height 46 (11+~24+11), radius 23. Composer total height (no tray) = 10 + 46 + 12 = **68** + bottom safe area.

Send behavior: `HapticFeedback.heavyImpact()`; if staged images → `_sendStagedImages(caption: text)` + clear input; else if text non-empty → `_sendMessage()` (trim; ignore empty). Disabled (null onTap) while uploading.

#### 2.8.1 Prefix drawer (animated)

Empty input → three 40×40 chips:
```
Row(min)
├─ _InputIconBtn(Icons.emoji_emotions_outlined | Icons.keyboard_rounded when picker open, active)
├─ SizedBox(width:4)
├─ _InputIconBtn(Icons.camera_alt_outlined)  → HapticFeedback.mediumImpact(); _takePhoto()
├─ SizedBox(width:4)
└─ _InputIconBtn(Icons.add_photo_alternate_outlined, active: hasStaged, badge: staged count)
      → HapticFeedback.mediumImpact(); _pickAndSendImages()
```
`_InputIconBtn`: `AnimatedContainer 200 ms, 40×40 circle`, active bg `#026AFD@.12` else `dark ? #2C2C2E : grey[100]`; glyph `Icon(icon, #026AFD, 20)`; badge `Positioned(top:-2, right:-2)`, padding 4, `Colors.red` circle, `min 16×16`, text 10 bold white.

Non-empty input → collapsed “+” drawer:
```
Row(min)
├─ GestureDetector(toggles _showMediaMenu) → AnimatedRotation(250 ms, turns: open ? 0.125 : 0)
│   └─ AnimatedContainer(200 ms, 40×40 circle,
│        bg: open ? #026AFD@.12 : grey[100])
│        Icon(Icons.add_rounded, #026AFD, 24)
└─ AnimatedSize(250 ms, Curves.easeOutCubic)
   └─ Container(maxWidth: open ? 150 : 0, clip antiAlias)
      Row(min): SizedBox(8) · emoji chip · 4 · camera chip · 4 · gallery chip
```
(So typing hides camera/gallery behind a rotating plus.)

#### 2.8.2 Emoji picker

```
Container(height:320, color dark ? #1C1C1E : white,
          border top 1px dark ? grey[800] : grey[200])
└─ DefaultTabController(length:5) Column
   ├─ Expanded TabBarView: 5 GridViews, padding all(16),
   │     crossAxisCount:7, mainAxisSpacing:12, crossAxisSpacing:12,
   │     cell: Center(Text(emoji, 26)); tap → HapticFeedback.lightImpact(); append to input
   └─ Container(height:50, color dark ? #121212 : grey[50],
              border top 1px dark ? grey[800] : grey[200])
      TabBar(indicatorColor:#026AFD, indicatorSize: label, labelColor:#026AFD,
             unselectedLabelColor: grey[400],
             tabs: Icon(size:22) → sentiment_satisfied_alt, favorite_border,
                    front_hand_outlined, pets_outlined, fastfood_outlined)
```
Picker sets are hard-coded short lists (see source lines 2474-2496), not the long `_emojiCategories` map.

### 2.9 Long-press reaction sheet (`_showReactionPicker`)

```
showModalBottomSheet(backgroundColor: transparent)
└─ Container(padding: symmetric(h:24, v:20),
             color: dark ? #1C1C1E : white,
             borderRadius: vertical(top: 30))
   └─ Column(min)
      ├─ Row(spaceAround) 5 emojis fontSize 32:
      │     ❤️  😂  🔥  👍  🙏      → POST /messages/:id/react then pop
      ├─ SizedBox(height:24)
      ├─ Divider()                        // 1px, height 16
      ├─ SizedBox(height:8)
      ├─ ListTile(leading: Icon(Icons.reply_rounded, #026AFD),
      │           title: Text('Reply to message', 14, w600)) → pop + _startReply(m)
      └─ SizedBox(height:8)
```
There is **no delete and no copy** action anywhere in `chat_screen.dart`. Do not invent one; if parity-plus is desired, treat as an addition.

Starting a reply focuses the input (`_focusNode.requestFocus()`) and shows the reply banner (2.8).

### 2.10 Group info sheet

`showModalBottomSheet(isScrollControlled:true, transparent)`.

```
Container(height: 85% screen, color dark ? #1C1C1E : white, top radius 24)
└─ Column
   ├─ SizedBox(12) · handle 48×5 (dark ? grey[800] : grey[300]) r2.5 · SizedBox(16)
   ├─ CircleAvatar(radius:45, bg dark ? grey[800] : grey[200],
   │               image = group avatar, fallback initial 28 bold #026AFD or 'G')
   ├─ SizedBox(12)
   ├─ Text(groupName, 22, bold, dark ? white : black)
   ├─ SizedBox(8)
   ├─ Padding(h:32) Text(description or 'No description provided.',
   │                    center, 14, dark ? grey[400] : grey[600])
   ├─ SizedBox(16)
   ├─ admin? Padding(h:16) Wrap(spacing:8, runSpacing:8, center):
   │    ElevatedButton.icon(Icons.edit, 14, 'Edit Details' 12)      bg #026AFD fg white
   │    ElevatedButton.icon(Icons.link, 14, 'Invite Link' 12)       bg dark ? #2C2C2E : white
   │    ElevatedButton.icon(Icons.person_add_alt_1_rounded, 14, 'Add Member' 12)  same as Invite
   │    all: padding symmetric(h:12,v:8), radius 20; outlined ones fg #026AFD
   │         + side BorderSide(#026AFD)
   │  : Row(center): Icon(Icons.lock_outline, 16, grey) · 6
   │                 Text('Only admins can edit group details.', 12, grey[500])
   ├─ Divider(height:32)
   ├─ Padding(h:20) Row(spaceBetween):
   │    Text('Members (${n})', 16, bold, dark ? white : black)
   │    Icon(Icons.people_outline, grey)
   ├─ SizedBox(12)
   └─ Expanded ListView(padding: h20) of ListTile(contentPadding: zero)
        leading: CircleAvatar (default radius 20) image / initial; bg dark ? grey[800] : grey[100]
        title: Row( Text(name, w600, color self ? #026AFD : dark ? white70 : black87),
                     if self: SizedBox(6) + Text('(You)', 12, grey[500]) )
        subtitle: Text(isAdmin ? 'Admin' : 'Member', 12, isAdmin ? #026AFD : grey[500])
        trailing:
          isAdmin → Container(padding: symmetric(h:8,v:2), bg #026AFD@.1, radius 10,
                    border #026AFD@.3) Text('Admin', 10, bold, #026AFD)
          else if currentUserIsAdmin && !self → PopupMenuButton(
                    Icon(Icons.more_horiz, grey))
                    'promote' → Row(Icon(Icons.shield_outlined, 20), 8, 'Make Admin')
                    'remove'  → Row(Icon(Icons.person_remove_outlined, red, 20), 8,
                                    'Remove Member' red)
          else null
```
Actions: promote → `POST /chats/:id/admin {targetUserId}` → toast `'<name> is now an Admin'`; remove → `DELETE /chats/:id/participants/:memberId` → toast `'<name> removed'`. Failures: `Failed to promote member`, `Failed to remove member`.

### 2.11 Edit group sheet (`_showEditGroupModal`)

```
Container(height: 80% screen, color dark ? #1C1C1E : white, top radius 24)
└─ Padding(h:20) Column
   ├─ SizedBox(12) · handle 48×5 · SizedBox(16)
   ├─ Text('Edit Group Info', 20, bold)
   ├─ SizedBox(20)
   ├─ CircleAvatar(radius:40, bg dark ? grey[800] : grey[200], new image / existing avatar,
   │               placeholder Icon(Icons.add_a_photo, grey, 28))  → gallery (quality 70)
   ├─ SizedBox(24)
   ├─ TextField(label 'Group Name', prefix Icons.group, filled dark ? #2C2C2E : grey[100], r16)
   ├─ SizedBox(16)
   ├─ TextField(label 'Description', maxLines 3, prefix Icons.description, same fill/r16)
   ├─ SizedBox(24)
   └─ SizedBox(width∞, height:50) ElevatedButton(bg #026AFD, fg white, r25, elevation 0)
        child: isSaving ? CircularProgressIndicator(white) : Text('Save Changes', 16, bold)
```
Validation toast `Group name cannot be empty`; success toast `Group updated!` + pop; failure `Failed to update group`. Calls `POST /upload-photo` (filename `group_avatar.jpg`) then `PUT /chats/:id {groupName, groupDescription, groupAvatar}`.

### 2.12 Invite-link dialog (`_shareInviteLink`)

`POST /chats/:id/invite` → `inviteCode`; `inviteUrl = 'https://zukaping.app/join-group?code=$inviteCode'`.

```
AlertDialog(backgroundColor dark ? #1C1C1E : white, radius 24)
├─ title: Row(Icon(Icons.link_rounded, #026AFD, 28), 8,
│           Text('Group Invite Link', 18, bold, dark ? white : black))
├─ content: Column(min, start)
│   ├─ Text('Anyone with this link can join this group chat, even if they are not currently a user.',
│   │      13, dark ? grey[400] : grey[600])
│   ├─ SizedBox(16)
│   └─ Container(padding: symmetric(h:12,v:10),
│          color dark ? #2C2C2E : grey[100], radius 12,
│          border 1px dark ? grey[800] : grey[300])
│       SelectableText(inviteUrl, 13, monospace, dark ? white70 : black87)
└─ actions:
   TextButton('Cancel', color grey)
   ElevatedButton.icon(Icons.copy_rounded 16, 'Copy Link', bg #026AFD, fg white, radius 16)
      → Clipboard.setData → pop → toast 'Invite link copied to clipboard!'
```
Failure toast `Failed to generate invite code`.

### 2.13 Add-members sheet (`_showAddGroupMembersModal`)

Height **75%**, same chrome (handle 12/48×5/16, title `Add Members to Group` 20 bold, 16 gap, h20 padding).
Search: hint `Search users by name...`, prefix search, suffix `IconButton(Icons.clear, grey)` when text non-empty, filled, r16; live search on each change (no debounce), `GET /users/search?q=`.
List: `ListTile(contentPadding: zero)`, leading `CircleAvatar` image/initial, title name w600, trailing:
- already member → `Text('Member', 13, bold, grey)`
- else `ElevatedButton('Add', bg #026AFD, fg white, radius 12, elevation 0, padding h16)` → `POST /chats/:id/participants {userId}` → toast `'<name> added to group!'`, updates both sheets.
Empty text: `Type to search registered users` / `No users found`, grey. Failures `Failed to add <name>`.

### 2.14 Overflow → media gallery (`_openMediaGallery`)

Collects all image URLs from messages (newest→oldest). If none: toast `No media shared yet`.
Route: `PageRouteBuilder` slide transition `Offset(0,1) → Offset.zero`.

```
Scaffold(bg dark ? #121212 : white)
├─ AppBar(elevation 0, bg same, foreground dark ? white : black87, centerTitle false)
│   title: Column(start): Text('Media, Links, and Docs', 16, bold)
│                          Text('${n} items', 12, dark ? grey[400] : grey[600])
└─ GridView.builder(padding: all(2),
     crossAxisCount:3, mainAxisSpacing:2, crossAxisSpacing:2)
     cell: CachedNetworkImage cover; placeholder #1C1C1E dark / grey[100]; error Icon(broken_image)
     tap → image carousel at index
```

### 2.15 Image carousel overlay (`_ImageCarouselOverlay`)

```
Scaffold(backgroundColor: black)
└─ Stack
   ├─ PageView.builder (initialPage = tapped index)
   │   cell: InteractiveViewer(minScale 0.5, maxScale 4.0)
   │         └─ Center(CachedNetworkImage(contain))
   │              placeholder white spinner; error Icon(broken_image, white, 60)
   ├─ Top bar Positioned(top/left/right 0)
   │   padding: top = MediaQuery.padding.top, left 8, right 8, bottom 8
   │   gradient: [rgba(0,0,0,.7), transparent] top→bottom
   │   Row(spaceBetween): IconButton(Icons.close, white, 28) → pop
   │                      Text('${i+1} / ${n}', 16, w600, white)
   │                      SizedBox(width:48)
   └─ if n>1: Positioned(bottom:24) Row(center) dots:
        AnimatedContainer(200 ms, margin h3, width current ? 20 : 6, height 6, radius 3,
                          color current ? white : rgba(255,255,255,.4))
```
Route uses `opaque:false`, `barrierColor: Colors.black`.

### 2.16 Full-screen effects

`AnimationController(duration: 3 s)`; `CustomPaint(size: Size.infinite)` over everything (last Stack child).

| Effect | Trigger keywords (lowercased `contains`) | Paint |
|---|---|---|
| `confetti` | `congratulations`, `yay`, `hbd` | 50 squares 8×8, color `Colors.primaries[rand]`, `y = progress*height*1.5 - rand*200`, `Random(42)` |
| `hearts` | `love`, `❤️` | 20× `'❤️'` 24 px, `y = (1-progress)*height - rand*200`, `Random(42)` |

Triggered on send (`_checkKeywordEffects`) and on incoming `new_message` when appended.

### 2.17 Message send pipeline (for behavioral parity)

1. `text = customText ?? controller.text.trim()`; abort if empty / no chat / no user.
2. Clear input (unless custom text), run keyword effects.
3. `type = _isOnlyEmoji(text) ? 'emoji' : 'text'` (≤10 chars and matches emoji regex).
4. Optimistic `Message(id:'opt_text_<ms>', senderId:me, content, type, createdAt: now, replyTo*)` inserted at index 0; hide icebreaker; clear reply; `jumpTo(0)`; `SoundService.playSent()`.
5. `POST /message {chatId, content, type:'text', replyToId, replyToContent, replyToSenderName}`; on error remove optimistic + toast `Failed to send` (floating snackbar).

Images: stage up to **10** (`imageQuality: 85`, multi-pick; camera single). Gallery over-limit toasts: `Max 10 images already staged`, `Only $remaining more image${s} allowed (max 10)`; picker/camera failures `Could not open image picker`, `Could not open camera`.
`_sendStagedImages`: optimistic message `id:'opt_<ms>'`, `content = json([local ids])`, type `image`; pending bytes map for instant render; upload each via `POST /upload-photo`; then `POST /message {content: json(urls), type:'image'}`; remove optimistic. Toasts: `Failed to upload <name>`, `Failed to send images`. Progress UI shows while uploading. Caption (if typed) sent as a separate text message.

### 2.18 API + WebSocket (Chat)

| Call | Method / path | JSON read |
|---|---|---|
| header load (chatId) | `GET /chats/:chatId` | `isGroup`, `partner{id,_id,name,avatar,status,isOnline,photos[]}`, `participants[]._id`, `groupName`, `groupAvatar`, `groupDescription`, `adminIds[]`, `participantsProfiles[]`, `id` ?? `_id` |
| header load (userId) | `GET /user/:userId` | `_id`, `name`, `avatar`, `status`, `isOnline`, `photos[]` |
| create chat | `POST /chats {participants:[userId]}` | `_id` |
| messages | `GET /messages/:chatId` | list or `{messages:[]}` → parsed by `Message.fromJson`, reversed |
| send | `POST /message` | `chatId`, `content`, `type`, `replyToId/Content/SenderName` |
| upload | `POST /upload-photo` (multipart `photo`) | `url` |
| react | `POST /messages/:id/react {emoji}` | 200 ⇒ ok |
| block | `POST /block {targetUserId}` | — |
| edit group | `PUT /chats/:id` | `groupName`, `groupDescription`, `groupAvatar` |
| promote | `POST /chats/:id/admin {targetUserId}` | — |
| remove member | `DELETE /chats/:id/participants/:userId` | — |
| invite | `POST /chats/:id/invite` | `inviteCode` |
| add member | `POST /chats/:id/participants {userId}` | — |
| search users | `GET /users/search?q=` | list/`{users:[]}` |

`Message.fromJson`: `_id` ?? `id`; `senderId` ?? `sender._id`; `content`; `type` (default `text`); `createdAt` (int **seconds** or ISO string, else now); `isRead`; `reactions` map<string,string>; `replyToId`, `replyToContent`, `replyToSenderName`; `senderName` ?? `sender.name`; `senderAvatar` ?? `sender.avatar`.

WS (envelope `{type, payload}`):

| `type` | payload | effect |
|---|---|---|
| `new_message` | full message + `chatId` | if `chatId == _actualChatId`: replace optimistic matching temp id + same content, else insert at 0 + effects; scroll to bottom; if not mine → sound + send read receipt |
| `message_read` | `chatId`, `messageIds[]` | mark `isRead` |
| `typing_start` | `chatId`, `userId` | show typing 5 s |
| `typing_end` | `chatId` | hide typing |
| `user_status_update` | `userId`, `status`, `isOnline` | appbar subtitle/dot |
| `message_reaction` | `messageId`, `reactions` | replace message with new reactions map |

Sends: `{type:'subscribe_chat', payload:{chatId}}` on init and after header load; `{type:'typing_start'|'typing_end', payload:{chatId}}` on every input change (non-empty→start, empty→end — no throttle); `{type:'message_read', payload:{chatId, messageIds}}`.

### 2.19 Block contact dialog

```
AlertDialog(shape radius 16)
├─ title: Text('Block Contact?')
├─ content: Text('Are you sure you want to block <name>? You will no longer receive messages from them.')
└─ actions: TextButton('Cancel')  ·  TextButton('Block', red, bold)
```
Confirm → `HapticFeedback.heavyImpact()`, `POST /block`, toast `User blocked`, pop screen. Errors: `Error blocking user`.

### 2.20 Snackbars

Chat screen uses `SnackBar(behavior: SnackBarBehavior.floating)` for every toast (default bg/elevation, 4 s default duration). Chats screen uses `behavior: fixed`, `backgroundColor #026AFD`, 2 s.

---

## 3. `MessageBubble` widget (`widgets/message_bubble.dart`) — standalone, unused by the two screens

Props: `content`, `senderName`, `senderAvatar?`, `isSelf=false`, `isSystem=false`, `createdAt?` (**never rendered**), `reactions?`.

**System message**
```
Center → Container(margin: symmetric(vertical:8),
                   padding: symmetric(horizontal:12, vertical:4),
                   color: grey.shade100 (#F5F5F5), radius 12)
  Text(content, 12, w600, grey.shade600 #757575)
```
No dark-mode branch (always light grey).

**Normal message**
```
Container(margin: symmetric(vertical:4))
└─ Row(crossAxisAlignment: start, mainAxisAlignment: isSelf ? end : start)
   ├─ if !isSelf: avatar 32×32 + SizedBox(width:8)
   ├─ Flexible → Column(crossAxisAlignment: isSelf ? end : start)
   │   ├─ if !isSelf: Padding(left:4, bottom:2)
   │   │     Text(senderName, 11, bold, dark ? grey.shade400 : grey.shade600)
   │   ├─ Container
   │   │    padding: symmetric(horizontal:14, vertical:10)
   │   │    color: isSelf ? #026AFD : (dark ? #1C1C1E : grey.shade100)
   │   │    radius: topLeft 16, topRight 16,
   │   │            bottomLeft isSelf ? 16 : 4, bottomRight isSelf ? 4 : 16
   │   │    Text(content, 14.5, color isSelf ? white : dark ? white : black87)
   │   └─ if reactions non-empty: Padding(top:4)
   │        Wrap(spacing:4) of Text(emoji, 16)          // all emojis, no counts
   └─ if isSelf: SizedBox(width:8) + avatar 32×32
```
Avatar: `Container 32×32` circle, `color: dark ? #2C2C2E : grey.shade100`, `ClipOval` image (cover, error→initial) else initial: `#026AFD@.1` fill, `Text(initial, 14, bold, #026AFD)`.

Differences vs the in-screen bubble: 32 px avatar present, sender name always (not group-gated), radius 16/4, padding 14/10, text 14.5, no max-width, no shadows, no swipe, no long-press, no sender palette, no reply quote, no image support.

---

## 4. Interaction / state matrix

| Element | Gesture | Result |
|---|---|---|
| Chat row | tap | open `RoomChatScreen(roomId)` if room else `ChatScreen(chatId)`; reload on return |
| Chat avatar | tap | `HapticFeedback.lightImpact()` + `pushNamed('/view-profile', {userId})` (1:1 only) |
| Status chip | tap | cycle status + `PUT /me` + `status_update` WS |
| Room card | tap | `RoomPreviewSheet` |
| FAB | tap | global user search sheet |
| User result row | tap | `pushNamed('/view-profile', {userId})` |
| User result “Chat” | tap | `POST /chats` → `/chat` with `chatId` |
| Chat app bar back | tap | light haptic + pop |
| Chat app bar title area | tap | group info sheet (only when `partnerStatus=='group'`) |
| Chat app bar ⋮ | tap | menu `Shared Media` / `Block Contact` |
| Message | long-press | light haptic + reaction sheet |
| Message | drag right ≥55 | reply (banner + focus) |
| Bubble | tap (reply quote) | jump to replied message |
| Image | tap | carousel overlay |
| Carousel | swipe / pinch | page / zoom 0.5–4× |
| Carousel close | tap | pop |
| Composer send | tap | heavy haptic + send text or staged images |
| Emoji chip | tap | toggle picker (keyboard icon when open) |
| Camera chip | tap | camera capture (quality 85) |
| Gallery chip | tap | multi-pick (quality 85, max 10 staged) |
| “+” chip (typing) | tap | expand/collapse 3 chips, rotate 45° |
| Staged image ✕ | tap | light haptic + remove that image |
| “Clear all” | tap | empty tray |
| Reply banner ✕ | tap | cancel reply |
| Group info ⋮ (member) | tap | promote / remove |
| Admin “Edit Details” | tap | edit group sheet |
| Admin “Invite Link” | tap | invite dialog |
| Admin “Add Member” | tap | add members sheet |

Not implemented anywhere in these files: message delete, message copy, message forward, chat-row swipe, pull-to-refresh, message search, read receipts UI (state only), typing bubble in list beyond dots.

---

## 5. Layout, scroll, safe areas, keyboard, breakpoints

- **No width breakpoints.** No `LayoutBuilder`, no `MediaQuery.width` thresholds. Only proportional rules: bubble `maxWidth = width*0.75`; sheets `height = 0.85/0.90/0.80/0.75 * screen height`.
- Chats list horizontal padding **24** (larger than chat list's 16); chat list padding `h16 / v20`.
- Chat list is `reverse: true`; newest at bottom; auto-scroll by `jumpTo(0)`.
- Chats screen: `AppBar` consumes top inset; bottom nav = `60 + padding.bottom`; no list bottom padding beyond the nav bar (FAB overlaps the last row's right edge).
- Chat screen: custom app bar `top = max(12, padding.top)` (so 12 on non-notched, ~56 on notched); composer wrapped in `SafeArea(top:false)`; keyboard resizes the Scaffold (default `resizeToAvoidBottomInset`), pushing composer + emoji picker up; `_focusNode` used for reply focus.
- Text fields: chats search `textInputAction` default; composer `maxLines:null`, `TextCapitalization.sentences`, max height 150 → internal scroll.
- No `Scrollbar` customization; default Material scrollbars.

---

## 6. Exact user-visible strings

Chats screen: `🔍 Search chats by name or message...` · `Available` · `Busy` · `Ghost` · `Stealth` · `Super` · `Offline` · `Status changed to <X>` · `Failed to update status` · `Typing` · `Just now` · `<n>m` · `<n>h` · `<d>/<m>` · `No messages yet` · `📷 Photo` · `Unknown error` · `Failed to load chats` · `Retry` · `💬` · `No results found` · `No chats yet` · `Clear search` · `🔥 Public Rooms Discovery` · `Find Friends` · `Search by name...` · `Type a name to search globally` · `No users found` · `@<slug>` · `Chat` · `Failed to start chat` · `New Group Chat` · `Group Name` · `Group Description (Optional)` · `Search members to add...` · `Type to search users` · `Create Group (<n>)` · `Please enter a group name` · `Please select at least one member` · `Failed to create group: <e>` · nav labels `Live` `Favorites` `Chats` `Profile` · notification `New Message` · `New message` · `You received a new message`.

Chat screen: `...` · `Shared Media` · `Block Contact` · `Block Contact?` · `Are you sure you want to block <name>? You will no longer receive messages from them.` · `Cancel` · `Block` · `User blocked` · `Error blocking user` · `typing...` · `<n> members` · `online` · `offline` · `Hey! How are you?` · `Love your profile!` · `Best food in town?` · `No messages yet` · `Start a conversation with <name>` · `Say hello to start the chat!` · `Reply to message` · `Member` · `Partner` · `You` · `Type a message...` · `Uploading <a> of <b>...` · `<n>%` · `<n> image selected` / `<n> images selected` · `Clear all` · `Max 10 images already staged` · `Only <n> more image allowed (max 10)` / `Only <n> more images allowed (max 10)` · `Could not open image picker` · `Could not open camera` · `Failed to upload <name>` · `Failed to send images` · `Failed to send` · `No media shared yet` · `Media, Links, and Docs` · `<n> items` · `<i> / <n>` · `Save Changes` · `Edit Group Info` · `Description` · `Group updated!` · `Group name cannot be empty` · `Failed to update group` · `Group Invite Link` · `Anyone with this link can join this group chat, even if they are not currently a user.` · `Copy Link` · `Invite link copied to clipboard!` · `Failed to generate invite code` · `Add Members to Group` · `Search users by name...` · `Type to search registered users` · `Add` · `<name> added to group!` · `Failed to add <name>` · `Only admins can edit group details.` · `Members (<n>)` · `(You)` · `Admin` · `Make Admin` · `Remove Member` · `<name> is now an Admin` · `<name> removed` · `Failed to promote member` · `Failed to remove member` · `No description provided.` · `Edit Details` · `Invite Link` · `Add Member` · `Group Chat`.

---

## 7. Copy-ready tokens

```css
:root{
  /* brand */
  --zp-primary:#026AFD;
  --zp-primary-05:rgba(2,106,253,.05);
  --zp-primary-08:rgba(2,106,253,.08);
  --zp-primary-10:rgba(2,106,253,.10);
  --zp-primary-12:rgba(2,106,253,.12);
  --zp-primary-15:rgba(2,106,253,.15);
  --zp-primary-20:rgba(2,106,253,.20);
  --zp-primary-30:rgba(2,106,253,.30);
  --zp-primary-35:rgba(2,106,253,.35);

  /* surfaces */
  --zp-bg-light:#F8F9FA;
  --zp-surface:#FFFFFF;
  --zp-surface-alt:#F0F2F5;        /* composer pill @ .8, reply preview */
  --zp-surface-muted:#F5F5F5;
  --zp-surface-reply:#F1F5F9;
  --zp-bg-dark:#121212;
  --zp-surface-dark:#1C1C1E;
  --zp-border-dark:#2C2C2E;

  /* text */
  --zp-text:#1A1A2E;               /* composer input light */
  --zp-text-87:rgba(0,0,0,.87);
  --zp-text-54:rgba(0,0,0,.54);
  --zp-hint:#9E9E9E;
  --zp-white-70:rgba(255,255,255,.7);
  --zp-white-85:rgba(255,255,255,.85);
  --zp-white-90:rgba(255,255,255,.9);

  /* greys */
  --zp-grey-50:#FAFAFA; --zp-grey-100:#F5F5F5; --zp-grey-200:#EEEEEE;
  --zp-grey-300:#E0E0E0; --zp-grey-400:#BDBDBD; --zp-grey-500:#9E9E9E;
  --zp-grey-600:#757575; --zp-grey-700:#616161; --zp-grey-800:#424242;

  /* status */
  --zp-online:#026AFD; --zp-busy:#FFFF00; --zp-super:#7C4DFF;
  --zp-ghost:rgba(158,158,158,.5); --zp-offline:#9E9E9E;
  --zp-danger:#F44336; --zp-room-live:#34C759; --zp-trending:#FF5722;

  /* group sender palette */
  --zp-sender-1:#EC4899; --zp-sender-2:#F59E0B; --zp-sender-3:#10B981;
  --zp-sender-4:#6366F1; --zp-sender-5:#8B5CF6; --zp-sender-6:#EF4444;
  --zp-sender-7:#06B6D4; --zp-sender-8:#14B8A6;

  /* radii */
  --zp-r-pill:25px; --zp-r-input:23px; --zp-r-chip:20px; --zp-r-bubble-lg:20px;
  --zp-r-bubble-sm:16px; --zp-r-bubble-tail:4px; --zp-r-sheet:24px;
  --zp-r-sheet-reaction:30px; --zp-r-card:16px; --zp-r-reply:8px;
  --zp-r-thumb:12px; --zp-r-badge:10px;

  /* elevation */
  --zp-shadow-bubble-self:0 6px 12px rgba(2,106,253,.20);
  --zp-shadow-bubble-other:0 6px 12px rgba(0,0,0,.04);
  --zp-shadow-bubble-inner:0 -1px 0 -1px rgba(255,255,255,.20);
  --zp-shadow-composer:0 -5px 15px rgba(0,0,0,.04);
  --zp-shadow-send:0 4px 10px rgba(2,106,253,.35);
  --zp-shadow-thumb:0 2px 4px rgba(0,0,0,.10);
  --zp-shadow-fab:0 4px 12px rgba(2,106,253,.30);

  /* blur */
  --zp-blur-appbar:10px; --zp-blur-composer:12px;

  /* motion */
  --zp-dur-150:150ms; --zp-dur-200:200ms; --zp-dur-250:250ms;
  --zp-dur-300:300ms; --zp-dur-500:500ms; --zp-dur-1200:1200ms; --zp-dur-2000:2000ms;
  --zp-dur-3000:3000ms;
  --zp-ease-out:cubic-bezier(0,0,.58,1);        /* Curves.easeOut */
  --zp-ease-out-cubic:cubic-bezier(.215,.61,.355,1);
  --zp-ease-in-out-cubic:cubic-bezier(.645,.045,.355,1);
  --zp-ease-out-back:cubic-bezier(.175,.885,.32,1.275);

  /* layout */
  --zp-chat-row-h:84px;            /* 12+60+12 */
  --zp-chat-avatar:60px;
  --zp-chat-list-pad-x:24px;
  --zp-status-dot:12px;
  --zp-online-dot:14px;
  --zp-unread-pill-h:16px;
  --zp-search-pad:16px;
  --zp-search-h:48px;
  --zp-room-strip-h:112px;
  --zp-room-card-w:72px;
  --zp-room-avatar:66px;
  --zp-nav-h:60px;
  --zp-nav-icon:26px;
  --zp-fab:56px;
  --zp-bubble-maxw:75vw;
  --zp-bubble-pad-x:16px;
  --zp-bubble-pad-y:10px;
  --zp-bubble-tail:4px;
  --zp-msg-avatar:32px;            /* MessageBubble only */
  --zp-input-pill-minh:46px;
  --zp-input-pill-maxh:150px;
  --zp-input-pad-x:16px;
  --zp-input-pad-y:11px;
  --zp-composer-h:68px;            /* 10+46+12 (+ safe area) */
  --zp-send:42px;
  --zp-chip:40px;
  --zp-emoji-picker-h:320px;
  --zp-emoji-cell:26px;
  --zp-staged-thumb:80px;
  --zp-staged-strip-h:85px;
  --zp-icebreaker-card:150x90px;
  --zp-group-avatar:45px;          /* radius */
}
```

```css
/* text styles */
.zp-t1{font-size:22px;font-weight:700;line-height:1.2}
.zp-t2{font-size:20px;font-weight:700;line-height:1.2}       /* w700 sheets */
.zp-t3{font-size:18px;font-weight:700;line-height:1.2}
.zp-t4{font-size:16px;font-weight:700;line-height:1.25}      /* list names/appbar */
.zp-t4s{font-size:16px;font-weight:600;line-height:1.25}
.zp-t5{font-size:15px;font-weight:400;line-height:1.3}       /* composer input */
.zp-t5b{font-size:15px;font-weight:700;letter-spacing:.3px;line-height:1.2}
.zp-body{font-size:14px;font-weight:400;line-height:1.43}    /* message text default */
.zp-body-14_5{font-size:14.5px;font-weight:400;line-height:1.38}
.zp-status{font-size:14px;font-weight:600;line-height:1.2}
.zp-t13{font-size:13px;font-weight:400;line-height:1.38}
.zp-t125{font-size:12.5px;font-weight:700;letter-spacing:.1px;line-height:1.3}
.zp-caption{font-size:12px;font-weight:400;line-height:1.33}
.zp-caption-600{font-size:12px;font-weight:600;line-height:1.33}
.zp-reply-body{font-size:11.5px;font-weight:400;line-height:1.3}
.zp-micro{font-size:11px;font-weight:700;line-height:1.27}
.zp-nav{font-size:11px;line-height:1.27}                     /* w600 active / w400 idle */
.zp-badge{font-size:10px;font-weight:700;line-height:1.2}
.zp-system{font-size:12px;font-weight:600;line-height:1.33}
.zp-emoji-xl{font-size:48px;line-height:1.1}
.zp-emoji-lg{font-size:38px;line-height:1.1}
.zp-emoji-md{font-size:32px;line-height:1.1}
.zp-emoji-sm{font-size:26px;line-height:1.1}
```

---

## 8. Implementation traps (must be preserved or consciously fixed)

1. `Chat.fromJson` sets `unreadCount: 0`, so unread tint/pill and nav badge are always zero.
2. Cache key mismatch (`cached_chats` vs `cached_chats_<userId>`; `cached_messages_<chatId>` vs `cached_messages_<chatId><userId>`).
3. Chat list bubble has **no avatar and no timestamp**; `MessageBubble` (with avatar) is dead code for these screens.
4. Long-press menu has react + reply only.
5. `_scrollToMessageIndex` uses `index*80` against a reversed list → scrolls to the wrong place.
6. Typing WS event is emitted on every character change (no debounce) and cleared after 5 s; list-screen typing clears after 3 s.
7. Room carousel is infinitely repeating horizontally and takes 112 px even with 1 room.
8. Emoji picker uses a 5-category short list while `_emojiCategories` (8 categories) is unused.
9. Self bubble uses a flat gradient `#026AFD → #026AFD` (i.e. solid) plus a 1 px inner white highlight at the top (`spreadRadius −1`).
10. Chat app bar is not an `AppBar`: it is a blurred 70 % translucent container, so content scrolls under it (list is inside `Expanded`, so in practice it does not).
