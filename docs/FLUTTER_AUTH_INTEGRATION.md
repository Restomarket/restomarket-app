# Flutter Authentication Integration Guide

This guide explains how to integrate RestoMarket's Better Auth backend with a Flutter mobile app using Bearer token authentication.

## Overview

RestoMarket uses Better Auth with the Bearer plugin, which means:

- ✅ Session tokens can be used directly as Bearer tokens
- ✅ Token is returned in `set-auth-token` response header after sign-in
- ✅ NestJS API already validates `Authorization: Bearer <token>` headers
- ✅ No additional backend changes required (already configured)

## Backend Configuration

The backend is already configured with:

- `bearer()` plugin in shared config
- Trusted origins include `restomarket://` for OAuth callbacks
- CORS configured for mobile origins
- NestJS `PermissionsGuard` extracts Bearer tokens from `Authorization` header

---

## Flutter Setup

### Dependencies

Add to your `pubspec.yaml`:

```yaml
dependencies:
  http: ^1.2.0
  dio: ^5.4.0 # Optional but recommended
  flutter_secure_storage: ^9.2.4 # Secure token storage
  url_launcher: ^6.3.0 # For Google OAuth
  app_links: ^6.3.3 # For deep link handling
  freezed_annotation: ^2.4.0 # For data classes
  json_annotation: ^4.9.0 # For JSON serialization

dev_dependencies:
  build_runner: ^2.4.0
  freezed: ^2.5.0
  json_serializable: ^6.8.0
```

---

## 1. Auth Service Implementation

