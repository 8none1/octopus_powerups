#!/usr/bin/env python3
"""
Free Electricity Session Finder using Octopus Energy GraphQL API
"""

import os
import sys
import json
import requests
from datetime import datetime, timezone
from typing import Dict, List

# Configuration
GRAPHQL_URL = "https://api.octopus.energy/v1/graphql/"


def get_token_with_api_key(api_key: str) -> str:
    """
    Get JWT token using API key via ObtainKrakenToken mutation.
    
    Args:
        api_key: Your Octopus Energy API key
    
    Returns:
        JWT token string
    """
    mutation = """
    mutation ObtainKrakenToken($input: ObtainJSONWebTokenInput!) {
        obtainKrakenToken(input: $input) {
            token
            refreshToken
            refreshExpiresIn
        }
    }
    """
    
    variables = {
        "input": {
            "APIKey": api_key
        }
    }
    
    response = requests.post(
        GRAPHQL_URL,
        json={"query": mutation, "variables": variables}
    )
    response.raise_for_status()
    data = response.json()
    
    if "errors" in data:
        raise Exception(f"GraphQL errors: {data['errors']}")
    
    return data["data"]["obtainKrakenToken"]["token"]


def get_token(email: str, password: str) -> str:
    """
    Get JWT token using email/password via ObtainKrakenToken mutation.
    
    Args:
        email: Your Octopus Energy account email
        password: Your Octopus Energy account password
    
    Returns:
        JWT token string
    """
    mutation = """
    mutation ObtainKrakenToken($input: ObtainJSONWebTokenInput!) {
        obtainKrakenToken(input: $input) {
            token
            refreshToken
            refreshExpiresIn
        }
    }
    """
    
    variables = {
        "input": {
            "email": email,
            "password": password
        }
    }
    
    response = requests.post(
        GRAPHQL_URL,
        json={"query": mutation, "variables": variables}
    )
    response.raise_for_status()
    data = response.json()
    
    if "errors" in data:
        raise Exception(f"GraphQL errors: {data['errors']}")
    
    return data["data"]["obtainKrakenToken"]["token"]


def get_account_number(token: str) -> str:
    """
    Auto-discover account number for the authenticated user.
    Returns the first account number found via the viewer query.
    
    Args:
        token: JWT authentication token
    
    Returns:
        Account number string (e.g., A-12345678)
    """
    query = """
    query ViewerQuery {
      viewer {
        accounts {
          number
        }
      }
    }
    """
    
    headers = {"Authorization": token}
    response = requests.post(
        GRAPHQL_URL,
        json={"query": query},
        headers=headers
    )
    response.raise_for_status()
    data = response.json()
    
    if "errors" in data:
        raise Exception(f"GraphQL errors: {data['errors']}")
    
    accounts = data["data"]["viewer"]["accounts"]
    
    if not accounts:
        raise Exception("No accounts found for authenticated user")
    
    # Return the first account number
    account_number = accounts[0]["number"]
    print(f"Auto-discovered account number: {account_number}")
    
    if len(accounts) > 1:
        print(f"Note: Found {len(accounts)} accounts, using first: {account_number}")
    
    return account_number


