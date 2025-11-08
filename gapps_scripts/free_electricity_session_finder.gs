// ======= Utilities / Email fetch =======

function getPowerUpEmails() {
  Logger.log("getPowerUpEmails: starting search");
  var threads = GmailApp.search('Fill your boots on', 0, 3);
  var messages = [];
  threads.forEach(function(thread, idx) {
    Logger.log("Thread " + idx + " isInInbox: " + thread.isInInbox());
    if (thread.isInInbox()) {
      var msg = thread.getMessages()[0];
      var sentDate = msg.getDate();
      var oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      Logger.log("Message date: " + sentDate + " (oneWeekAgo: " + oneWeekAgo + ")");
      if (sentDate >= oneWeekAgo) {
        var sender = msg.getFrom();
        Logger.log("Keeping message from: " + sender);
        messages.push(msg);
      } else {
        Logger.log("Skipping old message");
      }
    }
  });
  Logger.log("getPowerUpEmails: found " + messages.length + " messages");
  return messages;
}

// ======= Time parsing helpers =======

function convertTime(time_string) {
  // Input like "12:00 PM" or "2:30 AM"
  // Output "HH:MM:SS" in 24-hour
  if (!time_string) {
    Logger.log("convertTime: no input");
    return false;
  }
  var s = time_string.trim().toLowerCase();
  var m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m)$/i);
  if (!m) {
    Logger.log("convertTime: couldn't parse '" + time_string + "'");
    return false;
  }
  var hour = parseInt(m[1], 10);
  var minute = m[2] ? parseInt(m[2], 10) : 0;
  var period = m[3].toUpperCase();

  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  var hh = ("0" + hour).slice(-2);
  var mm = ("0" + minute).slice(-2);
  return hh + ":" + mm + ":00";
}

function findTimeInString(time_string, period_hint) {
  // Returns "HH:MM:SS" (24h) or false if ambiguous / can't parse.
  if (!time_string) {
    Logger.log("findTimeInString: empty input");
    return false;
  }
  var raw = String(time_string).trim();
  Logger.log("findTimeInString: raw input: '" + raw + "'; hint: " + period_hint);

  // remove trailing punctuation that sometimes appears
  raw = raw.replace(/[,\!\.]+$/g, "").trim();

  // Special words
  if (/noon/i.test(raw) || /\(noon\)/i.test(raw)) {
    Logger.log("Detected 'noon' => 12:00:00");
    return "12:00:00";
  }
  if (/midnight/i.test(raw)) {
    Logger.log("Detected 'midnight' => 00:00:00");
    return "00:00:00";
  }

  // canonicalise spaces
  raw = raw.replace(/\s+/g, " ");

  // Matches like "2pm", "10am"
  var m1 = raw.match(/^(\d{1,2})\s*([ap]m)$/i);
  if (m1) {
    var hour = parseInt(m1[1], 10);
    var period = m1[2].toUpperCase();
    var formatted = hour + ":00 " + period;
    Logger.log("Matched H[ap]m style -> " + formatted);
    return convertTime(formatted);
  }

  // Matches like "2:30pm", "10:05am"
  var m2 = raw.match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i);
  if (m2) {
    var hour = parseInt(m2[1], 10);
    var minute = m2[2];
    var period = m2[3].toUpperCase();
    var formatted = hour + ":" + minute + " " + period;
    Logger.log("Matched H:MM[ap]m style -> " + formatted);
    return convertTime(formatted);
  }

  // Plain number: "2" or "12" or "14"
  var m3 = raw.match(/^(\d{1,2})$/);
  if (m3) {
    var hour = parseInt(m3[1], 10);
    Logger.log("Matched plain hour: " + hour);
    if (hour >= 24) {
      Logger.log("Hour >= 24, invalid");
      return false;
    }
    if (hour > 12) {
      // treat as 24-hour, convert to 12-hour + PM for convertTime helper
      var hh12 = hour - 12;
      var formatted = hh12 + ":00 pm";
      Logger.log("Interpreting as 24h input -> " + formatted);
      return convertTime(formatted);
    } else {
      if (period_hint) {
        var ph = String(period_hint).toUpperCase();
        Logger.log("Using period hint '" + ph + "' -> " + hour + ":00 " + ph);
        return convertTime(hour + ":00 " + ph);
      } else {
        Logger.log("Ambiguous plain hour and no period hint: returning false");
        return false;
      }
    }
  }

  // If we get here, we couldn't parse
  Logger.log("findTimeInString: failed to parse '" + time_string + "'");
  return false;
}