```dart
// lib/services/auth_service.dart
import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class AuthService {
  // Your Next.js base URL (where Better Auth endpoints live)
  static const String _authBaseUrl = 'https://your-domain.com/api/auth';

  // Your NestJS API URL
  static const String _apiBaseUrl = 'https://api.your-domain.com/api/v1';

  final _storage = const FlutterSecureStorage();
  static const _tokenKey = 'bearer_token';
  static const _userKey = 'user_data';

  // ============================================
  // Email/Password Sign In
  // ============================================

  /// Sign in with email and password
  ///
  /// The Bearer token is returned in the `set-auth-token` response header
  /// and should be stored securely for subsequent API requests.
  Future<AuthResult> signInWithEmail(String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$_authBaseUrl/sign-in/email'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      );

      if (response.statusCode == 200) {
        // Extract Bearer token from response header (per Better Auth docs)
        final token = response.headers['set-auth-token'];
        final data = jsonDecode(response.body);
        final user = data['user'];

        if (token != null) {
          await _storage.write(key: _tokenKey, value: token);
          if (user != null) {
            await _storage.write(key: _userKey, value: jsonEncode(user));
          }
        }

        return AuthResult(success: true, user: user, token: token);
      }

      final error = jsonDecode(response.body);
      return AuthResult(
        success: false,
        error: error['message'] ?? 'Sign in failed',
      );
    } catch (e) {
      return AuthResult(success: false, error: e.toString());
    }
  }

  // ============================================
  // Email/Password Sign Up
  // ============================================

  Future<AuthResult> signUp({
    required String email,
    required String password,
    required String name,
    String? firstName,
    String? lastName,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$_authBaseUrl/sign-up/email'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'password': password,
          'name': name,
          if (firstName != null) 'firstName': firstName,
          if (lastName != null) 'lastName': lastName,
        }),
      );

      if (response.statusCode == 200) {
        final token = response.headers['set-auth-token'];
        final data = jsonDecode(response.body);
        final user = data['user'];

        if (token != null) {
          await _storage.write(key: _tokenKey, value: token);
          if (user != null) {
            await _storage.write(key: _userKey, value: jsonEncode(user));
          }
        }

        return AuthResult(success: true, user: user, token: token);
      }

      final error = jsonDecode(response.body);
      return AuthResult(success: false, error: error['message'] ?? 'Sign up failed');
    } catch (e) {
      return AuthResult(success: false, error: e.toString());
    }
  }

  // ============================================
  // Get / Validate Session
  // ============================================

  /// Get current session using stored Bearer token
  /// Returns null if token is invalid or expired
  Future<AuthResult> getSession() async {
    try {
      final token = await _storage.read(key: _tokenKey);
      if (token == null) {
        return AuthResult(success: false, error: 'No token found');
      }

      final response = await http.get(
        Uri.parse('$_authBaseUrl/get-session'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return AuthResult(success: true, user: data['user'], token: token);
      }

      // Token expired or invalid — clear storage
      await _storage.deleteAll();
      return AuthResult(success: false, error: 'Session expired');
    } catch (e) {
      return AuthResult(success: false, error: e.toString());
    }
  }

  // ============================================
  // Sign Out
  // ============================================

  Future<void> signOut() async {
    final token = await _storage.read(key: _tokenKey);

    if (token != null) {
      try {
        await http.post(
          Uri.parse('$_authBaseUrl/sign-out'),
          headers: {'Authorization': 'Bearer $token'},
        );
      } catch (e) {
        // Ignore errors on sign out
      }
    }

    await _storage.deleteAll();
  }

  // ============================================
  // Password Reset
  // ============================================

  Future<bool> requestPasswordReset(String email) async {
    try {
      final response = await http.post(
        Uri.parse('$_authBaseUrl/forget-password'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email}),
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<bool> resetPassword(String token, String newPassword) async {
    try {
      final response = await http.post(
        Uri.parse('$_authBaseUrl/reset-password'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'token': token,
          'password': newPassword,
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  // ============================================
  // Email OTP (Passwordless)
  // ============================================

  /// Send OTP to email for passwordless sign-in
  Future<bool> sendOtp(String email) async {
    try {
      final response = await http.post(
        Uri.parse('$_authBaseUrl/email-otp/send-verification-otp'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'type': 'sign-in',
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  /// Verify OTP and sign in
  Future<AuthResult> verifyOtp(String email, String otp) async {
    try {
      final response = await http.post(
        Uri.parse('$_authBaseUrl/sign-in/email-otp'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'otp': otp,
        }),
      );

      if (response.statusCode == 200) {
        final token = response.headers['set-auth-token'];
        final data = jsonDecode(response.body);

        if (token != null) {
          await _storage.write(key: _tokenKey, value: token);
          await _storage.write(key: _userKey, value: jsonEncode(data['user']));
        }

        return AuthResult(success: true, user: data['user'], token: token);
      }

      return AuthResult(success: false, error: 'Invalid OTP');
    } catch (e) {
      return AuthResult(success: false, error: e.toString());
    }
  }

  // ============================================
  // Token Management
  // ============================================

  Future<String?> getToken() => _storage.read(key: _tokenKey);

  Future<bool> isAuthenticated() async {
    final token = await _storage.read(key: _tokenKey);
    return token != null;
  }

  Future<Map<String, dynamic>?> getCachedUser() async {
    final userJson = await _storage.read(key: _userKey);
    if (userJson == null) return null;
    return jsonDecode(userJson) as Map<String, dynamic>;
  }
}

// ============================================
// Result Models
// ============================================

class AuthResult {
  final bool success;
  final Map<String, dynamic>? user;
  final String? token;
  final String? error;

  AuthResult({
    required this.success,
    this.user,
    this.token,
    this.error,
  });
}
```

---

## 2. API Client with Dio (Recommended)

