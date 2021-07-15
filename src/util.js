const DATE_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CATEGORY_EVENTS = "EVENTS";
const CATEGORY_SIGNUP = "SIGNUP";

const EMOJI_THUMBS_UP = "👍";
const EMOJI_THUMBS_DOWN = "👎";
const EMOJI_HOURGLASS = "⏳";
const EMOJI_HOURGLASS2 = "⌛";

/**
 * Generate Date object from date + time string
 * 
 * @param dateString - DD/MM/YYYY format
 * @param timeString - HH:MM format
 * @returns 
 */
function GenerateDate(dateString, timeString)
{
    var dateParts = dateString.split("/");
    var timeParts = timeString.split(":");

    if(dateParts.length != 3)
        return null;

    if(timeParts.length != 2)
        return null;
    
    var date = new Date(+dateParts[2], dateParts[1] - 1, +dateParts[0], timeParts[0], timeParts[1]);
    return date;
}

/**
 * Generates a string based off a title and date (example: magtheridon-sun-17)
 * 
 * @param name 
 * @param date 
 * @returns 
 */
 function GenerateChannelName(name, date)
 {
     var result = name;
     result += `-${DATE_DAYS[date.getDay()]}`.substring(0, 4).toLowerCase();
     result += `-${date.getDate()}`;
     return result;
 }

function IsNumeric(str) 
{
    if (typeof str != "string") 
        return false;
        
    return !isNaN(str) && !isNaN(parseFloat(str));
}

function IsIntBetween(val, min, max)
{
    return val >= min && val <= max;
}

 module.exports = 
 {
     GenerateDate,
     GenerateChannelName,
     IsNumeric,
     IsIntBetween,

     DATE_DAYS,
     CATEGORY_EVENTS,
     CATEGORY_SIGNUP,

     EMOJI_THUMBS_UP,
     EMOJI_THUMBS_DOWN,
     EMOJI_HOURGLASS,
     EMOJI_HOURGLASS2,
 }