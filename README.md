# octopus_powerups
Programmatic access to Octopus Energy Power Up and Free Electricity Session time data.

**📡 Now using the official Octopus Energy GraphQL API for Free Electricity Sessions!**

This project provides JSON feeds for both **Free Electricity Sessions** and **Power Ups** using two parallel data collection methods:

- **Free Electricity Sessions**: 
  - GraphQL API ✅ **Recommended** - reliable, structured data directly from Octopus Energy
  - Email parsing (legacy) - still runs alongside for backward compatibility
  
- **Power Ups**: 
  - Email parsing ✅ **Recommended** - most reliable for Power Ups
  - GraphQL API (experimental) ⚠️ - currently returns placeholder data, runs alongside but not recommended

The graphql system runs every 6 hours via GitHub Actions, providing multiple JSON files so you can choose the data source that works best for you. The keys are `start` and `end` with timestamps in ISO 8601 format (UTC). Using the template filter `as_timestamp` or `as_datetime` in Home Assistant will enable you to convert from UTC to local time easily.

*NB: You MUST still sign up for the Power Up from the email you received.*

The sign up URL in the email includes a bunch of information which identifies you to Octopus, so that they can apply the credits to your account.  It might be possible to extract this URL and genericise it such that you could write an automation to automatically sign you up, but I haven't explored this yet and at the moment, I don't intend to.  Let me know if you think this is needed.

You *do not* need to sign up for Free Electricity Sessions if you are subscribed via Octoplus.

 * Once a Power Up has ended that session is removed from the JSON file.
 * If there are no Power Ups known the JSON file will be contain `null` for the start and end times.
 * If there are multiple sessions known the first three will be in an array in the json file. As one ends then next one will be added.  They should always be sorted in most recent first order.
 * You still need to manually sign up for the Power Up via the link in the email.

## JSON Data Feeds

### Free Electricity Sessions (Recommended: GraphQL API)