```dart
// lib/core/api_client.dart
import 'package:dio/dio.dart';
import '../services/auth_service.dart';

class ApiClient {
  static const String _baseUrl = 'https://api.your-domain.com/api/v1';

  final AuthService _authService;
  late final Dio _dio;

  ApiClient(this._authService) {
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      headers: {'Content-Type': 'application/json'},
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
    ));

    _setupInterceptors();
  }

  void _setupInterceptors() {
    // Request interceptor - automatically attach Bearer token
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _authService.getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        // Handle 401 Unauthorized - token expired
        if (error.response?.statusCode == 401) {
          await _authService.signOut();
          // Navigate to login screen
          // You can use a navigation service or event bus here
        }
        handler.next(error);
      },
    ));

    // Logging interceptor (development only)
    _dio.interceptors.add(LogInterceptor(
      requestBody: true,
      responseBody: true,
    ));
  }

  // ============================================
  // HTTP Methods
  // ============================================

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) {
    return _dio.get<T>(path, queryParameters: queryParameters);
  }

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
  }) {
    return _dio.post<T>(path, data: data, queryParameters: queryParameters);
  }

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
  }) {
    return _dio.put<T>(path, data: data);
  }

  Future<Response<T>> patch<T>(
    String path, {
    dynamic data,
  }) {
    return _dio.patch<T>(path, data: data);
  }

  Future<Response<T>> delete<T>(String path) {
    return _dio.delete<T>(path);
  }
}

// ============================================
// Usage Example
// ============================================

class ProductsRepository {
  final ApiClient _apiClient;

  ProductsRepository(this._apiClient);

  Future<List<dynamic>> getProducts() async {
    final response = await _apiClient.get('/products');
    return response.data as List<dynamic>;
  }

  Future<dynamic> getProduct(String id) async {
    final response = await _apiClient.get('/products/$id');
    return response.data;
  }

  Future<dynamic> createProduct(Map<String, dynamic> data) async {
    final response = await _apiClient.post('/products', data: data);
    return response.data;
  }
}
```

---

## 3. Google OAuth Integration

```dart
// lib/services/google_auth_service.dart
import 'package:url_launcher/url_launcher.dart';
import 'package:app_links/app_links.dart';

class GoogleAuthService {
  static const _authBaseUrl = 'https://your-domain.com/api/auth';
  static const _redirectScheme = 'restomarket';

  final _appLinks = AppLinks();

  /// Initiate Google sign-in flow
  /// Opens browser for OAuth, then redirects back to app via deep link
  Future<void> signInWithGoogle() async {
    final callbackUrl = '$_redirectScheme://auth/callback';

    final url = Uri.parse(
      '$_authBaseUrl/sign-in/social?provider=google'
      '&callbackURL=${Uri.encodeComponent(callbackUrl)}',
    );

    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } else {
      throw Exception('Could not launch Google sign-in');
    }
  }

  /// Listen for OAuth callback deep link
  /// Call this in your app's initState or main widget
  Stream<String?> get onTokenReceived {
    return _appLinks.uriLinkStream.map((Uri uri) {
      // URI format: restomarket://auth/callback?token=xxx
      if (uri.scheme == _redirectScheme && uri.host == 'auth') {
        return uri.queryParameters['token'];
      }
      return null;
    }).where((token) => token != null);
  }
}
```

### Deep Link Configuration

**Android** (`android/app/src/main/AndroidManifest.xml`):

```xml
<activity android:name=".MainActivity">
  <!-- Add inside <activity> tag -->
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="restomarket" android:host="auth" />
  </intent-filter>
</activity>
```

**iOS** (`ios/Runner/Info.plist`):

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>restomarket</string>
    </array>
  </dict>
