import 'dart:convert';
import 'dart:async';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'api_service.dart';

class WebSocketService {
  static WebSocketChannel? _channel;
  static final StreamController<Map<String, dynamic>> _controller = StreamController<Map<String, dynamic>>.broadcast();
  static String get wsUrl {
    return ApiService.baseUrl.replaceFirst('http', 'ws').replaceAll('/api', '/ws');
  }

  static Stream<Map<String, dynamic>> get stream => _controller.stream;

  static Future<void> connect() async {
    if (_channel != null) return;
    final token = await ApiService.getToken();
    if (token == null) return;
    
    print('🔄 Attempting WebSocket connection to $wsUrl...');
    try {
      _channel = WebSocketChannel.connect(Uri.parse('$wsUrl?token=$token'));
      print('✅ WebSocket connected successfully!');
      _flushQueue();
      
      _channel!.stream.listen(
        (data) {
          try {
            print('📥 WebSocket received: $data');
            final message = jsonDecode(data);
            _controller.add(message);
          } catch (e) {
            print('❌ Error decoding WebSocket message: $e');
          }
        },
        onDone: () {
          print('⚠️ WebSocket closed normally. Reconnecting in 5s...');
          _channel = null;
          Future.delayed(const Duration(seconds: 5), connect);
        },
        onError: (error) {
          print('❌ WebSocket error: $error. Reconnecting in 5s...');
          _channel = null;
          Future.delayed(const Duration(seconds: 5), connect);
        },
      );
    } catch (e) {
      print('❌ WebSocket connection error: $e. Reconnecting in 5s...');
      _channel = null;
      Future.delayed(const Duration(seconds: 5), connect);
    }
  }

  static final List<String> _queue = [];

  static void _flushQueue() {
    if (_channel != null && _queue.isNotEmpty) {
      for (final msg in _queue) {
        _channel!.sink.add(msg);
      }
      _queue.clear();
    }
  }

  static void send(Map<String, dynamic> data) {
    final msg = jsonEncode(data);
    if (_channel != null) {
      _channel!.sink.add(msg);
    } else {
      _queue.add(msg);
      connect();
    }
  }

  static void disconnect() {
    _channel?.sink.close();
    _channel = null;
  }
}
