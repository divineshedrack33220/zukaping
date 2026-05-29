import "dart:convert";
import "dart:ui" as ui;
import "package:http/http.dart" as http;
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../services/api_service.dart';
import '../services/sound_service.dart';
import '../models/profile_image.dart';

class ViewProfileScreen extends StatefulWidget {
  final String userId;

  const ViewProfileScreen({super.key, required this.userId});

  @override
  State<ViewProfileScreen> createState() => _ViewProfileScreenState();
}

class _ViewProfileScreenState extends State<ViewProfileScreen> {
  Map<String, dynamic>? _userData;
  bool _isLoading = true;
  bool _isFavorited = false;
  String? _error;
  int _currentPhotoIndex = 0;
  final PageController _pageController = PageController();
  List<ProfileImage> _profileImages = [];

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadFavorites();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    setState(() => _isLoading = true);

    try {
      final data = await ApiService.getUserProfile(widget.userId);
      if (mounted) {
        setState(() {
          _userData = data;
          _profileImages = (data['profile_images'] as List<dynamic>?)
                  ?.map((e) => ProfileImage.fromJson(e as Map<String, dynamic>))
                  .toList() ??
              [];
          _isLoading = false;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = 'This profile is no longer available';
          _userData = {
            'name': 'Unknown User',
            'status': 'offline',
            'bio': 'This profile is no longer available or has been deleted.',
          };
          _profileImages = [];
        });
      }
    }
  }

  Future<void> _loadFavorites() async {
    try {
      final favorites = await ApiService.getFavorites();
      if (mounted) {
        setState(() {
          // API may return 'targetUserId' or 'userId' depending on endpoint version
          _isFavorited = favorites.any((f) =>
              f['targetUserId'] == widget.userId ||
              f['userId'] == widget.userId ||
              f['id'] == widget.userId);
        });
      }
    } catch (e) {
      print('Error loading favorites: $e');
    }
  }

  Future<void> _toggleFavorite() async {
    try {
      await ApiService.toggleFavorite(widget.userId, currentlyFavorited: _isFavorited);
      if (mounted) {
        setState(() => _isFavorited = !_isFavorited);
        if (_isFavorited) {
          SoundService.playFavorite();
        }
        _showToast(_isFavorited ? 'Added to favorites' : 'Removed from favorites');
      }
    } catch (e) {
      _showToast('Failed to update favorite');
    }
  }

  Future<void> _startChat() async {
    if (_userData?['name'] == 'Unknown User') return;

    try {
      final result = await ApiService.createChat(widget.userId);
      final chatId = result['id'] ?? result['_id'];

      if (chatId != null) {
        _showToast('Chat created!');
        if (mounted) {
          Navigator.pushReplacementNamed(
            context,
            '/chat',
            arguments: {'chatId': chatId},
          );
        }
      }
    } catch (e) {
      _showToast('Failed to create chat');
    }
  }

  void _showToast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: const Color(0xFF00AEEF),
      ),
    );
  }

  void _openLightbox() {
    final photos = _getPhotos();
    if (photos.isEmpty) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => _PhotoLightbox(
          photos: photos,
          initialIndex: _currentPhotoIndex,
        ),
      ),
    );
  }

  List<String> _getPhotos() {
    if (_userData == null) return [];
    final photos = _userData!['photos'] as List<dynamic>?;
    final validPhotos = photos
            ?.map((e) => e.toString())
            .where((e) => e.isNotEmpty && !e.contains('Portrait_Placeholder.png'))
            .toList() ??
        [];
    if (validPhotos.isNotEmpty) {
      return validPhotos;
    }
    final avatar = _userData!['avatar'] as String?;
    if (avatar != null && avatar.isNotEmpty && !avatar.contains('Portrait_Placeholder.png')) {
      return [avatar];
    }
    return [];
  }

  String _formatDistance(dynamic distance) {
    if (distance == null) return '';
    if (distance is num) {
      return '${distance.toStringAsFixed(1)} km away';
    }
    return '$distance km away';
  }

  String _formatTime(dynamic timestamp) {
    if (timestamp == null) return '';
    final dateTime = timestamp is int
        ? DateTime.fromMillisecondsSinceEpoch(timestamp * 1000)
        : DateTime.parse(timestamp.toString());
    final diff = DateTime.now().difference(dateTime);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} minutes ago';
    return '${diff.inHours} hours ago';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: isDark ? Colors.white : Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
        title: null,
      ),
      body: _isLoading ? _buildShimmerLoading() : _buildContent(),
    );
  }

  Widget _buildShimmerLoading() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          // Photo carousel shimmer
          Container(
            width: double.infinity,
            height: 380,
            decoration: BoxDecoration(
              color: Colors.grey[200],
              borderRadius: BorderRadius.circular(20),
            ),
          ),
          const SizedBox(height: 44),
          // Name shimmer
          Container(
            width: 200,
            height: 32,
            decoration: BoxDecoration(
              color: Colors.grey[200],
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          const SizedBox(height: 16),
          // Bio shimmer
          Container(
            width: 280,
            height: 60,
            decoration: BoxDecoration(
              color: Colors.grey[200],
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          const SizedBox(height: 32),
          // Meta shimmer
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 100,
                height: 20,
                decoration: BoxDecoration(
                  color: Colors.grey[200],
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              const SizedBox(width: 32),
              Container(
                width: 100,
                height: 20,
                decoration: BoxDecoration(
                  color: Colors.grey[200],
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ],
          ),
          const SizedBox(height: 40),
          // Rating shimmer
          Container(
            width: 120,
            height: 28,
            decoration: BoxDecoration(
              color: Colors.grey[200],
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          const SizedBox(height: 40),
          // Chat button shimmer
          Container(
            width: double.infinity,
            height: 52,
            decoration: BoxDecoration(
              color: Colors.grey[200],
              borderRadius: BorderRadius.circular(26),
            ),
          ),
          const SizedBox(height: 24),
          // Secondary buttons shimmer
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              3,
              (index) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: Colors.grey[200],
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    if (_userData == null) {
      return Center(
        child: Text(_error ?? 'Profile not available'),
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveImages = _getEffectiveImages();
    final name = _userData!['name'] ?? 'Unknown User';
    final age = _userData!['age'];
    final bio = _userData!['bio'] ?? '';
    final status = _userData!['status'] ?? 'offline';
    final distance = _userData!['distance'];
    final rating = _userData!['rating'];
    final verified = _userData!['verified'] ?? false;
    final lastActive = _userData!['lastActive'];
    final interests = _userData!['interests'] as List<dynamic>?;
    final isUnknown = name == 'Unknown User';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          // Photo Carousel
          if (effectiveImages.isNotEmpty)
            Column(
              children: [
                Container(
                  height: 380,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: isDark ? const Color(0xFF2C2C2E) : Colors.grey[300]!),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: PageView.builder(
                      controller: _pageController,
                      onPageChanged: (index) {
                        setState(() => _currentPhotoIndex = index);
                      },
                      itemCount: effectiveImages.length,
                      itemBuilder: (context, index) {
                        final img = effectiveImages[index];
                        final isLocked = img.isExclusive && !img.isUnlocked;

                        return GestureDetector(
                          onTap: () => _onPhotoTap(img),
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              if (isLocked)
                                ImageFiltered(
                                  imageFilter: ui.ImageFilter.blur(sigmaX: 25, sigmaY: 25),
                                  child: CachedNetworkImage(
                                    imageUrl: img.url,
                                    fit: BoxFit.cover,
                                    placeholder: (context, url) => Container(
                                      color: isDark ? const Color(0xFF1C1C1E) : Colors.grey[200],
                                    ),
                                    errorWidget: (context, url, error) => Container(
                                      color: isDark ? const Color(0xFF2C2C2E) : Colors.grey[300],
                                      child: const Icon(Icons.person, size: 80, color: Colors.grey),
                                    ),
                                  ),
                                )
                              else
                                CachedNetworkImage(
                                  imageUrl: img.url,
                                  fit: BoxFit.cover,
                                  placeholder: (context, url) => Container(
                                    color: isDark ? const Color(0xFF1C1C1E) : Colors.grey[200],
                                  ),
                                  errorWidget: (context, url, error) => Container(
                                    color: isDark ? const Color(0xFF2C2C2E) : Colors.grey[300],
                                    child: const Icon(Icons.person, size: 80, color: Colors.grey),
                                  ),
                                ),
                              if (isLocked) ...[
                                Container(
                                  color: Colors.black.withValues(alpha: 0.35),
                                ),
                                Center(
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.all(16),
                                        decoration: BoxDecoration(
                                          color: Colors.black54,
                                          shape: BoxShape.circle,
                                          border: Border.all(color: Colors.white24, width: 1.5),
                                        ),
                                        child: const Icon(
                                          Icons.lock_rounded,
                                          color: Colors.white,
                                          size: 36,
                                        ),
                                      ),
                                      const SizedBox(height: 12),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                        decoration: BoxDecoration(
                                          color: Colors.deepOrange,
                                          borderRadius: BorderRadius.circular(20),
                                          boxShadow: [
                                            BoxShadow(
                                              color: Colors.black.withOpacity(0.3),
                                              blurRadius: 6,
                                              offset: const Offset(0, 2),
                                            ),
                                          ],
                                        ),
                                        child: const Text(
                                          '🔒 Exclusive Content',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 13,
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
                      },
                    ),
                  ),
                ),
                if (effectiveImages.length > 1) ...[
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      effectiveImages.length,
                      (index) => Container(
                        width: 8,
                        height: 8,
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: index == _currentPhotoIndex
                              ? const Color(0xFF00AEEF)
                              : (isDark ? const Color(0xFF2C2C2E) : Colors.grey[300]),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            )
          else
            Container(
              height: 380,
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1C1C1E) : Colors.grey[200],
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Center(
                child: Icon(Icons.person, size: 80, color: Colors.grey),
              ),
            ),

          const SizedBox(height: 32),

          // Name & Age
          Text(
            '$name${age != null ? ', $age' : ''}',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black,
            ),
            textAlign: TextAlign.center,
          ),

          if (bio.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              bio,
              style: TextStyle(
                fontSize: 16,
                color: isDark ? Colors.grey[400] : const Color(0xFF666666),
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
          ],

          const SizedBox(height: 24),

          // Distance & Status
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (distance != null)
                Text(
                  _formatDistance(distance),
                  style: TextStyle(
                    fontSize: 16,
                    color: isDark ? Colors.grey[400] : const Color(0xFF666666),
                  ),
                ),
              if (distance != null) const SizedBox(width: 16),
              Row(
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: status == 'available'
                          ? const Color(0xFF00AEEF)
                          : status == 'busy'
                              ? Colors.yellow
                              : Colors.red,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    status == 'available'
                        ? 'Available'
                        : status == 'busy'
                            ? 'Busy'
                            : 'Offline',
                    style: TextStyle(
                      fontSize: 16,
                      color: isDark ? Colors.grey[400] : const Color(0xFF666666),
                    ),
                  ),
                ],
              ),
            ],
          ),

          // Rating
          if (rating != null) ...[
            const SizedBox(height: 32),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.star, color: Color(0xFFFFD700), size: 24),
                const SizedBox(width: 8),
                Text(
                  '$rating',
                  style: TextStyle(
                    fontSize: 18,
                    color: isDark ? Colors.white : Colors.black,
                  ),
                ),
                if (verified) ...[
                  const SizedBox(width: 8),
                  const Text(
                    '✓ Verified',
                    style: TextStyle(
                      fontSize: 14,
                      color: Color(0xFF00AEEF),
                    ),
                  ),
                ],
              ],
            ),
          ],

          const SizedBox(height: 32),

          // Action Buttons
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: isUnknown ? null : _startChat,
              style: ElevatedButton.styleFrom(
                backgroundColor: isUnknown ? Colors.grey[200] : const Color(0xFF00AEEF),
                foregroundColor: isUnknown ? Colors.grey : Colors.black,
                disabledBackgroundColor: Colors.grey[200],
                disabledForegroundColor: Colors.grey,
              ),
              child: const Text(
                'Chat',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Secondary Actions
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                onPressed: isUnknown ? null : _toggleFavorite,
                icon: Icon(
                  _isFavorited ? Icons.favorite : Icons.favorite_border,
                  color: _isFavorited ? Colors.red : const Color(0xFF8E8E8E),
                  size: 28,
                ),
                disabledColor: Colors.grey[400],
              ),
              const SizedBox(width: 32),
              IconButton(
                onPressed: isUnknown
                    ? null
                    : () => _showToast('Report action not implemented'),
                icon: const Icon(
                  Icons.report_gmailerrorred,
                  color: Color(0xFF8E8E8E),
                  size: 28,
                ),
                disabledColor: Colors.grey[400],
              ),
              const SizedBox(width: 32),
              IconButton(
                onPressed: isUnknown
                    ? null
                    : () => _showToast('Block action not implemented'),
                icon: const Icon(
                  Icons.block,
                  color: Color(0xFF8E8E8E),
                  size: 28,
                ),
                disabledColor: Colors.grey[400],
              ),
            ],
          ),

          const SizedBox(height: 32),

          // Photos Grid Title & Grid
          if (effectiveImages.isNotEmpty) ...[
            const SizedBox(height: 32),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Photos',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : Colors.black,
                ),
              ),
            ),
            const SizedBox(height: 16),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemCount: effectiveImages.length,
              itemBuilder: (context, index) {
                final img = effectiveImages[index];
                final isLocked = img.isExclusive && !img.isUnlocked;

                return GestureDetector(
                  onTap: () => _onPhotoTap(img),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        if (isLocked)
                          ImageFiltered(
                            imageFilter: ui.ImageFilter.blur(sigmaX: 15, sigmaY: 15),
                            child: CachedNetworkImage(
                              imageUrl: img.url,
                              fit: BoxFit.cover,
                              placeholder: (context, url) => Container(
                                color: Colors.grey[100],
                              ),
                              errorWidget: (context, url, error) => Container(
                                color: Colors.grey[200],
                                child: const Icon(Icons.broken_image, color: Colors.grey),
                              ),
                            ),
                          )
                        else
                          CachedNetworkImage(
                            imageUrl: img.url,
                            fit: BoxFit.cover,
                            placeholder: (context, url) => Container(
                              color: Colors.grey[100],
                            ),
                            errorWidget: (context, url, error) => Container(
                              color: Colors.grey[200],
                              child: const Icon(Icons.broken_image, color: Colors.grey),
                            ),
                          ),
                        if (isLocked) ...[
                          Container(
                            color: Colors.black.withValues(alpha: 0.2),
                          ),
                          Center(
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black26,
                                    blurRadius: 4,
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.lock_rounded,
                                color: Colors.deepOrange,
                                size: 20,
                              ),
                            ),
                          ),
                          Positioned(
                            bottom: 8,
                            left: 8,
                            right: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.black87,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                '🔒 Exclusive (₦${img.price.toStringAsFixed(0)})',
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                                textAlign: TextAlign.center,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                        ] else ...[
                          Positioned(
                            bottom: 8,
                            left: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                '🔓 Public',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ],

          const SizedBox(height: 32),

          // Additional Info
          if (lastActive != null || (interests != null && interests.isNotEmpty))
            Column(
              children: [
                if (lastActive != null)
                  Text(
                    'Last active ${_formatTime(lastActive)}',
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF666666),
                    ),
                    textAlign: TextAlign.center,
                  ),
                if (interests != null && interests.isNotEmpty)
                  Text(
                    'Mutual interests: ${interests.join(', ')}',
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF666666),
                    ),
                    textAlign: TextAlign.center,
                  ),
              ],
            ),
        ],
      ),
    );
  }

  List<ProfileImage> _getEffectiveImages() {
    if (_profileImages.isNotEmpty) {
      return _profileImages;
    }
    final photos = _getPhotos();
    return photos.map((url) => ProfileImage(
      id: url,
      url: url,
      thumbnailUrl: url,
      isExclusive: false,
      price: 0,
      currency: 'NGN',
      isUnlocked: true,
      createdAt: DateTime.now(),
    )).toList();
  }

  void _onPhotoTap(ProfileImage img) {
    if (img.isExclusive && !img.isUnlocked) {
      _showPayToUnlockBottomSheet(img);
    } else {
      final effectiveImages = _getEffectiveImages();
      final browseableImages = effectiveImages.where((e) => !e.isExclusive || e.isUnlocked).toList();
      final idx = browseableImages.indexWhere((item) => item.id == img.id);
      if (idx != -1) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => _PhotoLightbox(
              photos: browseableImages.map((e) => e.url).toList(),
              initialIndex: idx,
            ),
          ),
        );
      }
    }
  }

  void _showPayToUnlockBottomSheet(ProfileImage img) {
    final creatorName = _userData!['name'] ?? 'Creator';
    final creatorUsername = _userData!['username'] ?? creatorName.toLowerCase().replaceAll(' ', '');

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return Container(
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1C1C1E) : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.grey[350],
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              const SizedBox(height: 24),
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: SizedBox(
                  width: 140,
                  height: 140,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      ImageFiltered(
                        imageFilter: ui.ImageFilter.blur(sigmaX: 15, sigmaY: 15),
                        child: CachedNetworkImage(
                          imageUrl: img.url,
                          fit: BoxFit.cover,
                          placeholder: (context, url) => Container(
                            color: Colors.grey[200],
                          ),
                          errorWidget: (context, url, error) => Container(
                            color: Colors.grey[300],
                            child: const Icon(Icons.person, size: 40, color: Colors.grey),
                          ),
                        ),
                      ),
                      Container(
                        color: Colors.black12,
                      ),
                      const Center(
                        child: Icon(
                          Icons.lock_rounded,
                          color: Colors.white,
                          size: 40,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                '🔒 Exclusive Content',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: isDark ? Colors.white : Colors.black,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Unlock this premium photo by @$creatorUsername',
                style: TextStyle(
                  fontSize: 15,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  onPressed: () async {
                    Navigator.pop(context);
                    try {
                      final result = await ApiService.unlockContent(img.id);
                      _showToast("Payment coming soon! Content unlocked instantly for testing.");
                      _loadProfile();
                    } catch (e) {
                      _showToast("Failed to unlock content: $e");
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.deepOrange,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(27),
                    ),
                  ),
                  child: Text(
                    'Unlock for ₦${img.price.toStringAsFixed(0)}',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'By unlocking, you agree to our Terms of Service. Purchases are final and directly support the creator.',
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.grey[400],
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  'Cancel',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey[600],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }
}

// Fullscreen Lightbox for photos
class _PhotoLightbox extends StatelessWidget {
  final List<String> photos;
  final int initialIndex;

  const _PhotoLightbox({
    required this.photos,
    required this.initialIndex,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          PageView.builder(
            controller: PageController(initialPage: initialIndex),
            itemCount: photos.length,
            itemBuilder: (context, index) {
              return InteractiveViewer(
                child: Center(
                  child: CachedNetworkImage(
                    imageUrl: photos[index],
                    fit: BoxFit.contain,
                    placeholder: (context, url) => const Center(
                      child: CircularProgressIndicator(),
                    ),
                    errorWidget: (context, url, error) => const Center(
                      child: Icon(Icons.broken_image, size: 80, color: Colors.grey),
                    ),
                  ),
                ),
              );
            },
          ),
          Positioned(
            top: 40,
            right: 20,
            child: GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.5),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white24),
                ),
                child: const Icon(Icons.close, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}