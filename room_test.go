package main

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

type testClient struct {
	t    *testing.T
	conn *websocket.Conn
	msgs []map[string]any
}

func dial(t *testing.T, srv *httptest.Server) *testClient {
	t.Helper()
	conn, _, err := websocket.Dial(context.Background(), "ws"+strings.TrimPrefix(srv.URL, "http")+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.CloseNow() })
	return &testClient{t: t, conn: conn}
}

func (c *testClient) send(v map[string]any) {
	b, _ := json.Marshal(v)
	if err := c.conn.Write(context.Background(), websocket.MessageText, b); err != nil {
		c.t.Fatal(err)
	}
}

// waitFor reads messages until one matches type and pred; every message read is kept in c.msgs.
func (c *testClient) waitFor(typ string, pred func(map[string]any) bool) map[string]any {
	c.t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	for {
		_, b, err := c.conn.Read(ctx)
		if err != nil {
			c.t.Fatalf("waiting for %s: %v", typ, err)
		}
		var m map[string]any
		json.Unmarshal(b, &m)
		c.msgs = append(c.msgs, m)
		if m["type"] == typ && (pred == nil || pred(m)) {
			return m
		}
	}
}

func playersReady(n int) func(map[string]any) bool {
	return func(m map[string]any) bool {
		ps, _ := m["players"].([]any)
		ready := 0
		for _, p := range ps {
			if p.(map[string]any)["ready"] == true {
				ready++
			}
		}
		return ready == n
	}
}

func setupRoom(t *testing.T, srv *httptest.Server) (string, []*testClient, []map[string]any) {
	host := dial(t, srv)
	host.send(map[string]any{"type": "create", "nickname": "Alice", "playerCount": 4, "rarities": []string{"U", "R", "M"}})
	w := host.waitFor("welcome", nil)
	code := w["code"].(string)
	clients := []*testClient{host}
	welcomes := []map[string]any{w}
	for _, name := range []string{"Bob", "Chloé", "Dan"} {
		c := dial(t, srv)
		c.send(map[string]any{"type": "join", "code": strings.ToLower(code), "nickname": name})
		welcomes = append(welcomes, c.waitFor("welcome", nil))
		clients = append(clients, c)
	}
	return code, clients, welcomes
}

func TestGameFlowKeepsIdentitiesSecret(t *testing.T) {
	srv := httptest.NewServer(routes(NewServer()))
	defer srv.Close()
	_, clients, _ := setupRoom(t, srv)
	host := clients[0]

	for _, c := range clients[:3] {
		c.send(map[string]any{"type": "ready", "value": true})
	}
	host.waitFor("room", playersReady(3))
	host.send(map[string]any{"type": "start"})
	if e := host.waitFor("error", nil); !strings.Contains(e["message"].(string), "prêt") {
		t.Fatalf("start with a player not ready: %v", e)
	}

	clients[3].send(map[string]any{"type": "ready", "value": true})
	host.waitFor("room", playersReady(4))
	host.send(map[string]any{"type": "start"})

	seen := map[float64]bool{}
	for _, c := range clients {
		you := c.waitFor("you", nil)
		card := you["card"].(map[string]any)
		id := card["id"].(float64)
		if seen[id] {
			t.Fatalf("card %v dealt twice", id)
		}
		seen[id] = true
		var leader float64
		for _, m := range c.msgs {
			if m["type"] == "room" && m["phase"] == "playing" {
				card := m["leader"].(map[string]any)["card"].(map[string]any)
				if card["role"] != "Leader" {
					t.Fatalf("leader field carries a %v identity", card["role"])
				}
				leader = card["id"].(float64)
			}
		}
		if leader == 0 {
			t.Fatal("no playing room with a leader received")
		}

		for _, m := range c.msgs {
			if m["type"] == "you" {
				continue
			}
			b, _ := json.Marshal(m)
			for _, other := range allCards {
				if float64(other.ID) != id && float64(other.ID) != leader && strings.Contains(string(b), `"name":"`+other.Name+`"`) {
					t.Fatalf("message leaks identity %s: %s", other.Name, b)
				}
			}
		}
	}
}

func TestResumeReturnsSameCard(t *testing.T) {
	srv := httptest.NewServer(routes(NewServer()))
	defer srv.Close()
	code, clients, welcomes := setupRoom(t, srv)
	for _, c := range clients {
		c.send(map[string]any{"type": "ready", "value": true})
	}
	clients[0].waitFor("room", playersReady(4))
	clients[0].send(map[string]any{"type": "start"})
	before := clients[1].waitFor("you", nil)["card"].(map[string]any)["id"]

	clients[1].conn.CloseNow()
	again := dial(t, srv)
	again.send(map[string]any{"type": "resume", "code": code, "token": welcomes[1]["token"]})
	after := again.waitFor("you", nil)["card"].(map[string]any)["id"]
	if before != after {
		t.Fatalf("resume gave card %v, want %v", after, before)
	}

	bad := dial(t, srv)
	bad.send(map[string]any{"type": "resume", "code": code, "token": "nope"})
	bad.waitFor("error", nil)
}

func TestJoinRejectsFullRoom(t *testing.T) {
	srv := httptest.NewServer(routes(NewServer()))
	defer srv.Close()
	code, _, _ := setupRoom(t, srv)
	late := dial(t, srv)
	late.send(map[string]any{"type": "join", "code": code, "nickname": "Eve"})
	if e := late.waitFor("error", nil); !strings.Contains(e["message"].(string), "pleine") {
		t.Fatalf("got %v", e)
	}
}

func TestCreateRejectsImpossibleSettings(t *testing.T) {
	srv := httptest.NewServer(routes(NewServer()))
	defer srv.Close()
	c := dial(t, srv)
	c.send(map[string]any{"type": "create", "nickname": "Alice", "playerCount": 8, "rarities": []string{"S"}})
	c.waitFor("error", nil)
}
