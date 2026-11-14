// Command fetchcards downloads the Treachery identity list and card images
// from mtgtreachery.net into cards.json and web/public/cards/. Run once:
//
//	go run ./tools/fetchcards
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
)

const (
	jsonURL = "https://mtgtreachery.net/rules/oracle/treachery-cards.json"
	// ponytail: EN images only, FR ones are only published as PNG on Google Drive.
	imageURL = "https://mtgtreachery.net/images/cards/en/trd/"
)

type card struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	Role   string `json:"role"`
	Rarity string `json:"rarity"`
	Artist string `json:"artist"`
}

func main() {
	var src struct {
		Cards []struct {
			ID     int    `json:"id"`
			Name   string `json:"name"`
			Rarity string `json:"rarity"`
			Artist string `json:"artist"`
			Types  struct {
				Subtype string `json:"subtype"`
			} `json:"types"`
		} `json:"cards"`
	}
	body, err := get(jsonURL)
	if err != nil {
		log.Fatal(err)
	}
	if err := json.Unmarshal(body, &src); err != nil {
		log.Fatal(err)
	}

	cards := make([]card, 0, len(src.Cards))
	for _, c := range src.Cards {
		cards = append(cards, card{c.ID, c.Name, c.Types.Subtype, c.Rarity, c.Artist})
		file := fmt.Sprintf("%03d - %s - %s.jpg", c.ID, c.Types.Subtype, c.Name)
		img, err := get(imageURL + url.PathEscape(file))
		if err != nil {
			log.Fatalf("%s: %v", file, err)
		}
		if err := os.WriteFile(filepath.Join("web/public/cards", fmt.Sprintf("%d.jpg", c.ID)), img, 0o644); err != nil {
			log.Fatal(err)
		}
	}

	out, _ := json.MarshalIndent(cards, "", "  ")
	if err := os.WriteFile("cards.json", append(out, '\n'), 0o644); err != nil {
		log.Fatal(err)
	}
	log.Printf("%d cards written", len(cards))
}

func get(u string) ([]byte, error) {
	resp, err := http.Get(u)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GET %s: %s", u, resp.Status)
	}
	return io.ReadAll(resp.Body)
}
