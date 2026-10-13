/// The authenticated user, as returned by `AuthController::userPayload` on the backend.
class AuthUser {
  AuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.emailVerified,
    this.planId,
    this.subscriptionStatus,
    this.hasVpnAccess = false,
  });

  final int id;
  final String name;
  final String email;
  final String role;
  final bool emailVerified;
  final String? planId;
  final String? subscriptionStatus;
  final bool hasVpnAccess;

  bool get isAdmin => role == 'admin';

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    final status = json['subscriptionStatus'] as String?;
    final active = status == 'active' || status == 'trialing';
    return AuthUser(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      role: json['role'] as String? ?? 'user',
      emailVerified: json['emailVerified'] as bool? ?? false,
      planId: json['planId'] as String?,
      subscriptionStatus: status,
      hasVpnAccess: json['hasVpnAccess'] as bool? ?? active,
    );
  }
}
