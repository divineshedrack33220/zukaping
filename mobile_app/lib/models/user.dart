import 'profile_image.dart';

class User {
  final String id;
  final String email;
  final String name;
  final String? username;
  final String? bio;
  final String? avatar;
  final List<String> photos;
  final String gender;
  final List<String> interestedIn;
  final String status;
  final List<ProfileImage> profileImages;

  User({
    required this.id,
    required this.email,
    required this.name,
    this.username,
    this.bio,
    this.avatar,
    this.photos = const [],
    this.gender = 'Other',
    this.interestedIn = const [],
    this.status = 'offline',
    this.profileImages = const [],
  });

  factory User.fromJson(Map<String, dynamic> json) {
    final gender = json['gender']?.toString() ?? 'Other';
    final email = json['email']?.toString() ?? '';
    
    String name = json['name']?.toString() ?? '';
    if (name.isEmpty || name == 'User' || name == 'Unknown User') {
      if (email.isNotEmpty) {
        // Use the part before @ as a readable display name
        name = email.split('@').first;
      } else {
        name = 'User';
      }
    }

    final List<String> parsedPhotos = (json['photos'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .where((e) => e.isNotEmpty && !e.contains('Portrait_Placeholder.png'))
            .toList() ?? [];

    final List<ProfileImage> parsedProfileImages = (json['profile_images'] as List<dynamic>?)
            ?.map((e) => ProfileImage.fromJson(e as Map<String, dynamic>))
            .toList() ?? [];

    String? parsedAvatar = () {
      final av = json['avatar']?.toString() ?? '';
      if (av.isEmpty || av.contains('Portrait_Placeholder.png')) return null;
      return av;
    }();

    // If the user doesn't have a profile picture but has gallery pictures below, use the first one
    if (parsedAvatar == null || parsedAvatar.isEmpty) {
      if (parsedProfileImages.isNotEmpty) {
        parsedAvatar = parsedProfileImages.first.url;
      } else if (parsedPhotos.isNotEmpty) {
        parsedAvatar = parsedPhotos.first;
      }
    }

    return User(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      name: name,
      username: json['username']?.toString(),
      bio: json['bio']?.toString(),
      avatar: parsedAvatar,
      photos: parsedPhotos,
      gender: gender,
      interestedIn: (json['interestedIn'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      status: json['status']?.toString() ?? 'offline',
      profileImages: parsedProfileImages,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'bio': bio,
      'gender': gender,
      'interestedIn': interestedIn,
      'status': status,
      'profile_images': profileImages.map((e) => e.toJson()).toList(),
    };
  }
}
