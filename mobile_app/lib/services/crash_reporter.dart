import 'dart:async';
import 'dart:ui';

import 'package:flutter/foundation.dart';

class CrashReporter {
  static final ValueNotifier<List<String>> errors = ValueNotifier<List<String>>([]);
  static bool _installed = false;

  static void install() {
    if (_installed) return;
    _installed = true;

    FlutterError.onError = (FlutterErrorDetails details) {
      FlutterError.presentError(details);
      _record(details.exceptionAsString(), details.stack.toString());
    };

    PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
      _record(error.toString(), stack.toString());
      return true;
    };
  }

  static void record(Object error, StackTrace stack) {
    _record(error.toString(), stack.toString());
  }

  static void _record(String message, String stack) {
    final current = List<String>.from(errors.value);
    current.add('$message\n$stack');
    errors.value = current;
    debugPrint('CRASH: $message');
  }
}
