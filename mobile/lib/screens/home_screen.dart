import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_exception.dart';
import '../core/theme.dart';
import '../models/plan.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../providers/catalog_provider.dart';
import '../widgets/app_logo.dart';
import '../widgets/primary_button.dart';

import 'settings/settings_screen.dart';

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
            tooltip: 'Settings',
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            ),
          ),
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
                  const SizedBox(height: 20),
                  const _PlansAndCheckoutCard(),
                ],
              ),
            ),
    );
  }
}

class _SubscriptionCard extends ConsumerStatefulWidget {
  const _SubscriptionCard({required this.user});

  final AuthUser user;

  @override
  ConsumerState<_SubscriptionCard> createState() => _SubscriptionCardState();
}

class _SubscriptionCardState extends ConsumerState<_SubscriptionCard> {
  bool _canceling = false;

  Future<void> _cancel() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Subscription'),
        content: const Text('Are you sure you want to cancel your current subscription? Your active access will end.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Keep Active')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: NexusColors.destructive),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Yes, Cancel', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _canceling = true);
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/subscriptions/cancel');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message']?.toString() ?? 'Subscription canceled.')),
        );
      }
      await ref.read(authControllerProvider.notifier).refreshUser();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not cancel subscription. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _canceling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);
    final isSubscribed = widget.user.subscriptionStatus == 'active' || widget.user.subscriptionStatus == 'trialing';

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
            _row('Plan', widget.user.planId ?? '—', muted),
            _row('Status', widget.user.subscriptionStatus ?? 'none', muted),
            _row('VPN access', widget.user.hasVpnAccess ? 'Active' : 'Not active', muted),
            if (isSubscribed) ...[
              const SizedBox(height: 14),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: NexusColors.destructive,
                  side: BorderSide(color: NexusColors.destructive.withValues(alpha: 0.5)),
                  minimumSize: const Size.fromHeight(42),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: _canceling
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.cancel_outlined, size: 18),
                label: const Text('Cancel Subscription'),
                onPressed: _canceling ? null : _cancel,
              ),
            ],
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

class _PlansAndCheckoutCard extends ConsumerStatefulWidget {
  const _PlansAndCheckoutCard();

  @override
  ConsumerState<_PlansAndCheckoutCard> createState() => _PlansAndCheckoutCardState();
}

class _PlansAndCheckoutCardState extends ConsumerState<_PlansAndCheckoutCard> {
  String? _selectedSlug;
  bool _loadingCheckout = false;
  bool _loadingTrial = false;

  Future<void> _payWithChargily(String planSlug) async {
    setState(() => _loadingCheckout = true);
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/checkout', data: {
        'plan_slug': planSlug,
        'billing_period': 'monthly',
      });
      final checkoutUrl = res['checkout_url'] as String?;
      if (checkoutUrl != null && checkoutUrl.isNotEmpty) {
        final uri = Uri.parse(checkoutUrl);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else {
          _showMsg('Could not open payment URL in browser.');
        }
      } else {
        _showMsg(res['message']?.toString() ?? 'Checkout created successfully.');
      }
    } on ApiException catch (e) {
      _showMsg(e.message);
    } catch (_) {
      _showMsg('Payment initialization failed. Please try again.');
    } finally {
      if (mounted) setState(() => _loadingCheckout = false);
    }
  }

  Future<void> _startTrial(String planSlug) async {
    setState(() => _loadingTrial = true);
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/subscriptions/trial', data: {'plan_slug': planSlug});
      _showMsg(res['message']?.toString() ?? '7-day trial started successfully!');
      await ref.read(authControllerProvider.notifier).refreshUser();
    } on ApiException catch (e) {
      _showMsg(e.message);
    } catch (_) {
      _showMsg('Trial activation failed. Please try again.');
    } finally {
      if (mounted) setState(() => _loadingTrial = false);
    }
  }

  void _showMsg(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final plansAsync = ref.watch(plansProvider);
    final muted = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.local_offer_outlined, color: NexusColors.accent),
                const SizedBox(width: 10),
                Text('Available Plans & Payment', style: Theme.of(context).textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 6),
            Text('Choose a plan to pay with Chargily or start a 7-day free trial.',
                style: TextStyle(color: muted, fontSize: 13)),
            const SizedBox(height: 16),
            plansAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Text('Could not load plans: $e', style: const TextStyle(color: NexusColors.destructive)),
              data: (plans) {
                final selfServe = plans.where((p) => p.selfServe).toList();
                if (selfServe.isEmpty) {
                  return Text('No plans available.', style: TextStyle(color: muted));
                }
                _selectedSlug ??= (selfServe.firstWhere((p) => p.popular, orElse: () => selfServe.first)).slug;

                return Column(
                  children: [
                    ...selfServe.map((p) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: RadioListTile<String>(
                            value: p.slug,
                            groupValue: _selectedSlug,
                            title: Text('${p.name} (${p.monthlyLabel})',
                                style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: p.description != null ? Text(p.description!) : null,
                            onChanged: (val) => setState(() => _selectedSlug = val),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: BorderSide(
                                color: _selectedSlug == p.slug
                                    ? NexusColors.primary
                                    : Theme.of(context).dividerColor,
                              ),
                            ),
                          ),
                        )),
                    const SizedBox(height: 12),
                    if (_selectedSlug != null) ...[
                      PrimaryButton(
                        label: 'Pay with Chargily',
                        loading: _loadingCheckout,
                        onPressed: () => _payWithChargily(_selectedSlug!),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(48),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: _loadingTrial ? null : () => _startTrial(_selectedSlug!),
                        child: _loadingTrial
                            ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Text('Start 7-Day Free Trial'),
                      ),
                    ],
                  ],
                );
              },
            ),
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
