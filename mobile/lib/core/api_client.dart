import 'package:dio/dio.dart';

import 'api_exception.dart';
import 'config.dart';
import 'token_storage.dart';

/// Thin wrapper around Dio that attaches the bearer token and turns
/// responses/errors into plain maps or [ApiException]s.
class ApiClient {
  ApiClient(this._tokens) {
    dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 20),
        headers: {'Accept': 'application/json'},
        // Treat 4xx as normal responses so we can map them to messages ourselves.
        validateStatus: (status) => status != null && status < 500,
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _tokens.read();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          final cookies = await _tokens.readRawCookies();
          if (cookies != null && cookies.isNotEmpty) {
            options.headers['Cookie'] = cookies;
          }
          handler.next(options);
        },
        onResponse: (response, handler) async {
          final setCookie = response.headers['set-cookie'];
          if (setCookie != null && setCookie.isNotEmpty) {
            final cookies = setCookie.map((c) => c.split(';').first).join('; ');
            await _tokens.writeRawCookies(cookies);
          }
          handler.next(response);
        },
      ),
    );
  }

  late final Dio dio;
  final TokenStorage _tokens;

  /// Called whenever the server answers 401 (token missing/expired/revoked).
  /// Set once after construction (see `main.dart`), so the client has no
  /// compile-time dependency on the auth provider.
  void Function()? onUnauthorized;

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query}) =>
      _send('GET', path, query: query);

  Future<Map<String, dynamic>> post(String path, {Object? data}) =>
      _send('POST', path, data: data);

  Future<Map<String, dynamic>> put(String path, {Object? data}) =>
      _send('PUT', path, data: data);

  Future<Map<String, dynamic>> patch(String path, {Object? data}) =>
      _send('PATCH', path, data: data);

  Future<Map<String, dynamic>> delete(String path, {Object? data}) =>
      _send('DELETE', path, data: data);

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Object? data,
    Map<String, dynamic>? query,
  }) async {
    try {
      final res = await dio.request(
        path,
        data: data,
        queryParameters: query,
        options: Options(method: method),
      );
      final body = res.data;
      final map = body is Map<String, dynamic> ? body : <String, dynamic>{};
      final status = res.statusCode ?? 0;

      if (status >= 200 && status < 300) return map;
      if (status == 401) onUnauthorized?.call();

      throw ApiException(
        _messageFrom(map),
        statusCode: status,
        code: map['code'] as String?,
      );
    } on DioException catch (e) {
      throw ApiException(_networkMessage(e), statusCode: e.response?.statusCode);
    }
  }

  String _messageFrom(Map<String, dynamic> map) {
    final errors = map['errors'];
    if (errors is Map && errors.isNotEmpty) {
      final first = errors.values.first;
      if (first is List && first.isNotEmpty) return first.first.toString();
    }
    return (map['error'] ?? map['message'] ?? 'Something went wrong.').toString();
  }

  String _networkMessage(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return 'The server took too long to respond. Please try again.';
      default:
        return 'Could not reach the server. Check your connection and the API address.';
    }
  }
}
