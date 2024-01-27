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

You can get £50 credit if you sign up to Octopus using this link: https://share.octopus.energy/great-kiwi-634
(and so do I).

