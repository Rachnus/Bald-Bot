const WOWAPI = require('wowgamedataapi-js');

var Util     = require('../util');

const RESISTANCE_MIN = 0;
const RESISTANCE_MAX = 365;

const SignupFormatError = 
{
    SUCCESS:     0,
    FIELDS:      1,
    CLASS:       2,
    SPEC:        3,
    RACE:        4,
    RESISTANCE:  5,
}

const SignupStatus = 
{
    PENDING:  0,
    ACCEPTED: 1,
    DECLINED: 2,
    BENCH:    3
}

class EventSignup
{
    constructor()
    {
        this.m_szRaw = null;

        this.m_szName = null;
        this.m_Class = null;
        this.m_Spec = null;
        this.m_Race = null;
        this.m_Status = null;
    }
}

function HandleSignup(msg)
{
    msg.channel.messages.fetch({after: 1, limit: 1}).then((result) => 
    {
        var signupMessage = result.first().content;
        var lines = signupMessage.split("\n");

        var signupFormat = null;
        var example = null;

        for(var i = 0; i < lines.length; i++)
        {
            // Find the signup format line, once found, +1 it to get the format string
            if(lines[i].startsWith("**Signup Format**"))
            signupFormat = lines[i+1];

            if(lines[i].startsWith("**Example**"))
                example = lines[i+1];
        }

        if(signupFormat == null)
        {
            console.log("Error: Cannot find signup format (HandleSignup)");
            return false;
        }

        var untouchedFormat = signupFormat;

        signupFormat = signupFormat.replace("/\n/g","");
        signupFormat = signupFormat.replace(/ /g, "");

        var ret = CheckSignupFormat(msg.content, signupFormat);

        if(ret != SignupFormatError.SUCCESS)
        {
            var retString = `Please follow the signup format when signing up!\n\n`;

            retString += `**REQUIRED FORMAT**:\n`;
            retString += `${untouchedFormat}\n\n`;

            retString += `**OPTIONAL FIELDS**:\n`;
            retString += `- **Alert**: If this is in your signup,  a bot will message you once you get accepted/declined or put on hold\n\n`;

            retString += `**You may also add any additional info to your sign up at the end of your message, such as ${example} - Can tank NR hydros**`;

            switch(ret)
            {
                case SignupFormatError.CLASS:
                    retString += `\n\n**ERROR**:\nInvalid class name\n\n`;
                    retString += `**CLASS LIST**:`;
                    for (const [key, value] of WOWAPI.Character.g_Classes.entries()) 
                        retString += `\n${key}`;

                    break;

                case SignupFormatError.SPEC:
                    let clsName  = GetFieldFromSignup(msg.content, signupFormat, "class");
                    let cls = WOWAPI.Character.FindClass(clsName);

                    retString += `\n\n**ERROR**:\nInvalid spec\n\n`;
                    retString += `**SPEC LIST FOR ${cls.m_szName.toUpperCase()}**:`;
                    for (const [key, value] of cls.m_Specs.entries()) 
                        retString += `\n${key}`;

                    break;
                case SignupFormatError.RACE:
                    retString += `\n\n**ERROR**:\nInvalid race\n\n`;
                    retString += `**RACE LIST**:`;
                    for (const [key, value] of WOWAPI.Character.g_Races.entries()) 
                        retString += `\n${key}`;

                    break;
            }

            msg.author.send(retString);
            msg.delete();
            return false;
        }
    });
}

function GetFieldFromSignup(signupMessage, format, field)
{
    var signupFields = signupMessage.replace(/ /g, "").split("-");
    var formatFields = format.replace(/ /g, "").split("-");

    if(signupFields.length < formatFields.length)
        return "";

    // Get fields required for other fields first... such as Class, since we need the class to get the spec
    for(var i = 0; i < formatFields.length; i++)
    {
        // Check for valid class field
        if(formatFields[i].toLowerCase().includes(field))
            return signupFields[i];
    }
    return "";
}

