# API documentation

The docs for the Octopus Energy GraphQL API that we use:
- https://docs.octopus.energy/graphql/guides/basics 
- https://docs.octopus.energy/graphql/reference/queries#api-queries-customerflexibilitycampaignevents

## Key Points

- Campaign slug: `"free-electricity"` (note: uses hyphen, not underscore)
- GraphQL endpoint: `https://api.octopus.energy/v1/graphql/`
- Authentication: Use `obtainKrakenToken` mutation with API key to get JWT token
- Token is valid for 60 minutes
- Token goes in `Authorization` header (not "Bearer", just the token value)

## Query Example

```graphql
query FreeElectricitySessions($accountNumber: String!, $supplyPointIdentifier: String!, $from: DateTime!, $to: DateTime!) {
  customerFlexibilityCampaignEvents(
    accountNumber: $accountNumber
    supplyPointIdentifier: $supplyPointIdentifier
    campaignSlug: "free-electricity"
    from: $from
    to: $to
  ) {
    edges {
      node {
        id
        startAt
        endAt
        status
        rewardAmount
      }
    }
  }
}
```
