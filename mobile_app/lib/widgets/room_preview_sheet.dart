import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/room.dart';
import '../services/room_service.dart';
import '../screens/room_chat_screen.dart';

class RoomPreviewSheet extends StatefulWidget {
  final Room room;
  final VoidCallback onJoinSuccess;

  const RoomPreviewSheet({
    super.key,
    required this.room,
    required this.onJoinSuccess,
  });

  @override
  State<RoomPreviewSheet> createState() => _RoomPreviewSheetState();
}

class _RoomPreviewSheetState extends State<RoomPreviewSheet> {
  bool _isLoading = true;
  String? _error;
  List<dynamic> _previewMessages = [];
  int _memberCount = 0;
  bool _isJoined = false;
  late Room _detailedRoom;

  @override
  void initState() {
    super.initState();
    _detailedRoom = widget.room;
    _memberCount = widget.room.currentMembers;
    _isJoined = widget.room.isJoined;
    _loadRoomDetails();
  }

  Future<void> _loadRoomDetails() async {
    try {
      final data = await RoomService.getRoomDetails(widget.room.id);
      if (mounted) {
        setState(() {
          _previewMessages = data['preview_messages'] as List? ?? [];
          _memberCount = data['member_count'] is int 
              ? data['member_count'] 
              : int.tryParse(data['member_count']?.toString() ?? '0') ?? 0;
          _isJoined = data['is_joined'] == true;
          if (data['room'] != null) {
            _detailedRoom = Room.fromJson(data['room']);
          }
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load details';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleJoin() async {
    setState(() => _isLoading = true);
    try {
      await RoomService.joinRoom(_detailedRoom.id);
      widget.onJoinSuccess();
      
      if (mounted) {
        Navigator.pop(context); // Dismiss sheet
        
        // Push premium RoomChatScreen
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => RoomChatScreen(roomId: _detailedRoom.id),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        String errMsg = e.toString().replaceAll('Exception: ', '');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errMsg),
            backgroundColor: const Color(0xFFFF453A),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isFull = _detailedRoom.currentMembers >= _detailedRoom.maxMembers;
    final isTrending = _detailedRoom.isTrending || _memberCount >= 10;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.only(top: 8, bottom: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 44,
            height: 5,
            decoration: BoxDecoration(
              color: isDark ? Colors.grey.shade800 : Colors.grey.shade300,
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          const SizedBox(height: 16),
          
          if (_isLoading && _previewMessages.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00AEEF)),
              ),
            )
          else if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Text(
                _error!,
                style: const TextStyle(color: Colors.grey),
              ),
            )
          else ...[
            // Room Header Info
            ListTile(
              leading: Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isDark ? Colors.grey.shade900 : Colors.grey.shade100,
                  border: Border.all(color: isDark ? Colors.grey.shade800 : Colors.grey.shade200, width: 1),
                ),
                child: ClipOval(
                  child: CachedNetworkImage(
                    imageUrl: _detailedRoom.avatarUrl,
                    fit: BoxFit.cover,
                    errorWidget: (context, url, error) => Container(
                      color: const Color(0xFF00AEEF).withValues(alpha: 0.1),
                      alignment: Alignment.center,
                      child: Text(
                        _detailedRoom.name[0].toUpperCase(),
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF00AEEF)),
                      ),
                    ),
                  ),
                ),
              ),
              title: Row(
                children: [
                  Expanded(
                    child: Text(
                      _detailedRoom.name,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: isDark ? Colors.white : Colors.black,
                      ),
                    ),
                  ),
                  if (isTrending)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: isDark ? Colors.orange.withOpacity(0.12) : Colors.orange.shade50,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: isDark ? Colors.orange.withOpacity(0.3) : Colors.orange.shade200, width: 0.5),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('🔥', style: TextStyle(fontSize: 12)),
                          SizedBox(width: 2),
                          Text(
                            'Trending',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.orange,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              subtitle: Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  '👥 $_memberCount / ${_detailedRoom.maxMembers} members • Category: ${_detailedRoom.category.toUpperCase()}',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                  ),
                ),
              ),
            ),

            const SizedBox(height: 12),

            // Description
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                _detailedRoom.description,
                textAlign: TextAlign.left,
                style: TextStyle(
                  fontSize: 14,
                  color: isDark ? Colors.grey.shade300 : Colors.black54,
                  height: 1.3,
                ),
              ),
            ),

            const SizedBox(height: 12),

            // Tags Chips List
            if (_detailedRoom.tags.isNotEmpty)
              Container(
                height: 32,
                margin: const EdgeInsets.symmetric(vertical: 4),
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  itemCount: _detailedRoom.tags.length,
                  itemBuilder: (context, index) {
                    final tag = _detailedRoom.tags[index];
                    return Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFF00AEEF).withValues(alpha: 0.06),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: const Color(0xFF00AEEF).withValues(alpha: 0.15),
                          width: 0.5,
                        ),
                      ),
                      child: Text(
                        '#$tag',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF00AEEF),
                        ),
                      ),
                    );
                  },
                ),
              ),

            const SizedBox(height: 20),

            // Live Chat Preview Section (Blurred last 3 messages)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.symmetric(horizontal: 20),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade50,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: isDark ? Colors.grey.shade800 : Colors.grey.shade200, width: 0.5),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.blur_on_rounded, size: 18, color: isDark ? Colors.grey.shade400 : Colors.grey),
                      const SizedBox(width: 6),
                      Text(
                        '💬 Live Room Preview',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.grey.shade400 : Colors.grey,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  
                  if (_previewMessages.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Text(
                        'No messages in this room yet. Be the first to start the vibe!',
                        style: TextStyle(fontSize: 13, color: isDark ? Colors.grey.shade400 : Colors.grey, fontStyle: FontStyle.italic),
                      ),
                    )
                  else
                    ..._previewMessages.map((m) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${m['sender_name']}: ',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: isDark ? Colors.white70 : Colors.black87,
                              ),
                            ),
                            Expanded(
                              child: Stack(
                                children: [
                                  // The text is partially visible but blurred
                                  Text(
                                    m['content']?.toString() ?? '',
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: isDark ? Colors.grey.shade300 : Colors.black54,
                                    ),
                                  ),
                                  // Blur filter overlay
                                  Positioned.fill(
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(4),
                                      child: BackdropFilter(
                                        filter: ImageFilter.blur(sigmaX: 4.5, sigmaY: 4.5),
                                        child: Container(
                                          color: Colors.transparent,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Action Buttons
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                children: [
                  if (_isJoined)
                    ElevatedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => RoomChatScreen(roomId: _detailedRoom.id),
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF00AEEF),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.chat_bubble_outline_rounded, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Open Chat Room',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    )
                  else
                    ElevatedButton(
                      onPressed: isFull ? null : _handleJoin,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isFull ? Colors.grey : const Color(0xFF00AEEF),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            isFull ? Icons.lock_outline : Icons.login_rounded,
                            size: 20,
                          ),
                          SizedBox(width: 8),
                          Text(
                            isFull ? 'Room is Full' : 'Join Room & Start Chatting',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: Text(
                      'Maybe Later',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.grey.shade400 : Colors.grey,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
