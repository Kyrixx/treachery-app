package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCatalogListsCardsAndDistribution(t *testing.T) {
	srv := httptest.NewServer(routes(NewServer()))
	defer srv.Close()
	res, err := http.Get(srv.URL + "/api/catalog")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(res.Body).Decode(&raw); err != nil {
		t.Fatal(err)
	}
	if len(raw) != 2 {
		t.Fatalf("catalog has unexpected fields: %v", raw)
	}
	var cards []map[string]any
	var dist map[string][4]int
	json.Unmarshal(raw["cards"], &cards)
	json.Unmarshal(raw["distribution"], &dist)
	if len(cards) != 62 {
		t.Fatalf("got %d cards", len(cards))
	}
	for _, c := range cards {
		if len(c) != 5 {
			t.Fatalf("card has unexpected fields: %v", c)
		}
	}
	for n := 4; n <= 8; n++ {
		d := dist[string(rune('0'+n))]
		if d[0]+d[1]+d[2]+d[3] != n {
			t.Fatalf("distribution for %d = %v", n, d)
		}
	}
}
