package main

import (
	"cmp"
	"embed"
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"os"
	"time"
)

//go:embed all:web/dist
var dist embed.FS

// catalogJSON is public data (the site lists every card); secrecy is about who holds which one.
var catalogJSON, _ = json.Marshal(map[string]any{"cards": allCards, "distribution": distribution})

func routes(s *Server) http.Handler {
	static, _ := fs.Sub(dist, "web/dist")
	files := http.FileServerFS(static)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /ws", s.handleWS)
	mux.HandleFunc("GET /api/catalog", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(catalogJSON)
	})
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		if _, err := fs.Stat(static, r.URL.Path[1:]); err != nil {
			r.URL.Path = "/" // SPA fallback: /r/ABCD serves index.html
		}
		files.ServeHTTP(w, r)
	})
	return mux
}

func main() {
	s := NewServer()
	s.load(cmp.Or(os.Getenv("DATA_FILE"), "rooms.json"), time.Now())
	go func() {
		for now := range time.Tick(10 * time.Second) {
			s.sweep(now)
		}
	}()
	addr := ":" + cmp.Or(os.Getenv("PORT"), "8080")
	log.Printf("listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, routes(s)))
}
