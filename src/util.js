const { MessageAttachment } = require("discord.js");

const DATE_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CATEGORY_EVENTS = "EVENTS";
const CATEGORY_SIGNUP = "SIGNUP";

const EMOJI_THUMBS_UP = "👍";
const EMOJI_THUMBS_DOWN = "👎";
const EMOJI_HOURGLASS = "⏳";
const EMOJI_HOURGLASS2 = "⌛";

const MAX_MESSAGE_LENGTH = 2000;

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

function ToDiscordAttachment(text, attachmentName, extension = 'prolog', format = 'utf-8')
{
    return new MessageAttachment(Buffer.from(text, format), `${attachmentName+"."+extension}`);
}

var g_EditAttachmentTimer = null;
var g_AttachMentsToSend = [];

class TimerAttachmentData
{
    constructor()
    {
        this.m_DiscordAttachment = null;
        this.m_DiscordChannel = null;
        this.m_DiscordMessage = null;
        this.m_szName = null;
        this.m_szExt = null;
    }
}

function EditDiscordMessage_Timer(discordChannel, discordMessage, attachment)
{
    for(var i = 0; i < g_AttachMentsToSend.length; i++)
    {
        // Cannot edit attachments, so delete the old one
        if(g_AttachMentsToSend[i].m_DiscordMessage != null) 
            g_AttachMentsToSend[i].m_DiscordMessage.delete();

        g_AttachMentsToSend[i].m_DiscordChannel.send(g_AttachMentsToSend[i].m_DiscordAttachment);
    }

    g_EditAttachmentTimer = null;
    g_AttachMentsToSend = [];
}

/**
 * Sends or Edits a discord message
 *  
 * @param discordChannel - DiscordChannel
 * @param discordMessage - DiscordMessage
 * @param newText        - Text to send
 * @param codeBlock      - True if send as a codeblock
 * @param attachmentName - Name of the attachment that will be created if the message is too long
 * @param extension      - Extension of the attachment
 */
function EditDiscordMessage(discordChannel, discordMessage, newText, codeBlock, attachmentName, extension)
{
    if(newText.length >= MAX_MESSAGE_LENGTH)
    {
        // if the message is over the discord character limit (2000), send it as a txt file instead
        var att = ToDiscordAttachment(newText, attachmentName, extension);
        if(discordChannel == null)
            return;
        
        var exist = false;
        for(var i = 0; i < g_AttachMentsToSend.length; i++)
        {
            if(g_AttachMentsToSend[i].m_szName === attachmentName && g_AttachMentsToSend[i].m_szExt === extension)
                exist = true;
        }

        if(!exist)
        {
            var attData = new TimerAttachmentData;
            attData.m_DiscordAttachment = att;
            attData.m_DiscordChannel = discordChannel;
            attData.m_DiscordMessage = discordMessage;
            attData.m_szName = attachmentName;
            attData.m_szExt = extension;

            g_AttachMentsToSend.push(attData);
        }
        
        if(g_EditAttachmentTimer != null)
            clearTimeout(g_EditAttachmentTimer);
        g_EditAttachmentTimer = setTimeout(EditDiscordMessage_Timer, 10000);
    }
    else
    {
        // else, just send it as a normal message or codeblock
        var message = newText;
        if(codeBlock)
            message = `\`\`\`${extension}\n` + message + '```';
        
        if(discordMessage != null) 
            discordMessage.edit(message); 
        else 
            discordChannel.send(message);
    }
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

     ToDiscordAttachment,
     EditDiscordMessage,

     DATE_DAYS,
     CATEGORY_EVENTS,
     CATEGORY_SIGNUP,

     EMOJI_THUMBS_UP,
     EMOJI_THUMBS_DOWN,
     EMOJI_HOURGLASS,
     EMOJI_HOURGLASS2,

     MAX_MESSAGE_LENGTH
 }