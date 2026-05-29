class Room {
  final String id;
  final String name;
  final String description;
  final String avatarUrl;
  final String category;
  final int maxMembers;
  final int currentMembers;
  final String createdBy;
  final bool isTrending;
  final List<String> tags;
  final bool isJoined;
  final bool isFull;

  Room({
    required this.id,
    required this.name,
    required this.description,
    required this.avatarUrl,
    required this.category,
    required this.maxMembers,
    required this.currentMembers,
    required this.createdBy,
    required this.isTrending,
    required this.tags,
    required this.isJoined,
    required this.isFull,
  });

  factory Room.fromJson(Map<String, dynamic> json) {
    return Room(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      avatarUrl: json['avatar_url']?.toString() ?? '',
      category: json['category']?.toString() ?? '',
      maxMembers: json['max_members'] is int ? json['max_members'] : int.tryParse(json['max_members']?.toString() ?? '0') ?? 0,
      currentMembers: json['current_members'] is int ? json['current_members'] : int.tryParse(json['current_members']?.toString() ?? '0') ?? 0,
      createdBy: json['created_by']?.toString() ?? '',
      isTrending: json['is_trending'] == true,
      tags: (json['tags'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      isJoined: json['is_joined'] == true,
      isFull: json['is_full'] == true,
    );
  }

  Room copyWith({
    String? id,
    String? name,
    String? description,
    String? avatarUrl,
    String? category,
    int? maxMembers,
    int? currentMembers,
    String? createdBy,
    bool? isTrending,
    List<String>? tags,
    bool? isJoined,
    bool? isFull,
  }) {
    return Room(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      category: category ?? this.category,
      maxMembers: maxMembers ?? this.maxMembers,
      currentMembers: currentMembers ?? this.currentMembers,
      createdBy: createdBy ?? this.createdBy,
      isTrending: isTrending ?? this.isTrending,
      tags: tags ?? this.tags,
      isJoined: isJoined ?? this.isJoined,
      isFull: isFull ?? this.isFull,
    );
  }
}
