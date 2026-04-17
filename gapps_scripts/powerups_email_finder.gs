function getPowerUpEmails() {
  var threads = GmailApp.search('subject:"Power Up" from:octopusenergy.it',0, 3);
  var messages = [];
  threads.forEach(function(thread) {
    messages.push(thread.getMessages()[0]);
  });
  return messages;
}

// function getMessagesDisplay() {
//   var templ = HtmlService.createTemplateFromFile('messages');
//   templ.messages = getPowerUpEmails();
//   return templ.evaluate();
// }

function convertTime(time_string) {
  // String formatted as HH:MM AM|PM
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
  Logger.log(headers);
  Logger.log(blocks);
  Logger.log(dkim);
  Logger.log(arc);
  Logger.log(dmarc);
};

function generateJson(){
  var messages = getPowerUpEmails();
  Logger.log(messages);
  var powerups = [];
  messages.forEach(function(message) {
    var authentic = checkHeaders(message.getHeader('ARC-Authentication-Results'));
    var body = message.getPlainBody();
    Logger.log("Email body: " + body);

    // Italian format: "tra le 13:00 e le 14:00"
    const time_re = /tra le (\d{1,2}:\d{2}) e le (\d{1,2}:\d{2})/i;
    var time_match = body.match(time_re);

    if (time_match) {
      var start_time = time_match[1];
      var end_time = time_match[2];
      Logger.log("Start time: " + start_time);
      Logger.log("End time: " + end_time);

      // Handle relative dates (Domani = tomorrow, oggi = today) or explicit DD/MM/YYYY
      const date_re = /(domani|oggi|\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}))/i;
      var date_match = body.match(date_re);

      var event_date;
      if (date_match) {
        var date_str = date_match[1].toLowerCase();
        if (date_str === 'domani') {
          event_date = new Date();
          event_date.setDate(event_date.getDate() + 1);
        } else if (date_str === 'oggi') {
          event_date = new Date();
        } else {
          // Parse DD/MM/YYYY or DD/MM/YY
          var parts = date_str.split('/');
          var year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
          event_date = new Date(year + '-' + parts[1] + '-' + parts[0]);
        }
      } else {
        // Default to tomorrow if no date indicator found
        Logger.log("No date found in email, defaulting to tomorrow");
        event_date = new Date();
        event_date.setDate(event_date.getDate() + 1);
      }

      var year = event_date.getFullYear();
      var month = String(event_date.getMonth() + 1).padStart(2, '0');
      var day = String(event_date.getDate()).padStart(2, '0');
      var date_prefix = year + '-' + month + '-' + day;

      var start_datetime_str = date_prefix + ' ' + start_time + ':00';
      var end_datetime_str = date_prefix + ' ' + end_time + ':00';
      const start_datetime = new Date(start_datetime_str);
      const end_datetime = new Date(end_datetime_str);
      Logger.log("Start datetime: " + start_datetime);
      Logger.log("End datetime: " + end_datetime);
      const now = new Date();

      if (end_datetime < now) {
        Logger.log("Power up is in the past");
        return;
      }
      var powerup = {};
      powerup['start'] = start_datetime;
      powerup['end'] = end_datetime;
      powerups.push(powerup);
    }
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
