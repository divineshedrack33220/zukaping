import 'dart:async';
import 'dart:ui';

import 'package:flutter/foundation.dart';

class CrashReporter {
  static final ValueNotifier<List<String>> errors = ValueNotifier<List<String>>[];
  static bool _installed = false;
  static int _maxErrors = 5;

  static void setMaxErrors(int max) => _maxErrors = max;

  static void install() {
    if (_installed) return;
    _installed = true;

    FlutterError.onError = (FlutterErrorDetails details) {
      FlutterError.presentError(details);
      _record(details.exceptionAsString(), kReleaseMode ? '' : details.stack.toString());
    };

    PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
      _record(error.toString(), kReleaseMode ? '' : stack.toString());
      return true;
    };
  }

  static void record(Object error, StackTrace stack) {
    _record(error.toString(), kReleaseMode ? '' : stack.toString());
  }

  static void _record(String message, String stack) {
    var current = List<String>.from(errors.value);
    // Only add message; skip stack in release to avoid leaking internal details
    if (current.length < _maxErrors) {
      current.add(kReleaseMode ? message : '$message\n$stack');
    }
    errors.value = current;
    debugPrint('CRASH: $message');
  }

  /// Clear all recorded errors (e.g., after successful login, navigation)
  static void clear() {
    errors.value = [];
  }
}