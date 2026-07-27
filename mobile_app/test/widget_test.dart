import 'package:flutter_test/flutter_test.dart';
import 'package:zukaping/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const ZukapingApp());
    expect(find.byType(ZukapingApp), findsOneWidget);
  });
}
