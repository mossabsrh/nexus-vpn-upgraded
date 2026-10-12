import 'package:flutter/material.dart';

import '../core/theme.dart';

class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 28});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.shield_outlined, color: NexusColors.primary, size: size),
        const SizedBox(width: 8),
        Text(
          'NexusVPN',
          style: TextStyle(
            fontSize: size * 0.72,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.5,
          ),
        ),
      ],
    );
  }
}
