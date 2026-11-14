package main

import (
	"slices"
	"testing"
)

func TestDrawRespectsDistribution(t *testing.T) {
	all := []string{"U", "R", "M", "S"}
	for n, counts := range distribution {
		for range 50 {
			hand, err := draw(n, all)
			if err != nil {
				t.Fatalf("%d players: %v", n, err)
			}
			if len(hand) != n {
				t.Fatalf("%d players: got %d cards", n, len(hand))
			}
			seen := map[int]bool{}
			got := map[string]int{}
			for _, c := range hand {
				if seen[c.ID] {
					t.Fatalf("%d players: duplicate card %s", n, c.Name)
				}
				seen[c.ID] = true
				got[c.Role]++
			}
			for i, role := range roles {
				if got[role] != counts[i] {
					t.Fatalf("%d players: %s = %d, want %d", n, role, got[role], counts[i])
				}
			}
		}
	}
}

func TestDrawOnlyAllowedRarities(t *testing.T) {
	allowed := []string{"U"}
	for range 50 {
		hand, err := draw(8, allowed)
		if err != nil {
			t.Fatal(err)
		}
		for _, c := range hand {
			if !slices.Contains(allowed, c.Rarity) {
				t.Fatalf("%s has rarity %s", c.Name, c.Rarity)
			}
		}
	}
}

func TestValidateSettings(t *testing.T) {
	cases := []struct {
		name     string
		players  int
		rarities []string
		ok       bool
	}{
		{"uncommon only, 8 players", 8, []string{"U"}, true},
		{"special only has no leader", 8, []string{"S"}, false},
		{"too few players", 3, []string{"U"}, false},
		{"too many players", 9, []string{"U"}, false},
		{"no rarity", 5, nil, false},
		{"unknown rarity", 5, []string{"U", "X"}, false},
		{"mythic only, 8 players needs 3 assassins", 8, []string{"M"}, true},
		{"rare only, 8 players needs 2 traitors", 8, []string{"R"}, true},
	}
	for _, c := range cases {
		err := validateSettings(c.players, c.rarities)
		if (err == nil) != c.ok {
			t.Errorf("%s: err = %v, want ok=%v", c.name, err, c.ok)
		}
		if _, derr := draw(c.players, c.rarities); (derr == nil) != c.ok {
			t.Errorf("%s: draw err = %v, want ok=%v", c.name, derr, c.ok)
		}
	}
}