// ======= Date extraction helpers =======

function dateMatch_dd_mmmm(extracted_text) {
  Logger.log("dateMatch_dd_mmmm: input: '" + extracted_text + "'");
  var dayMonthRegex = /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)/i;
  var dm = extracted_text.match(dayMonthRegex);
  if (!dm) {
    Logger.log("dateMatch_dd_mmmm: no day/month match");
    return false;
  }
  Logger.log("dateMatch_dd_mmmm: found day=" + dm[1] + " month=" + dm[2]);

  // Find time range near the date (allow multiple dash chars and optional (noon))
  var timeRangeRegex = /(\d{1,2}(?::\d{2})?(?:\s*\(noon\))?(?:\s*[ap]m)?)\s*[-\u2013\u2014]\s*(\d{1,2}(?::\d{2})?)([ap]m)/i;
  var tm = extracted_text.match(timeRangeRegex);
  if (!tm) {
    Logger.log("dateMatch_dd_mmmm: no time-range found in same text");
    return [dm[0], dm[1], dm[2], null];
  }
  Logger.log("dateMatch_dd_mmmm: time match: " + JSON.stringify(tm));
  return [dm[0], dm[1], dm[2], tm];
}

function dateMatch_dddd_dd_mmmm(extracted_text) {
  Logger.log("dateMatch_dddd_dd_mmmm: input: '" + extracted_text + "'");
  var dayMonthRegex = /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)/i;
  var dm = extracted_text.match(dayMonthRegex);
  if (!dm) {
    Logger.log("dateMatch_dddd_dd_mmmm: no match");
    return false;
  }
  Logger.log("dateMatch_dddd_dd_mmmm: found day=" + dm[1] + " month=" + dm[2]);

  var timeRangeRegex = /(\d{1,2}(?::\d{2})?(?:\s*\(noon\))?(?:\s*[ap]m)?)\s*[-\u2013\u2014]\s*(\d{1,2}(?::\d{2})?)([ap]m)/i;
  var tm = extracted_text.match(timeRangeRegex);
  if (!tm) {
    Logger.log("dateMatch_dddd_dd_mmmm: no time-range found");
    return [dm[0], dm[1], dm[2], null];
  }
  Logger.log("dateMatch_dddd_dd_mmmm: time match: " + JSON.stringify(tm));
  return [dm[0], dm[1], dm[2], tm];
}

// ======= Main JSON generation (improved start-period logic) =======

