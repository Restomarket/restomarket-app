# Flutter Authentication: Session vs Bearer Token

## Understanding Better Auth Sessions

Better Auth has **one unified session system** stored in the database:

```typescript
// Session table (from your schema)
{
  id: string,
  userId: string,
  token: string,              // ← The actual session token
  expiresAt: Date,
  ipAddress: string,
  userAgent: string,
  activeOrganizationId: string,
  activeTeamId: string,
}
```

The **same session** can be accessed in **two ways**:

### 1. Cookie-Based (Web Browsers) 🍪

- Token stored in HTTP-only cookie
- Browser automatically sends cookie with every request
- Best for: Web apps (Next.js, React, Vue)
- **Not ideal for Flutter** (mobile apps don't handle cookies like browsers)

### 2. Bearer Token (Mobile/API Clients) 🔑

- Token sent in `Authorization: Bearer <token>` header
- App manually manages token storage
- Best for: Mobile apps, desktop apps, external APIs
- **Recommended for Flutter**

---

## Can Flutter Use Session-Based (Cookie) Auth?

**Short answer: Yes, but it's complicated and not recommended.**

### Option A: Cookie-Based Auth in Flutter ❌ Not Recommended

Flutter's `http` package has limited cookie support. You'd need to:

```dart
import 'package:http/http.dart' as http;
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';

// Using Dio with cookie manager
final cookieJar = CookieJar();
final dio = Dio();
dio.interceptors.add(CookieManager(cookieJar));

// Sign in - cookies are automatically stored
await dio.post('https://your-domain.com/api/auth/sign-in/email',
  data: {'email': email, 'password': password}
);

// Subsequent requests automatically include cookies
await dio.get('https://your-domain.com/api/auth/get-session');
```

**Problems with this approach:**

1. **Security**: Cookies are stored in SharedPreferences (not secure like Keychain/Keystore)
2. **Complexity**: Need to manage cookie persistence across app restarts
3. **CORS issues**: Mobile apps may have CORS complications with cookies
4. **Domain constraints**: Cookies are domain-specific, hard to manage across dev/staging/prod
5. **Background sync**: Cookies don't work well with background tasks/push notifications
6. **Debugging**: Harder to inspect and debug cookie state
7. **Token refresh**: More complex to implement than Bearer tokens

### Option B: Bearer Token Auth ✅ Recommended

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final storage = FlutterSecureStorage();

// Sign in - extract token from header
final response = await http.post(
  Uri.parse('https://your-domain.com/api/auth/sign-in/email'),
  body: jsonEncode({'email': email, 'password': password}),
);

// Better Auth returns token in `set-auth-token` header
final token = response.headers['set-auth-token'];
await storage.write(key: 'bearer_token', value: token);

// Use token for subsequent requests
final token = await storage.read(key: 'bearer_token');
await http.get(
  Uri.parse('https://api.your-domain.com/api/v1/products'),
  headers: {'Authorization': 'Bearer $token'},
);
```

**Advantages:**

1. ✅ **Secure storage**: iOS Keychain / Android Keystore
2. ✅ **Simple**: Just a string token
3. ✅ **Portable**: Works across all environments
4. ✅ **Debuggable**: Easy to inspect token
5. ✅ **Background tasks**: Token available in all contexts
6. ✅ **Standard**: Industry-standard approach for mobile APIs

---

## How Sessions Work in Your Setup

### When User Signs In (Any Method)

```
1. User signs in via email/password or OAuth
   ↓
2. Better Auth creates session in database:
   {
     id: "session_123",
     userId: "user_456",
     token: "random_secure_token_xyz",  ← This is your session token
     expiresAt: 7 days from now
   }
   ↓
3. Response differs by client:

   📱 Flutter (Bearer plugin enabled):
      Headers: { "set-auth-token": "random_secure_token_xyz" }

   🌐 Web Browser (cookies):
      Headers: { "Set-Cookie": "better-auth.session_token=random_secure_token_xyz; HttpOnly; Secure" }
```

### When User Makes Authenticated Request

```
📱 Flutter Request:
GET /api/v1/products
Headers: {
  "Authorization": "Bearer random_secure_token_xyz"
}
↓
NestJS PermissionsGuard extracts token from header
↓
Validates against session table in database
↓
Returns user data + permissions

🌐 Web Browser Request:
GET /api/v1/products
Cookies: {
  "better-auth.session_token": "random_secure_token_xyz"
}
↓
Better Auth middleware extracts token from cookie
↓
Validates against session table in database
↓
Returns user data + permissions
```

**Same session, different transport mechanism!**

---

## Comparison Table

| Feature                | Cookie-Based (Web)             | Bearer Token (Mobile)                     |
| ---------------------- | ------------------------------ | ----------------------------------------- |
| **Storage**            | Browser cookie store           | Secure device storage (Keychain/Keystore) |
| **Automatic sending**  | ✅ Browser handles             | ❌ App must attach to headers             |
| **Security**           | ✅ HttpOnly prevents JS access | ✅ Encrypted at OS level                  |
| **CORS**               | ⚠️ Complex with credentials    | ✅ Simple (just headers)                  |
| **Domain binding**     | ⚠️ Tied to domain              | ✅ Works anywhere                         |
| **Background tasks**   | ❌ Not accessible              | ✅ Accessible                             |
| **Debugging**          | ⚠️ Hidden in browser           | ✅ Easy to inspect                        |
| **Multi-environment**  | ⚠️ Cookie per domain           | ✅ Single token                           |
| **Token refresh**      | ⚠️ Complex                     | ✅ Simple string replacement              |
| **Push notifications** | ❌ Not compatible              | ✅ Full support                           |
| **Best for**           | Web apps                       | Mobile apps, APIs, desktop apps           |

---

## Your Current Setup

### Already Configured ✅

```typescript
// packages/shared/src/auth/config.ts
plugins: [
  bearer(), // ← Enables Bearer token auth
  // ... other plugins
];
```

This means:

- ✅ Sessions created by sign-in work with **both** cookies and Bearer tokens
- ✅ NestJS `PermissionsGuard` validates **both** cookie and Bearer authentication
- ✅ Flutter can use Bearer tokens without any backend changes

### What Happens When Flutter Signs In

```dart
// 1. Flutter makes sign-in request
final response = await http.post(
  Uri.parse('https://your-domain.com/api/auth/sign-in/email'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'email': 'user@example.com', 'password': 'pass123'}),
);