function CheckSignupFormat(signupMessage, format)
{
    var signupFields = signupMessage.replace(/ /g, "").split("-");
    var formatFields = format.replace(/ /g, "").split("-");

    if(signupFields.length < formatFields.length)
    {
        console.log(signupFields);
        console.log(formatFields);
        return SignupFormatError.FIELDS;
    }

    var classIndex  = -1;
    var specIndex   = -1;
    var raceIndex   = -1;

    var frostIndex  = -1;
    var fireIndex   = -1;
    var natureIndex = -1;
    var shadowIndex = -1;
    var arcaneIndex = -1;

    var cls = null;
    var spec = null;

    // Get fields required for other fields first... such as Class, since we need the class to get the spec
    for(var i = 0; i < formatFields.length; i++)
    {
        // Check for valid class field
        if(formatFields[i].toLowerCase().includes("class"))   classIndex = i;
        if(formatFields[i].toLowerCase().includes("spec"))    specIndex = i;
        if(formatFields[i].toLowerCase().includes("race"))    raceIndex = i;

        if(formatFields[i].toLowerCase().includes("frost"))   frostIndex = i;
        if(formatFields[i].toLowerCase().includes("fire"))    fireIndex = i;
        if(formatFields[i].toLowerCase().includes("nature"))  natureIndex = i;
        if(formatFields[i].toLowerCase().includes("shadow"))  shadowIndex = i;
        if(formatFields[i].toLowerCase().includes("arcane"))  arcaneIndex = i;
    }

    if(classIndex != -1)
    {
        cls = WOWAPI.Character.FindClass(signupFields[classIndex]);
        if(cls == null)
            return SignupFormatError.CLASS;
    }

    if(specIndex != -1)
    {
        if(cls != null)
        {
            spec = cls.FindSpec(signupFields[specIndex]);
            if(spec == null)
                return SignupFormatError.SPEC;
        }
    }

    if(raceIndex != -1)
    {
        race = WOWAPI.Character.FindRace(signupFields[raceIndex]);
        if(race == null)
            return SignupFormatError.RACE;
    }

    if(frostIndex != -1)
        if(!Util.IsNumeric(signupFields[frostIndex]) && Util.IsIntBetween(parseInt(signupFields[frostIndex]), RESISTANCE_MIN, RESISTANCE_MAX))
            return SignupFormatError.RESISTANCE;
    if(fireIndex != -1)
        if(!Util.IsNumeric(signupFields[fireIndex]) && Util.IsIntBetween(parseInt(signupFields[fireIndex]), RESISTANCE_MIN, RESISTANCE_MAX))
            return SignupFormatError.RESISTANCE;
    if(natureIndex != -1)
        if(!Util.IsNumeric(signupFields[natureIndex]) && Util.IsIntBetween(parseInt(signupFields[natureIndex]), RESISTANCE_MIN, RESISTANCE_MAX))
            return SignupFormatError.RESISTANCE;
    if(shadowIndex != -1)
        if(!Util.IsNumeric(signupFields[shadowIndex]) && Util.IsIntBetween(parseInt(signupFields[shadowIndex]), RESISTANCE_MIN, RESISTANCE_MAX))
            return SignupFormatError.RESISTANCE;
    if(arcaneIndex != -1)
        if(!Util.IsNumeric(signupFields[arcaneIndex]) && Util.IsIntBetween(parseInt(signupFields[arcaneIndex]), RESISTANCE_MIN, RESISTANCE_MAX))
            return SignupFormatError.RESISTANCE;

    return SignupFormatError.SUCCESS;
}

/**
 * Gets the event channel associated with this signup channel (Discord.Channel)
 * 
 * @param signupChannel - Discord.Channel object
 * @returns Promise
 */
