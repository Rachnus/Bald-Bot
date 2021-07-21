const WOWAPI    = require('wowgamedataapi-js');
const WCLOGSAPI = require('warcraftlogsapi-js');

var   Util     = require('../util');
const Token    = require('../../token');

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

        this.m_iFrostResistance = null;
        this.m_iFireResistance = null;
        this.m_iNatureResistance = null;
        this.m_iShadowResistance = null;
        this.m_iArcaneResistance = null;

        this.m_bAttuned = null;

        this.m_ZoneRankings = null;
    }
}

function HandleSignup(msg)
{
    msg.channel.messages.fetch({after: 1, limit: 1}).then((result) => 
    {
        var ret = CheckSignup(msg.content);

        if(ret != SignupFormatError.SUCCESS)
        {
            var retString = `Please follow the signup format when signing up!\n\n`;

            retString += "**Required signup fields**:\n"
            retString += `Name - Class - Spec - Race`

            retString += "\n\n**Optional signup fields**:\n"
            retString += `FrR - FR - NR - SR - AR - Attuned - Alert - Other`

            retString += "\n\n**Signup Field Legend:**\`\`\`c";
            retString += `\nFrR     Frost resistance   Example: 'Notbald - Warrior - Prot - Human - 180 FrR'`;
            retString += `\nFR      Fire resistance    Example: 'Notbald - Warrior - Prot - Human - 180 FR'`;
            retString += `\nNR      Nature resistance  Example: 'Notbald - Warrior - Prot - Human - 180 NR'`;
            retString += `\nSR      Shadow resistance  Example: 'Notbald - Warrior - Prot - Human - 180 SR'`;
            retString += `\nAR      Arcane resistance  Example: 'Notbald - Warrior - Prot - Human - 180 AR'`;
            retString += `\nAlert                      Example: 'Notbald - Warrior - Prot - Human - Alert'`;
            retString += `\nAttuned                    Example: 'Notbald - Warrior - Prot - Human - Attuned to kara'\`\`\``;

            switch(ret)
            {
                case SignupFormatError.CLASS:
                    retString += `\n\n**ERROR**:\nCould not find a class in your signup\n\n`;
                    retString += `**CLASS LIST**:`;
                    for (const [key, value] of WOWAPI.Character.g_Classes.entries()) 
                        retString += `\n${key}`;

                    break;

                case SignupFormatError.SPEC:
                    let clsName = GetFieldFromSignup(msg.content, "class");
                    let cls = WOWAPI.Character.FindClass(clsName);

                    retString += `\n\n**ERROR**:\nCould not find a valid spec in your sign up\n\n`;
                    retString += `**SPEC LIST FOR ${cls.m_szName.toUpperCase()}**:`;
                    for (const [key, value] of cls.m_Specs.entries()) 
                        retString += `\n${key}`;

                    break;
                case SignupFormatError.RACE:
                    retString += `\n\n**ERROR**:\nCould not find a valid race in your signup\n\n`;
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

function GetFieldFromSignup(signupMessage, field)
{
    var signupFields = signupMessage.replace(/ /g, "").split("-");

    if(field === "name")
        return signupFields[0];

    // Get fields required for other fields first... such as Class, since we need the class to get the spec
    for(var i = 1; i < signupFields.length; i++)
    {
        
        // Check for valid class field
        var checkField = signupFields[i].toLowerCase();

        if(field === "class")
        {
            var cls = WOWAPI.Character.FindClass(checkField);
            if(cls != null)
                return checkField;
        }
        else if(field === "spec")
        {
            // some lazy recursion
            var classField = GetFieldFromSignup(signupMessage, "class");
            if(classField === "")
                continue;

            var cls = WOWAPI.Character.FindClass(classField);
            if(cls == null)
                continue;
            
            var spec = cls.FindSpec(checkField);
            if(spec == null)
                continue;
            
            return checkField;
        }
        else if(field === "race")
        {
            var cls = WOWAPI.Character.FindRace(checkField);
            if(cls != null)
                return checkField;
        }
        else if(field === "frr")
        {
            var num = checkField.replace(/ /g, "").replace("frr", "");
            if(checkField.includes("frr") && Util.IsNumeric(num))
                return num;
        }
        else if(field === "fr")
        {
            var num = checkField.replace(/ /g, "").replace("fr", "");
            if(checkField.includes("fr") && Util.IsNumeric(num))
                return num;
        }
        else if(field === "nr")
        {
            var num = checkField.replace(/ /g, "").replace("nr", "");
            if(checkField.includes("nr") && Util.IsNumeric(num))
                return num;
        }
        else if(field === "sr")
        {
            var num = checkField.replace(/ /g, "").replace("sr", "");
            if(checkField.includes("sr") && Util.IsNumeric(num))
                return num;
        }
        else if(field === "ar")
        {
            var num = checkField.replace(/ /g, "").replace("ar", "");
            if(checkField.includes("ar") && Util.IsNumeric(num))
                return num;
        }
        else if(field === "attuned")
        {
            if(checkField.includes("attuned"))
            {
                if(checkField.includes("no"))
                    return "nattuned";
                else
                    return "attuned";
            }
        }
             
    }
    return "";
}

function CheckSignup(signupMessage)
{
    var cls = null;
    var spec = null;
    var race = null;

    var signupClass   = GetFieldFromSignup(signupMessage, "class");
    var signupSpec    = GetFieldFromSignup(signupMessage, "spec");
    var signupRace    = GetFieldFromSignup(signupMessage, "race");

    var signupFrost   = GetFieldFromSignup(signupMessage, "frr");
    var signupFire    = GetFieldFromSignup(signupMessage, "fr");
    var signupNature  = GetFieldFromSignup(signupMessage, "nr");
    var signupShadow  = GetFieldFromSignup(signupMessage, "sr");
    var signupArcane  = GetFieldFromSignup(signupMessage, "ar");

    if(signupClass === "") return SignupFormatError.CLASS;
    if(signupSpec === "")  return SignupFormatError.SPEC;
    if(signupRace === "")  return SignupFormatError.RACE;

    cls = WOWAPI.Character.FindClass(signupClass);
    if(cls == null)
        return SignupFormatError.CLASS; 

    spec = cls.FindSpec(signupSpec);
    if(spec == null)
        return SignupFormatError.SPEC;

    race = WOWAPI.Character.FindRace(signupRace);
    if(race == null)
        return SignupFormatError.RACE;

    if(signupFrost != "")
        if(!Util.IsNumeric(signupFrost) && Util.IsIntBetween(parseInt(signupFrost), RESISTANCE_MIN, RESISTANCE_MAX))
            return SignupFormatError.RESISTANCE;
    if(signupFire != "")
        if(!Util.IsNumeric(signupFire) && Util.IsIntBetween(parseInt(signupFire), RESISTANCE_MIN, RESISTANCE_MAX))
            return SignupFormatError.RESISTANCE;
    if(signupNature != "")
        if(!Util.IsNumeric(signupNature) && Util.IsIntBetween(parseInt(signupNature), RESISTANCE_MIN, RESISTANCE_MAX))
            return SignupFormatError.RESISTANCE;
    if(signupShadow != "")
        if(!Util.IsNumeric(signupShadow) && Util.IsIntBetween(parseInt(signupShadow), RESISTANCE_MIN, RESISTANCE_MAX))
            return SignupFormatError.RESISTANCE;
    if(signupArcane != "")
        if(!Util.IsNumeric(signupArcane) && Util.IsIntBetween(parseInt(signupArcane), RESISTANCE_MIN, RESISTANCE_MAX))
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

function GetRaidsFromSignupMessage(signupMessage)
{
    // first get the raids from the sign up message and store them in an array of strings
    var words = signupMessage.split(" ");
    var day = null;

    for(var i = 0; i < words.length; i++)
    {
        var breakOuter = false;
        for(var j = 0; j < Util.DATE_DAYS.length; j++)
        {
            if(words[i].toLowerCase().includes(Util.DATE_DAYS[j].toLowerCase()))
            {
                day = Util.DATE_DAYS[j].toUpperCase();
                break;
            }
        }

        if(breakOuter)
            break;
    }

    if(day == null)
        return null;

    console.log(day);

    words = signupMessage.split(day);
    words = words[0].replace("**Signup for ", "");

    words = words.split(' & ');                                 // put all raids in an array
    words[words.length-1] = words[words.length-1].slice(0, -1); // remove the space from the last raid word

    // then get all raid/map IDs then translate them to warcraftlog zone IDs
    return Util.GetZoneMapsFromGameMaps(words);
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
            var result = [];

            var signup = null;

            // find the signup message to get the raid
            for (const [key, signupMsg] of signupMessages.entries())
            {
                if(signupMsg.content.startsWith("**Signup for"))
                {
                    signup = signupMsg;
                    break;
                }
            }

            if(signup == null)
                return;
            
            var raids = GetRaidsFromSignupMessage(signup.content);
    
            var allstarQueries = [];

            for (const [key, signupMsg] of signupMessages.entries())
            {
                if(signupMsg.content.startsWith("**Signup for"))
                    continue;

                var thumbsUp   = signupMsg.reactions.cache.find(reaction => reaction._emoji.name === Util.EMOJI_THUMBS_UP);
                var thumbsDown = signupMsg.reactions.cache.find(reaction => reaction._emoji.name === Util.EMOJI_THUMBS_DOWN);
                var hourglass  = signupMsg.reactions.cache.find(reaction => reaction._emoji.name === Util.EMOJI_HOURGLASS);

                if(hourglass == null)
                    hourglass = signupMsg.reactions.cache.find(reaction => reaction._emoji.name === Util.EMOJI_HOURGLASS2);

                var signupName  = GetFieldFromSignup(signupMsg.content, "name");
                var signupClass = GetFieldFromSignup(signupMsg.content, "class");
                var signupSpec  = GetFieldFromSignup(signupMsg.content, "spec");
                var signupRace  = GetFieldFromSignup(signupMsg.content, "race");

                var signupFrost   = GetFieldFromSignup(signupMsg.content, "frr");
                var signupFire    = GetFieldFromSignup(signupMsg.content, "fr");
                var signupNature  = GetFieldFromSignup(signupMsg.content, "nr");
                var signupShadow  = GetFieldFromSignup(signupMsg.content, "sr");
                var signupArcane  = GetFieldFromSignup(signupMsg.content, "ar");
            
                var signupAttuned = GetFieldFromSignup(signupMsg.content, "attuned");

                var gameRace = WOWAPI.Character.FindRace(signupRace);
                var gameCls = WOWAPI.Character.FindClass(signupClass);
                var gameSpec = null;
                if(gameCls != null)
                    gameSpec = gameCls.FindSpec(signupSpec);

                // if class & spec is invalid, skip
                if(gameCls == null || gameSpec == null || gameRace == null)
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

                signup.m_iFrostResistance  = Number(signupFrost);
                signup.m_iFireResistance   = Number(signupFire);
                signup.m_iNatureResistance = Number(signupNature);
                signup.m_iShadowResistance = Number(signupShadow);
                signup.m_iArcaneResistance = Number(signupArcane);

                signup.m_ZoneRankings      = [];

                signup.m_bAttuned = (signupAttuned === "attuned"?true:(signupAttuned==="nattuned"?false:null));

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

                for(var i = 0; i < raids.length; i++)
                {
                    var opt = new WCLOGSAPI.Types.WCLOGSRankingOptions();
                    opt.m_iZoneID = raids[i].m_iID;
                    if( signup.m_Spec.m_szName.toLowerCase() === "holy" ||
                        signup.m_Spec.m_szName.toLowerCase() === "discipline" ||
                        signup.m_Spec.m_szName.toLowerCase() === "restoration")
                    {
                        opt.m_Metric = WCLOGSAPI.Types.WCLOGSCharacterRankingMetricType.HPS;
                    }
                    else
                        opt.m_Metric = WCLOGSAPI.Types.WCLOGSCharacterRankingMetricType.DPS;

                    var allstarQuery = new WCLOGSAPI.Rankings.QueryAllstar(signupName, Token.WOW_REALM, Token.WOW_REGION, opt);
                    allstarQueries.push(allstarQuery);
                }
                result.push(signup);
            }

            WCLOGSAPI.Rankings.GetAllstars(allstarQueries).then((allstars) =>
            {
                // after we get the rankings, we need to match the allstars with the signups
                // result contains of all current signups, so add allstars to those signups
                for(var i = 0; i < result.length; i++)
                {
                    for(var j = 0; j < raids.length; j++)
                    {
                        result[i].m_ZoneRankings.push(allstars[i*raids.length+j]);
                    }
                }
                resolve(result);
            });
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