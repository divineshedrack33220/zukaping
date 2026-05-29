import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/room.dart';
import 'room_preview_sheet.dart';

class RoomCarousel extends StatefulWidget {
  final List<Room> rooms;
  final VoidCallback onRefresh;

  const RoomCarousel({
    super.key,
    required this.rooms,
    required this.onRefresh,
  });

  @override
  State<RoomCarousel> createState() => _RoomCarouselState();
}

class _RoomCarouselState extends State<RoomCarousel> {
  late ScrollController _scrollController;

  @override
  void initState() {
    super.initState();
    // Use large initial index to allow infinite circular scroll in both directions
    const initialMultiplier = 100;
    final initialOffset = widget.rooms.isNotEmpty 
        ? (widget.rooms.length * initialMultiplier) * (72.0 + 16.0) 
        : 0.0;
    _scrollController = ScrollController(initialScrollOffset: initialOffset);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.rooms.isEmpty) {
      return const SizedBox.shrink();
    }
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 16, top: 12, bottom: 8),
          child: DefaultTextStyle(
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
              letterSpacing: 0.3,
            ),
            child: Row(
              children: [
                const Text('🔥 Public Rooms Discovery'),
                const SizedBox(width: 4),
                Icon(Icons.explore_outlined, size: 16, color: const Color(0xFF00AEEF)),
              ],
            ),
          ),
        ),
        SizedBox(
          height: 112,
          child: ListView.builder(
            controller: _scrollController,
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemBuilder: (context, index) {
              final roomIndex = index % widget.rooms.length;
              final room = widget.rooms[roomIndex];
              return _RoomCard(
                room: room,
                onTap: () {
                  _showRoomPreview(context, room);
                },
              );
            },
          ),
        ),
        Divider(height: 1, color: isDark ? const Color(0xFF2C2C2E) : const Color(0xFFEEEEEE)),
      ],
    );
  }

  void _showRoomPreview(BuildContext context, Room room) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => RoomPreviewSheet(
        room: room,
        onJoinSuccess: widget.onRefresh,
      ),
    );
  }
}

class _RoomCard extends StatefulWidget {
  final Room room;
  final VoidCallback onTap;

  const _RoomCard({
    required this.room,
    required this.onTap,
  });

  @override
  State<_RoomCard> createState() => _RoomCardState();
}

class _RoomCardState extends State<_RoomCard> with SingleTickerProviderStateMixin {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final room = widget.room;
    final isFull = room.isFull;
    final isJoined = room.isJoined;
    final isTrending = room.isTrending || room.currentMembers >= 10;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) => setState(() => _isPressed = false),
      onTapCancel: () => setState(() => _isPressed = false),
      onTap: widget.onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOut,
        width: 72,
        margin: const EdgeInsets.only(right: 16),
        transform: Matrix4.diagonal3Values(_isPressed ? 0.95 : 1.0, _isPressed ? 0.95 : 1.0, 1.0),
        child: Column(
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                // Avatar background/ring logic
                Container(
                  width: 66,
                  height: 66,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isJoined 
                          ? const Color(0xFF00AEEF) 
                          : (isDark ? Colors.grey.shade800 : Colors.grey.shade200),
                      width: isJoined ? 2.5 : 1.5,
                    ),
                    boxShadow: isJoined
                        ? [
                            BoxShadow(
                              color: const Color(0xFF00AEEF).withValues(alpha: 0.2),
                              blurRadius: 6,
                              spreadRadius: 1,
                            )
                          ]
                        : null,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(2.0),
                    child: Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isDark ? const Color(0xFF1C1C1E) : const Color(0xFFF5F5F5),
                      ),
                      child: ClipOval(
                        child: CachedNetworkImage(
                          imageUrl: room.avatarUrl,
                          fit: BoxFit.cover,
                          placeholder: (context, url) => Container(
                            color: isDark ? const Color(0xFF1C1C1E) : Colors.grey.shade100,
                            alignment: Alignment.center,
                            child: const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 1.5,
                                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00AEEF)),
                              ),
                            ),
                          ),
                          errorWidget: (context, url, error) => Container(
                            color: const Color(0xFF00AEEF).withValues(alpha: 0.1),
                            alignment: Alignment.center,
                            child: Text(
                              room.name.isNotEmpty ? room.name[0].toUpperCase() : 'R',
                              style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF00AEEF),
                                ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                // Grey overlay if room is capacity reached / locked
                if (isFull && !isJoined)
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.black.withValues(alpha: 0.35),
                      ),
                      child: const Icon(
                        Icons.lock_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  ),

                // Green pulse dot if room has users active and user hasn't joined yet
                if (!isJoined && !isFull && room.currentMembers > 0)
                  Positioned(
                    bottom: 2,
                    right: 2,
                    child: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: const Color(0xFF34C759),
                        shape: BoxShape.circle,
                        border: Border.all(color: isDark ? const Color(0xFF121212) : Colors.white, width: 2),
                      ),
                    ),
                  ),

                // Blue joined checkmark badge
                if (isJoined)
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.all(1.5),
                      decoration: const BoxDecoration(
                        color: Color(0xFF00AEEF),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check_rounded,
                        color: Colors.white,
                        size: 11,
                      ),
                    ),
                  ),

                // Trending hot flame badge
                if (isTrending)
                  Positioned(
                    top: -1,
                    right: -1,
                    child: Container(
                      padding: const EdgeInsets.all(2.5),
                      decoration: const BoxDecoration(
                        color: Colors.deepOrange,
                        shape: BoxShape.circle,
                      ),
                      child: const Text(
                        '🔥',
                        style: TextStyle(fontSize: 10),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              room.name,
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isJoined ? FontWeight.w700 : FontWeight.w500,
                color: isJoined ? const Color(0xFF00AEEF) : (isDark ? Colors.white : Colors.black87),
                height: 1.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
