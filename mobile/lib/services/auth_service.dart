import '../core/api_client.dart';
import '../core/token_storage.dart';
import '../models/user.dart';

/// Talks to the backend's `/api/mobile/auth/*` and `/api/mobile/me` endpoints
/// and keeps the bearer token in secure storage.
class AuthService {
  AuthService(this._api, this._tokens);

  final ApiClient _api;
  final TokenStorage _tokens;

  Future<AuthUser> login(String email, String password, {String? device}) async {
    final res = await _api.post('/auth/login', data: {
      'email': email,
      'password': password,
      if (device != null) 'device_name': device,
    });
    final token = res['token'];
    if (token is String && token.isNotEmpty) {
      await _tokens.write(token);
    }
    return AuthUser.fromJson(res['user'] as Map<String, dynamic>);
  }

  Future<AuthUser> register({
    required String name,
    required String email,
    required String password,
    required String passwordConfirmation,
    required String planSlug,
    String? device,
  }) async {
    final res = await _api.post('/auth/register', data: {
      'name': name,
      'email': email,
      'password': password,
      'password_confirmation': passwordConfirmation,
      'plan_slug': planSlug,
      if (device != null) 'device_name': device,
    });
    final token = res['token'];
    if (token is String && token.isNotEmpty) {
      await _tokens.write(token);
    }
    return AuthUser.fromJson(res['user'] as Map<String, dynamic>);
  }

  Future<String> forgotPassword(String email) async {
    final res = await _api.post('/auth/forgot-password', data: {'email': email});
    return (res['message'] ?? 'If an account exists, a reset link has been sent.').toString();
  }

  Future<AuthUser> me() async {
    final res = await _api.get('/me');
    return AuthUser.fromJson(res['user'] as Map<String, dynamic>);
  }

  Future<String> resendVerification() async {
    final res = await _api.post('/email/verification-notification');
    return (res['message'] ?? 'Verification link sent.').toString();
  }

  Future<void> logout() async {
    try {
      await _api.post('/auth/logout');
    } catch (_) {
      // Even if the call fails, drop the local token.
    }
    await _tokens.clear();
  }

  Future<String?> currentToken() => _tokens.read();
}
