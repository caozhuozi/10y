package credentials

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/oauth2"
)

type TokenStore struct {
	path string
}

func NewTokenStore(path string) *TokenStore {
	return &TokenStore{path: path}
}

func (s *TokenStore) Load() (*oauth2.Token, error) {
	b, err := os.ReadFile(s.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("Google OAuth token not found at %s; run `google-health-cli auth` first", s.path)
		}
		return nil, err
	}

	var token oauth2.Token
	if err := json.Unmarshal(b, &token); err != nil {
		return nil, fmt.Errorf("decode OAuth token %s: %w", s.path, err)
	}
	if token.RefreshToken == "" {
		return nil, fmt.Errorf("OAuth token %s has no refresh token; authorize again with prompt=consent", s.path)
	}
	return &token, nil
}

func (s *TokenStore) Save(token *oauth2.Token) error {
	if token == nil || token.RefreshToken == "" {
		return errors.New("refusing to save an OAuth token without a refresh token")
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(token, "", "  ")
	if err != nil {
		return err
	}
	b = append(b, '\n')
	if err := os.WriteFile(s.path, b, 0o600); err != nil {
		return err
	}
	return os.Chmod(s.path, 0o600)
}
