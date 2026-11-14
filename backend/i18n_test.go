package main

import (
	"os"
	"regexp"
	"testing"
)

// Server errors are translation keys rendered by the client: each one needs an error_<code> entry.
func TestEveryErrorCodeIsTranslated(t *testing.T) {
	dict, err := os.ReadFile("../web/src/i18n.ts")
	if err != nil {
		t.Fatal(err)
	}
	translated := map[string]int{}
	for _, m := range regexp.MustCompile(`\berror_(\w+):`).FindAllSubmatch(dict, -1) {
		translated[string(m[1])]++
	}
	codeRe := regexp.MustCompile(`(?:fail\(|appError\{)"(\w+)"`)
	for _, file := range []string{"draw.go", "room.go"} {
		src, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range codeRe.FindAllSubmatch(src, -1) {
			if n := translated[string(m[1])]; n != 2 { // en + fr
				t.Errorf("%s: code %q has %d translations, want 2", file, m[1], n)
			}
		}
	}
}
