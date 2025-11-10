#!/usr/bin/env python3
"""
Power Up Finder using Octopus Energy GraphQL API
Fetches UKPN Power Up events for your account
"""

import os
import sys
import json
import requests
from datetime import datetime, timezone
from typing import Dict, List

# Configuration
GRAPHQL_URL = "https://api.octopus.energy/v1/graphql/"
CAMPAIGN_SLUG = "power_ups_ukpn"


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


def get_account_number(token: str) -> str:
    """
    Get the account number for the authenticated user.
    
    Args:
        token: JWT token
    
    Returns:
        Account number string
    """
    query = """
    {
        viewer {
            accounts {
                number
            }
        }
    }
    """
    
    response = requests.post(
        GRAPHQL_URL,
        json={"query": query},
        headers={"Authorization": token}
    )
    response.raise_for_status()
    data = response.json()
    
    if "errors" in data:
        raise Exception(f"GraphQL errors: {data['errors']}")
    
    accounts = data["data"]["viewer"]["accounts"]
    if not accounts:
        raise Exception("No accounts found")
    
    return accounts[0]["number"]


def get_mpan(token: str, account_number: str) -> str:
    """
    Get the first IMPORT electricity meter point (MPAN) for the account.
    
    Args:
        token: JWT token
        account_number: Account number
    
    Returns:
        MPAN string
    """
    query = """
    query GetAccount($accountNumber: String!) {
        account(accountNumber: $accountNumber) {
            properties {
                electricityMeterPoints {
                    mpan
                    meters {
                        meterType
                    }
                }
            }
        }
    }
    """
    
    variables = {"accountNumber": account_number}
    
    response = requests.post(
        GRAPHQL_URL,
        json={"query": query, "variables": variables},
        headers={"Authorization": token}
    )
    response.raise_for_status()
    data = response.json()
    
    if "errors" in data:
        raise Exception(f"GraphQL errors: {data['errors']}")
    
    properties = data["data"]["account"]["properties"]
    if not properties:
        raise Exception("No properties found")
    
    # Find first IMPORT meter
    for prop in properties:
        for meter_point in prop["electricityMeterPoints"]:
            # Check if it's an IMPORT meter (not EXPORT for solar panels)
            for meter in meter_point["meters"]:
                if meter["meterType"] == "ELECTRICITY_IMPORT":
                    return meter_point["mpan"]
    
    # If no IMPORT meter found, just return the first MPAN
    if properties[0]["electricityMeterPoints"]:
        return properties[0]["electricityMeterPoints"][0]["mpan"]
    
    raise Exception("No electricity meter points found")


def get_power_up_events(token: str, account_number: str, mpan: str) -> List[Dict]:
    """
    Get Power Up events for the account.
    
    Args:
        token: JWT token
        account_number: Account number
        mpan: Meter point administration number
    
    Returns:
        List of Power Up events
    """
    query = """
    query GetPowerUpEvents($accountNumber: String!, $mpan: String!, $campaignSlug: String!) {
        customerFlexibilityCampaignEvents(
            accountNumber: $accountNumber,
            supplyPointIdentifier: $mpan,
            campaignSlug: $campaignSlug,
            first: 50
        ) {
            edges {
                node {
                    code
                    startAt
                    endAt
                }
            }
        }
    }
    """
    
    variables = {
        "accountNumber": account_number,
        "mpan": mpan,
        "campaignSlug": CAMPAIGN_SLUG
    }
    
    response = requests.post(
        GRAPHQL_URL,
        json={"query": query, "variables": variables},
        headers={"Authorization": token}
    )
    response.raise_for_status()
    data = response.json()
    
    if "errors" in data:
        raise Exception(f"GraphQL errors: {data['errors']}")
    
    events = []
    edges = data["data"]["customerFlexibilityCampaignEvents"]["edges"]
    
    for edge in edges:
        node = edge["node"]
        events.append({
            "code": node["code"],
            "start": node["startAt"],
            "end": node["endAt"]
        })
    
    return events


def filter_future_events(events: List[Dict]) -> List[Dict]:
    """
    Filter events to only include those that haven't ended yet.
    
    Args:
        events: List of events
    
    Returns:
        List of future events
    """
    now = datetime.now(timezone.utc)
    future_events = []
    
    for event in events:
        end_time = datetime.fromisoformat(event["end"].replace("Z", "+00:00"))
        if end_time > now:
            future_events.append(event)
    
    return future_events


def format_output(events: List[Dict]) -> List[Dict]:
    """
    Format events to match the Google Apps Script output format.
    
    Args:
        events: List of events
    
    Returns:
        List of formatted events or [{"start": null, "end": null}] if no events
    """
    if not events:
        return [{"start": None, "end": None}]
    
    formatted = []
    for event in events:
        formatted.append({
            "start": event["start"],
            "end": event["end"]
        })
    
    return formatted


def main():
    """Main function"""
    try:
        # Get API key from environment
        api_key = os.environ.get("OCTOPUS_API_KEY")
        if not api_key:
            print("Error: OCTOPUS_API_KEY environment variable not set")
            sys.exit(1)
        
        print("🔌 Power Up Finder (UKPN)")
        print("=" * 50)
        
        # Authenticate
        print("Authenticating with API key...")
        token = get_token_with_api_key(api_key)
        print("✓ Authenticated")
        
        # Get account details
        print("Getting account details...")
        account_number = get_account_number(token)
        print(f"✓ Account: {account_number}")
        
        mpan = get_mpan(token, account_number)
        print(f"✓ MPAN: {mpan}")
        
        # Get Power Up events
        print(f"Fetching Power Up events for campaign '{CAMPAIGN_SLUG}'...")
        events = get_power_up_events(token, account_number, mpan)
        print(f"✓ Found {len(events)} total events")
        
        # Filter to future events only
        future_events = filter_future_events(events)
        print(f"✓ Found {len(future_events)} future events")
        
        # Format output
        output = format_output(future_events)
        
        # Write to JSON file at repository root
        output_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "powerup_graphql.json")
        with open(output_file, "w") as f:
            json.dump(output, f, indent=2)
        
        print(f"✓ Wrote output to {output_file}")
        print()
        
        if future_events:
            print(f"Next Power Up event:")
            print(f"  Start: {future_events[0]['start']}")
            print(f"  End:   {future_events[0]['end']}")
        else:
            print("No upcoming Power Up events")
        
        print()
        print("✅ Done!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
