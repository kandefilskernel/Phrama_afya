import 'package:flutter/material.dart';

/// Palette de la marque, identique à celle du site : un vert profond et un accent chaud « lumière ».
class Couleurs {
  static const marque50 = Color(0xFFEFFAF5);
  static const marque100 = Color(0xFFD6F2E5);
  static const marque200 = Color(0xFFAEE4CC);
  static const marque500 = Color(0xFF1F9A76);
  static const marque600 = Color(0xFF0F7B61);
  static const marque700 = Color(0xFF0C6350);
  static const marque800 = Color(0xFF0A4F41);
  static const marque950 = Color(0xFF04251F);

  static const lumiere500 = Color(0xFFF5A524);
  static const lumiere50 = Color(0xFFFFF8E8);
  static const lumiere700 = Color(0xFFB46B08);

  static const fond = Color(0xFFF4F7F6);
  static const encre = Color(0xFF0F1F1A);
  static const ardoise500 = Color(0xFF64748B);
  static const ardoise600 = Color(0xFF475569);
  static const ardoise300 = Color(0xFFCBD5E1);
  static const ardoise200 = Color(0xFFE2E8F0);
  static const ardoise100 = Color(0xFFF1F5F9);

  static const rouge600 = Color(0xFFDC2626);
  static const rouge50 = Color(0xFFFEF2F2);
  static const rouge700 = Color(0xFFB91C1C);
  static const ciel50 = Color(0xFFF0F9FF);
  static const ciel700 = Color(0xFF0369A1);
}

ThemeData themeNuru() {
  final base = ColorScheme.fromSeed(seedColor: Couleurs.marque600, brightness: Brightness.light).copyWith(
    primary: Couleurs.marque600,
    onPrimary: Colors.white,
    secondary: Couleurs.lumiere500,
    surface: Colors.white,
    error: Couleurs.rouge600,
  );

  const rayon = BorderRadius.all(Radius.circular(10));
  final bordure = OutlineInputBorder(borderRadius: rayon, borderSide: const BorderSide(color: Couleurs.ardoise300));

  return ThemeData(
    useMaterial3: true,
    colorScheme: base,
    scaffoldBackgroundColor: Couleurs.fond,
    visualDensity: VisualDensity.standard,
    textTheme: Typography.material2021().black.apply(bodyColor: Couleurs.encre, displayColor: Couleurs.encre),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: Couleurs.encre,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: Couleurs.encre, letterSpacing: -0.2),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: Couleurs.marque100,
      surfaceTintColor: Colors.transparent,
      height: 68,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (s) => TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: s.contains(WidgetState.selected) ? Couleurs.marque700 : Couleurs.ardoise500),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(size: 24, color: s.contains(WidgetState.selected) ? Couleurs.marque700 : Couleurs.ardoise500),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: bordure,
      enabledBorder: bordure,
      focusedBorder: bordure.copyWith(borderSide: const BorderSide(color: Couleurs.marque600, width: 2)),
      errorBorder: bordure.copyWith(borderSide: const BorderSide(color: Couleurs.rouge600)),
      focusedErrorBorder: bordure.copyWith(borderSide: const BorderSide(color: Couleurs.rouge600, width: 2)),
      hintStyle: const TextStyle(color: Couleurs.ardoise500),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: const RoundedRectangleBorder(borderRadius: rayon),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: const RoundedRectangleBorder(borderRadius: rayon),
        side: const BorderSide(color: Couleurs.ardoise300),
        foregroundColor: Couleurs.encre,
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: Couleurs.marque700, textStyle: const TextStyle(fontWeight: FontWeight.w600)),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Colors.white,
      selectedColor: Couleurs.marque600,
      side: const BorderSide(color: Couleurs.ardoise200),
      shape: const StadiumBorder(),
      labelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
      showCheckmark: false,
    ),
    dividerTheme: const DividerThemeData(color: Couleurs.ardoise100, thickness: 1, space: 1),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: rayon)),
  );
}
