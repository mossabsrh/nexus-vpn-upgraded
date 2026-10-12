import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Colors taken from the website's design tokens (`app/globals.css`).
class NexusColors {
  static const primary = Color(0xFF1AD1D1); // cyan
  static const onPrimary = Color(0xFF04141A);
  static const accent = Color(0xFF7C5CFF); // purple
  static const destructive = Color(0xFFE5484D);

  // Dark (the website's default theme)
  static const darkBg = Color(0xFF080B14);
  static const darkCard = Color(0xFF10141E);
  static const darkField = Color(0xFF0E121B);
  static const darkBorder = Color(0xFF242A3A);
  static const darkFg = Color(0xFFF4F6F8);
  static const darkMutedFg = Color(0xFF8C93A3);

  // Light
  static const lightBg = Color(0xFFF4F6F8);
  static const lightCard = Color(0xFFE9ECF2);
  static const lightBorder = Color(0xFFCCD2DE);
  static const lightFg = Color(0xFF080B14);
  static const lightMutedFg = Color(0xFF5A6072);
}

ThemeData buildAppTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final bg = isDark ? NexusColors.darkBg : NexusColors.lightBg;
  final card = isDark ? NexusColors.darkCard : NexusColors.lightCard;
  final field = isDark ? NexusColors.darkField : Colors.white;
  final border = isDark ? NexusColors.darkBorder : NexusColors.lightBorder;
  final fg = isDark ? NexusColors.darkFg : NexusColors.lightFg;
  final mutedFg = isDark ? NexusColors.darkMutedFg : NexusColors.lightMutedFg;

  final scheme = ColorScheme(
    brightness: brightness,
    primary: NexusColors.primary,
    onPrimary: NexusColors.onPrimary,
    secondary: NexusColors.accent,
    onSecondary: Colors.white,
    error: NexusColors.destructive,
    onError: Colors.white,
    surface: card,
    onSurface: fg,
  );

  final base = ThemeData(brightness: brightness, useMaterial3: true, colorScheme: scheme);

  TextTheme textTheme;
  try {
    // Geist is the website's font; falls back to the platform font if unavailable.
    textTheme = GoogleFonts.getTextTheme('Geist', base.textTheme);
  } catch (_) {
    textTheme = base.textTheme;
  }

  return base.copyWith(
    scaffoldBackgroundColor: bg,
    textTheme: textTheme.apply(bodyColor: fg, displayColor: fg),
    appBarTheme: AppBarTheme(
      backgroundColor: bg,
      foregroundColor: fg,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: card,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: field,
      hintStyle: TextStyle(color: mutedFg),
      labelStyle: TextStyle(color: mutedFg),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: NexusColors.primary, width: 1.6),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: NexusColors.destructive),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: NexusColors.primary,
        foregroundColor: NexusColors.onPrimary,
        minimumSize: const Size.fromHeight(52),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: NexusColors.primary),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: card,
      contentTextStyle: TextStyle(color: fg),
      behavior: SnackBarBehavior.floating,
    ),
    dividerColor: border,
  );
}
