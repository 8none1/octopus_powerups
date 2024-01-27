# octopus_powerups
Programmatic access to Octopus Power Up time data.

When there is a Power Up in my region a script runs on my local machine which scrapes the email, converts the time data into ISO datetimes and dumps it in `powerup.json`.  That file is a array of JSON objects.  The keys are `start` and `end`.  The timezone should always be in UTC and so you might need to check your conversions in the summer.

 * Once a Power Up has ended that session is removed from the JSON file.
 * If there are no Power Ups known the JSON file will be a blank array. i.e. `[]`
 * If there are multiple Power Ups known the first three will be in an array in the json file. As one ends then next one will be added.  They should always be sorted in most recent first order.
 * You still need to manually sign up for the Power Up via the link in the email.

The main JSON file will be available at this URL: https://www.whizzy.org/octopus_powerups/powerup.json
This file is published from and hosted by Github, so should have good reliability and scalability.

You can watch the `powerup.json` file for changes from RSS with Github's atom feed: https://github.com/8none1/octopus_powerups/commits/main/powerup.json.atom

# Home Assistant

I have two sensors to consume this data.  

## REST sensor to parse the JSON

```
  - platform: rest
    name: "Power Up Times"
    resource: "https://www.whizzy.org/octopus_powerups/powerup.json"
    scan_interval: 900
    json_attributes_path: "$.[0]"
    json_attributes:
      - start
      - end
```

This retrieves the Power Up data

## Binary Power Up In Progress Sensor

[//]: # ({% raw %})
```
    - name: "Power Up In Progress"
      state: >
        {% set n = now() | as_timestamp %}
        {% set st  = state_attr('sensor.power_up_times', 'start') | as_timestamp %}
        {% set end = state_attr('sensor.power_up_times', 'end')   | as_timestamp %}
        {% if n >= st and n < end %}
          True
        {% else %}
          False
        {% endif %}
      attributes:
        duration_mins: >
          {% set st  = state_attr('sensor.power_up_times', 'start') | as_timestamp %}
          {% set end = state_attr('sensor.power_up_times', 'end')   | as_timestamp %}
          {{ ((end - st) / 60) | int }}
        duration_remaining: >
          {% if this.state == 'on' %}
            {% set n = now() | as_timestamp %}
            {% set end = state_attr('sensor.power_up_times', 'end') | as_timestamp %}
            {{ ((end - n) / 60) | int }}
          {% else %}
            {{ False }}
          {% endif %}
        start_time: "{{state_attr('sensor.power_up_times', 'start') | as_datetime }}"
        end_time: "{{state_attr('sensor.power_up_times', 'end') | as_datetime }}"
```
[//]: # {% endraw %}

This converts the previous sensor in to something a bit easier to work with.  The sensor will turn `ON` at the start of the Power Up and `OFF` at the end.  There are four attributes of this sensor:
 - the overall duration of the Power Up
 - the amount of time remaining until the end of the Power Up
 - The start time of the Power Up
 - The end time of the Power Up


# Affiliate Code

You can get £50 credit if you sign up to Octopus using this link: https://share.octopus.energy/great-kiwi-634
(and so do I).

