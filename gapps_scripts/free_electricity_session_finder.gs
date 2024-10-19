function getPowerUpEmails() {
  var threads = GmailApp.search('Fill your boots on',0, 3);
  var threads2 = GmailApp.search('Shift your electricity use to', 0, 3);
  var messages = [];
  threads.forEach(function(thread) {
    if (thread.isInInbox()) {
      // Is it actually an email, not a chat?
      msg = thread.getMessages()[0];
      sender = msg.getFrom();
      Logger.log("Message from: " + sender);
      messages.push(msg);
    }
  });

  threads2.forEach(function(thread) {
    if (thread.isInInbox()) {
      // Is it actually an email, not a chat?
      msg = thread.getMessages()[0];
      sender = msg.getFrom();
      Logger.log("Message from: " + sender);
      messages.push(msg);
    }
  });
  return messages;
}

// function getMessagesDisplay() {
//   var templ = HtmlService.createTemplateFromFile('messages');
//   templ.messages = getPowerUpEmails();
//   return templ.evaluate();
// }

function convertTime(time_string) {
  // Input string formatted as HH:MM AM|PM
  // Output is 24 hour formatted HH:MM:SS
  time_string = time_string.toLowerCase();
  var hour = parseInt(time_string.slice(0,2));
  if (time_string.indexOf('am') != -1 && hour == 12) {
    time_string = time_string.replace('12', '0');
  }
  if (time_string.indexOf('pm') != -1 && hour < 12) {
    time_string = time_string.replace(hour, (hour+12));
  }
  time_string = time_string.replace(/(am|pm)/, '');
  time_string = time_string.trim();
  time_string += ":00";
  return time_string;
}

function findTimeInString(time_string, period_hint = false) {
  // Inputs can be any of:
  //  - 10:30am
  //  - 10
  //  - 10pm
  //  - 4
  //  returns 24 hour clock time with 00 seconds
  // TO ADD:
  //  - 10:30 am (nb: space between time and period)

  time_string = time_string.trim();

  // 2pm or 10am
  if (time_string.match(/^\d{1,2}([ap][m])/i)) {
    Logger.log("Found time matching 2pm or 10am style: " + time_string);
    var period = time_string.slice(-2).toLowerCase();
    var hour = parseInt(time_string.slice(0,-2));
    if (hour < 10 && period == "am") { hour = "0" + hour};
    var min = "00"
    var time_string = String(hour) + ":" + min + " " + period;
    Logger.log("Processed time string: " + time_string);
    return convertTime(time_string);
  }

  // 2:30pm or 10:30am
  if (time_string.match(/^\d{1,2}:\d{2}([ap][m])/i)) {
    Logger.log("Found time matching 2:30pm or 10:00am style: " + time_string);
    var period = time_string.slice(-2).toLowerCase();
    var time_parts = time_string.split(":");
    var hour = parseInt(time_parts[0]);
    if (hour < 10 && period == "am") { hour = "0" + hour};
    var minute = time_parts[1].replace(/\D/g, "");
    var time_string = String(hour) + ":" + minute + " " + period;
    Logger.log("Processed time string: " + time_string);
    return convertTime(time_string);
  }

  // 1 or 12
  if (time_string.match(/^\d{1,2}$/)) {
    Logger.log("Found time matching 2 or 10 style: " + time_string);
    Logger.log("I might need to use the period hint");
    var hour = parseInt(time_string);
    if (hour > 12) {
      // Must already be 24hour format
      return convertTime(String(hour-12) + ":00 pm");
    } else {
      // We don't know what the period is, so we will have to use the hint
      if (period_hint) {
        Logger.log("Period hint is: " + period_hint);
        if (hour < 10 && period_hint.toLowerCase() == "am") {hour = "0" + String(hour)};
        return convertTime(String(hour) + ":00 " + period_hint);
      } else {
        return false;
      }

    }


  }

  return false;
}

function testTimeFinder() {
  Logger.log(findTimeInString("10pm"));
  Logger.log(findTimeInString("4am"));
  Logger.log(findTimeInString("10:30am"));
  Logger.log(findTimeInString("2:30pm"));
  Logger.log(findTimeInString("2:30am"));
  Logger.log(findTimeInString("2"));
  Logger.log(findTimeInString("14"));
  Logger.log(findTimeInString("2", "AM"));
  Logger.log(findTimeInString("2", "PM"));
  Logger.log(findTimeInString("14", "PM"));
}

function sortJsonArray(jsonString) {
  Logger.log("Incoming JsonString: "+jsonString);
  const jsonArray = JSON.parse(jsonString);
  if (jsonArray.length == 0) {
    Logger.log("No powerups found, returning special empty object")
    var emptyRepresentation = {};
    emptyRepresentation['start'] = null;
    emptyRepresentation['end'] = null;
    var emptyPowerups = [];
    emptyPowerups.push(emptyRepresentation);
    return JSON.stringify(emptyPowerups);
  } else {
    jsonArray.sort((a, b) => {
      const dateA = new Date(a.start);
      const dateB = new Date(b.start);
      return dateA - dateB;
    });
  }
  const sortedJsonString = JSON.stringify(jsonArray);
  Logger.log("Sorted JSON string: " + sortedJsonString);
  return sortedJsonString;
}

