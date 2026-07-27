import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

/// Displays a post card in the feed or as a standalone widget.
class PostCard extends StatelessWidget {
  final String userName;
  final String? userAvatar;
  final String content;
  final String? category;
  final String distance;
  final String timeAgo;
  final bool isOwnPost;
  final VoidCallback? onTap;

  const PostCard({
    super.key,
    required this.userName,
    this.userAvatar,
    required this.content,
    this.category,
    required this.distance,
    required this.timeAgo,
    this.isOwnPost = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1C1C1E) : Colors.grey[50],
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? const Color(0xFF2C2C2E) : Colors.grey[200]!,
          ),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: const Color(0xFF026AFD).withValues(alpha: 0.1),
                  child: userAvatar != null && userAvatar!.isNotEmpty
                      ? ClipOval(
                          child: CachedNetworkImage(
                            imageUrl: userAvatar!,
                            width: 48,
                            height: 48,
                            fit: BoxFit.cover,
                            errorWidget: (context, url, error) =>
                                _buildInitialAvatar(userName),
                          ),
                        )
                      : _buildInitialAvatar(userName),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        userName,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.white : Colors.black,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '$distance \u00b7 $timeAgo',
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (category != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF2C2C2E) : Colors.grey[200],
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  category!,
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? Colors.white : Colors.black,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 12),
            Text(
              content,
              style: TextStyle(
                fontSize: 15,
                color: isDark ? Colors.grey[300] : const Color(0xFF333333),
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInitialAvatar(String name) {
    return Center(
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.bold,
          color: Color(0xFF026AFD),
        ),
      ),
    );
  }
}
