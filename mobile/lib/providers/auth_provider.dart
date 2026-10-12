import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../core/token_storage.dart';
import '../models/user.dart';
import '../services/auth_service.dart';

enum AuthStatus { unknown, authenticated, guest }

class AuthState {
  const AuthState(this.status, {this.user});

  final AuthStatus status;
  final AuthUser? user;

  bool get isAuthenticated => status == AuthStatus.authenticated;
}

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

final apiClientProvider =
    Provider<ApiClient>((ref) => ApiClient(ref.watch(tokenStorageProvider)));

final authServiceProvider = Provider<AuthService>(
  (ref) => AuthService(ref.watch(apiClientProvider), ref.watch(tokenStorageProvider)),
);

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

class AuthController extends Notifier<AuthState> {
  static const _device = 'NexusVPN Android';

  AuthService get _service => ref.read(authServiceProvider);

  @override
  AuthState build() => const AuthState(AuthStatus.unknown);

  /// Called on startup: if a stored token is valid, go authenticated.
  Future<void> loadSession() async {
    final token = await _service.currentToken();
    if (token == null || token.isEmpty) {
      state = const AuthState(AuthStatus.guest);
      return;
    }
    try {
      state = AuthState(AuthStatus.authenticated, user: await _service.me());
    } catch (_) {
      state = const AuthState(AuthStatus.guest);
    }
  }

  Future<void> login(String email, String password) async {
    final user = await _service.login(email.trim(), password, device: _device);
    state = AuthState(AuthStatus.authenticated, user: user);
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
    required String passwordConfirmation,
    required String planSlug,
  }) async {
    final user = await _service.register(
      name: name.trim(),
      email: email.trim(),
      password: password,
      passwordConfirmation: passwordConfirmation,
      planSlug: planSlug,
      device: _device,
    );
    state = AuthState(AuthStatus.authenticated, user: user);
  }

  Future<String> forgotPassword(String email) => _service.forgotPassword(email.trim());

  Future<void> refreshUser() async {
    try {
      state = AuthState(AuthStatus.authenticated, user: await _service.me());
    } catch (_) {
      // keep current state
    }
  }

  Future<void> logout() async {
    await _service.logout();
    state = const AuthState(AuthStatus.guest);
  }

  /// A request came back 401 — the token is gone/expired/revoked.
  void onUnauthorized() {
    if (state.status != AuthStatus.guest) {
      state = const AuthState(AuthStatus.guest);
    }
  }
}
