package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	mrand "math/rand/v2"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/coder/websocket"
)

const (
	lobbyGrace  = 5 * time.Minute
	roomTTL     = 6 * time.Hour
	codeLetters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
)

// Wire format, mirrored in web/src/types.ts.
type inMsg struct {
	Type        string   `json:"type"`
	Nickname    string   `json:"nickname"`
	PlayerCount int      `json:"playerCount"`
	Rarities    []string `json:"rarities"`
	Code        string   `json:"code"`
	Token       string   `json:"token"`
	Value       bool     `json:"value"`
}

type Settings struct {
	PlayerCount int      `json:"playerCount"`
	Rarities    []string `json:"rarities"`
}

type playerView struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Ready     bool   `json:"ready"`
	Connected bool   `json:"connected"`
}

type leaderView struct {
	PlayerID string `json:"playerId"`
	Card     Card   `json:"card"`
}

type roomView struct {
	Type     string       `json:"type"`
	Code     string       `json:"code"`
	Phase    string       `json:"phase"`
	HostID   string       `json:"hostId"`
	Settings Settings     `json:"settings"`
	Players  []playerView `json:"players"`
	Leader   *leaderView  `json:"leader,omitempty"`
}

type client struct {
	conn   *websocket.Conn
	send   chan []byte
	room   *Room
	player *Player
}

type Player struct {
	ID, Name, token string
	Ready           bool
	card            *Card
	client          *client
	leftAt          time.Time
}

type Room struct {
	Code     string
	Phase    string // "lobby" | "playing"
	HostID   string
	Settings Settings
	Players  []*Player
	touched  time.Time
}

// ponytail: one global mutex, per-room locks if many rooms run at once.
type Server struct {
	mu    sync.Mutex
	rooms map[string]*Room
}