def get_account_mpans(token: str, account_number: str) -> List[str]:
    """
    Fetch electricity meter point MPANs for an account.
    Only returns IMPORT meter points (excludes EXPORT meters like solar export).
    
    Args:
        token: JWT authentication token
        account_number: Your Octopus account number (e.g., A-12345678)
    
    Returns:
        List of MPAN strings for import meters only
    """
    query = """
    query AccountPropertiesQuery($accountNumber: String!) {
      account(accountNumber: $accountNumber) {
        properties {
          electricityMeterPoints {
            mpan
            direction
            agreements {
              validFrom
              validTo
            }
          }
        }
      }
    }
    """
    
    variables = {
        "accountNumber": account_number
    }
    
    headers = {
        "Authorization": token,
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
    
    # Extract MPANs from properties, filtering for IMPORT meters only
    mpans = []
    properties = data.get("data", {}).get("account", {}).get("properties", [])
    for prop in properties:
        for meter_point in prop.get("electricityMeterPoints", []):
            mpan = meter_point.get("mpan")
            direction = meter_point.get("direction")
            
            if mpan and direction == "IMPORT":
                # Check if this meter point has active agreements
                agreements = meter_point.get("agreements", [])
                if agreements:  # Only include meter points with agreements
                    mpans.append(mpan)
    
    return mpans


def get_free_electricity_sessions(
    token: str,
    account_number: str,
    supply_point_identifier: str
) -> List[Dict]:
    """
    Fetch free electricity campaign events.
    
    Args:
        token: JWT authentication token
        account_number: Your Octopus account number (e.g., A-12345678)
        supply_point_identifier: The MPAN of your electricity meter
    
    Returns:
        List of free electricity session events
    """
    query = """
    query FreeElectricityEventsQuery($accountNumber: String!, $supplyPointIdentifier: String!, $campaignSlug: String!, $first: Int!) {
      customerFlexibilityCampaignEvents(
        accountNumber: $accountNumber
        supplyPointIdentifier: $supplyPointIdentifier
        campaignSlug: $campaignSlug
        first: $first
      ) {
        edges {
          node {
            name
            code
            startAt
            endAt
          }
        }
        edgeCount
      }
    }
    """
    
    variables = {
        "accountNumber": account_number,
        "supplyPointIdentifier": supply_point_identifier,
        "campaignSlug": "free_electricity",
        "first": 50
    }
    
    headers = {
        "Authorization": token,
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
    
    # Extract nodes from edges
    edges = data["data"]["customerFlexibilityCampaignEvents"]["edges"]
    return [edge["node"] for edge in edges]


def format_sessions_human(sessions: List[Dict]) -> None:
    """Pretty print the sessions for human reading."""
    if not sessions:
        print("No free electricity sessions found.")
        return
    
    print(f"\nFound {len(sessions)} free electricity session(s):\n")
    
    for session in sessions:
        start = datetime.fromisoformat(session["startAt"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(session["endAt"].replace("Z", "+00:00"))
        name = session.get("name", "N/A")
        code = session.get("code", "N/A")
        
        print(f"Name: {name}")
        print(f"  Code:  {code}")
        print(f"  Start: {start.strftime('%Y-%m-%d %H:%M %Z')}")
        print(f"  End:   {end.strftime('%Y-%m-%d %H:%M %Z')}")
        print()


def format_sessions_json(sessions: List[Dict]) -> str:
    """Format sessions as JSON (for GitHub Actions output)."""
    formatted = []
    for session in sessions:
        formatted.append({
            "name": session["name"],
            "code": session["code"],
            "start": session["startAt"],
            "end": session["endAt"]
        })
    return json.dumps(formatted, indent=2)


def write_sessions_to_file(sessions: List[Dict], filename: str = "free_electricity_session_graphql.json") -> None:
    """
    Write sessions to JSON file matching Google Apps Script format.
    
    - Filters to include only future sessions (end time > now)
    - Sorts by start time
    - Outputs { "start": ISO, "end": ISO, "code": "..." } format
    - If no sessions found, outputs [{ "start": null, "end": null, "code": null }]
    
    Args:
        sessions: List of session dictionaries
        filename: Output filename (default: free_electricity_session_graphql.json)
    """
    now = datetime.now(timezone.utc)
    
    # Filter for future sessions only (end time > now)
    future_sessions = []
    for session in sessions:
        end_dt = datetime.fromisoformat(session["endAt"].replace("Z", "+00:00"))
        # Ensure end_dt is timezone-aware for comparison
        if end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=timezone.utc)
        if end_dt > now:
            future_sessions.append(session)
    
    # Sort by start time
    future_sessions.sort(key=lambda s: s["startAt"])
    
    # Format for output matching Google Apps Script format
    if not future_sessions:
        # Empty result with null structure matching Google Apps Script
        output = [{"start": None, "end": None, "code": None}]
    else:
        output = []
        for session in future_sessions:
            output.append({
                "start": session["startAt"],
                "end": session["endAt"],
                "code": session.get("code", "")
            })
    
    # Write to file at repo root (one level up from script directory)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)  # Go up one level to repo root
    output_path = os.path.join(repo_root, filename)
    
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"Written {len(future_sessions)} future session(s) to {output_path}", file=sys.stderr)


def main():
    """Main entry point."""
    # Get credentials from environment variables
    api_key = os.getenv("OCTOPUS_API_KEY")
    account_number = os.getenv("OCTOPUS_ACCOUNT_NUMBER")  # Optional - will auto-discover if not provided
    mpan = os.getenv("OCTOPUS_MPAN")  # Optional - will auto-fetch if not provided
    output_format = os.getenv("OUTPUT_FORMAT", "human")  # 'human' or 'json'
    
    if not api_key:
        print("ERROR: OCTOPUS_API_KEY environment variable not set", file=sys.stderr)
        print("Generate an API key in your Octopus Energy dashboard settings", file=sys.stderr)
        sys.exit(1)
    
    try:
        print("Authenticating with Octopus Energy API using API key...", file=sys.stderr)
        token = get_token_with_api_key(api_key)
        
        # Auto-discover account number if not provided
        if not account_number:
            print("No account number provided, auto-discovering from authenticated user...", file=sys.stderr)
            account_number = get_account_number(token)
        else:
            print(f"Using provided account number: {account_number}", file=sys.stderr)
        
        # Auto-fetch MPAN if not provided
        if not mpan:
            print("No MPAN provided, fetching from account...", file=sys.stderr)
            mpans = get_account_mpans(token, account_number)
            
            if not mpans:
                print("ERROR: No electricity meter points found on account", file=sys.stderr)
                sys.exit(1)
            
            if len(mpans) > 1:
                print(f"Found {len(mpans)} electricity meter points:", file=sys.stderr)
                for i, m in enumerate(mpans, 1):
                    print(f"  {i}. {m}", file=sys.stderr)
                print("\nUsing first MPAN. Set OCTOPUS_MPAN environment variable to use a different one.", file=sys.stderr)
            
            mpan = mpans[0]
            print(f"Using MPAN: {mpan}", file=sys.stderr)
        
        print("Fetching free electricity sessions...", file=sys.stderr)
        sessions = get_free_electricity_sessions(token, account_number, mpan)
        
        # Always write to JSON file (matching Google Apps Script format)
        write_sessions_to_file(sessions)
        
        # Also print to stdout if requested
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
