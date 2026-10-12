import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../widgets/app_logo.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;

    return Scaffold(
      appBar: AppBar(
        title: const AppLogo(size: 24),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      body: user == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () => ref.read(authControllerProvider.notifier).refreshUser(),
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Text('Hi, ${user.name}',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(user.email,
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
                  const SizedBox(height: 20),
                  if (!user.emailVerified) const _VerifyEmailBanner(),
                  _SubscriptionCard(user: user),
                  const SizedBox(height: 16),
                  const _ComingNextCard(),
                ],
              ),
            ),
    );
  }
}

class _SubscriptionCard extends StatelessWidget {
  const _SubscriptionCard({required this.user});

  final AuthUser user;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.workspace_premium_outlined, color: NexusColors.primary),
                const SizedBox(width: 10),
                Text('Subscription', style: Theme.of(context).textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 14),
            _row('Plan', user.planId ?? '—', muted),
            _row('Status', user.subscriptionStatus ?? 'none', muted),
            _row('VPN access', user.hasVpnAccess ? 'Active' : 'Not active', muted),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value, Color muted) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: TextStyle(color: muted)),
            Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
          ],
        ),
      );
}

class _ComingNextCard extends StatelessWidget {
  const _ComingNextCard();

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Coming next', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text('Plans, dashboard, Chargily payment, VPN config download and profile settings.',
                style: TextStyle(color: muted)),
          ],
        ),
      ),
    );
  }
}

class _VerifyEmailBanner extends ConsumerStatefulWidget {
  const _VerifyEmailBanner();

  @override
  ConsumerState<_VerifyEmailBanner> createState() => _VerifyEmailBannerState();
}

class _VerifyEmailBannerState extends ConsumerState<_VerifyEmailBanner> {
  bool _sending = false;

  Future<void> _resend() async {
    setState(() => _sending = true);
    String message;
    try {
      message = await ref.read(authServiceProvider).resendVerification();
    } catch (_) {
      message = 'Could not send the verification email. Please try again.';
    }
    if (!mounted) return;
    setState(() => _sending = false);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: NexusColors.accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: NexusColors.accent.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          const Icon(Icons.mark_email_unread_outlined, color: NexusColors.accent),
          const SizedBox(width: 12),
          const Expanded(child: Text('Please verify your email to subscribe and get a VPN config.')),
          _sending
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : TextButton(onPressed: _resend, child: const Text('Resend')),
        ],
      ),
    );
  }
}