// 2. Better Auth creates session in database:
//    INSERT INTO session (id, user_id, token, expires_at)
//    VALUES ('session_123', 'user_456', 'abc123...', '2024-01-20')

// 3. Better Auth returns BOTH cookie AND header:
//    - Set-Cookie: better-auth.session_token=abc123...
//      (Flutter ignores this - no cookie jar configured)
//
//    - set-auth-token: abc123...
//      (Flutter uses this! ✅)

final token = response.headers['set-auth-token'];  // "abc123..."

// 4. Flutter stores token securely
await storage.write(key: 'bearer_token', value: token);

// 5. Flutter makes API request with Bearer token
await http.get(
  Uri.parse('https://api.your-domain.com/api/v1/products'),
  headers: {'Authorization': 'Bearer $token'},  // Uses stored token
);

// 6. NestJS receives request:
//    GET /api/v1/products
//    Headers: { Authorization: "Bearer abc123..." }

// 7. PermissionsGuard extracts token:
private extractToken(request: Request): string | undefined {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);  // Returns "abc123..."
  }
  return undefined;
}

// 8. Guard validates token against session table:
//    SELECT * FROM session WHERE token = 'abc123...' AND expires_at > NOW()
//    ✅ Found! User is authenticated.

// 9. Request proceeds with user context attached
```

---

## Session Lifecycle

### Both Web and Mobile Share Same Sessions

```
Database Session Table:
┌─────────────┬──────────┬──────────┬────────────┐
│ id          │ user_id  │ token    │ expires_at │
├─────────────┼──────────┼──────────┼────────────┤
│ session_001 │ user_123 │ abc123   │ Jan 20     │  ← Web browser session
│ session_002 │ user_123 │ xyz789   │ Jan 21     │  ← Flutter app session
│ session_003 │ user_456 │ def456   │ Jan 19     │  ← Another user
└─────────────┴──────────┴──────────┴────────────┘

Same user can have multiple sessions:
- Web browser on laptop
- Flutter app on phone
- Flutter app on tablet
```

### Session Management

```dart
// Get all active sessions (requires admin permission)
final sessions = await authClient.listSessions();
// Returns all sessions for current user

// Revoke specific session
await authClient.revokeSession(sessionId: 'session_001');

// Sign out (revokes current session)
await authClient.signOut();
// Deletes session from database
```

---

## Token Validation Flow

### Web (Cookie-Based)

```
Browser → Cookie: session_token=abc123
           ↓
Next.js Middleware → better-auth extracts from cookie
           ↓
Database → SELECT * FROM session WHERE token='abc123'
           ↓
Response with user data
```

### Flutter (Bearer Token)

```
Flutter App → Header: Authorization: Bearer abc123
              ↓
NestJS Guard → Extract from Authorization header
              ↓
Database → SELECT * FROM session WHERE token='abc123'
              ↓
