#!/usr/bin/env python3
import argparse
import base64
import calendar
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CREDENTIALS = ROOT / "fitbit-credentials.md"


def read_credential(credentials_file, field):
    text = credentials_file.read_text()
    pattern = rf"\|\s*{re.escape(field)}\s*\|\s*`([^`]+)`\s*\|"
    match = re.search(pattern, text)
    if not match:
        raise ValueError(f"Could not find {field} in {credentials_file}")
    return match.group(1)


def replace_refresh_token(credentials_file, old_token, new_token):
    if not new_token or new_token == old_token:
        return

    text = credentials_file.read_text()
    credentials_file.write_text(text.replace(old_token, new_token))
    print(f"Updated refresh token in {credentials_file}")


def post_form(url, headers, data):
    body = urllib.parse.urlencode(data).encode()
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    return request_json(request)


def get_json(url, headers):
    request = urllib.request.Request(url, headers=headers, method="GET")
    return request_json(request)


def request_json(request):
    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        body = error.read().decode()
        try:
            details = json.loads(body)
        except json.JSONDecodeError:
            details = body
        raise RuntimeError(f"HTTP {error.code}: {details}") from error


def refresh_access_token(client_id, client_secret, refresh_token):
    basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    response = post_form(
        "https://api.fitbit.com/oauth2/token",
        {
            "Authorization": f"Basic {basic}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
    )

    if "access_token" not in response:
        raise RuntimeError(f"Token refresh failed: {response}")

    return response


def month_ranges(year, end_date):
    for month in range(1, 13):
        start = date(year, month, 1)
        if start > end_date:
            break

        last_day = calendar.monthrange(year, month)[1]
        end = date(year, month, last_day)
        if end > end_date:
            end = end_date

        yield start, end


def download_month(access_token, start, end, out_file):
    url = f"https://api.fitbit.com/1.2/user/-/sleep/date/{start}/{end}.json"
    data = get_json(url, {"Authorization": f"Bearer {access_token}"})
    out_file.write_text(json.dumps(data, indent=2) + "\n")
    count = len(data.get("sleep", []))
    print(f"Saved {out_file} ({start} to {end}, {count} records)")
    return data


def merge_months(month_files, merged_file):
    records = []
    for path in month_files:
        data = json.loads(path.read_text())
        records.extend(data.get("sleep", []))

    merged = {"sleep": records}
    merged_file.write_text(json.dumps(merged, indent=2) + "\n")

    if not records:
        print(f"Merged file: {merged_file}")
        print("No sleep records")
        return

    dates = [record["dateOfSleep"] for record in records if "dateOfSleep" in record]
    print(f"Merged file: {merged_file}")
    print(f"{min(dates)}\t{max(dates)}\t{len(records)}")


def parse_args():
    parser = argparse.ArgumentParser(description="Export Fitbit sleep data by month.")
    parser.add_argument(
        "--end-date",
        default=date.today().isoformat(),
        help="Last date to export, in YYYY-MM-DD format. Defaults to today.",
    )
    parser.add_argument(
        "--year",
        type=int,
        help="Year to export. Defaults to the year from --end-date.",
    )
    parser.add_argument(
        "--credentials",
        type=Path,
        default=DEFAULT_CREDENTIALS,
        help="Markdown credentials file.",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        help="Output directory. Defaults to data/fitbit/sleep/<year>.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    end_date = date.fromisoformat(args.end_date)
    year = args.year or end_date.year
    out_dir = args.out_dir or ROOT / "data" / "fitbit" / "sleep" / str(year)
    out_dir.mkdir(parents=True, exist_ok=True)

    client_id = read_credential(args.credentials, "Client ID")
    client_secret = read_credential(args.credentials, "Client Secret")
    refresh_token = read_credential(args.credentials, "Refresh Token")

    token_response = refresh_access_token(client_id, client_secret, refresh_token)
    replace_refresh_token(
        args.credentials,
        refresh_token,
        token_response.get("refresh_token"),
    )

    access_token = token_response["access_token"]
    month_files = []

    for start, end in month_ranges(year, end_date):
        out_file = out_dir / f"fitbit-sleep-{year}-{start.month:02d}.json"
        download_month(access_token, start, end, out_file)
        month_files.append(out_file)

    merge_months(month_files, out_dir / f"fitbit-sleep-{year}.json")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(error, file=sys.stderr)
        sys.exit(1)
