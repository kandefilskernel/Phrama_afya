import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'etat/fournisseurs.dart';
import 'etat/routeur.dart';
import 'presentation/theme.dart';

class NuruApp extends ConsumerStatefulWidget {
  const NuruApp({super.key});

  @override
  ConsumerState<NuruApp> createState() => _NuruAppEtat();
}

class _NuruAppEtat extends ConsumerState<NuruApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Au retour dans l'application, on tente tout de suite d'envoyer ce qui attendait.
  @override
  void didChangeAppLifecycleState(AppLifecycleState etat) {
    if (etat == AppLifecycleState.resumed && ref.read(sessionProvider).value != null) {
      ref.read(fileProvider.notifier).vider();
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Nuru ya Afya',
      debugShowCheckedModeBanner: false,
      theme: themeNuru(),
      locale: const Locale('fr', 'FR'),
      supportedLocales: const [Locale('fr', 'FR')],
      localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
      routerConfig: ref.watch(routeurProvider),
    );
  }
}
