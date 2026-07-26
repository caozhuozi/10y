package cmd

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"google-health-cli/internal/credentials"
	"google-health-cli/internal/googlehealth"

	"github.com/spf13/cobra"
	"golang.org/x/oauth2"
)

type authOptions struct {
	clientID     string
	clientSecret string
	redirectURL  string
	tokenFile    string
	code         string
}

func newAuthCommand() *cobra.Command {
	opts := authOptions{
		clientID:     os.Getenv("GOOGLE_HEALTH_CLIENT_ID"),
		clientSecret: os.Getenv("GOOGLE_HEALTH_CLIENT_SECRET"),
		redirectURL:  envOrDefault("GOOGLE_HEALTH_REDIRECT_URL", "http://127.0.0.1:8080/oauth2/callback"),
		tokenFile:    envOrDefault("GOOGLE_HEALTH_TOKEN_FILE", filepath.Join("..", "google-health-token.json")),
	}

	cmd := &cobra.Command{
		Use:   "auth",
		Short: "Authorize access to Google Health sleep data",
		RunE: func(cmd *cobra.Command, args []string) error {
			config, err := googlehealth.OAuthConfig(opts.clientID, opts.clientSecret, opts.redirectURL)
			if err != nil {
				return err
			}
			if opts.code == "" {
				state, err := randomState()
				if err != nil {
					return err
				}
				url := config.AuthCodeURL(
					state,
					oauth2.AccessTypeOffline,
					oauth2.ApprovalForce,
				)
				fmt.Println("Opening Google authorization in your browser:")
				fmt.Println(url)
				if err := openBrowser(url); err != nil {
					fmt.Printf("Could not open the browser automatically: %v\n", err)
				}
				code, err := waitForAuthorizationCode(cmd.Context(), opts.redirectURL, state)
				if err != nil {
					return err
				}
				opts.code = code
			}

			token, err := config.Exchange(cmd.Context(), opts.code)
			if err != nil {
				return fmt.Errorf("exchange Google OAuth authorization code: %w", err)
			}
			if token.RefreshToken == "" {
				return fmt.Errorf("Google did not return a refresh token; revoke the old grant or authorize again with prompt=consent")
			}
			if err := credentials.NewTokenStore(opts.tokenFile).Save(token); err != nil {
				return err
			}
			fmt.Printf("Saved Google OAuth token to %s\n", opts.tokenFile)
			return nil
		},
	}

	cmd.Flags().StringVar(&opts.clientID, "client-id", opts.clientID, "Google OAuth client ID (defaults to GOOGLE_HEALTH_CLIENT_ID)")
	cmd.Flags().StringVar(&opts.redirectURL, "redirect-url", opts.redirectURL, "authorized Google OAuth redirect URL")
	cmd.Flags().StringVar(&opts.tokenFile, "token-file", opts.tokenFile, "file used to securely store the OAuth token")
	cmd.Flags().StringVar(&opts.code, "code", "", "authorization code returned by Google")
	return cmd
}

func randomState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate OAuth state: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func openBrowser(url string) error {
	return exec.Command("open", url).Start()
}

func waitForAuthorizationCode(ctx context.Context, redirectURL, expectedState string) (string, error) {
	callbackURL, err := url.Parse(redirectURL)
	if err != nil {
		return "", fmt.Errorf("parse redirect URL: %w", err)
	}
	if callbackURL.Scheme != "http" || callbackURL.Hostname() != "127.0.0.1" {
		return "", fmt.Errorf("desktop OAuth redirect URL must use http://127.0.0.1")
	}

	listener, err := net.Listen("tcp", callbackURL.Host)
	if err != nil {
		return "", fmt.Errorf("listen for OAuth callback on %s: %w", callbackURL.Host, err)
	}
	defer listener.Close()

	result := make(chan authResult, 1)
	mux := http.NewServeMux()
	mux.HandleFunc(callbackURL.Path, func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		switch {
		case query.Get("error") != "":
			result <- authResult{err: fmt.Errorf("Google OAuth authorization failed: %s", query.Get("error"))}
		case query.Get("state") != expectedState:
			result <- authResult{err: fmt.Errorf("Google OAuth state mismatch")}
		case query.Get("code") == "":
			result <- authResult{err: fmt.Errorf("Google OAuth callback did not contain an authorization code")}
		default:
			result <- authResult{code: query.Get("code")}
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, "<!doctype html><title>Google Health CLI</title><h1>Authorization received</h1><p>You can close this tab and return to the terminal.</p>")
	})

	server := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		_ = server.Serve(listener)
	}()
	defer server.Shutdown(context.Background())

	timer := time.NewTimer(5 * time.Minute)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	case <-timer.C:
		return "", fmt.Errorf("timed out waiting for Google OAuth authorization")
	case auth := <-result:
		return auth.code, auth.err
	}
}

type authResult struct {
	code string
	err  error
}

func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
