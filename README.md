# octopus_powerups
Programmatic access to Octopus Power Up and Free Electricty Session time data.

When there is a Power Up in my region (eastern England) or a Free Electricity Session, a script runs on my local machine which scrapes the email, converts the time data into ISO datetimes and dumps it in to a JSON object.  That file is a array of JSON objects.  The keys are `start` and `end`.  The timezone should always be in UTC and so you might need to check your conversions in the summer.  Using the template filter `as_timestamp` or `as_datetime` will enable you to convert from UTC to local time easily.

*NB: You MUST still sign up for the Power Up from the email you received.*

The sign up URL in the email includes a bunch of information which identifies you to Octopus, so that they can apply the credits to your account.  It might be possible to extract this URL and genericise it such that you could write an automation to automatically sign you up, but I haven't explored this yet and at the moment, I don't intend to.  Let me know if you think this is needed.

You *do not* need to sign up for Free Electricity Sessions if you are subscribed via Octoplus.

 * Once a Power Up has ended that session is removed from the JSON file.
 * If there are no Power Ups known the JSON file will be contain `null` for the start and end times.
 * If there are multiple sessions known the first three will be in an array in the json file. As one ends then next one will be added.  They should always be sorted in most recent first order.
 * You still need to manually sign up for the Power Up via the link in the email.

The main Power Ups JSON file is available at this URL: [https://www.whizzy.org/octopus_powerups/powerup.json](https://www.whizzy.org/octopus_powerups/powerup.json)

The main Free Electricity Sessions JSON file is available at this URL: [https://www.whizzy.org/octopus_powerups/free_electricity_session.json](https://www.whizzy.org/octopus_powerups/free_electricity_session.json)

These files are published from and hosted by Github, so should have good reliability and scalability.

You can watch the `powerup.json` file for changes from RSS with Github's atom feed: [https://github.com/8none1/octopus_powerups/commits/main/powerup.json.atom](https://github.com/8none1/octopus_powerups/commits/main/powerup.json.atom)

There are two accompanying blog posts which explain how to use these feeds to trigger your own automations in Home Assistant.

* This post explains how the data is extracted from the email:  [https://www.whizzy.org/2024-01-24-powerups-api/]
* This post explains how to create Home Assistant sensors that turn on and off at the start and end of a session: [https://www.whizzy.org/2024-09-14-free-electricity-sessions/]

# Home Assistant

I have two sensors to consume this data.

## REST sensor to parse the JSON

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

This retrieves the Power Up data.

## Binary Power Up In Progress Sensor

These suggested sensors will work for Power Ups or Free Electricity Sessions.  To trigger an automation watch for the binary sensor to change from `Off` to `On`, and vice versa to trigger something when the session ends.

Place this `binary_sensor` in the `template` section of your `configuration.yaml`.  e.g.

```yaml
...
template:
  ...
  - binary_sensor:
    - name: "Power Up In Progress"
    <as below>
...
```

The binary sensors has an `ON` or `OFF` state and includes attributes for the start and stop times as datetimes the total duration and the time remaning once `ON`.

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

This converts the previous sensor in to something a bit easier to work with.  The sensor will turn `ON` at the start of the Power Up and `OFF` at the end.  There are four attributes of this sensor:
 - the overall duration of the Power Up
 - the amount of time remaining until the end of the Power Up
 - The start time of the Power Up
 - The end time of the Power Up

# GitHub Project

The main GitHub page is here: [https://github.com/8none1/octopus_powerups](https://github.com/8none1/octopus_powerups)

# The email scraper

If you're interested in hosting this yourself, you can read more about how the Power Up emails are scraped in this issue:

https://github.com/8none1/octopus_powerups/issues/1#issuecomment-2308447124

# Affiliate Code

You can get £50 credit if you sign up to Octopus using this link: [https://share.octopus.energy/great-kiwi-634](https://share.octopus.energy/great-kiwi-634)
(and so do I).