function generateJson() {
  Logger.log("generateJson: start");
  var messages = getPowerUpEmails();
  Logger.log("generateJson: messages length = " + messages.length);
  var powerups = [];

  messages.forEach(function(message, idx) {
    Logger.log("Processing message " + idx);
    try {
      var headers = message.getHeader ? message.getHeader('ARC-Authentication-Results') : null;
      Logger.log("Headers (ARC-Authentication-Results): " + headers);
      var authentic = checkHeaders(headers);
      Logger.log("Authentic header check: " + authentic);

      var plain_body = message.getPlainBody();
      Logger.log("Plain body start (first 500 chars):\n" + plain_body.slice(0, 500));

      // Updated regex to handle both "time-timepm, Day DDth Month" and "time-timepm Day DDth Month" formats
      // Captures: [1] start, [2] end numeric, [3] end am/pm, [4] optional day-of-week, [5] day number, [6] month name
      var timeDateRegex = /(\d{1,2}(?::\d{2})?(?:\s*\(noon\))?(?:\s*[ap]m)?)\s*[-–—]\s*(\d{1,2}(?::\d{2})?)([ap]m)[,]?\s*(?:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b[,]?\s*)?(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)/gi;

      // 1) try scanning the whole message
      var allMatches = [...plain_body.matchAll(timeDateRegex)];
      Logger.log("Found " + allMatches.length + " time/date ranges across whole message");

      // 2) fallback: if nothing in whole message, attempt to extract snippet and search inside the snippet
      if (allMatches.length === 0) {
        // ----- Named regex for the Free Electricity Session (so you can find it easily) -----
        const free_electricty_session_finder =
          /Free Electricity Session\s+\d{1,2}(?::\d{2})?(?:\s*\(noon\))?\s*[-–—]\s*\d{1,2}(?::\d{2})?[ap]m,?\s*(?:\w+\s+)?\d{1,2}(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)!?/i;

        const patterns = [
          /Fill your boots on.+?\./s,
          /Shift your electricity use to.+?\./s,
          /Use more power on.+?\./s,
          free_electricty_session_finder
        ];

        var extract = patterns.map(p => (plain_body.match(p) || [])[0]).find(Boolean);
        Logger.log("Fallback extracted snippet: " + (extract ? extract : "none"));
        if (extract) {
          allMatches = [...extract.matchAll(timeDateRegex)];
          Logger.log("Fallback: found " + allMatches.length + " time/date ranges inside extract");
        }
      }

      if (allMatches.length === 0) {
        Logger.log("No time/date ranges found for this message, skipping.");
        return;
      }

      // Process each matched occurrence separately
      allMatches.forEach(function(match) {
        Logger.log("Match groups: " + JSON.stringify(match));

        var start_raw = (match[1] || "").trim();
        var end_numeric_raw = (match[2] || "").trim();
        var end_period_raw = (match[3] || "").trim().toLowerCase(); // 'am' / 'pm' or ''
        var day_of_week = match[4]; // optional day name (now captured separately)
        var day_of_month = match[5];
        var month_name = match[6];

        Logger.log("start_raw: '" + start_raw + "'   end_raw pieces: '" + end_numeric_raw + "' '" + end_period_raw + "'");
        Logger.log("day_of_week=" + day_of_week + " day=" + day_of_month + " month=" + month_name);

        // Interpret end first (so we have canonical 24h end time)
        var end_raw_combined = (end_numeric_raw + (end_period_raw || "")).trim();
        var end_parsed = findTimeInString(end_raw_combined);
        Logger.log("end_parsed result: " + end_parsed);
        if (!end_parsed) {
          Logger.log("Could not parse end time '" + end_raw_combined + "', skipping this match.");
          return;
        }

        // Decide start period intelligently:
        // If start already has am/pm or 'noon' we let findTimeInString handle it.
        var start_has_period = /[ap]m/i.test(start_raw) || /noon/i.test(start_raw);

        var start_parsed = false;
        var chosen_start_hint = null;

        if (start_has_period) {
          // start raw explicitly contains AM/PM or noon — parse directly
          start_parsed = findTimeInString(start_raw);
          Logger.log("start had explicit period -> start_parsed: " + start_parsed);
        } else if (end_period_raw) {
          // Use the raw end period to reason about start period
          var start_num = parseInt((start_raw.match(/\d{1,2}/) || [NaN])[0], 10);
          var end_num = parseInt((end_numeric_raw.match(/\d{1,2}/) || [NaN])[0], 10);
          Logger.log("start_num: " + start_num + " end_num: " + end_num + " end_period_raw: " + end_period_raw);

          if (!isNaN(start_num) && !isNaN(end_num)) {
            if (end_period_raw === "pm") {
              // Common cases:
              // - "11-12pm" -> start should be AM (11am->12pm)
              // - "12-2pm"  -> start should be PM (12pm->2pm)
              // - "12-3pm"  -> start should be PM (12pm->3pm)
              if (start_num === 12) {
                // If start is 12 and end is PM, start must be 12 PM (noon)
                chosen_start_hint = "PM";
              } else if (end_num === 12) {
                chosen_start_hint = (start_num <= 11) ? "AM" : "PM";
              } else {
                chosen_start_hint = (start_num < end_num) ? "PM" : "AM";
              }
            } else if (end_period_raw === "am") {
              // Common cases:
              // - "11-12am" -> usually 11pm->12am (start PM), so choose PM when start_num >= end_num
              // - "1-3am" -> start AM
              // - "12-3am" -> start should be AM (12am->3am)
              if (start_num === 12) {
                // If start is 12 and end is AM, start must be 12 AM (midnight)
                chosen_start_hint = "AM";
              } else if (end_num === 12) {
                chosen_start_hint = (start_num < 12) ? "PM" : "AM";
              } else {
                chosen_start_hint = (start_num < end_num) ? "AM" : "PM";
              }
            }
            Logger.log("Heuristic chose start hint: " + chosen_start_hint);
            if (chosen_start_hint) {
              start_parsed = findTimeInString(start_raw, chosen_start_hint);
              Logger.log("start_parsed using chosen_start_hint: " + start_parsed);
            }
          }
        }

        // Fallback: if we still don't have a parsed start, fall back to end_parsed-derived hint
        if (!start_parsed) {
          var end_hour24 = parseInt(end_parsed.slice(0, 2), 10);
          var fallback_hint = (end_hour24 < 12) ? "AM" : "PM";
          Logger.log("Fallback hint based on end_parsed hour (" + end_hour24 + "): " + fallback_hint);
          start_parsed = findTimeInString(start_raw, fallback_hint);
          Logger.log("start_parsed using fallback hint: " + start_parsed);
          chosen_start_hint = chosen_start_hint || fallback_hint;
        }

        if (!start_parsed) {
          Logger.log("Could not determine start time for match, skipping.");
          return;
        }

        // Build Date objects explicitly (avoid ambiguous date string parsing)
        var year = new Date().getFullYear();
        var monthIndex = new Date(month_name + " 1, " + year).getMonth(); // 0-based
        var day = parseInt(day_of_month, 10);
        Logger.log("Building Date using year=" + year + " monthIndex=" + monthIndex + " day=" + day);

        var start_parts = start_parsed.split(":").map(Number);
        var end_parts = end_parsed.split(":").map(Number);

        var start_dt = new Date(year, monthIndex, day, start_parts[0], start_parts[1], start_parts[2] || 0);
        var end_dt = new Date(year, monthIndex, day, end_parts[0], end_parts[1], end_parts[2] || 0);

        Logger.log("Initial start_dt: " + start_dt.toString() + "  (ISO: " + start_dt.toISOString() + ")");
        Logger.log("Initial end_dt:   " + end_dt.toString()   + "  (ISO: " + end_dt.toISOString() + ")");

        // If start >= end, try an alternate start hint (flip AM<->PM) — this helps cases like 11-12pm
        if (start_dt >= end_dt) {
          Logger.log("start_dt >= end_dt; trying inverse hint to recover correct ordering");
          var inverse_hint = (chosen_start_hint && chosen_start_hint.toUpperCase() === "AM") ? "PM" : "AM";
          // If chosen_start_hint is null, but start had no period, try both hints (AM then PM)
          var alt_start_parsed = findTimeInString(start_raw, inverse_hint);
          if (alt_start_parsed) {
            var alt_parts = alt_start_parsed.split(":").map(Number);
            var alt_start_dt = new Date(year, monthIndex, day, alt_parts[0], alt_parts[1], alt_parts[2] || 0);
            Logger.log("Alternate start_dt using " + inverse_hint + ": " + alt_start_dt.toString() + " (ISO: " + alt_start_dt.toISOString() + ")");
            if (alt_start_dt < end_dt) {
              Logger.log("Alternate start is before end — using alternate start");
              start_parsed = alt_start_parsed;
              start_dt = alt_start_dt;
            } else {
              Logger.log("Alternate start still not before end; leaving original (will skip if invalid)");
            }
          }
        }

        // If still start >= end after attempts, skip (ambiguous)
        if (start_dt >= end_dt) {
          Logger.log("After attempts, start_dt is still >= end_dt. Skipping this match as ambiguous.");
          return;
        }

        Logger.log("Final start_dt: " + start_dt.toISOString() + "  end_dt: " + end_dt.toISOString());

        if (end_dt < new Date()) {
          Logger.log("Detected end_dt in the past -> skipping this match");
          return;
        }

        powerups.push({
          start: start_dt.toISOString(),
          end: end_dt.toISOString()
        });

        Logger.log("Added powerup: start=" + start_dt.toISOString() + " end=" + end_dt.toISOString());
      });

    } catch (err) {
      Logger.log("Exception while processing message: " + err + "\n" + (err.stack || ""));
    }
  });

  Logger.log("generateJson: finished. powerups count = " + powerups.length);
  Logger.log("powerups array JSON: " + JSON.stringify(powerups, null, 2));
  return powerups;
}

