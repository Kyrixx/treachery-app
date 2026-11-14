// Package treachery holds the built frontend. It sits at the module root
// because go:embed cannot reach a parent directory from backend/.
package treachery

import "embed"

//go:embed all:web/dist
var Web embed.FS