func NewServer() *Server { return &Server{rooms: map[string]*Room{}} }

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: []string{"localhost:*"}})
	if err != nil {
		return
	}
	conn.SetReadLimit(4096)
	cl := &client{conn: conn, send: make(chan []byte, 32)}
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	go func() {
		for {
			select {
			case b := <-cl.send:
				wctx, wcancel := context.WithTimeout(ctx, 5*time.Second)
				err := conn.Write(wctx, websocket.MessageText, b)
				wcancel()
				if err != nil {
					cancel()
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			break
		}
		var m inMsg
		if json.Unmarshal(data, &m) != nil {
			continue
		}
		s.mu.Lock()
		if err := s.handle(cl, &m); err != nil {
			cl.write(map[string]any{"type": "error", "error": err})
		}
		s.mu.Unlock()
	}
	s.mu.Lock()
	s.disconnect(cl)
	s.mu.Unlock()
	conn.CloseNow()
}

func (cl *client) write(v any) {
	b, _ := json.Marshal(v)
	select {
	case cl.send <- b:
	default: // slow client: drop; it resyncs on reconnect
	}
}

func (s *Server) handle(cl *client, m *inMsg) error {
	switch m.Type {
	case "create":
		name, err := cleanName(m.Nickname)
		if err != nil {
			return err
		}
		if err := validateSettings(m.PlayerCount, m.Rarities); err != nil {
			return err
		}
		room := &Room{Code: s.newCode(), Phase: "lobby", Settings: Settings{m.PlayerCount, m.Rarities}}
		p := newPlayer(name)
		room.HostID = p.ID
		room.Players = []*Player{p}
		s.rooms[room.Code] = room
		s.attach(cl, room, p)
	case "join":
		name, err := cleanName(m.Nickname)
		if err != nil {
			return err
		}
		room, err := s.find(m.Code)
		if err != nil {
			return err
		}
		if room.Phase != "lobby" {
			return fail("gameStarted")
		}
		if len(room.Players) >= room.Settings.PlayerCount {
			return fail("roomFull")
		}
		for _, p := range room.Players {
			if strings.EqualFold(p.Name, name) {
				return fail("nicknameTaken")
			}
		}
		p := newPlayer(name)
		room.Players = append(room.Players, p)
		s.attach(cl, room, p)
	case "resume":
		room, err := s.find(m.Code)
		if err != nil {
			return err
		}
		i := slices.IndexFunc(room.Players, func(p *Player) bool { return p.token == m.Token })
		if i < 0 {
			return fail("seatNotFound")
		}
		s.attach(cl, room, room.Players[i])
	case "ready":
		if cl.player == nil || cl.room.Phase != "lobby" {
			return nil
		}
		cl.player.Ready = m.Value
		s.broadcast(cl.room)
	case "start":
		room := cl.room
		if room == nil || room.HostID != cl.player.ID || room.Phase != "lobby" {
			return nil
		}
		if len(room.Players) != room.Settings.PlayerCount {
			return fail("roomNotFull")
		}
		if slices.ContainsFunc(room.Players, func(p *Player) bool { return !p.Ready }) {
			return fail("notAllReady")
		}
		hand, err := draw(room.Settings.PlayerCount, room.Settings.Rarities)
		if err != nil {
			return err
		}
		for i, p := range room.Players {
			p.card = &hand[i]
		}
		room.Phase = "playing"
		s.broadcast(room)
		for _, p := range room.Players {
			if p.client != nil {
				p.client.write(youMsg(p))
			}
		}
	case "reset":
		room := cl.room
		if room == nil || room.HostID != cl.player.ID {
			return nil
		}
		room.Phase = "lobby"
		for _, p := range room.Players {
			p.card, p.Ready = nil, false
		}
		s.broadcast(room)
	}
	if cl.room != nil {
		cl.room.touched = time.Now()
	}
	return nil
}

func (s *Server) attach(cl *client, room *Room, p *Player) {
	if cl.player != nil && cl.player != p {
		s.disconnect(cl)
	}
	if p.client != nil && p.client != cl {
		go p.client.conn.Close(websocket.StatusPolicyViolation, "reconnected elsewhere")
	}
	p.client, cl.room, cl.player = cl, room, p
	cl.write(map[string]string{"type": "welcome", "code": room.Code, "playerId": p.ID, "token": p.token})
	s.broadcast(room)
	if p.card != nil {
		cl.write(youMsg(p))
	}
}

func (s *Server) disconnect(cl *client) {
	if cl.player == nil || cl.player.client != cl {
		return
	}
	cl.player.client = nil
	cl.player.leftAt = time.Now()
	s.broadcast(cl.room)
}

// broadcast must never carry another player's identity, except the Leader's.
func (s *Server) broadcast(room *Room) {
	v := roomView{Type: "room", Code: room.Code, Phase: room.Phase, HostID: room.HostID, Settings: room.Settings}
	for _, p := range room.Players {
		v.Players = append(v.Players, playerView{p.ID, p.Name, p.Ready, p.client != nil})
		if p.card != nil && p.card.Role == "Leader" {
			v.Leader = &leaderView{p.ID, *p.card}
		}
	}
	for _, p := range room.Players {
		if p.client != nil {
			p.client.write(v)
		}
	}
}

func youMsg(p *Player) any {
	return map[string]any{"type": "you", "role": p.card.Role, "card": p.card}
}

// sweep drops lobby players gone for lobbyGrace and idle rooms.
func (s *Server) sweep(now time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for code, room := range s.rooms {
		if now.Sub(room.touched) > roomTTL {
			delete(s.rooms, code)
			continue
		}
		if room.Phase != "lobby" {
			continue
		}
		before := len(room.Players)
		room.Players = slices.DeleteFunc(room.Players, func(p *Player) bool {
			return p.client == nil && now.Sub(p.leftAt) > lobbyGrace
		})
		if len(room.Players) == 0 {
			delete(s.rooms, code)
			continue
		}
		if len(room.Players) != before {
			if !slices.ContainsFunc(room.Players, func(p *Player) bool { return p.ID == room.HostID }) {
				room.HostID = room.Players[0].ID
			}
			s.broadcast(room)
		}
	}
}

func (s *Server) find(code string) (*Room, error) {
	room, ok := s.rooms[strings.ToUpper(strings.TrimSpace(code))]
	if !ok {
		return nil, fail("roomNotFound")
	}
	return room, nil
}

func (s *Server) newCode() string {
	for {
		b := make([]byte, 4)
		for i := range b {
			b[i] = codeLetters[mrand.IntN(len(codeLetters))]
		}
		if _, taken := s.rooms[string(b)]; !taken {
			return string(b)
		}
	}
}

func newPlayer(name string) *Player {
	return &Player{ID: rand.Text()[:10], Name: name, token: rand.Text()}
}

func cleanName(s string) (string, error) {
	s = strings.TrimSpace(s)
	if n := utf8.RuneCountInString(s); n < 1 || n > 20 {
		return "", fail("invalidNickname")
	}
	return s, nil
}