// ======= Sort + endpoint =======

function sortJsonArray(jsonString) {
  Logger.log("sortJsonArray: input JSON length = " + jsonString.length);
  const jsonArray = JSON.parse(jsonString);
  if (jsonArray.length == 0) {
    Logger.log("sortJsonArray: empty array -> returning placeholder");
    var emptyRepresentation = { start: null, end: null };
    return JSON.stringify([emptyRepresentation]);
  }
  jsonArray.sort((a, b) => new Date(a.start) - new Date(b.start));
  var out = JSON.stringify(jsonArray);
  Logger.log("sortJsonArray: sorted output length = " + out.length);
  return out;
}

function checkHeaders(headers) {
  Logger.log("checkHeaders: headers input: " + headers);
  if (!headers) return false;
  var blocks = headers.split(/\s+/);
  var dkim = blocks.includes("dkim=pass");
  var arc = blocks.includes("arc=pass");
  var dmarc = blocks.includes("dmarc=pass");
  Logger.log("checkHeaders: dkim=" + dkim + " arc=" + arc + " dmarc=" + dmarc);
  return dkim && arc && dmarc;
}

function doGet() {
  Logger.log("doGet called");
  var powerups = generateJson();
  var jsonString = JSON.stringify(powerups);
  var sortedJsonString = sortJsonArray(jsonString);
  Logger.log("doGet: final payload: " + sortedJsonString);
  return ContentService.createTextOutput(sortedJsonString)
    .setMimeType(ContentService.MimeType.JSON);
}

