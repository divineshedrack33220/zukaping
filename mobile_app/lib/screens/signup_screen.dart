import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';

class SignupScreen extends StatefulWidget {
  final String? inviteCode;
  const SignupScreen({super.key, this.inviteCode});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  // Data storage
  String _email = '';
  String _password = '';
  String _name = '';
  String _birthDate = '';
  String _gender = 'male';
  String _interestedIn = 'men';
  double? _latitude;
  double? _longitude;
  String _bio = '';
  String _status = 'available';
  String? _token;
  String? _userId;
  bool _isGoogleSignup = false;
  List<String?> _uploadedPhotos = List.filled(6, null);
  
  // Controllers
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _bioController = TextEditingController();
  final TextEditingController _dobController = TextEditingController();
  
  // State
  int _currentScreen = 0;
  bool _isLoading = false;
  String _errorMessage = '';
  List<bool> _uploadingSlots = List.filled(6, false);
  bool _obscurePassword = true;
  
  final String _baseUrl = ApiService.baseUrl.replaceAll('/api', '');

  late PageController _pageController;
  
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    clientId: '12239007321-kcvn3r3asgef4ic341tnvbn2bpt8i9qg.apps.googleusercontent.com',
  );

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _loadToken();
  }

  Future<void> _loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _token = prefs.getString('token');
      _userId = prefs.getString('userId');
    });
  }

  bool _isValidEmail(String email) {
    final emailRegex = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
    return emailRegex.hasMatch(email);
  }

  Future<void> _handleGoogleSignIn() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });
    
    try {
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser != null) {
        final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
        final idToken = googleAuth.idToken;
        
        if (idToken != null) {
          final result = await ApiService.googleAuth(idToken);
          
          if (result['error'] == true) {
            throw Exception(result['message'] ?? 'Authentication failed');
          }
          
          _token = result['token'];
          _userId = result['userId'];
          
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('token', _token!);
          await prefs.setString('userId', _userId!);
          
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Google account linked successfully!')),
            );
            
            if (result['isNewUser'] == true || result['hasCompletedOnboarding'] == false) {
              _isGoogleSignup = true;
              _nextScreen();
            } else {
              Navigator.pushNamedAndRemoveUntil(context, '/feed', (route) => false);
            }
          }
        } else {
          throw Exception("Failed to retrieve Google token");
        }
      }
    } catch (e) {
      if (mounted) {
        _showGoogleFallbackOption(e.toString());
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _signup() async {
    _email = _emailController.text.trim();
    _password = _passwordController.text;

    if (!_isValidEmail(_email)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid email')),
      );
      return;
    }
    if (_password.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password must be at least 6 characters')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/signup'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': _email, 
          'password': _password,
          if (widget.inviteCode != null && widget.inviteCode!.isNotEmpty) 'inviteCode': widget.inviteCode,
        }),
      );

      if (response.statusCode == 201) {
        final data = jsonDecode(response.body);
        _token = data['token'];
        _userId = data['userId'];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('token', _token!);
        await prefs.setString('userId', _userId!);
        _isGoogleSignup = false;
        
        _nextScreen();
      } else {
        final error = jsonDecode(response.body);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error['error'] ?? 'Signup failed')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Connection error')),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _nextScreen() {
    if (_currentScreen < 7) { // Total 8 screens (0-7)
      _currentScreen++;
      _pageController.animateToPage(
        _currentScreen,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  void _previousScreen() {
    if (_currentScreen > 0) {
      _currentScreen--;
      _pageController.animateToPage(
        _currentScreen,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      Navigator.pop(context);
    }
  }

  Future<void> _completeOnboarding() async {
    if (_token == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Session expired. Please sign up again.')),
      );
      return;
    }

    final photos = _uploadedPhotos.where((p) => p != null).cast<String>().toList();
    
    final onboardingData = {
      'name': _nameController.text.trim(),
      'birthDate': _dobController.text.isNotEmpty 
          ? (DateTime.tryParse(_dobController.text)?.millisecondsSinceEpoch ?? 0) ~/ 1000
          : null,
      'gender': _gender,
      'interestedIn': _interestedIn == 'everyone' ? ['men', 'women'] : [_interestedIn],
      'bio': _bioController.text.trim(),
      'status': _status,
      'photos': photos,
    };

    setState(() => _isLoading = true);

    try {
      final response = await http.put(
        Uri.parse('$_baseUrl/api/me'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
        body: jsonEncode(onboardingData),
      );

      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Welcome to Zukaping!')),
        );
        WebSocketService.connect();
        Navigator.pushNamedAndRemoveUntil(context, '/feed', (route) => false);
      } else {
        final error = jsonDecode(response.body);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error['error'] ?? 'Failed to save profile')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save profile')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _uploadPhoto(int index) async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);
    
    if (pickedFile == null) return;
    
    if (_token == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please sign up first')),
      );
      return;
    }

    setState(() {
      _uploadingSlots[index] = true;
    });

    try {
      final url = await ApiService.uploadImage(pickedFile, pickedFile.name);
      if (url != null) {
        setState(() {
          _uploadedPhotos[index] = url;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Photo uploaded')),
        );
      } else {
        throw Exception('Upload failed');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to upload photo')),
      );
    } finally {
      setState(() {
        _uploadingSlots[index] = false;
      });
    }
  }

  Widget _buildScreen1() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fillColor = isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF5F5F5);
    final borderColor = isDark ? const Color(0xFF3A3A3C) : const Color(0xFFE0E0E0);
    final dividerColor = isDark ? const Color(0xFF3A3A3C) : Colors.grey[300]!;
    final textColor = isDark ? Colors.white : Colors.black;
    final hintColor = isDark ? Colors.grey[500] : Colors.grey[600];
    
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 40),
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            style: TextStyle(color: textColor),
            decoration: InputDecoration(
              hintText: 'Email address',
              hintStyle: TextStyle(color: hintColor),
              filled: true,
              fillColor: fillColor,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: borderColor),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: borderColor),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF026AFD), width: 2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            style: TextStyle(color: textColor),
            decoration: InputDecoration(
              hintText: 'Password',
              hintStyle: TextStyle(color: hintColor),
              filled: true,
              fillColor: fillColor,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: borderColor),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: borderColor),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF026AFD), width: 2),
              ),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword ? Icons.visibility_off : Icons.visibility,
                  color: isDark ? Colors.grey[400] : Colors.grey,
                ),
                onPressed: () {
                  setState(() {
                    _obscurePassword = !_obscurePassword;
                  });
                },
              ),
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _signup,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF026AFD),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
              ),
              child: _isLoading
                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Sign Up', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: Colors.white)),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: Divider(color: dividerColor)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text('or', style: TextStyle(color: hintColor)),
              ),
              Expanded(child: Divider(color: dividerColor)),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: OutlinedButton(
              onPressed: _isLoading ? null : _handleGoogleSignIn,
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: borderColor),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Image.network(
                    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Google_Favicon_2025.svg/250px-Google_Favicon_2025.svg.png',
                    width: 20,
                    height: 20,
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'Continue with Google',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: textColor),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text("Already have an account? ", style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600])),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: const Text('Log in', style: TextStyle(color: Color(0xFF026AFD), fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarScreen() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final avatar = _uploadedPhotos[0];
    final bgColor = isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF5F5F5);
    final borderColor = isDark ? const Color(0xFF3A3A3C) : const Color(0xFFE0E0E0);
    final textColor = isDark ? Colors.white : Colors.black;
    final hintColor = isDark ? Colors.grey[400] : const Color(0xFF8E8E8E);
    
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 40),
          Text(
            'Upload a Profile Picture',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: textColor),
          ),
          const SizedBox(height: 12),
          Text(
            'Choose a clear photo of yourself. A profile picture is mandatory to help keep the community authentic and safe.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 15, color: isDark ? Colors.grey[400] : Colors.grey),
          ),
          const SizedBox(height: 50),
          
          // Beautiful Circle Image Uploader
          GestureDetector(
            onTap: () => _uploadPhoto(0),
            child: Stack(
              children: [
                Container(
                  width: 160,
                  height: 160,
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF5F5F5),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: avatar != null ? const Color(0xFF026AFD) : borderColor,
                      width: 4,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(isDark ? 0.3 : 0.05),
                        blurRadius: 15,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: _uploadingSlots[0]
                      ? const Center(
                          child: CircularProgressIndicator(
                            strokeWidth: 3,
                            color: Color(0xFF026AFD),
                          ),
                        )
                      : avatar != null
                          ? ClipOval(
                              child: Image.network(avatar, fit: BoxFit.cover),
                            )
                          : const Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.add_a_photo_rounded,
                                    size: 40,
                                    color: Color(0xFF026AFD),
                                  ),
                                  SizedBox(height: 8),
                                  Text(
                                    'Upload',
                                    style: TextStyle(
                                      color: Color(0xFF8E8E8E),
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                ),
                if (avatar != null)
                  Positioned(
                    right: 4,
                    bottom: 4,
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: const BoxDecoration(
                        color: Color(0xFF026AFD),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 60),
          
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: avatar != null ? _nextScreen : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF026AFD),
                disabledBackgroundColor: const Color(0xFF026AFD).withOpacity(0.3),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
                elevation: avatar != null ? 2 : 0,
              ),
              child: Text(
                'Next Step',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: avatar != null ? Colors.white : (isDark ? Colors.white54 : Colors.black45),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScreen2() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fillColor = isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF5F5F5);
    final borderColor = isDark ? const Color(0xFF3A3A3C) : const Color(0xFFE0E0E0);
    final textColor = isDark ? Colors.white : Colors.black;
    final hintColor = isDark ? Colors.grey[500] : Colors.grey[600];
    
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 40),
          Text('What should we call you?', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: textColor)),
          const SizedBox(height: 40),
          TextField(
            controller: _nameController,
            style: TextStyle(color: textColor),
            decoration: InputDecoration(
              hintText: 'Full name',
              hintStyle: TextStyle(color: hintColor),
              filled: true,
              fillColor: fillColor,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: borderColor),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: borderColor),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF026AFD), width: 2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _dobController,
            readOnly: true,
            style: TextStyle(color: textColor),
            onTap: () async {
              final date = await showDatePicker(
                context: context,
                initialDate: DateTime(2000),
                firstDate: DateTime(1950),
                lastDate: DateTime.now(),
                builder: (context, child) {
                  return Theme(
                    data: Theme.of(context).copyWith(
                      colorScheme: ColorScheme.light(
                        primary: Color(0xFF026AFD),
                        onPrimary: Colors.white,
                        onSurface: isDark ? Colors.white : Colors.black,
                        surface: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                      ),
                    ),
                    child: child!,
                  );
                },
              );
              if (date != null) {
                setState(() {
                  _birthDate = date.toIso8601String().split('T')[0];
                  _dobController.text = _birthDate;
                });
              }
            },
            decoration: InputDecoration(
              hintText: 'Birth date (YYYY-MM-DD)',
              hintStyle: TextStyle(color: hintColor),
              suffixIcon: const Icon(Icons.calendar_today, color: Color(0xFF026AFD)),
              filled: true,
              fillColor: fillColor,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: borderColor),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: borderColor),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF026AFD), width: 2),
              ),
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _nextScreen,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF026AFD),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
              ),
              child: const Text('Next', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScreen3() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black;
    final unselectedColor = isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF5F5F5);
    final unselectedBorder = isDark ? const Color(0xFF3A3A3C) : const Color(0xFFE0E0E0);
    final unselectedText = isDark ? Colors.white : Colors.black;
    
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 40),
          Text('Who are you?', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: textColor)),
          const SizedBox(height: 24),
          Row(
            children: [
              _buildGenderButton('Male', 'male', isDark),
              const SizedBox(width: 12),
              _buildGenderButton('Female', 'female', isDark),
              const SizedBox(width: 12),
              _buildGenderButton('Other', 'other', isDark),
            ],
          ),
          const SizedBox(height: 40),
          Text('Who are you interested in?', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: textColor)),
          const SizedBox(height: 24),
          Row(
            children: [
              _buildInterestButton('Men', 'men', isDark),
              const SizedBox(width: 12),
              _buildInterestButton('Women', 'women', isDark),
              const SizedBox(width: 12),
              _buildInterestButton('Everyone', 'everyone', isDark),
            ],
          ),
          const SizedBox(height: 40),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _nextScreen,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF026AFD),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
              ),
              child: const Text('Next', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGenderButton(String label, String value, bool isDark) {
    final selected = _gender == value;
    final unselectedColor = isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF5F5F5);
    final unselectedBorder = isDark ? const Color(0xFF3A3A3C) : const Color(0xFFE0E0E0);
    final unselectedText = isDark ? Colors.white : Colors.black;
    
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _gender = value),
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            color: selected ? const Color(0xFF026AFD) : unselectedColor,
            border: Border.all(color: selected ? const Color(0xFF026AFD) : unselectedBorder),
            borderRadius: BorderRadius.circular(26),
          ),
          child: Center(
            child: Text(
              label, 
              style: TextStyle(
                color: selected ? Colors.white : unselectedText, 
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInterestButton(String label, String value, bool isDark) {
    final selected = _interestedIn == value;
    final unselectedColor = isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF5F5F5);
    final unselectedBorder = isDark ? const Color(0xFF3A3A3C) : const Color(0xFFE0E0E0);
    final unselectedText = isDark ? Colors.white : Colors.black;
    
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _interestedIn = value),
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            color: selected ? const Color(0xFF026AFD) : unselectedColor,
            border: Border.all(color: selected ? const Color(0xFF026AFD) : unselectedBorder),
            borderRadius: BorderRadius.circular(26),
          ),
          child: Center(
            child: Text(
              label, 
              style: TextStyle(
                color: selected ? Colors.white : unselectedText, 
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildScreen4() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black;
    final hintColor = isDark ? Colors.grey[400] : const Color(0xFF666666);
    final borderColor = isDark ? const Color(0xFF3A3A3C) : const Color(0xFFE0E0E0);
    
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 100),
          Text("Enable Location", textAlign: TextAlign.center, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: textColor)),
          const SizedBox(height: 8),
          Text('We use your location to show nearby people', textAlign: TextAlign.center, style: TextStyle(color: hintColor)),
          const SizedBox(height: 40),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: () { _getLocation(); _nextScreen(); },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF026AFD),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
              ),
              child: const Text('Allow location', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: Colors.white)),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: OutlinedButton(
              onPressed: _nextScreen,
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: borderColor),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
              ),
              child: Text('Skip', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: textColor)),
            ),
          ),
        ],
      ),
    );
  }

  void _getLocation() async { }

  Widget _buildScreen5() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black;
    final mainBg = isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF5F5F5);
    final otherBg = isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF5F5F5);
    final otherBorder = isDark ? const Color(0xFF3A3A3C) : const Color(0xFFE0E0E0);
    final iconColor = isDark ? Colors.grey[400] : const Color(0xFF8E8E8E);
    
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 40),
          Text('Add photos', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: textColor)),
          const SizedBox(height: 24),
          GridView.builder(
            shrinkWrap: true,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, crossAxisSpacing: 12, mainAxisSpacing: 12),
            itemCount: 6,
            itemBuilder: (context, index) {
              if (index == 0) {
                // Show Main Profile Photo (Slot 0)
                final mainAvatar = _uploadedPhotos[0];
                return Container(
                  decoration: BoxDecoration(
                    color: mainBg,
                    border: Border.all(color: const Color(0xFF026AFD), width: 2),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Stack(
                    children: [
                      if (mainAvatar != null)
                        ClipRRect(borderRadius: BorderRadius.circular(14), child: Image.network(mainAvatar, fit: BoxFit.cover, width: double.infinity, height: double.infinity))
                      else
                        Center(child: Icon(Icons.person, color: Color(0xFF026AFD))),
                      Positioned(
                        top: 4, left: 4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: const Color(0xFF026AFD), borderRadius: BorderRadius.circular(8)),
                          child: const Text('Main', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                );
              }

              return GestureDetector(
                onTap: () => _uploadPhoto(index),
                child: Container(
                  decoration: BoxDecoration(
                    color: otherBg,
                    border: Border.all(color: otherBorder),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: _uploadingSlots[index]
                      ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF026AFD)))
                      : _uploadedPhotos[index] != null
                          ? ClipRRect(borderRadius: BorderRadius.circular(16), child: Image.network(_uploadedPhotos[index]!, fit: BoxFit.cover))
                          : Center(child: Icon(Icons.add_a_photo_outlined, color: iconColor)),
                ),
              );
            },
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _nextScreen,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF026AFD),
                disabledBackgroundColor: const Color(0xFF026AFD).withOpacity(0.3),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
              ),
              child: const Text('Next', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScreen6() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fillColor = isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF5F5F5);
    final borderColor = isDark ? const Color(0xFF3A3A3C) : const Color(0xFFE0E0E0);
    final textColor = isDark ? Colors.white : Colors.black;
    final hintColor = isDark ? Colors.grey[500] : Colors.grey[600];
    
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 40),
          Text('Your Bio', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: textColor)),
          const SizedBox(height: 40),
          TextField(
            controller: _bioController,
            maxLines: 4,
            style: TextStyle(color: textColor),
            decoration: InputDecoration(
              hintText: 'Describe yourself...',
              hintStyle: TextStyle(color: hintColor),
              filled: true,
              fillColor: fillColor,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: borderColor),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: borderColor),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF026AFD), width: 2),
              ),
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _nextScreen,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF026AFD),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
              ),
              child: const Text('Next', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScreen7() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black;
    final unselectedColor = isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF5F5F5);
    final unselectedBorder = isDark ? const Color(0xFF3A3A3C) : const Color(0xFFE0E0E0);
    final unselectedText = isDark ? Colors.white : Colors.black;
    
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 100),
          Text('Ready to connect', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: textColor)),
          const SizedBox(height: 40),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _status = 'available'),
                  child: Container(
                    height: 52,
                    decoration: BoxDecoration(
                      color: _status == 'available' ? const Color(0xFF026AFD) : unselectedColor,
                      border: Border.all(color: _status == 'available' ? const Color(0xFF026AFD) : unselectedBorder),
                      borderRadius: BorderRadius.circular(26),
                    ),
                    child: Center(child: Text('Available', style: TextStyle(color: _status == 'available' ? Colors.white : unselectedText, fontWeight: FontWeight.w600))),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _status = 'busy'),
                  child: Container(
                    height: 52,
                    decoration: BoxDecoration(
                      color: _status == 'busy' ? const Color(0xFF026AFD) : unselectedColor,
                      border: Border.all(color: _status == 'busy' ? const Color(0xFF026AFD) : unselectedBorder),
                      borderRadius: BorderRadius.circular(26),
                    ),
                    child: Center(child: Text('Busy', style: TextStyle(color: _status == 'busy' ? Colors.white : unselectedText, fontWeight: FontWeight.w600))),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 40),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _completeOnboarding,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF026AFD),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
              ),
              child: _isLoading
                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Go Live', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        elevation: 0,
        leading: IconButton(icon: Icon(Icons.arrow_back, color: isDark ? Colors.white : Colors.black), onPressed: _previousScreen),
        title: _currentScreen > 0 ? Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(8, (index) => Container(
            margin: const EdgeInsets.symmetric(horizontal: 4),
            width: 8, height: 8,
            decoration: BoxDecoration(shape: BoxShape.circle, color: _currentScreen >= index ? const Color(0xFF026AFD) : (isDark ? const Color(0xFF2C2C2E) : const Color(0xFFDDDDDD))),
          )),
        ) : null,
      ),
      body: PageView(
        controller: _pageController,
        onPageChanged: (index) => setState(() => _currentScreen = index),
        physics: const NeverScrollableScrollPhysics(),
        children: [
          _buildScreen1(),
          _buildAvatarScreen(),
          _buildScreen2(),
          _buildScreen3(),
          _buildScreen4(),
          _buildScreen5(),
          _buildScreen6(),
          _buildScreen7(),
        ],
      ),
    );
  }

  void _showGoogleFallbackOption(String originalError) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF1C1C1E) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black;
    final hintColor = isDark ? Colors.grey[400] : Colors.grey[700];
    final borderColor = isDark ? const Color(0xFF3A3A3C) : Colors.grey[300]!;
    
    showModalBottomSheet(
      context: context,
      backgroundColor: bgColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.amber[50],
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.warning_amber_rounded, color: Colors.amber[800], size: 28),
                ),
                const SizedBox(width: 16),
                Text(
                  'Google Auth Failed',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: textColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              'Google authentication failed or is not configured for this environment.\n\nError: $originalError',
              style: TextStyle(
                fontSize: 14,
                color: hintColor,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 28),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      side: BorderSide(color: borderColor),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: Text('Cancel', style: TextStyle(color: textColor, fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.pop(context);
                      _performDemoLogin();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF026AFD),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: const Text('Use Demo Account', style: TextStyle(color: Colors.black, fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _performDemoLogin() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });
    try {
      // 1. Try to login first
      var result = await ApiService.login('demo@zukaping.com', 'password123');
      
      // 2. If login fails (user doesn't exist), try to sign up
      if (result['error'] == true) {
        final signupResult = await ApiService.signup({
          'email': 'demo@zukaping.com',
          'password': 'password123',
          'name': 'Demo User',
          'gender': 'Other',
          'interestedIn': ['everyone'],
        });
        
        if (signupResult['error'] != true) {
          // Signup succeeded, now log in!
          result = await ApiService.login('demo@zukaping.com', 'password123');
        }
      }
      
      if (result['error'] == true) {
        throw Exception(result['message'] ?? 'Failed to authenticate Demo Account');
      }
      
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', result['token']);
      await prefs.setString('userId', result['userId']);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Logged in with Demo Account!')),
        );
        Navigator.pushNamedAndRemoveUntil(context, '/feed', (route) => false);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Demo login failed: ${e.toString()}')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }
}