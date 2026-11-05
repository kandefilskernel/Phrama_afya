import 'package:flutter/material.dart';

import '../theme.dart';

/// Surface blanche à bord fin : la brique de base de tous les écrans.
class CarteNuru extends StatelessWidget {
  const CarteNuru({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap, this.couleur});

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? couleur;

  @override
  Widget build(BuildContext context) {
    final forme = RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: Couleurs.ardoise200));
    return Material(
      color: couleur ?? Colors.white,
      shape: forme,
      clipBehavior: Clip.antiAlias,
      child: onTap == null ? Padding(padding: padding, child: child) : InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
    );
  }
}

/// Titre de section d'un écran.
class TitreSection extends StatelessWidget {
  const TitreSection(this.texte, {super.key, this.action});

  final String texte;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 24, bottom: 10),
      child: Row(
        children: [
          Expanded(child: Text(texte, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, letterSpacing: -0.2))),
          ?action,
        ],
      ),
    );
  }
}
