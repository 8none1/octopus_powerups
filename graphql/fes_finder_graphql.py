#!/usr/bin/env python3
"""
Free Electricity Session Finder using Octopus Energy GraphQL API
"""

import os
import sys
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional

# Configuration
GRAPHQL_URL = "https://api.octopus.energy/v1/graphql/"
TOKEN_URL = "https://api.octopus.energy/v1/graphql/token/"


def get_token(api_key: str) -> str:
    """
    Get JWT token using API key.
    
    Args:
        api_key: Your Octopus Energy API key (format: sk_live_xxx)
    
    Returns:
        JWT token string
    """
    response = requests.post(
        TOKEN_URL,
        json={"apiKey": api_key}
    )
    response.raise_for_status()
    data = response.json()
    return data["token"]


def get_free_electricity_sessions(
    token: str,
    account_number: str,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None
) -> List[Dict]:
    """
    Fetch free electricity campaign events.
    
    Args:
        token: JWT authentication token
        account_number: Your Octopus account number (e.g., A-12345678)
        from_date: Start date (defaults to now)
        to_date: End date (defaults to 30 days from now)
    
    Returns:
        List of free electricity session events
    """
    if from_date is None:
        from_date = datetime.now()
    if to_date is None:
        to_date = from_date + timedelta(days=30)
    
    # Format dates for GraphQL (ISO 8601)
    from_iso = from_date.isoformat()
    to_iso = to_date.isoformat()
    
    query = """
    query FreeElectricitySessions($accountNumber: String!, $from: DateTime!, $to: DateTime!) {
      customerFlexibilityCampaignEvents(
        accountNumber: $accountNumber
        campaignSlug: "free-electricity"
        from: $from
        to: $to
      ) {
        id
        startAt
        endAt
        status
        rewardAmount
      }
    }
    """
    
    variables = {
        "accountNumber": account_number,
        "from": from_iso,
        "to": to_iso
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(
        GRAPHQL_URL,
        json={"query": query, "variables": variables},
        headers=headers
    )
    response.raise_for_status()
    
    data = response.json()
    
    if "errors" in data:
        raise Exception(f"GraphQL errors: {data['errors']}")
    
    return data["data"]["customerFlexibilityCampaignEvents"]


def format_sessions_human(sessions: List[Dict]) -> None:
    """Pretty print the sessions for human reading."""
    if not sessions:
        print("No free electricity sessions found.")
        return
    
    print(f"\nFound {len(sessions)} free electricity session(s):\n")
    
    for session in sessions:
        start = datetime.fromisoformat(session["startAt"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(session["endAt"].replace("Z", "+00:00"))
        status = session.get("status", "unknown")
        reward = session.get("rewardAmount", "N/A")
        
        print(f"Session ID: {session['id']}")
        print(f"  Start:  {start.strftime('%Y-%m-%d %H:%M %Z')}")
        print(f"  End:    {end.strftime('%Y-%m-%d %H:%M %Z')}")
        print(f"  Status: {status}")
        print(f"  Reward: {reward}")
        print()


def format_sessions_json(sessions: List[Dict]) -> str:
    """Format sessions as JSON (for GitHub Actions output)."""
    formatted = []
    for session in sessions:
        formatted.append({
            "id": session["id"],
            "start": session["startAt"],
            "end": session["endAt"],
            "status": session.get("status"),
            "reward": session.get("rewardAmount")
        })
    return json.dumps(formatted, indent=2)


def main():
    """Main entry point."""
    # Get credentials from environment variables
    api_key = os.getenv("OCTOPUS_API_KEY")
    account_number = os.getenv("OCTOPUS_ACCOUNT_NUMBER")
    output_format = os.getenv("OUTPUT_FORMAT", "human")  # 'human' or 'json'
    
    if not api_key:
        print("ERROR: OCTOPUS_API_KEY environment variable not set", file=sys.stderr)
        print("Get your API key from: https://octopus.energy/dashboard/new/accounts/personal-details/api-access", file=sys.stderr)
        sys.exit(1)
    
    if not account_number:
        print("ERROR: OCTOPUS_ACCOUNT_NUMBER environment variable not set", file=sys.stderr)
        print("Find your account number in format A-XXXXXXXX in your Octopus dashboard", file=sys.stderr)
        sys.exit(1)
    
    try:
        print("Authenticating with Octopus Energy API...", file=sys.stderr)
        token = get_token(api_key)
        
        print("Fetching free electricity sessions...", file=sys.stderr)
        sessions = get_free_electricity_sessions(token, account_number)
        
        if output_format == "json":
            print(format_sessions_json(sessions))
        else:
            format_sessions_human(sessions)
            
    except requests.exceptions.HTTPError as e:
        print(f"ERROR: HTTP request failed: {e}", file=sys.stderr)
        if e.response is not None:
            print(f"Response: {e.response.text}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
