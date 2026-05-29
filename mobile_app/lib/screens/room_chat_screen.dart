import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import '../services/room_service.dart';
import '../services/sound_service.dart';
import '../models/message.dart';
import '../models/room.dart';
import 'package:shared_preferences/shared_preferences.dart';

class RoomChatScreen extends StatefulWidget {
  final String roomId;

  const RoomChatScreen({super.key, required this.roomId});

  @override
  State<RoomChatScreen> createState() => _RoomChatScreenState();
}

class _RoomChatScreenState extends State<RoomChatScreen> with WidgetsBindingObserver {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final ImagePicker _picker = ImagePicker();
  final FocusNode _focusNode = FocusNode();

  List<Message> _messages = [];
  bool _isLoading = true;
  bool _isTyping = false;
  String? _currentUserId;
  
  // Room metadata
  String _roomName = 'Room Chat';
  String? _roomAvatar;
  String _roomDescription = '';
  int _memberCount = 0;
  
  StreamSubscription<Map<String, dynamic>>? _wsSubscription;
  Timer? _typingTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeRoomChat();
    _setupWebSocket();
    
    _messageController.addListener(() {
      setState(() {});
      _handleTyping();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _wsSubscription?.cancel();
    _typingTimer?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _initializeRoomChat() async {
    final token = await ApiService.getToken();
    if (token == null) return;

    WebSocketService.connect();

    try {
      final parts = token.split('.');
      if (parts.length == 3) {
        final payload = json.decode(utf8.decode(base64.decode(base64.normalize(parts[1]))));
        _currentUserId = payload['userId'] ?? payload['sub'] ?? payload['id'];
      }
    } catch (_) {
      // JWT decode failed; _currentUserId remains null
    }

    await _loadRoomMetadata();
    _loadMessages();
  }

  Future<void> _loadRoomMetadata() async {
    try {
      final data = await RoomService.getRoomDetails(widget.roomId);
      if (mounted && data['room'] != null) {
        final room = Room.fromJson(data['room']);
        setState(() {
          _roomName = room.name;
          _roomAvatar = room.avatarUrl;
          _roomDescription = room.description;
          _memberCount = room.currentMembers;
        });
      }
    } catch (e) {
      // metadata load failure is non-critical; room will show with defaults
    }
  }

  Future<void> _loadMessages() async {
    // Fast cache load
    try {
      final prefs = await SharedPreferences.getInstance();
      final cached = prefs.getString('cached_messages_${widget.roomId}');
      if (cached != null) {
        final decoded = jsonDecode(cached);
        if (decoded is List && mounted) {
          setState(() {
            _messages = decoded.cast<Map<String, dynamic>>().map((m) => Message.fromJson(m)).toList().reversed.toList();
            _isLoading = false;
          });
          _scrollToBottom();
        }
      }
    } catch (_) {
      // cache miss is fine; will fall through to network load
    }

    // Network load
    try {
      final messages = await ApiService.getMessages(widget.roomId);
      if (mounted) {
        setState(() {
          _messages = messages.map((m) => Message.fromJson(m)).toList().reversed.toList();
          _isLoading = false;
        });
        _scrollToBottom();
      }
    } catch (e) {
      if (mounted && _messages.isEmpty) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _setupWebSocket() {
    // Subscribe to standard real-time chat channel (using room ID as chat ID)
    WebSocketService.send({
      'type': 'subscribe_chat',
      'payload': {'chatId': widget.roomId},
    });

    _wsSubscription = WebSocketService.stream.listen((data) {
      final type = data['type'];
      final payload = data['payload'];
      if (!mounted) return;

      switch (type) {
        case 'new_message':
          if (payload?['chatId'] == widget.roomId) {
            final message = Message.fromJson(payload!);
            setState(() {
              // De-duplicate optimistic messages
              final tempIndex = _messages.indexWhere((m) => m.id.startsWith('opt_') && m.content == message.content);
              if (tempIndex != -1) {
                _messages[tempIndex] = message;
              } else {
                _messages.insert(0, message);
              }
            });
            _scrollToBottom();
            if (message.senderId != _currentUserId) {
              SoundService.playReceived();
              _sendReadReceipt([message.id]);
            }
          }
          break;

        case 'room_update':
          if (payload?['roomId'] == widget.roomId) {
            setState(() {
              _memberCount = payload['currentMembers'] is int 
                  ? payload['currentMembers'] 
                  : int.tryParse(payload['currentMembers']?.toString() ?? '0') ?? 0;
            });
          }
          break;

        case 'typing_start':
          if (payload?['chatId'] == widget.roomId && payload?['userId'] != _currentUserId) {
            setState(() => _isTyping = true);
            _typingTimer?.cancel();
            _typingTimer = Timer(const Duration(seconds: 5), () => setState(() => _isTyping = false));
          }
          break;

        case 'typing_end':
          if (payload?['chatId'] == widget.roomId) {
            setState(() => _isTyping = false);
          }
          break;

        case 'message_reaction':
          final msgId = payload?['messageId'];
          final reactions = payload?['reactions'];
          if (msgId != null && reactions != null) {
            setState(() {
              final idx = _messages.indexWhere((m) => m.id == msgId);
              if (idx != -1) {
                final m = _messages[idx];
                _messages[idx] = Message(
                  id: m.id,
                  senderId: m.senderId,
                  content: m.content,
                  type: m.type,
                  createdAt: m.createdAt,
                  isRead: m.isRead,
                  reactions: Map<String, String>.from(reactions),
                );
              }
            });
          }
          break;
      }
    });
  }

  void _handleTyping() {
    if (_messageController.text.isNotEmpty) {
      WebSocketService.send({'type': 'typing_start', 'payload': {'chatId': widget.roomId}});
    } else {
      WebSocketService.send({'type': 'typing_end', 'payload': {'chatId': widget.roomId}});
    }
  }

  void _sendReadReceipt(List<String> ids) {
    WebSocketService.send({'type': 'message_read', 'payload': {'chatId': widget.roomId, 'messageIds': ids}});
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _currentUserId == null) return;

    _messageController.clear();

    final optimisticMsg = Message(
      id: 'opt_${DateTime.now().millisecondsSinceEpoch}',
      senderId: _currentUserId!,
      content: text,
      type: 'text',
      createdAt: DateTime.now(),
    );

    setState(() {
      _messages.insert(0, optimisticMsg);
    });
    _scrollToBottom();
    SoundService.playSent();

    try {
      await ApiService.sendMessage(widget.roomId, text);
    } catch (e) {
      if (mounted) {
        setState(() => _messages.removeWhere((m) => m.id == optimisticMsg.id));
      }
      _showToast('Failed to send message');
    }
  }

  Future<void> _sendImage() async {
    try {
      final XFile? image = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
      if (image == null || _currentUserId == null) return;

      final optimisticMsg = Message(
        id: 'opt_img_${DateTime.now().millisecondsSinceEpoch}',
        senderId: _currentUserId!,
        content: '[Image uploading...]',
        type: 'image',
        createdAt: DateTime.now(),
      );

      setState(() {
        _messages.insert(0, optimisticMsg);
      });
      _scrollToBottom();
      SoundService.playSent();

      final url = await ApiService.uploadImage(image, image.name);
      if (url != null) {
        await ApiService.sendMessage(widget.roomId, jsonEncode([url]), type: 'image');
        setState(() {
          _messages.removeWhere((m) => m.id == optimisticMsg.id);
        });
      } else {
        throw Exception('Upload error');
      }
    } catch (e) {
      _showToast('Failed to upload photo');
    }
  }

  Future<void> _handleLeaveRoom() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Leave $_roomName?'),
        content: const Text("You'll stop receiving messages."),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false), 
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true), 
            child: const Text('Leave', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await RoomService.leaveRoom(widget.roomId);
        _showToast('Left "$_roomName" successfully');
        if (mounted) {
          Navigator.pop(context); // Go back to chats list
        }
      } catch (e) {
        _showToast('Failed to leave room');
      }
    }
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.jumpTo(0.0);
    }
  }

  void _showToast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: isDark ? Colors.white : Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.grey.shade100,
              ),
              child: ClipOval(
                child: _roomAvatar != null
                    ? CachedNetworkImage(imageUrl: _roomAvatar!, fit: BoxFit.cover)
                    : Container(
                        color: const Color(0xFF00AEEF).withValues(alpha: 0.1),
                        alignment: Alignment.center,
                        child: Text(
                          _roomName.isNotEmpty ? _roomName[0].toUpperCase() : 'R',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF00AEEF)),
                        ),
                      ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    _roomName,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Color(0xFF34C759),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '👥 $_memberCount members online',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_horiz_rounded, color: Colors.black87),
            onSelected: (value) {
              if (value == 'leave') {
                _handleLeaveRoom();
              }
            },
            itemBuilder: (BuildContext context) => [
              const PopupMenuItem<String>(
                value: 'leave',
                child: Row(
                  children: [
                    Icon(Icons.logout_rounded, color: Colors.red, size: 20),
                    SizedBox(width: 8),
                    Text('Leave Room', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // Info banner detailing rules/description
          if (_roomDescription.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: const Color(0xFF00AEEF).withValues(alpha: 0.04),
              child: Text(
                '💡 Info: $_roomDescription',
                style: const TextStyle(fontSize: 12, color: Colors.black54, height: 1.2),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          
          // Messages list
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00AEEF)),
                    ),
                  )
                : _messages.isEmpty
                    ? _buildEmptyState()
                    : _buildMessagesList(),
          ),
          
          if (_isTyping)
            Container(
              alignment: Alignment.centerLeft,
              padding: const EdgeInsets.only(left: 24, bottom: 8),
              child: Text(
                'Someone is typing...',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade500, fontStyle: FontStyle.italic),
              ),
            ),
            
          // Text Input bar
          _buildInputBar(),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('🌱', style: TextStyle(fontSize: 50)),
          const SizedBox(height: 12),
          Text(
            'Welcome to $_roomName!',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              'Be respectful, vibe out, and say hi to the room members!',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Colors.grey),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessagesList() {
    return ListView.builder(
      controller: _scrollController,
      reverse: true,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: _messages.length,
      itemBuilder: (context, index) {
        final m = _messages[index];
        final isSelf = m.senderId == _currentUserId;
        final isSystem = m.type == 'system';

        if (isSystem) {
          return Center(
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200, width: 0.5),
              ),
              child: Text(
                m.content,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey.shade600,
                ),
              ),
            ),
          );
        }

        return _RoomMessageBubble(
          message: m,
          isSelf: isSelf,
        );
      },
    );
  }

  Widget _buildInputBar() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
        border: Border(top: BorderSide(color: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade200)),
      ),
      child: SafeArea(
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.photo_library_outlined, color: Color(0xFF00AEEF)),
              onPressed: _sendImage,
            ),
            Expanded(
              child: TextField(
                controller: _messageController,
                focusNode: _focusNode,
                textCapitalization: TextCapitalization.sentences,
                style: TextStyle(color: isDark ? Colors.white : Colors.black),
                decoration: InputDecoration(
                  hintText: 'Type your message...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                  filled: true,
                  fillColor: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade100,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: _messageController.text.trim().isNotEmpty ? _sendMessage : null,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _messageController.text.trim().isNotEmpty
                      ? const Color(0xFF00AEEF)
                      : (isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade200),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.send_rounded,
                  color: _messageController.text.trim().isNotEmpty ? Colors.white : (isDark ? Colors.grey.shade600 : Colors.grey.shade400),
                  size: 20,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoomMessageBubble extends StatelessWidget {
  final Message message;
  final bool isSelf;

  const _RoomMessageBubble({
    required this.message,
    required this.isSelf,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final senderName = message.senderName ?? 'User';
    final senderAvatar = message.senderAvatar;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: isSelf ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!isSelf) ...[
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade100,
              ),
              child: ClipOval(
                child: senderAvatar != null
                    ? CachedNetworkImage(imageUrl: senderAvatar, fit: BoxFit.cover)
                    : Container(
                        color: const Color(0xFF00AEEF).withValues(alpha: 0.1),
                        alignment: Alignment.center,
                        child: Text(
                          senderName.isNotEmpty ? senderName[0].toUpperCase() : '?',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF00AEEF)),
                        ),
                      ),
              ),
            ),
            const SizedBox(width: 8),
          ],
          
          Flexible(
            child: Column(
              crossAxisAlignment: isSelf ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                if (!isSelf)
                  Padding(
                    padding: const EdgeInsets.only(left: 4, bottom: 2),
                    child: Text(
                      senderName,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                      ),
                    ),
                  ),
                
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isSelf ? const Color(0xFF00AEEF) : (isDark ? const Color(0xFF1C1C1E) : Colors.grey.shade100),
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isSelf ? 16 : 4),
                      bottomRight: Radius.circular(isSelf ? 4 : 16),
                    ),
                  ),
                  child: message.type == 'image'
                      ? _buildImageContent(context)
                      : Text(
                          message.content,
                          style: TextStyle(
                            color: isSelf ? Colors.white : (isDark ? Colors.white : Colors.black87),
                            fontSize: 14.5,
                          ),
                        ),
                ),
              ],
            ),
          ),
          
          if (isSelf) ...[
            const SizedBox(width: 8),
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade100,
              ),
              child: ClipOval(
                child: senderAvatar != null
                    ? CachedNetworkImage(imageUrl: senderAvatar, fit: BoxFit.cover)
                    : Container(
                        color: const Color(0xFF00AEEF).withValues(alpha: 0.1),
                        alignment: Alignment.center,
                        child: Text(
                          senderName.isNotEmpty ? senderName[0].toUpperCase() : '?',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF00AEEF)),
                        ),
                      ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildImageContent(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    try {
      final List<dynamic> urls = jsonDecode(message.content) as List;
      if (urls.isNotEmpty) {
        return ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: CachedNetworkImage(
            imageUrl: urls[0].toString(),
            placeholder: (context, url) => Container(
              width: 200,
              height: 150,
              color: isDark ? const Color(0xFF1C1C1E) : Colors.grey.shade200,
              child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
            ),
            errorWidget: (context, url, error) => const SizedBox(
              width: 200,
              height: 150,
              child: Icon(Icons.broken_image, color: Colors.grey),
            ),
          ),
        );
      }
    } catch (_) {}
    return const Text('[Image Content]');
  }
}