function checkHeaders(headers) {
  var blocks = headers.split(" ");
  var dkim = blocks.includes("dkim=pass");
  var arc = blocks.includes("arc=pass");
  var dmarc = blocks.includes("dmarc=pass");
  // Logger.log(headers);
  // Logger.log(blocks);
  // Logger.log(dkim);
  // Logger.log(arc);
  // Logger.log(dmarc);
};

function generateJson(){
  var messages = getPowerUpEmails();
  Logger.log(messages);
  var powerups = [];
  messages.forEach(function(message) {
    var authentic = checkHeaders(message.getHeader('ARC-Authentication-Results'));
    var plain_body = message.getPlainBody();
    Logger.log("Plain body: " + plain_body);
    const fill_your_boots_finder = /Fill your boots on.+?\./s;
    const shift_your_electricity_use_finder = /Shift your electricity use to.+?\./s;
    // Are there any matches before we proceed?
    var boots_match = plain_body.match(fill_your_boots_finder);
    var shift_match = plain_body.match(shift_your_electricity_use_finder);
    Logger.log(boots_match);
    Logger.log(shift_match);

    if (boots_match) {
      var extract = plain_body.match(fill_your_boots_finder)[0];
    }
    else if (shift_match) {
      var extract = plain_body.match(shift_your_electricity_use_finder)[0];
    } else {
      return
    }
    
   
    // if (fill_your_boots_extract.length < 1) {
    //   if (shift_your_electricity_use_extract.length > 0) {
    //     fill_your_boots_extract = shift_your_electricity_use_extract;
    //   }
    // }

    Logger.log("Extracted text: " + extract);
    const day_month_regex = /([0-9]{2}|[1-9]) (January|February|March|April|May|June|July|August|September|October|November|December)/s;
    var day_month = extract.match(day_month_regex);
    if (day_month.length < 3) {
      Logger.log("Error: No matching date information found.")
      return False;
    }
    // (probably) the full text is in index 0, the day of month in 1 and the month name in 2
    Logger.log("Day Month text: " + day_month[0]);
    const day_of_month = day_month[1];
    const month_name = day_month[2];
    Logger.log("Day of month:" + day_of_month);
    Logger.log("Month name: " + month_name);
    var i = extract.indexOf(month_name);
    var time_text = extract.slice(i + month_name.length);
    // >>> THIS IS THE MAIN REGEX FOR FINDING THE TIMES IN THE EMAIL... <<<
    time_text = time_text.match(/(\d{1,2}|\d{1,2}:\d{2})-(\d{1,2}|\d{1,2}:\d{2})([ap][m])/i)[0];
    Logger.log("Time text: " + time_text);
    var start_time = time_text.split('-')[0];
    var end_time = time_text.split('-')[1];
    Logger.log("Start: " + start_time);
    Logger.log("End: " + end_time);
    // Send the end time off to get interpretted first because we can get the period hint from it
    end_time = findTimeInString(end_time);
    if (end_time) {
      // It converted correctly, so now try and look up the start...
      var end_time_hour = parseInt(end_time.slice(0,2));
      if (end_time_hour < 12) {
        start_time = findTimeInString(start_time, "AM");
      } else {
        start_time = findTimeInString(start_time, "PM");
      }
    } else {
      return false;
    }

    Logger.log("Done finding start and end time strings...")
    Logger.log("Start: " + start_time);
    Logger.log("End: " + end_time);

    const year = new Date().getFullYear();
    const month = new Date(month_name + " 1, 2024").getMonth() + 1;

    var start_datetime_str = year + '-' + month + '-' + day_of_month + ' ' + start_time;
    var end_datetime_str =   year + '-' + month + '-' + day_of_month + ' ' + end_time;
    const start_datetime = new Date(start_datetime_str);
    const end_datetime = new Date(end_datetime_str);
    Logger.log("Start datetime: " + start_datetime);
    Logger.log("End datetime: " + end_datetime);
    const now = new Date();

    if (end_datetime < now) {
      // The power up is in the past, so ignore it.
      Logger.log("Power up is in the past");
      return;
    }
    Logger.log(start_datetime);
    Logger.log(end_datetime);
    var powerup = {};
    powerup['start'] = start_datetime;
    powerup['end'] = end_datetime;
    powerups.push(powerup);
  })
  Logger.log(powerups);
  return powerups;
}

function doGet(){
  var powerups = generateJson();
  var jsonString = JSON.stringify(powerups);
  var sortedJsonString = sortJsonArray(jsonString);
  return ContentService.createTextOutput(sortedJsonString).setMimeType(ContentService.MimeType.JSON);
  }
