import 'dart:convert';

String normalizeBase64Url(String str) {
  String normalized = str.replaceAll('-', '+').replaceAll('_', '/');
  switch (normalized.length % 4) {
    case 2: normalized += '=='; break;
    case 3: normalized += '='; break;
  }
  return normalized;
}

String decodeJwtPayload(String token) {
  try {
    final parts = token.split('.');
    if (parts.length != 3) return '';
    final payload = normalizeBase64Url(parts[1]);
    return utf8.decode(base64.decode(payload));
  } catch (e) {
    return '';
  }
}

Map<String, dynamic>? parseJwtPayload(String token) {
  try {
    final payloadStr = decodeJwtPayload(token);
    if (payloadStr.isEmpty) return null;
    return json.decode(payloadStr) as Map<String, dynamic>;
  } catch (e) {
    return null;
  }
}