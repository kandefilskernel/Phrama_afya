import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme.dart';
import 'logo.dart';

/// Cadre commun des écrans de connexion et d'inscription : logo, titre, contenu, défilement sûr avec le clavier.
class CadreAuth extends StatelessWidget {
  const CadreAuth({super.key, required this.titre, this.sousTitre, required this.enfants, this.retour});

  final String titre;
  final String? sousTitre;
  final List<Widget> enfants;
  final VoidCallback? retour;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: retour == null ? null : AppBar(backgroundColor: Couleurs.fond, leading: BackButton(onPressed: retour)),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Center(child: MarqueNuru()),
                  const SizedBox(height: 32),
                  Text(titre, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, letterSpacing: -0.5, height: 1.2)),
                  if (sousTitre != null) ...[
                    const SizedBox(height: 8),
                    Text(sousTitre!, style: const TextStyle(fontSize: 15, color: Couleurs.ardoise600, height: 1.45)),
                  ],
                  const SizedBox(height: 24),
                  ...enfants,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Champ de saisie d'un code à 6 chiffres reçu par SMS.
class ChampCode extends StatelessWidget {
  const ChampCode({super.key, required this.controleur, required this.surChangement, this.autoFocus = true});

  final TextEditingController controleur;
  final ValueChanged<String> surChangement;
  final bool autoFocus;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controleur,
      autofocus: autoFocus,
      keyboardType: TextInputType.number,
      textAlign: TextAlign.center,
      autofillHints: const [AutofillHints.oneTimeCode],
      inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
      style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w700, letterSpacing: 12),
      decoration: const InputDecoration(hintText: '••••••', labelText: 'Code reçu par SMS', floatingLabelAlignment: FloatingLabelAlignment.center),
      onChanged: surChangement,
    );
  }
}
