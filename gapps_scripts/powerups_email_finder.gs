function getPowerUpEmails() {
  var threads = GmailApp.search('subject:"Power-ups: Opt in"',0, 3);
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
    var subject_line = message.getSubject();
    Logger.log("Subject line from API: " + subject_line);
    const subject_line_regex = /.*[0-9]{2}\/[0-9]{2}\/(?:\d{4}|\d{2})/s;
    var extract = subject_line.match(subject_line_regex);
    Logger.log("Extracted text: " + extract);
    if (extract.length == 1) { 
      // if not, then???
      const start_re = /(?<=at )([0-9]{2}|[0-9]):[0-9]{2} (AM|PM)/i;
      const end_re = /(?<= - )([0-9]{2}|[0-9]):[0-9]{2} (AM|PM)/i;
      const date_re = /([0-9]{2}|[0-9])\/([0-9]{2}|[0-9])\/(?:\d{4}|\d{2})/;
      var date_str = extract[0].match(date_re)[0];
      var start_str = extract[0].match(start_re)[0];
      var end_str = extract[0].match(end_re)[0];
      Logger.log("Date: "+date_str);
      Logger.log("Start time: " + start_str);
      Logger.log("End time: " + end_str);
      if (date_str.slice(6).length == 2) {
        var start_datetime_str = '20' + date_str.slice(6) + '-' + date_str.slice(3,5) + '-' + date_str.slice(0,2) + ' ' + convertTime(start_str);
        var end_datetime_str   = '20' + date_str.slice(6) + '-' + date_str.slice(3,5) + '-' + date_str.slice(0,2) + ' ' + convertTime(end_str);
      } else {
        var start_datetime_str = date_str.slice(6) + '-' + date_str.slice(3,5) + '-' + date_str.slice(0,2) + ' ' + convertTime(start_str);
        var end_datetime_str   = date_str.slice(6) + '-' + date_str.slice(3,5) + '-' + date_str.slice(0,2) + ' ' + convertTime(end_str);
      };
      //const end_datetime_str   = '20' + date_str.slice(6) + '-' + date_str.slice(3,5) + '-' + date_str.slice(0,2) + ' ' + convertTime(end_str);
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
    };
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
