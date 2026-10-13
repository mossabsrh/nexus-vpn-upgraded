import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_exception.dart';
import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../widgets/primary_button.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  // Profile Form
  final _profileFormKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  bool _profileLoading = false;

  // Password Form
  final _passwordFormKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _passwordLoading = false;
  bool _obscureCurrent = true;
  bool _obscureNew = true;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authControllerProvider).user;
    _nameController = TextEditingController(text: user?.name ?? '');
    _emailController = TextEditingController(text: user?.email ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _updateProfile() async {
    if (!_profileFormKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _profileLoading = true);

    try {
      final api = ref.read(apiClientProvider);
      final res = await api.patch('/settings/profile', data: {
        'name': _nameController.text.trim(),
        'email': _emailController.text.trim(),
      });
      _showMsg(res['message']?.toString() ?? 'Profile updated successfully.');
      await ref.read(authControllerProvider.notifier).refreshUser();
    } on ApiException catch (e) {
      _showMsg(e.message);
    } catch (_) {
      _showMsg('Failed to update profile. Please try again.');
    } finally {
      if (mounted) setState(() => _profileLoading = false);
    }
  }

  Future<void> _updatePassword() async {
    if (!_passwordFormKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _passwordLoading = true);

    try {
      final api = ref.read(apiClientProvider);
      final res = await api.put('/settings/password', data: {
        'current_password': _currentPasswordController.text,
        'password': _newPasswordController.text,
        'password_confirmation': _confirmPasswordController.text,
      });
      _showMsg(res['message']?.toString() ?? 'Password updated successfully.');
      _currentPasswordController.clear();
      _newPasswordController.clear();
      _confirmPasswordController.clear();
    } on ApiException catch (e) {
      _showMsg(e.message);
    } catch (_) {
      _showMsg('Failed to update password. Please try again.');
    } finally {
      if (mounted) setState(() => _passwordLoading = false);
    }
  }

  Future<void> _confirmDeleteAccount() async {
    final passwordCtrl = TextEditingController();
    bool deleting = false;

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Delete Account'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Are you sure you want to delete your account? This action is permanent and cannot be undone.',
                style: TextStyle(color: NexusColors.destructive),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: passwordCtrl,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Confirm Password',
                  hintText: 'Enter your current password',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: NexusColors.destructive),
              onPressed: deleting
                  ? null
                  : () async {
                      if (passwordCtrl.text.isEmpty) return;
                      setDialogState(() => deleting = true);
                      try {
                        final api = ref.read(apiClientProvider);
                        await api.delete('/settings/account', data: {
                          'password': passwordCtrl.text,
                        });
                        if (mounted) {
                          Navigator.of(ctx).pop();
                          ref.read(authControllerProvider.notifier).logout();
                        }
                      } on ApiException catch (e) {
                        setDialogState(() => deleting = false);
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
                      } catch (_) {
                        setDialogState(() => deleting = false);
                        ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Failed to delete account. Try again.')));
                      }
                    },
              child: deleting
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Delete Account', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  void _showMsg(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final currentTheme = ref.watch(themeModeProvider);
    final muted = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // 1. Profile Section
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Form(
                  key: _profileFormKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.person_outline, color: NexusColors.primary),
                          const SizedBox(width: 10),
                          Text('Profile Information', style: Theme.of(context).textTheme.titleMedium),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text('Update your account\'s profile information and email address.',
                          style: TextStyle(color: muted, fontSize: 13)),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _nameController,
                        decoration: const InputDecoration(labelText: 'Name'),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter your name' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(labelText: 'Email'),
                        validator: (v) => (v == null || !v.contains('@')) ? 'Enter a valid email' : null,
                      ),
                      const SizedBox(height: 16),
                      PrimaryButton(
                        label: 'Save Profile',
                        loading: _profileLoading,
                        onPressed: _updateProfile,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // 2. Update Password Section
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Form(
                  key: _passwordFormKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.lock_outline, color: NexusColors.primary),
                          const SizedBox(width: 10),
                          Text('Update Password', style: Theme.of(context).textTheme.titleMedium),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text('Ensure your account is using a long, random password to stay secure.',
                          style: TextStyle(color: muted, fontSize: 13)),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _currentPasswordController,
                        obscureText: _obscureCurrent,
                        decoration: InputDecoration(
                          labelText: 'Current Password',
                          suffixIcon: IconButton(
                            icon: Icon(_obscureCurrent ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                            onPressed: () => setState(() => _obscureCurrent = !_obscureCurrent),
                          ),
                        ),
                        validator: (v) => (v == null || v.isEmpty) ? 'Enter current password' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _newPasswordController,
                        obscureText: _obscureNew,
                        decoration: InputDecoration(
                          labelText: 'New Password',
                          suffixIcon: IconButton(
                            icon: Icon(_obscureNew ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                            onPressed: () => setState(() => _obscureNew = !_obscureNew),
                          ),
                        ),
                        validator: (v) => (v == null || v.length < 8) ? 'At least 8 characters' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _confirmPasswordController,
                        obscureText: _obscureNew,
                        decoration: const InputDecoration(labelText: 'Confirm Password'),
                        validator: (v) => (v != _newPasswordController.text) ? 'Passwords do not match' : null,
                      ),
                      const SizedBox(height: 16),
                      PrimaryButton(
                        label: 'Update Password',
                        loading: _passwordLoading,
                        onPressed: _updatePassword,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // 3. Appearance / Theme Section
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.palette_outlined, color: NexusColors.primary),
                        const SizedBox(width: 10),
                        Text('Appearance', style: Theme.of(context).textTheme.titleMedium),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text('Customize the theme and interface of your app.',
                        style: TextStyle(color: muted, fontSize: 13)),
                    const SizedBox(height: 12),
                    RadioListTile<ThemeMode>(
                      value: ThemeMode.dark,
                      groupValue: currentTheme,
                      title: const Text('Dark Mode (Default)'),
                      subtitle: const Text('Dark background with glowing neon accents'),
                      onChanged: (mode) {
                        if (mode != null) ref.read(themeModeProvider.notifier).set(mode);
                      },
                    ),
                    RadioListTile<ThemeMode>(
                      value: ThemeMode.light,
                      groupValue: currentTheme,
                      title: const Text('Light Mode'),
                      subtitle: const Text('Clean light interface'),
                      onChanged: (mode) {
                        if (mode != null) ref.read(themeModeProvider.notifier).set(mode);
                      },
                    ),
                    RadioListTile<ThemeMode>(
                      value: ThemeMode.system,
                      groupValue: currentTheme,
                      title: const Text('System Default'),
                      subtitle: const Text('Match your device system theme settings'),
                      onChanged: (mode) {
                        if (mode != null) ref.read(themeModeProvider.notifier).set(mode);
                      },
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // 4. Delete Account Section
            Card(
              color: NexusColors.destructive.withValues(alpha: 0.08),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: NexusColors.destructive.withValues(alpha: 0.3)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.warning_amber_rounded, color: NexusColors.destructive),
                        const SizedBox(width: 10),
                        Text('Delete Account', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: NexusColors.destructive)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text('Permanently delete your NexusVPN account and cancel all active subscriptions.',
                        style: TextStyle(color: muted, fontSize: 13)),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: NexusColors.destructive,
                        minimumSize: const Size.fromHeight(48),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: _confirmDeleteAccount,
                      child: const Text('Delete Account', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
