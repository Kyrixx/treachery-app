package main

import (
	"bytes"
	"log/slog"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

type syncBuffer struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (w *syncBuffer) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.b.Write(p)
}

func (w *syncBuffer) String() string {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.b.String()
}

func TestLogsNeverLeakTokensOrCards(t *testing.T) {
	var out syncBuffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&out, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })

	srv := httptest.NewServer(routes(NewServer()))
	t.Cleanup(srv.Close)
	code, clients, welcomes := setupRoom(t, srv)
	for _, c := range clients {
		c.send(map[string]any{"type": "ready", "value": true})
	}
	clients[0].waitFor("room", playersReady(4))
	clients[0].send(map[string]any{"type": "start"})
	var cards []string
	for _, c := range clients {
		cards = append(cards, c.waitFor("you", nil)["card"].(map[string]any)["name"].(string))
	}
	late := dial(t, srv)
	late.send(map[string]any{"type": "join", "code": code, "nickname": "Late"})
	late.waitFor("error", nil)
	logs := out.String()
	if !strings.Contains(logs, "msg=start") || !strings.Contains(logs, "room="+code) || !strings.Contains(logs, "msg=rejected") {
		t.Fatalf("expected game events in logs:\n%s", logs)
	}
	for _, w := range welcomes {
		if strings.Contains(logs, w["token"].(string)) {
			t.Fatal("a token leaked into the logs")
		}
	}
	for _, name := range cards {
		if strings.Contains(logs, name) {
			t.Fatalf("card %q leaked into the logs", name)
		}
	}
}