**✅ Use this for Free Electricity Sessions:**
- **GraphQL API** (recommended): [https://www.whizzy.org/octopus_powerups/free_electricity_session_graphql.json](https://www.whizzy.org/octopus_powerups/free_electricity_session_graphql.json)
- Legacy (email parsing): [https://www.whizzy.org/octopus_powerups/free_electricity_session.json](https://www.whizzy.org/octopus_powerups/free_electricity_session.json)

The GraphQL API provides reliable, structured data directly from Octopus Energy.

### Power Ups (Recommended: Email Parsing)

**⚠️ Use this for Power Ups (email parsing is currently more reliable):**
- **Email parsing** (recommended): [https://www.whizzy.org/octopus_powerups/powerup.json](https://www.whizzy.org/octopus_powerups/powerup.json)
- GraphQL API (experimental): [https://www.whizzy.org/octopus_powerups/powerup_graphql.json](https://www.whizzy.org/octopus_powerups/powerup_graphql.json)

**Note**: The GraphQL API for Power Ups currently returns placeholder data (24-hour windows instead of real 1-2 hour events). We recommend using the email-parsed version until the API data quality improves.

## GraphQL API Implementation

The project now includes GraphQL API integration alongside the original email parsing:

**Free Electricity Sessions** (GraphQL - Production Ready ✅):

- Uses campaign slug `free_electricity`
- National coverage, auto-enrolled via Octoplus
- **Reliable, accurate data - recommended for production use**

**Power Ups** (GraphQL - Experimental ⚠️):

- Uses campaign slug `power_ups_ukpn` (eastern England, manual opt-in required)
- Currently returns placeholder data (24-hour windows vs real 1-2 hour events)
- Email parsing remains more accurate until API improves

### How the GraphQL Scripts Work

The Python scripts (`fes_finder_graphql.py` and `power_up_finder_graphql.py`) authenticate using only an API key and automatically:

1. Discover your account number
2. Find your electricity meter (MPAN)
3. Fetch flexibility campaign events
4. Filter to future events only
5. Output to JSON files

See [graphql/README.md](graphql/README.md) for setup instructions and [graphql/POWER_UPS.md](graphql/POWER_UPS.md) for technical details.

These files are published from and hosted by Github, so should have good reliability and scalability.

You can watch the `powerup.json` file for changes from RSS with Github's atom feed: [https://github.com/8none1/octopus_powerups/commits/main/powerup.json.atom](https://github.com/8none1/octopus_powerups/commits/main/powerup.json.atom)

## Blog Posts

There are several accompanying blog posts which explain how to use these feeds to trigger your own automations in Home Assistant:

- **Original email parsing approach**: [Power Ups API](https://www.whizzy.org/2024-01-24-powerups-api/)
- **Home Assistant integration guide**: [Free Electricity Sessions](https://www.whizzy.org/2024-09-14-free-electricity-sessions/)
- **GraphQL API discovery** (coming soon): Announcement of the official Octopus Energy GraphQL API for Free Electricity Sessions

## Home Assistant Integration

You can consume this data in Home Assistant using REST sensors and binary sensors.

### REST sensor to parse the JSON

```yaml
  - platform: rest
    name: "Power Up Times"
    unique_id: octopus_power_up_times
    resource: "https://www.whizzy.org/octopus_powerups/powerup.json"
    scan_interval: 900
    json_attributes_path: "$.[0]"
    json_attributes:
      - start
      - end
```

This retrieves the Power Up data. For Free Electricity Sessions, use the same configuration but with the `free_electricity_session_graphql.json` URL.

### Binary Power Up In Progress Sensor

These suggested sensors will work for Power Ups or Free Electricity Sessions. To trigger an automation, watch for the binary sensor to change from `Off` to `On`, and vice versa to trigger something when the session ends.

Place this `binary_sensor` in the `template` section of your `configuration.yaml`. For example:

```yaml
# configuration.yaml
template:
  - binary_sensor:
      - name: "Power Up In Progress"
        # ... configuration below
```

The binary sensor has an `ON` or `OFF` state and includes attributes for the start and stop times as datetimes, the total duration, and the time remaining once `ON`.

[//]: # ({% raw %})

```yaml
    - name: "Power Up In Progress"

      state: >
        {% set n = now() | as_timestamp %}
        {% set st  = state_attr('sensor.power_up_times', 'start') %}
        {% set end = state_attr('sensor.power_up_times', 'end')  %}
        {% if st != none %}
          {% if n >= as_timestamp(st) and n < as_timestamp(end) %}
            True
          {% else %}
             False
          {% endif %}
        {% endif %}
      attributes:
        duration_mins: >
          {% set st  = state_attr('sensor.power_up_times', 'start') | as_timestamp(0) %}
          {% set end = state_attr('sensor.power_up_times', 'end')   | as_timestamp(0) %}
          {{ ((end - st) / 60) | int }}
        duration_remaining: >
          {% if this.state == 'on' %}
            {% set n = now() | as_timestamp %}
            {% set end = state_attr('sensor.power_up_times', 'end') | as_timestamp(0) %}
            {{ ((end - n) / 60) | int }}
          {% else %}
            {{ False }}
          {% endif %}
        start_time: "{{state_attr('sensor.power_up_times', 'start') | as_datetime }}"
        end_time: "{{state_attr('sensor.power_up_times', 'end') | as_datetime }}"
```

[//]: # ({% endraw %})

This converts the previous sensor into something a bit easier to work with. The sensor will turn `ON` at the start of the Power Up and `OFF` at the end. There are four attributes of this sensor:

- The overall duration of the Power Up
- The amount of time remaining until the end of the Power Up
- The start time of the Power Up
- The end time of the Power Up

## Self-Hosting

If you're interested in hosting this yourself, you can read more about:

- **Email scraping implementation**: See this [detailed issue comment](https://github.com/8none1/octopus_powerups/issues/1#issuecomment-2308447124)
- **GraphQL API setup**: See [graphql/README.md](graphql/README.md) for configuration instructions

## GitHub Project

The main GitHub repository is here: [https://github.com/8none1/octopus_powerups](https://github.com/8none1/octopus_powerups)

## Affiliate Code

You can get £50 credit if you sign up to Octopus using this link: [https://share.octopus.energy/great-kiwi-634](https://share.octopus.energy/great-kiwi-634)
(and so do I).
