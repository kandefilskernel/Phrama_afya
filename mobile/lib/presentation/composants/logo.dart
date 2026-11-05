import 'package:flutter/material.dart';

import '../theme.dart';

/// Symbole de la marque : une croix de santé et un point de lumière (« nuru » signifie lumière).
class LogoNuru extends StatelessWidget {
  const LogoNuru({super.key, this.taille = 40});

  final double taille;

  @override
  Widget build(BuildContext context) => SizedBox(width: taille, height: taille, child: CustomPaint(painter: _PeintreLogo()));
}

class _PeintreLogo extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 32);
    canvas.drawRRect(RRect.fromLTRBR(0, 0, 32, 32, const Radius.circular(8)), Paint()..color = Couleurs.marque600);
    final blanc = Paint()..color = Colors.white;
    canvas.drawRRect(RRect.fromLTRBR(8.5, 13, 23.5, 19, const Radius.circular(1)), blanc);
    canvas.drawRRect(RRect.fromLTRBR(13, 8.5, 19, 23.5, const Radius.circular(1)), blanc);
    canvas.drawCircle(const Offset(24, 8), 3.2, Paint()..color = Couleurs.lumiere500);
  }

  @override
  bool shouldRepaint(covariant CustomPainter ancien) => false;
}

/// Logo et nom, pour les écrans d'accueil.
class MarqueNuru extends StatelessWidget {
  const MarqueNuru({super.key, this.taille = 40});

  final double taille;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        LogoNuru(taille: taille),
        const SizedBox(width: 10),
        Text.rich(
          TextSpan(
            text: 'Nuru ',
            style: TextStyle(fontSize: taille * 0.46, fontWeight: FontWeight.w700, color: Couleurs.marque950, letterSpacing: -0.3),
            children: const [TextSpan(text: 'ya Afya', style: TextStyle(color: Couleurs.marque600))],
          ),
        ),
      ],
    );
  }
}
