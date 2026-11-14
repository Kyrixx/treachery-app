package main

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"slices"
)

type Card struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	Role   string `json:"role"`
	Rarity string `json:"rarity"`
	Artist string `json:"artist"`
}

//go:embed cards.json
var cardsJSON []byte

var allCards = func() []Card {
	var cards []Card
	if err := json.Unmarshal(cardsJSON, &cards); err != nil {
		panic(err)
	}
	return cards
}()

var roles = []string{"Leader", "Traitor", "Assassin", "Guardian"}

// distribution follows the official table (CR 907.3c), same order as roles.
var distribution = map[int][4]int{
	4: {1, 1, 2, 0},
	5: {1, 1, 2, 1},
	6: {1, 1, 3, 1},
	7: {1, 1, 3, 2},
	8: {1, 2, 3, 2},
}

var allRarities = []string{"U", "R", "M", "S"}

var roleFR = map[string]string{"Leader": "Leader", "Traitor": "Traître", "Assassin": "Assassin", "Guardian": "Gardien"}

func pool(role string, rarities []string) []Card {
	var out []Card
	for _, c := range allCards {
		if c.Role == role && slices.Contains(rarities, c.Rarity) {
			out = append(out, c)
		}
	}
	return out
}

func validateSettings(playerCount int, rarities []string) error {
	counts, ok := distribution[playerCount]
	if !ok {
		return errors.New("le nombre de joueurs doit être entre 4 et 8")
	}
	if len(rarities) == 0 {
		return errors.New("choisis au moins une rareté")
	}
	for _, r := range rarities {
		if !slices.Contains(allRarities, r) {
			return fmt.Errorf("rareté inconnue : %q", r)
		}
	}
	for i, role := range roles {
		if have := len(pool(role, rarities)); have < counts[i] {
			return fmt.Errorf("pas assez d'identités %s avec ces raretés (%d pour %d)", roleFR[role], have, counts[i])
		}
	}
	return nil
}

// draw returns playerCount distinct identities in random order.
func draw(playerCount int, rarities []string) ([]Card, error) {
	if err := validateSettings(playerCount, rarities); err != nil {
		return nil, err
	}
	var hand []Card
	for i, role := range roles {
		p := pool(role, rarities)
		rand.Shuffle(len(p), func(a, b int) { p[a], p[b] = p[b], p[a] })
		hand = append(hand, p[:distribution[playerCount][i]]...)
	}
	rand.Shuffle(len(hand), func(a, b int) { hand[a], hand[b] = hand[b], hand[a] })
	return hand, nil
}
