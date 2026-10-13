class Plan {
  Plan({
    required this.slug,
    required this.name,
    this.description,
    this.monthlyPrice,
    this.yearlyPrice,
    this.yearlyTotal,
    this.currency = 'DZD',
    this.features = const [],
    this.popular = false,
    this.cta,
    this.selfServe = true,
  });

  final String slug;
  final String name;
  final String? description;
  final int? monthlyPrice;
  final int? yearlyPrice;
  final int? yearlyTotal;
  final String currency;
  final List<String> features;
  final bool popular;
  final String? cta;
  final bool selfServe;

  String get monthlyLabel =>
      monthlyPrice == null ? 'Custom pricing' : '$monthlyPrice $currency/mo';

  factory Plan.fromJson(Map<String, dynamic> json) => Plan(
        slug: json['slug'] as String,
        name: json['name'] as String? ?? '',
        description: json['description'] as String?,
        monthlyPrice: (json['monthlyPrice'] as num?)?.toInt(),
        yearlyPrice: (json['yearlyPrice'] as num?)?.toInt(),
        yearlyTotal: (json['yearlyTotal'] as num?)?.toInt(),
        currency: json['currency'] as String? ?? 'DZD',
        features: (json['features'] as List?)?.map((e) => e.toString()).toList() ?? const [],
        popular: json['popular'] as bool? ?? false,
        cta: json['cta'] as String?,
        selfServe: json['selfServe'] as bool? ?? (json['slug'] != 'team'),
      );
}