</array>
```

---

## 4. Complete Usage Example

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'services/auth_service.dart';
import 'services/google_auth_service.dart';
import 'core/api_client.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final _authService = AuthService();
  late final _apiClient = ApiClient(_authService);
  final _googleAuth = GoogleAuthService();

  @override
  void initState() {
    super.initState();

    // Listen for Google OAuth callbacks
    _googleAuth.onTokenReceived.listen((token) async {
      if (token != null) {
        // Store token from OAuth callback
        await _authService.getToken(); // Validates and stores
        setState(() {}); // Refresh UI
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: LoginScreen(
        authService: _authService,
        googleAuth: _googleAuth,
        apiClient: _apiClient,
      ),
    );
  }
}

// ============================================
// Login Screen Example
// ============================================

class LoginScreen extends StatefulWidget {
  final AuthService authService;
  final GoogleAuthService googleAuth;
  final ApiClient apiClient;

  const LoginScreen({
    super.key,
    required this.authService,
    required this.googleAuth,
    required this.apiClient,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;

  Future<void> _signIn() async {
    setState(() => _isLoading = true);

    final result = await widget.authService.signInWithEmail(
      _emailController.text,
      _passwordController.text,
    );

    setState(() => _isLoading = false);

    if (result.success) {
      // Navigate to home screen
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => HomeScreen(apiClient: widget.apiClient),
        ),
      );
    } else {
      // Show error
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.error ?? 'Sign in failed')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sign In')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              controller: _emailController,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _passwordController,
              decoration: const InputDecoration(labelText: 'Password'),
              obscureText: true,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isLoading ? null : _signIn,
              child: _isLoading
                  ? const CircularProgressIndicator()
                  : const Text('Sign In'),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: widget.googleAuth.signInWithGoogle,
              icon: const Icon(Icons.login),
              label: const Text('Sign in with Google'),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================
// Home Screen with API Call Example
// ============================================

class HomeScreen extends StatefulWidget {
  final ApiClient apiClient;

  const HomeScreen({super.key, required this.apiClient});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<dynamic> _products = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  Future<void> _loadProducts() async {
    try {
      final response = await widget.apiClient.get('/products');
      setState(() {
        _products = response.data as List<dynamic>;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load products: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Products')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _products.length,
              itemBuilder: (context, index) {
                final product = _products[index];
                return ListTile(
                  title: Text(product['name'] ?? 'Unknown'),
                  subtitle: Text(product['description'] ?? ''),
                );
              },
            ),
    );
  }
}
```

---

## Environment Variables

Add to your `.env` files:

```bash
# .env
MOBILE_APP_URL=restomarket://  # For CORS
```

---

## Testing Checklist

- [ ] Email/password sign in returns token in `set-auth-token` header
- [ ] Token is stored securely using FlutterSecureStorage
- [ ] Authenticated requests include `Authorization: Bearer <token>` header
- [ ] 401 responses trigger logout and redirect to login
- [ ] Google OAuth redirects back to app via deep link
- [ ] Token from OAuth callback is stored and validated
- [ ] OTP sign-in flow works (send OTP → verify → receive token)
- [ ] Session validation on app launch works
- [ ] Sign out clears token and redirects to login

---

## Security Best Practices

1. **Always use HTTPS** in production
2. **Use FlutterSecureStorage** for token storage (uses iOS Keychain / Android Keystore)
3. **Implement token refresh** if needed (Better Auth sessions expire after 7 days)
4. **Validate SSL certificates** in production (Dio does this by default)
5. **Add rate limiting** on sensitive endpoints
6. **Implement biometric auth** for additional security (local_auth package)

---

## Troubleshooting

### "CORS error" when calling auth endpoints

- Ensure `MOBILE_APP_URL` is added to `.env`
- Verify `trustedOrigins` includes your app's scheme
- Check CORS headers in auth route OPTIONS handler

### "401 Unauthorized" on API calls

- Verify token is stored correctly after sign-in
- Check that `Authorization` header is being sent
- Validate token hasn't expired (check session expiry in auth config)

### Google OAuth not redirecting back

- Verify deep link scheme is registered (AndroidManifest.xml / Info.plist)
- Ensure callback URL matches registered deep link
- Test deep links using `adb` (Android) or `xcrun simctl` (iOS)

---

## Next Steps

1. Add organization/team switching (already supported by Better Auth)
2. Implement biometric authentication (local_auth package)
3. Add offline support with local database (Drift, Hive, or Isar)
4. Implement push notifications for real-time updates
5. Add analytics and crash reporting (Firebase, Sentry)
