import 'package:flutter/material.dart';
import 'screens/onboarding_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/feed_screen.dart';
import 'screens/create_post_screen.dart';
import 'screens/chats_screen.dart';
import 'screens/chat_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/edit_profile_screen.dart';
import 'screens/favorites_screen.dart';
import 'screens/nearby_screen.dart';
import 'screens/view_profile_screen.dart';
import 'screens/group_join_screen.dart';

import 'dart:async';

import 'services/notification_service.dart';
import 'widgets/network_wrapper.dart';
import 'services/theme_service.dart';
import 'services/api_service.dart';
import 'services/crash_reporter.dart';
import 'config/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  CrashReporter.install();

  runZonedGuarded(() async {
    try {
      await NotificationService.initialize();
    } catch (e) {
      debugPrint('Failed to initialize notifications on startup: $e');
    }

    try {
      await ApiService.initActiveUrl();
    } catch (e) {
      debugPrint('Failed to initialize active API URL on startup: $e');
    }

    runApp(const ZukapingApp());
  }, (Object error, StackTrace stack) {
    CrashReporter.record(error, stack);
  });
}

class ZukapingApp extends StatelessWidget {
  const ZukapingApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeNotifier,
      builder: (context, currentMode, _) {
        return MaterialApp(
          title: 'Zukaping',
          debugShowCheckedModeBanner: false,
          themeMode: currentMode,
          builder: (context, child) {
            return ValueListenableBuilder<List<String>>(
              valueListenable: CrashReporter.errors,
              builder: (context, errors, _) {
                final wrapped = NetworkWrapper(child: child!);
                if (errors.isEmpty) return wrapped;
                return Stack(
                  children: [
                    wrapped,
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: Container(
                        color: const Color(0xFFFF1744),
                        padding: const EdgeInsets.all(12),
                        child: Text(
                          errors.join('\n\n'),
                          style: const TextStyle(color: Colors.white, fontSize: 12),
                        ),
                      ),
                    ),
                  ],
                );
              },
            );
          },
          theme: buildLightTheme(),
          darkTheme: buildDarkTheme(),
          initialRoute: '/',
          routes: {
            '/': (context) => const SplashScreen(),
            '/onboarding': (context) => const OnboardingScreen(),
            '/login': (context) => const LoginScreen(),
            '/signup': (context) => const SignupScreen(),
            '/feed': (context) => const FeedScreen(),
            '/create-post': (context) => const CreatePostScreen(),
            '/chats': (context) => const ChatsScreen(),
            '/profile': (context) => const ProfileScreen(),
            '/edit-profile': (context) => const EditProfileScreen(),
            '/favorites': (context) => const FavoritesScreen(),
            '/nearby': (context) => const NearbyScreen(),
            // '/settings': (context) => const SettingsScreen(), // Uncomment when created
          },
          onGenerateRoute: (settings) {
            // Handle routes with arguments
            
            // Chat screen - can accept chatId or userId
            if (settings.name == '/chat') {
              final args = settings.arguments as Map<String, dynamic>?;
              final chatId = args?['chatId'] as String?;
              final userId = args?['userId'] as String?;
              
              return MaterialPageRoute(
                builder: (context) => ChatScreen(
                  chatId: chatId,
                  userId: userId,
                ),
              );
            }
            
            // View profile screen - requires userId
            if (settings.name == '/view-profile') {
              final args = settings.arguments as Map<String, dynamic>?;
              final userId = args?['userId'] as String? ?? '';
              
              return MaterialPageRoute(
                builder: (context) => ViewProfileScreen(userId: userId),
              );
            }

            // Group Join Screen - requires inviteCode
            if (settings.name == '/join-group') {
              final args = settings.arguments as Map<String, dynamic>?;
              final inviteCode = args?['inviteCode'] as String? ?? '';
              
              return MaterialPageRoute(
                builder: (context) => GroupJoinScreen(inviteCode: inviteCode),
              );
            }

            // Signup screen - can accept inviteCode
            if (settings.name == '/signup') {
              final args = settings.arguments as Map<String, dynamic>?;
              final inviteCode = args?['inviteCode'] as String?;
              
              return MaterialPageRoute(
                builder: (context) => SignupScreen(inviteCode: inviteCode),
              );
            }

            // Login screen - can accept inviteCode
            if (settings.name == '/login') {
              final args = settings.arguments as Map<String, dynamic>?;
              final inviteCode = args?['inviteCode'] as String?;
              
              return MaterialPageRoute(
                builder: (context) => LoginScreen(inviteCode: inviteCode),
              );
            }
            
            return null;
          },
        );
      },
    );
  }
}