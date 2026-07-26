# Google Health CLI

Local CLI that exports Fitbit sleep data through the Google Health API v4.
It uses Google's generated Go client and the reconciled data stream, so exported
records match the data Google Health selects across available sources.

## Google Cloud setup

Before using the CLI:

1. Enable **Google Health API** in the Google Cloud project.
2. Add your Google account as an OAuth test user (while the app is in testing).
3. Add the restricted scope
   `https://www.googleapis.com/auth/googlehealth.sleep.readonly`.
4. Create a **Desktop app** OAuth client. Desktop clients use the loopback
   redirect `http://127.0.0.1:8080/oauth2/callback` and do not expose an
   Authorized redirect URIs field in Google Cloud Console.

Do not commit the client secret or OAuth token. Provide the OAuth client
credentials through environment variables:

```bash
export GOOGLE_HEALTH_CLIENT_ID='your-client-id'
export GOOGLE_HEALTH_CLIENT_SECRET='your-client-secret'
```

## Authorize

Generate the consent URL:

```bash
go run . auth
```

The command opens the consent page, listens on the loopback callback, exchanges
the authorization code, and saves the token automatically. The `--code` flag
remains available as a manual fallback.

The refresh token is stored at `../google-health-token.json` with mode `0600`.
Override this location with `GOOGLE_HEALTH_TOKEN_FILE`.

Google OAuth clients in **Testing** status issue refresh tokens that expire
after seven days. Publish the app when appropriate to avoid weekly
reauthorization.

## Export sleep data

```bash
go run . sleep export --end-date 2026-07-26
```

By default files are written to:

```text
../data/google-health/sleep/<year>/
```

The command groups output by calendar month by default. Use ISO weeks (Monday
through Sunday) instead with:

```bash
go run . sleep export --group-by week
```

Weekly files are named `google-health-sleep-2026-W01.json`,
`google-health-sleep-2026-W02.json`, and so on. Partial weeks at the beginning
of the year and at `--end-date` are supported. Both grouping modes follow every
API page and can write a merged yearly file. Each file uses the Google Health
`ReconciledDataPoint` response shape:

```json
{
  "dataPoints": [
    {
      "dataPointName": "users/.../dataTypes/sleep/dataPoints/...",
      "sleep": {
        "interval": {},
        "summary": {},
        "stages": []
      }
    }
  ]
}
```

Useful flags:

- `--year`: year to export; defaults to the year in `--end-date`
- `--token-file`: OAuth token file
- `--out-dir`: output directory
- `--group-by month|week`: output one file per month or ISO week
- `--merge=false`: skip the merged yearly file
