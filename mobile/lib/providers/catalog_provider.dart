import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/plan.dart';
import '../services/catalog_service.dart';
import 'auth_provider.dart';

final catalogServiceProvider =
    Provider<CatalogService>((ref) => CatalogService(ref.watch(apiClientProvider)));

/// All plans from `/api/pricing`.
final plansProvider =
    FutureProvider.autoDispose<List<Plan>>((ref) => ref.watch(catalogServiceProvider).plans());