Response with user data
```

**Same database query, different input method!**

---

## Advanced: Hybrid Approach (Cookie + Bearer)

If you really need both cookie and Bearer support in Flutter (e.g., for WebViews):

```dart
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:cookie_jar/cookie_jar.dart';

class HybridAuthClient {
  final Dio _dio;
  final CookieJar _cookieJar;
  final FlutterSecureStorage _storage;

  HybridAuthClient()
    : _cookieJar = CookieJar(),
      _storage = FlutterSecureStorage(),
      _dio = Dio() {

    // Enable cookie support
    _dio.interceptors.add(CookieManager(_cookieJar));

    // Also add Bearer token
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'bearer_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
    ));
  }

  Future<void> signIn(String email, String password) async {
    final response = await _dio.post(
      'https://your-domain.com/api/auth/sign-in/email',
      data: {'email': email, 'password': password},
    );

    // Cookies are automatically stored by CookieManager
    // Also extract and store Bearer token
    final token = response.headers['set-auth-token']?.first;
    if (token != null) {
      await _storage.write(key: 'bearer_token', value: token);
    }
  }
}
```

**When to use this:**

- Flutter app with embedded WebView that needs cookies
- Sharing auth between native code and WebView content
- Still not recommended unless you have a specific use case

---

## Recommendation for Your Project

### Use Bearer Token Auth (Already Configured) ✅

**Why:**

1. Your backend already supports it (Bearer plugin enabled)
2. More secure for mobile (Keychain/Keystore)
3. Simpler implementation
4. Better for background tasks and push notifications
5. Industry standard for mobile APIs

**Implementation:**
Follow the guide in `/docs/FLUTTER_AUTH_INTEGRATION.md`

### If You Need Cookie Support

Only implement cookies if you have a **specific requirement** like:

- Embedded WebView needs to share session
- Legacy system integration
- Specific compliance requirement

Even then, use the hybrid approach (Bearer + Cookies) so you have the best of both worlds.

---

## Token Refresh / Session Extension

Better Auth automatically extends sessions:

```typescript
// packages/shared/src/auth/config.ts
session: {
  expiresIn: 60 * 60 * 24 * 7,    // 7 days
  updateAge: 60 * 60 * 24,         // Update every 24 hours
}
```

**What this means:**

- Session expires after 7 days of **no activity**
- Every time user makes a request, if it's been >24 hours, session is extended
- Flutter doesn't need to handle refresh tokens - it's automatic!

**Flutter implementation:**

```dart
// Check if session is still valid
Future<bool> isSessionValid() async {
  try {
    final response = await http.get(
      Uri.parse('$authBaseUrl/get-session'),
      headers: {'Authorization': 'Bearer ${await getToken()}'},
    );
    return response.statusCode == 200;
  } catch (e) {
    return false;
  }
}

// Call on app launch
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final authService = AuthService();
  final isValid = await authService.isSessionValid();

  runApp(MyApp(
    initialRoute: isValid ? '/home' : '/login',
  ));
}
```

---

## Security Considerations

### Bearer Token Security in Flutter

```dart
// ✅ GOOD: Use FlutterSecureStorage
final storage = FlutterSecureStorage(
  aOptions: AndroidOptions(
    encryptedSharedPreferences: true,  // Android Keystore
  ),
  iOptions: IOSOptions(
    accessibility: KeychainAccessibility.first_unlock,  // iOS Keychain
  ),
);

// ❌ BAD: Don't use SharedPreferences for tokens
final prefs = await SharedPreferences.getInstance();
prefs.setString('token', token);  // Stored in plain text!

// ❌ BAD: Don't log tokens
print('Token: $token');  // Visible in logs!

// ✅ GOOD: Implement token cleanup
Future<void> clearToken() async {
  await storage.delete(key: 'bearer_token');
  await storage.delete(key: 'user_data');
}
```

### Cookie Security (If You Use Them)

```dart
// Cookies stored via cookie_jar are NOT secure by default
// They're saved to file system in plain text
// Only use for non-sensitive data or with additional encryption
```

---

## Summary

| Question                            | Answer                                                  |
| ----------------------------------- | ------------------------------------------------------- |
| Can Flutter use session-based auth? | Yes - both methods use the **same session system**      |
| Should Flutter use cookies?         | ❌ No - use Bearer tokens instead                       |
| Is Bearer token less secure?        | ❌ No - actually **more secure** with Keychain/Keystore |
| Do I need JWT plugin?               | ❌ No - Bearer plugin already enabled                   |
| Will web and mobile share sessions? | ✅ Yes - same database, different transport             |
| Do I need backend changes?          | ✅ No - already configured correctly                    |

**Bottom line:** Your setup is already perfect for Flutter. Use Bearer tokens as shown in the Flutter integration guide.