// ======= Test function =======

function testEmailParsing() {
  Logger.log("testEmailParsing: start");
  
  var testEmailBody = `
Hi William,

The wind is blowing and the turbines are living their best lives. The perfect conditions for...you guessed it...Free Electricity. This weekend is an absolute corker with not one, but TWO sessions:

 

Tonight: 9-10pm Friday 24th October

Tomorrow: 12-3pm Saturday 25th October 🎉 (A TRIPLE session!) 🎉

 
 

Fill your boots and make it count
`;

  // First, let's test the regex directly to see what it matches
  var timeDateRegex = /(\d{1,2}(?::\d{2})?(?:\s*\(noon\))?(?:\s*[ap]m)?)\s*[-–—]\s*(\d{1,2}(?::\d{2})?)([ap]m)[,]?\s*(?:\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b[,]?\s*)?(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)/gi;
  
  Logger.log("=== REGEX TEST ===");
  var matches = [...testEmailBody.matchAll(timeDateRegex)];
  matches.forEach(function(m, i) {
    Logger.log("Match " + i + ":");
    Logger.log("  Full match: " + m[0]);
    Logger.log("  start_raw: " + m[1]);
    Logger.log("  end_numeric: " + m[2]);
    Logger.log("  end_period: " + m[3]);
    Logger.log("  day_of_week: " + m[4]);
    Logger.log("  day_of_month: " + m[5]);
    Logger.log("  month_name: " + m[6]);
  });

  // Temporarily replace getPowerUpEmails
  var originalGetPowerUpEmails = this.getPowerUpEmails;
  
  // Store original Date constructor
  var OriginalDate = Date;
  var testDate = new OriginalDate(2024, 9, 24, 8, 0, 0); // October 24, 2024 at 8am (before the sessions)
  
  this.getPowerUpEmails = function() {
    return [{
      getPlainBody: function() { return testEmailBody; },
      getHeader: function() { return "dkim=pass arc=pass dmarc=pass"; },
      getDate: function() { return testDate; },
      getFrom: function() { return "test@octopus.energy"; }
    }];
  };
  
  // Override Date constructor - only return testDate for no-argument calls
  Date = function() {
    if (arguments.length === 0) {
      // This is for "new Date()" calls (current time checks)
      return testDate;
    }
    // For all other calls (like new Date(year, month, day...)), use original
    return new (Function.prototype.bind.apply(OriginalDate, [null].concat(Array.prototype.slice.call(arguments))))();
  };
  Date.prototype = OriginalDate.prototype;
  Date.now = function() { return testDate.getTime(); };
  Date.parse = OriginalDate.parse;
  Date.UTC = OriginalDate.UTC;
  
  // Call the real generateJson function
  var powerups = generateJson();
  
  // Restore original functions
  this.getPowerUpEmails = originalGetPowerUpEmails;
  Date = OriginalDate;
  
  Logger.log("\n=== TEST RESULTS ===");
  Logger.log("Found " + powerups.length + " powerup sessions");
  Logger.log(JSON.stringify(powerups, null, 2));
  
  return powerups;
}
