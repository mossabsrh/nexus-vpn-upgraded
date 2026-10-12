import '../core/api_client.dart';
import '../models/plan.dart';

/// Public catalog (pricing). No authentication required.
class CatalogService {
  CatalogService(this._api);

  final ApiClient _api;

  Future<List<Plan>> plans() async {
    final res = await _api.get('/pricing');
    final list = res['plans'] as List? ?? const [];
    return list.map((e) => Plan.fromJson(e as Map<String, dynamic>)).toList();
  }
}
