import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Stores the Sanctum bearer token in the device's secure storage (Android Keystore).
class TokenStorage {
  TokenStorage([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _key = 'auth_token';
  static const _cookieKey = 'auth_cookies';

  Future<String?> read() => _storage.read(key: _key);
  Future<void> write(String token) => _storage.write(key: _key, value: token);

  Future<String?> readRawCookies() => _storage.read(key: _cookieKey);
  Future<void> writeRawCookies(String cookies) => _storage.write(key: _cookieKey, value: cookies);

  Future<void> clear() async {
    await _storage.delete(key: _key);
    await _storage.delete(key: _cookieKey);
  }
}