function GetEventChannelFromSignupChannel(signupChannel)
{
    const newPromise = new Promise((resolve, reject) => 
    {
        signupChannel.messages.fetch({after: 1, limit: 1}).then((signupMessages) => 
        {
            var signupMessage = signupMessages.first().content;
            var lines = signupMessage.split("\n");

            for(var i = 0; i < lines.length; i++)
            {
                // Find the signup title
                if(lines[i].startsWith("**Signup for"))
                    signupMessage = lines[i];
            }

            signupMessage = signupMessage.replace(/ /g, "");
            var signupSplit = signupMessage.split("-");

            signupSplit[1] = signupSplit[1].replace(/\*/g, "");

            let date = Util.GenerateDate(signupSplit[1], "00:00");
            var channelName = signupChannel.name.replace("-signup", "");
            var eventChannelName = Util.GenerateChannelName(channelName, date);

            resolve(signupChannel.guild.channels.cache.find(channel => channel.name === eventChannelName));
        });
    });
    return newPromise;
}

/**
 * Gets all sign up messages from a channel
 * 
 * @param signupChannel - Discord.Channel object
 * @returns Promise
 */
function GetSignupsFromChannel(signupChannel)
{
    const newPromise = new Promise((resolve, reject) => 
    {
        signupChannel.messages.fetch({after: 1, limit: 100}).then((signupMessages) => 
        {
            var signupMessage = signupMessages.last().content;
            var lines = signupMessage.split("\n");

            var signupFormat = null;

            for(var i = 0; i < lines.length; i++)
            {
                // Find the signup format line, once found, +1 it to get the format string
                if(lines[i].startsWith("**Signup Format**"))
                    signupFormat = lines[i+1];
            }

            if(signupFormat == null)
            {
                console.log("Error: Cannot find signup format (GetSignupsFromChannel)");
                return false;
            }

            signupFormat = signupFormat.replace("/\n/g","");
            signupFormat = signupFormat.replace(/ /g, "");

            var result = [];

            for (const [key, signupMsg] of signupMessages.entries())
            {
                var thumbsUp   = signupMsg.reactions.cache.find(reaction => reaction._emoji.name === Util.EMOJI_THUMBS_UP);
                var thumbsDown = signupMsg.reactions.cache.find(reaction => reaction._emoji.name === Util.EMOJI_THUMBS_DOWN);
                var hourglass  = signupMsg.reactions.cache.find(reaction => reaction._emoji.name === Util.EMOJI_HOURGLASS);

                if(hourglass == null)
                    hourglass = signupMsg.reactions.cache.find(reaction => reaction._emoji.name === Util.EMOJI_HOURGLASS2);

                var signupName  = GetFieldFromSignup(signupMsg.content, signupFormat, "name");
                var signupClass = GetFieldFromSignup(signupMsg.content, signupFormat, "class");
                var signupSpec  = GetFieldFromSignup(signupMsg.content, signupFormat, "spec");
                var signupRace  = GetFieldFromSignup(signupMsg.content, signupFormat, "race");

                var gameRace = WOWAPI.Character.FindRace(signupRace);
                var gameCls = WOWAPI.Character.FindClass(signupClass);
                var gameSpec = null;
                if(gameCls != null)
                    gameSpec = gameCls.FindSpec(signupSpec);

                // if class & spec is invalid, skip
                if(gameCls == null || gameSpec == null)
                    continue;

                // Uppercase first letter in name
                signupName = signupName.charAt(0).toUpperCase() + signupName.slice(1);

                var signup = new EventSignup;
                signup.m_szRaw = signupMsg.content;
                signup.m_szName = signupName;
                signup.m_Class = gameCls;
                signup.m_Race = gameRace;
                signup.m_Spec = gameSpec;
                signup.m_Status = SignupStatus.PENDING;

                if(thumbsUp != null && thumbsUp.count >= 1)
                {
                    // Player was accepted
                    signup.m_Status = SignupStatus.ACCEPTED;
                }
                else if(hourglass != null && hourglass.count >= 1)
                {
                    // Player is put on hold/back up
                    signup.m_Status = SignupStatus.BENCH;
                }
                else if(thumbsDown != null && thumbsDown.count >= 1)
                {
                    // Player is declined
                    signup.m_Status = SignupStatus.DECLINED;
                }
                result.push(signup);
            }

            resolve(result);
        });
    });

    return newPromise;
}

module.exports = 
{
    GetEventChannelFromSignupChannel,
    GetSignupsFromChannel,

    HandleSignup,

    SignupStatus
}