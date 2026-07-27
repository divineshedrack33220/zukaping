import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

/// A chat message bubble for use in 1:1 and group chats.
class MessageBubble extends StatelessWidget {
  final String content;
  final String senderName;
  final String? senderAvatar;
  final bool isSelf;
  final bool isSystem;
  final DateTime? createdAt;
  final Map<String, String>? reactions;

  const MessageBubble({
    super.key,
    required this.content,
    required this.senderName,
    this.senderAvatar,
    this.isSelf = false,
    this.isSystem = false,
    this.createdAt,
    this.reactions,
  });

  @override
  Widget build(BuildContext context) {
    if (isSystem) {
      return Center(
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 8),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            content,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.grey.shade600,
            ),
          ),
        ),
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment:
            isSelf ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!isSelf) ...[
            _buildAvatar(isDark),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment:
                  isSelf ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                if (!isSelf)
                  Padding(
                    padding: const EdgeInsets.only(left: 4, bottom: 2),
                    child: Text(
                      senderName,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: isDark
                            ? Colors.grey.shade400
                            : Colors.grey.shade600,
                      ),
                    ),
                  ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isSelf
                        ? const Color(0xFF026AFD)
                        : (isDark
                            ? const Color(0xFF1C1C1E)
                            : Colors.grey.shade100),
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isSelf ? 16 : 4),
                      bottomRight: Radius.circular(isSelf ? 4 : 16),
                    ),
                  ),
                  child: Text(
                    content,
                    style: TextStyle(
                      color: isSelf
                          ? Colors.white
                          : (isDark ? Colors.white : Colors.black87),
                      fontSize: 14.5,
                    ),
                  ),
                ),
                if (reactions != null && reactions!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Wrap(
                      spacing: 4,
                      children: reactions!.entries
                          .map((e) => Text(e.value, style: const TextStyle(fontSize: 16)))
                          .toList(),
                    ),
                  ),
              ],
            ),
          ),
          if (isSelf) ...[
            const SizedBox(width: 8),
            _buildAvatar(isDark),
          ],
        ],
      ),
    );
  }

  Widget _buildAvatar(bool isDark) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isDark ? const Color(0xFF2C2C2E) : Colors.grey.shade100,
      ),
      child: ClipOval(
        child: senderAvatar != null && senderAvatar!.isNotEmpty
            ? CachedNetworkImage(
                imageUrl: senderAvatar!,
                fit: BoxFit.cover,
                errorWidget: (context, url, error) => _buildInitial(),
              )
            : _buildInitial(),
      ),
    );
  }

  Widget _buildInitial() {
    return Container(
      color: const Color(0xFF026AFD).withOpacity(0.1),
      alignment: Alignment.center,
      child: Text(
        senderName.isNotEmpty ? senderName[0].toUpperCase() : '?',
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.bold,
          color: Color(0xFF026AFD),
        ),
      ),
    );
  }
}
