import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/stockage/cache_local.dart';
import 'etat/fournisseurs.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('fr_FR');
  final preferences = await SharedPreferences.getInstance();
  runApp(ProviderScope(
    overrides: [cacheProvider.overrideWithValue(CachePreferences(preferences))],
    child: const NuruApp(),
  ));
}
