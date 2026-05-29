import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/room.dart';
import 'api_service.dart';

class RoomService {
  static String get baseUrl => ApiService.baseUrl;

  // List all available pre-created rooms
  static Future<List<Room>> getRooms({String? category, bool? trending}) async {
    final prefs = await SharedPreferences.getInstance();
    try {
      final headers = await ApiService.getHeaders();
      
      // Build query string
      final queryParams = <String, String>{};
      if (category != null && category.isNotEmpty) {
        queryParams['category'] = category;
      }
      if (trending == true) {
        queryParams['trending'] = 'true';
      }

      final uri = Uri.parse('$baseUrl/rooms').replace(queryParameters: queryParams);
      final response = await http.get(uri, headers: headers);
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final list = data['rooms'] as List? ?? [];
        await prefs.setString('cached_rooms', jsonEncode(list));
        return list.map((e) => Room.fromJson(e)).toList();
      }
      throw Exception('Server error: ${response.statusCode}');
    } catch (e) {
      // getRooms offline fallback
      final cached = prefs.getString('cached_rooms');
      if (cached != null) {
        final list = jsonDecode(cached) as List? ?? [];
        return list.map((e) => Room.fromJson(e)).toList();
      }
      return [];
    }
  }

  // Get details + message preview for a specific room
  static Future<Map<String, dynamic>> getRoomDetails(String roomId) async {
    final headers = await ApiService.getHeaders();
    final response = await http.get(
      Uri.parse('$baseUrl/rooms/$roomId'),
      headers: headers,
    );
    
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to get room details: ${response.statusCode}');
  }

  // Join a public room
  static Future<Map<String, dynamic>> joinRoom(String roomId) async {
    final headers = await ApiService.getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/rooms/$roomId/join'),
      headers: headers,
      body: jsonEncode({}),
    );
    
    final data = jsonDecode(response.body);
    if (response.statusCode != 200) {
      throw Exception(data['error'] ?? 'Failed to join room');
    }
    return data;
  }

  // Leave a public room
  static Future<Map<String, dynamic>> leaveRoom(String roomId) async {
    final headers = await ApiService.getHeaders();
    final response = await http.delete(
      Uri.parse('$baseUrl/rooms/$roomId/leave'),
      headers: headers,
    );
    
    final data = jsonDecode(response.body);
    if (response.statusCode != 200) {
      throw Exception(data['error'] ?? 'Failed to leave room');
    }
    return data;
  }
}
