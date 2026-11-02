import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

class NotificationService {
  static final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();
  static bool _initialized = false;
  static bool _permissionRequested = false;

  static Future<void> initialize() async {
    if (_initialized || kIsWeb) return;

    // Request notification permission on Android 13+ if not already requested
    if (!kIsWeb && !_permissionRequested) {
      _permissionRequested = true;
      final status = await Permission.notification.request();
      if (!status.isGranted) {
        debugPrint('Notification permission not granted - notifications will not appear');
      }
    }

    const AndroidInitializationSettings androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const DarwinInitializationSettings iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const InitializationSettings settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _notificationsPlugin.initialize(
      settings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        // Handle notification tap - navigate to relevant screen
        _handleNotificationTap(response.payload);
      },
    );
    
    _initialized = true;
  }

  static Future<void> showNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    if (!_initialized || kIsWeb) return;

    const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
      'zukaping_main_channel',
      'Zukaping Notifications',
      channelDescription: 'Main channel for Zukaping notifications',
      importance: Importance.max,
      priority: Priority.high,
      showWhen: true,
    );

    const DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const NotificationDetails details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _notificationsPlugin.show(
      id,
      title,
      body,
      details,
      payload: payload,
    );
  }

  /// Parse the payload from a notification tap and navigate to the appropriate screen
  static void _handleNotificationTap(String? payload) {
    if (payload == null) return;

    try {
      final data = jsonDecode(payload);
      // Navigate based on payload data
      // Expected format: {"targetType": "chat", "targetId": "chat_id", "route": "/chat", ...}
      final targetType = data['targetType'] as String?;
      final targetId = data['targetId'] as String?;

      if (targetType == 'chat' && targetId != null) {
        // Navigate to chat screen
        // This would be handled by the app's navigation logic
        debugPrint('Navigate to chat: $targetId');
      } else if (targetType == 'room' && targetId != null) {
        // Navigate to room screen
        debugPrint('Navigate to room: $targetId');
      } else {
        debugPrint('Notification payload: $payload');
      }
    } catch (e) {
      debugPrint('Error parsing notification payload: $e');
    }
  }
}