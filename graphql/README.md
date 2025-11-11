# Free Electricity Session Finder (GraphQL)

Fetch free electricity sessions from Octopus Energy using email scraping and the GraphQL API.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Set environment variables with your credentials:
   ```bash
   export OCTOPUS_API_KEY="sk_live_your_key_here"
   # Optional: export OCTOPUS_ACCOUNT_NUMBER="A-12345678"
   # Optional: export OCTOPUS_MPAN="1234567890123"
   ```

3. Get your API key from: https://octopus.energy/dashboard/new/accounts/personal-details/api-access

4. **Account number is auto-discovered** The script will automatically discover your account number from the authenticated API key. If you have multiple accounts, set `OCTOPUS_ACCOUNT_NUMBER` to specify which one to use.

5. **MPAN is auto-discovered** The script will automatically fetch your electricity meter point(s) from the account. If you have multiple properties, set `OCTOPUS_MPAN` to specify which one to use.

   **Note**: The script automatically filters for **IMPORT** meters (electricity consumption) and ignores **EXPORT** meters (e.g., solar generation). If you have solar panels, you'll have both types, but only the import meter is relevant for free electricity sessions.

## Authentication

The script uses the Octopus Energy GraphQL API with token-based authentication:
1. Your API key is exchanged for a JWT token using the `obtainKrakenToken` mutation
2. The token is valid for 60 minutes
3. The token is included in the `Authorization` header for subsequent requests

## Usage

### Minimal usage (full auto-discovery)

The script requires **only your API key**! Account number and MPAN are auto-discovered.

```bash
export OCTOPUS_API_KEY="sk_live_your_key"
python fes_finder_graphql.py
```

Output:

```text
Authenticating with Octopus Energy API using API key...
No account number provided, auto-discovering from authenticated user...
Auto-discovered account number: A-12345678
No MPAN provided, fetching from account...
Using MPAN: 1234567890123
Fetching free electricity sessions...

Found 15 free electricity session(s):
...
```

### Explicit account/MPAN (for multiple accounts or properties)

If you have multiple accounts or properties, you can specify which to use:

```bash
export OCTOPUS_API_KEY="sk_live_your_key"
export OCTOPUS_ACCOUNT_NUMBER="A-12345678"  # Optional: specify account
export OCTOPUS_MPAN="1234567890123"         # Optional: specify property
python fes_finder_graphql.py
```

### JSON output (for scripts/automation)

```bash
export OUTPUT_FORMAT="json"
python fes_finder_graphql.py
```

## JSON File Output

The script automatically writes future sessions to a JSON file matching the Google Apps Script format:

- **Filename**: `free_electricity_session_graphql.json` (at the repository root)
- **Format**: Array of session objects with `start`, `end`, and `code` fields
- **Filtering**: Only includes sessions with `end` time in the future
- **Sorting**: Sorted by `start` time (earliest first)
- **Empty result**: If no future sessions, outputs `[{"start": null, "end": null, "code": null}]`

### Field Descriptions

- **`start`**: ISO 8601 timestamp (UTC) when the free electricity session begins
- **`end`**: ISO 8601 timestamp (UTC) when the free electricity session ends
- **`code`**: Unique event identifier assigned by Octopus Energy (e.g., `FREE_ELECTRICITY_EVENT_15_251025`). This code is used internally by Octopus to track specific flexibility events and can be useful for logging, debugging, or correlating events with Octopus communications

Example output with sessions:

```json
[
  {
    "start": "2025-10-25T11:00:00+00:00",
    "end": "2025-10-25T14:00:00+00:00",
    "code": "FREE_ELECTRICITY_EVENT_15_251025"
  },
  {
    "start": "2025-10-24T20:00:00+00:00",
    "end": "2025-10-24T21:00:00+00:00",
    "code": "FREE_ELECTRICITY_EVENT_14_241025"
  }
]
```

Example output with no future sessions:

```json
[
  {
    "start": null,
    "end": null,
    "code": null
  }
]
```

This file is committed to the repository and automatically updated by GitHub Actions, so you can access the latest free electricity sessions at:
`https://raw.githubusercontent.com/8none1/octopus_powerups/graphql/free_electricity_session_graphql.json`

### GitHub Actions

Add this secret to your repository:

- `OCTOPUS_API_KEY` (required)

Optional secrets (only if you have multiple accounts/properties):

- `OCTOPUS_ACCOUNT_NUMBER` (optional - auto-discovered from API key)
- `OCTOPUS_MPAN` (optional - auto-discovered from account)

The workflow will run every 6 hours automatically, or you can trigger it manually from the Actions tab.

## API Documentation

- GraphQL Guide: <https://docs.octopus.energy/graphql/guides/basics>
- Query Reference: <https://docs.octopus.energy/graphql/reference/queries#api-queries-customerflexibilitycampaignevents>
- Campaign Slugs: <https://docs.octopus.energy/rest/guides/data-import/account-field-definitions#account_campaigns.slug>
