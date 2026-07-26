package googlehealth

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"golang.org/x/oauth2"
	health "google.golang.org/api/health/v4"
	"google.golang.org/api/option"
)

const (
	ScopeSleepReadOnly = "https://www.googleapis.com/auth/googlehealth.sleep.readonly"
	sleepParent        = "users/me/dataTypes/sleep"
)

type TokenStore interface {
	Save(*oauth2.Token) error
}

type Config struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
	Token        *oauth2.Token
	TokenStore   TokenStore
}

type Client struct {
	service *health.Service
}

func OAuthConfig(clientID, clientSecret, redirectURL string) (*oauth2.Config, error) {
	if clientID == "" {
		return nil, errors.New("GOOGLE_HEALTH_CLIENT_ID is required")
	}
	if clientSecret == "" {
		return nil, errors.New("GOOGLE_HEALTH_CLIENT_SECRET is required")
	}
	if redirectURL == "" {
		return nil, errors.New("Google OAuth redirect URL is required")
	}
	return &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{ScopeSleepReadOnly},
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://accounts.google.com/o/oauth2/v2/auth",
			TokenURL: "https://oauth2.googleapis.com/token",
		},
	}, nil
}

func NewClient(ctx context.Context, cfg Config) (*Client, error) {
	if cfg.Token == nil || cfg.Token.RefreshToken == "" {
		return nil, errors.New("a Google OAuth refresh token is required")
	}
	oauthConfig, err := OAuthConfig(cfg.ClientID, cfg.ClientSecret, cfg.RedirectURL)
	if err != nil {
		return nil, err
	}

	source := oauthConfig.TokenSource(ctx, cfg.Token)
	source = &persistingTokenSource{base: source, last: cfg.Token, store: cfg.TokenStore}
	httpClient := oauth2.NewClient(ctx, source)
	service, err := health.NewService(ctx, option.WithHTTPClient(httpClient))
	if err != nil {
		return nil, fmt.Errorf("create Google Health client: %w", err)
	}
	return &Client{service: service}, nil
}

func (c *Client) SleepByDateRange(ctx context.Context, start, end time.Time) ([]*health.ReconciledDataPoint, error) {
	// Google Health's sleep filter is end-exclusive and filters by the session's
	// civil end time. Include the complete requested end date.
	exclusiveEnd := end.AddDate(0, 0, 1)
	filter := fmt.Sprintf(
		`sleep.interval.civil_end_time >= %q AND sleep.interval.civil_end_time < %q`,
		start.Format(time.DateOnly),
		exclusiveEnd.Format(time.DateOnly),
	)

	var records []*health.ReconciledDataPoint
	pageToken := ""
	for {
		call := c.service.Users.DataTypes.DataPoints.Reconcile(sleepParent).
			Filter(filter).
			PageSize(25).
			Context(ctx)
		if pageToken != "" {
			call = call.PageToken(pageToken)
		}
		response, err := call.Do()
		if err != nil {
			return nil, fmt.Errorf("query Google Health sleep data: %w", err)
		}
		records = append(records, response.DataPoints...)
		if response.NextPageToken == "" {
			return records, nil
		}
		pageToken = response.NextPageToken
	}
}

type persistingTokenSource struct {
	base  oauth2.TokenSource
	store TokenStore

	mu   sync.Mutex
	last *oauth2.Token
}

func (s *persistingTokenSource) Token() (*oauth2.Token, error) {
	token, err := s.base.Token()
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if s.last == nil || token.AccessToken != s.last.AccessToken ||
		token.RefreshToken != s.last.RefreshToken || !token.Expiry.Equal(s.last.Expiry) {
		if token.RefreshToken == "" && s.last != nil {
			token.RefreshToken = s.last.RefreshToken
		}
		if s.store != nil {
			if err := s.store.Save(token); err != nil {
				return nil, fmt.Errorf("persist refreshed OAuth token: %w", err)
			}
		}
	}
	s.last = token
	return token, nil
}
