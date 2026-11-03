package handlers

import "testing"

func TestGatewayPayerName(t *testing.T) {
	cases := []struct {
		in   []string
		want string
	}{
		{[]string{"Ada Okafor", "ada45"}, "Ada Okafor"},
		{[]string{"user123"}, "user Customer"},
		{[]string{"Buyer", "buyer99"}, "Buyer Customer"},
		{[]string{"Chidera", "chidi_9"}, "Chidera chidi"},
		{[]string{"💃", "42"}, "Zukaping Customer"},
		{[]string{"", ""}, "Zukaping Customer"},
		{[]string{"Bọ́là Ògún"}, "Bọ́là Ògún"},
		{[]string{"  A-B   C'afe  "}, "A-B C'afe"},
	}
	for _, tc := range cases {
		if got := gatewayPayerName(tc.in...); got != tc.want {
			t.Errorf("gatewayPayerName(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestPaymentReferenceIsUnforgeable(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 200; i++ {
		ref := newPaymentReference()
		if len(ref) < 10 || ref[:2] != "zk" || seen[ref] {
			t.Fatalf("bad reference %q", ref)
		}
		seen[ref] = true
	}
}
