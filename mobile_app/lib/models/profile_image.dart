class ProfileImage {
  final String id;
  final String url;
  final String thumbnailUrl;
  final bool isExclusive;
  final double price;
  final String currency;
  final String blurHash;
  final bool isUnlocked;
  final DateTime createdAt;

  ProfileImage({
    required this.id,
    required this.url,
    required this.thumbnailUrl,
    this.isExclusive = false,
    this.price = 0.0,
    this.currency = 'NGN',
    this.blurHash = '',
    this.isUnlocked = true,
    required this.createdAt,
  });

  factory ProfileImage.fromJson(Map<String, dynamic> json) {
    return ProfileImage(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      url: json['url']?.toString() ?? '',
      thumbnailUrl: json['thumbnail_url']?.toString() ?? json['thumbnailUrl']?.toString() ?? '',
      isExclusive: json['is_exclusive'] ?? json['isExclusive'] ?? false,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency']?.toString() ?? 'NGN',
      blurHash: json['blur_hash']?.toString() ?? json['blurHash']?.toString() ?? '',
      isUnlocked: json['is_unlocked'] ?? json['isUnlocked'] ?? true,
      createdAt: json['created_at'] != null 
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now() 
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'url': url,
      'thumbnail_url': thumbnailUrl,
      'is_exclusive': isExclusive,
      'price': price,
      'currency': currency,
      'blur_hash': blurHash,
      'is_unlocked': isUnlocked,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
