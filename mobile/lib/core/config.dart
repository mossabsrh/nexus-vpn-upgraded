/// App configuration.
///
/// The API address can be overridden at run time (e.g. to point at your PC's
/// LAN IP when testing on a real phone):
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.20:8000
class AppConfig {
  /// Origin of the Laravel backend — no trailing slash, no `/api`.
  /// Default `10.0.2.2` is the Android emulator's alias for the host machine's localhost.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://nexus-vpn-upgraded.vercel.app',
  );

  /// REST base. Backend endpoints live under `/backend-api`.
  static String get apiUrl => '$apiBaseUrl/backend-api';
}
