
const WOWAPI       = require('wowgamedataapi-js');
const FETCH        = require('node-fetch');

var Util           = require('../util');
var Signup         = require('./signup');
var ChatProcess = require('./chatprocess');

const EVENT_LIST_ROSTER_PREFIX = "ROSTER";
const EVENT_LIST_INFO_PREFIX   = "INFO";

ChatProcess.ChatProcessHandler.AddPrototype("Event Setup", StartCreateEventProcess, HandleCreateEventProcess, FinishCreateEventProcess);

function StartCreateEventProcess(msg, process)
{
    process.AddStep("RAIDS",       "Enter the names of all raids in the event (Seperate by comma) (Example: Gruul's Lair,Magtheridon)", 1, 128, false);
    process.AddStep("CHANNEL",     "Enter short event name (For the channel name... Example: 'gruul' = gruul-mon-12th)", 1, 12, false);
    process.AddStep("DATE",        "Enter the date of the event. FORMAT: dd/mm/yy (example: 15/4/2021)", 8, 10, false);
    process.AddStep("TIME",        "Enter the time of the event (Server time). FORMAT: hh:mm (example: 19:30)", 5, 5, false);
    process.AddStep("TITLE",       "Enter event title", 1, 128, false);
    process.AddStep("HRES",        "Enter hard reserves (Seperate by comma)", 1, 128, true);
    process.AddStep("GBID",        "Enter GBIDs (If theres any specific items on gbid) (Seperate by comma)", 1, 128, true);
    process.AddStep("SR",          "Enter softres link", 1, 64, true);
    process.AddStep("CUSTOM",      "Enter custom info (Good place to put if the event(s) are MS>OS, or SR>MS>OS etc.)", 1, 256, true);

    var initialMessage = `Event setup\nYou may cancel this process at any time by typing !stop !cancel or !exit\n\n`;
    initialMessage += process.GetCurrentStep().m_szDescription + (process.GetCurrentStep().m_bOptional?` ${OPTIONAL_MESSAGE}`:"");

    msg.author.send(initialMessage);
}

function HandleCreateEventProcess(msg, process)
{
    var currStep = process.GetCurrentStep();

    if(currStep.m_szName === "RAIDS")
    {
        var errorMsg = "Error: Invalid raids:";

        var raidList = currStep.m_szResponse.split(",");

        var newResponse = null;
        var errors = 0;

        var raidSize = -1;
        for(var i = 0; i < raidList.length; i++)
        {
            var gameMap = WOWAPI.GameMap.FindGameMap(raidList[i]);
            if(gameMap == null)
            {
                errors++;
                errorMsg += `\n${raidList[i]}`;
            }
            else
            {
                if(raidSize != -1)
                {
                    if(raidSize != gameMap.m_iMaxPlayers)
                    {
                        errors++;
                        errorMsg = "\n\nError: All raids must have the same raid size";
                    }
                }
                raidSize = gameMap.m_iMaxPlayers;
                console.log(gameMap.m_szName);

                if(newResponse == null)
                    newResponse = gameMap.m_szName;
                else
                    newResponse += "," + gameMap.m_szName;
            }
        }

        if(errors > 0)
        {
            msg.author.send(errorMsg);
            currStep.Uncomplete();
            return false;
        }
        else
        {
            currStep.m_szResponse = newResponse;
        }
    }
    else if(currStep.m_szName === "DATE")
    {
        // Check if the channel exists here already, rather than having to go through the entire process again
        let name = process.GetStep("CHANNEL").m_szResponse;
        let date = Util.GenerateDate(currStep.m_szResponse, "00:00");
        if(date != null)
        {
            let eventChannelName = Util.GenerateChannelName(name, date);
            let signupChannelName = name + "-signup";

            if(process.m_Guild.channels.cache.find(channel => channel.name === eventChannelName) != null)
            {
                msg.author.send(`Error: Channel with the name '${eventChannelName}' already exists!`);
                process.UncompleteStep("CHANNEL");
                currStep.Uncomplete();
                process.GotoStep("RAIDS");
                return false;
            }

            if(process.m_Guild.channels.cache.find(channel => channel.name === signupChannelName) != null)
            {
                msg.author.send(`Error: Channel with the name '${signupChannelName}' already exists!`);
                process.UncompleteStep("CHANNEL");
                currStep.Uncomplete();
                process.GotoStep("RAIDS");
                return false;
            }
        }
        else
        {
            msg.author.send(`Error: Invalid date '${currStep.m_szResponse}'`);
            currStep.Uncomplete();
            return false;
        }
    }

    return true;
}

function FinishCreateEventProcess(msg, process)
{
    var channelName = process.GetStep("CHANNEL").m_szResponse;
    var dateStr     = process.GetStep("DATE").m_szResponse;
    var timeStr     = process.GetStep("TIME").m_szResponse;

    let name = channelName;
    let date = Util.GenerateDate(dateStr, timeStr);

    let eventChannelName = Util.GenerateChannelName(name, date);
    let signupChannelName = name + "-signup";

    process.m_Guild.channels.create(signupChannelName, { reason: 'New signup' }).then((signupChannel) =>
    {
        // SIGNUP CHANNEL, wanna create this one first to tag it in event channel
        var signupCategory = process.m_Guild.channels.cache.find(signupChannel => signupChannel.name === Util.CATEGORY_SIGNUP);
        signupChannel.setParent(signupCategory);

        let msg = GenerateSignupMessage(process);
        signupChannel.send(msg);

        process.m_Guild.channels.create(eventChannelName, { reason: 'New event' }).then((eventChannel) =>
        {
            // EVENTS CHANNEL
            var eventsCategory = process.m_Guild.channels.cache.find(eventChannel => eventChannel.name === Util.CATEGORY_EVENTS);
            eventChannel.setParent(eventsCategory);

            let msg = GenerateEventHeader(process, signupChannel);
            eventChannel.send(msg);
            eventChannel.send(`\`\`\`prolog\n${EVENT_LIST_ROSTER_PREFIX}\`\`\``);
            eventChannel.send(`\`\`\`prolog\n${EVENT_LIST_INFO_PREFIX}\`\`\``);
        })
    })
}

function GenerateSignupMessage(process)
{
    var raids       = process.GetStep("RAIDS").m_szResponse;
    var dateStr     = process.GetStep("DATE").m_szResponse;
    var timeStr     = process.GetStep("TIME").m_szResponse;
    
    let date = Util.GenerateDate(dateStr, timeStr);

    var raidList = raids.split(",");
    raids = raidList[0];
    for(var i = 1; i < raidList.length; i++)
        raids += " & " + raidList[i];

    var message = `**Signup for ${raids} ${Util.DATE_DAYS[date.getDay()].toUpperCase()} ${timeStr} Server Time - ${dateStr}**`;

    message += "\n\n**Required signup fields**:\n"
    message += `Name - Class - Spec - Race`

    message += "\n\n**Optional signup fields**:\n"
    message += `FrR - FR - NR - SR - AR - Attuned - Alert - Other`

    message += "\n\n**Signup Field Legend:**\`\`\`c";
    message += `\nFrR     Frost resistance   Example: 'Notbald - Warrior - Prot - Human - 180 FrR'`;
    message += `\nFR      Fire resistance    Example: 'Notbald - Warrior - Prot - Human - 180 FR'`;
    message += `\nNR      Nature resistance  Example: 'Notbald - Warrior - Prot - Human - 180 NR'`;
    message += `\nSR      Shadow resistance  Example: 'Notbald - Warrior - Prot - Human - 180 SR'`;
    message += `\nAR      Arcane resistance  Example: 'Notbald - Warrior - Prot - Human - 180 AR'`;
    message += `\nAlert                      Example: 'Notbald - Warrior - Prot - Human - Alert'`;
    message += `\nAttuned                    Example: 'Notbald - Warrior - Prot - Human - Attuned to kara'\`\`\``;

    message += "\n\n**Info about signing up**:\n"
    message += `Name always first in your signup, rest can be in any order. Example:\n`
    message += `Notbald - Warrior - Prot - 180 FrR - Attuned - 295 NR - Alert - Can tank NR hydros :)`

    message += `\n\n ${Util.EMOJI_THUMBS_UP} means accepted`;
    message += `\n\n ${Util.EMOJI_THUMBS_DOWN} means not accepted`;
    message += `\n\n ${Util.EMOJI_HOURGLASS} means put on hold`;

    return message;
}

function GenerateEventHeader(process, signupChannel)
{
    var raids       = process.GetStep("RAIDS").m_szResponse;
    var dateStr     = process.GetStep("DATE").m_szResponse;
    var timeStr     = process.GetStep("TIME").m_szResponse;
    var title       = process.GetStep("TITLE").m_szResponse;
    var hresStr     = process.GetStep("HRES").m_szResponse;
    var gbidStr     = process.GetStep("GBID").m_szResponse;
    var srStr       = process.GetStep("SR").m_szResponse;
    var customStr   = process.GetStep("CUSTOM").m_szResponse;

    var raidList = raids.split(",");
    raids = raidList[0];
    for(var i = 1; i < raidList.length; i++)
        raids += " & " + raidList[i];

    var message = `**${title}**`;
    if(raidList.length == 1)
        message += `\n\n**Raid**: `;
    else
        message += `\n\n**Raids**: `;

    message += `${raids}`;

    if(customStr.length > 1)
        message += `\n\n**${customStr}**`;

    message += `\n\n**Date**: ${dateStr}`;
    message += `\n**Time**: ${timeStr}`;

    message += `\n\n**Hard Resses**: ${hresStr}`;
    message += `\n**GBIDs**: ${gbidStr}`;

    message += `\n\n**SR**: ${srStr}`;
    message += `\n\n**Signup**: <#${signupChannel.id}>`;

    return message;
}

function GenerateRosterMessage(signups, eventMessage)
{
    var lines = eventMessage.split("\n");
    var raids = []

    for(var i = 0; i < lines.length; i++)
    {
        if(lines[i].startsWith("**Raid"))
        {
            var raidsStr = lines[i].replace("**Raids**: ", "").replace("**Raid**: ", "").replace(/ & /g, "&");
            if(raidsStr.includes('&'))
                raids = raidsStr.split("&");
            else
                raids.push(raidsStr);
        }
    }

    var gameMap = WOWAPI.GameMap.FindGameMap(raids[0]);
    if(gameMap == null)
    {
        console.log(`Error: Could not find raid '${raids[0]}' (GenerateRosterMessage)`);
        return;
    }

    var rosterStr = `${EVENT_LIST_ROSTER_PREFIX}\n\n`;

    const rosterPadding = 20;
    const signupNamePadding = 12;

    // Roster
    var tankList = [];
    var dpsList = [];
    var healerList = [];

    // Backups/Bench
    var bTankList = [];
    var bDpsList = [];
    var bHealerList = [];

    for(var i = 0; i < signups.length; i++)
    {   
        var signup = signups[i];
        var name = `${signup.m_szName.padEnd(signupNamePadding)}`;

        switch(signup.m_Status)
        {
            case Signup.SignupStatus.ACCEPTED:
                if(signup.m_Spec.m_szRole === 'Tank')
                    tankList.push(name);
                else if(signup.m_Spec.m_szRole === 'DPS')
                    dpsList.push(name);
                else if(signup.m_Spec.m_szRole === 'Healer')
                    healerList.push(name);
                break;
            case Signup.SignupStatus.BENCH:
                if(signup.m_Spec.m_szRole === 'Tank')
                    bTankList.push(name);
                else if(signup.m_Spec.m_szRole === 'DPS')
                    bDpsList.push(name);
                else if(signup.m_Spec.m_szRole === 'Healer')
                    bHealerList.push(name);
                break;
        }
    }

    rosterStr += `TOTAL SIGNUPS: ${signups.length}\n`;
    rosterStr += `RAID SIZE: ${tankList.length + dpsList.length + healerList.length}/${gameMap.m_iMaxPlayers}\n`;
    rosterStr += `BENCH COUNT: ${bTankList.length + bDpsList.length + bHealerList.length}\n\n`;

    rosterStr += `'TANKS'`.padEnd(rosterPadding);
    rosterStr += `'DPS'`.padEnd(rosterPadding);
    rosterStr += `'HEALERS'\n\n`;

    for(var i = 0; i < Math.max(tankList.length, dpsList.length, healerList.length); i++)
    {
        if(i < tankList.length)
            rosterStr += tankList[i].padEnd(rosterPadding);
        else
            rosterStr += "".padEnd(rosterPadding);

        if(i < dpsList.length)
            rosterStr += dpsList[i].padEnd(rosterPadding);
        else
            rosterStr += "".padEnd(rosterPadding);

        if(i < healerList.length)
            rosterStr += healerList[i];

        rosterStr += '\n';
    }

    var backupCount = Math.max(bTankList.length, bDpsList.length, bHealerList.length);

    if(backupCount > 0)
    {
        rosterStr += `\n'BENCH TANKS'`.padEnd(rosterPadding);
        rosterStr += `'BENCH DPS'`.padEnd(rosterPadding);
        rosterStr += `'BENCH HEALERS'\n\n`;
        
        for(var i = 0; i < backupCount; i++)
        {
            if(i < bTankList.length)
                rosterStr += bTankList[i].padEnd(rosterPadding);
            else
                rosterStr += "".padEnd(rosterPadding);

            if(i < bDpsList.length)
                rosterStr += bDpsList[i].padEnd(rosterPadding);
            else
                rosterStr += "".padEnd(rosterPadding);

            if(i < bHealerList.length)
                rosterStr += bHealerList[i];

            rosterStr += '\n';
        }
    }

    return rosterStr;
}

function GenerateInfoMessage(signups, eventMessage)
{
    var lines = eventMessage.split("\n");
    var raids = []

    for(var i = 0; i < lines.length; i++)
    {
        if(lines[i].startsWith("**Raid"))
        {
            var raidsStr = lines[i].replace("**Raids**: ", "").replace("**Raid**: ", "").replace(/ & /g, "&");
            if(raidsStr.includes('&'))
                raids = raidsStr.split("&");
            else
                raids.push(raidsStr);
        }
    }

    var zones = Util.GetZoneMapsFromGameMaps(raids);

    var infoStr = `${EVENT_LIST_INFO_PREFIX}\n\n`;

    if(signups.length <= 0)
        return infoStr;

    var att, frr, fr, nr, sr, ar = false;

    for(var i = 0; i < raids.length; i++)
    {
        var raidData = WOWAPI.RaidData.GetRaidData(raids[i]);
        if(raidData == null)
            continue;
        
        if(raidData.m_bAttunement) att = true;
        if(raidData.m_bFrostRes)   frr = true;
        if(raidData.m_bFireRes)    fr = true;
        if(raidData.m_bNatureRes)  nr = true;
        if(raidData.m_bShadowRes)  sr = true;
        if(raidData.m_bArcaneRes)  ar = true;
        
    }

    infoStr += "#".padEnd(4);
    infoStr += "Name".padEnd(14);
    infoStr += "Class".padEnd(12);
    infoStr += "Spec".padEnd(16);
    infoStr += "Race".padEnd(12);
    if(frr) infoStr += "FrR".padEnd(5);
    if(fr) infoStr += "FR".padEnd(5);
    if(nr) infoStr += "NR".padEnd(5);
    if(sr) infoStr += "SR".padEnd(5);
    if(ar) infoStr += "AR".padEnd(5);
    if(att) infoStr += "Attuned".padEnd(10);

    for(var i = 0; i < zones.length; i++)
    {
        infoStr += zones[i].m_szName.padEnd(26); // TODO Set minimum padding
    }

    infoStr += "\n\n";

    for(var i = 0; i < signups.length; i++)
    {   
        var signup = signups[i];
        infoStr += `${i+1}`.padEnd(4);
        infoStr += `${signup.m_szName}`.padEnd(14);
        infoStr += `${signup.m_Class.m_szName}`.padEnd(12);
        infoStr += `${signup.m_Spec.m_szName}`.padEnd(16);
        infoStr += `${signup.m_Race.m_szName}`.padEnd(12);
        if(frr) infoStr += `${signup.m_iFrostResistance}`.padEnd(5);
        if(fr) infoStr += `${signup.m_iFireResistance}`.padEnd(5);
        if(nr) infoStr += `${signup.m_iNatureResistance}`.padEnd(5);
        if(sr) infoStr += `${signup.m_iShadowResistance}`.padEnd(5);
        if(ar) infoStr += `${signup.m_iArcaneResistance}`.padEnd(5);
        if(att) infoStr += `${(signup.m_bAttuned==null)?'?':(signup.m_bAttuned?"Yes":"No")}`.padEnd(10);

        for(var j = 0; j < signup.m_ZoneRankings.length; j++)
        {
            var allstar = signup.m_ZoneRankings[j];
            if(allstar != null)
            {
                var allstarRank = '?';
                if(allstar.m_Allstars != null && allstar.m_Allstars.length > 0)
                    allstarRank = allstar.m_Allstars[0].m_iRank;

                infoStr += `${allstar.m_flBestPerformanceAverage.toFixed(1)} (WRank: ${allstarRank})`.padEnd(26);
            }
            else
            {
                infoStr += `?`.padEnd(26);
            }
        }

        infoStr += "\n";
    }

    return infoStr;
}

/**
 * Creates or edits (if it exists) the roster message posted with the creation of the event channel
 * 
 * @param signupChannel - Discord.Channel object
 */
function GenerateEventMessages(signupChannel)
{
    Signup.GetSignupsFromChannel(signupChannel).then((result) => 
    {
        Signup.GetEventChannelFromSignupChannel(signupChannel).then((eventChannel) =>
        {
            eventChannel.messages.fetch({after: 1, limit: 100}).then(async (eventMessages) => 
            {
                var rosterMsg = null;
                var infoMsg = null;

                for (const [key, eventMsg] of eventMessages.entries()) 
                {
                    var att = eventMsg.attachments.first();
                    if(att != null)
                    {
                        var response = await FETCH(att.url);

                        if(!response.ok)
                            continue;
                        
                        var text = await response.text();
                        if(text.startsWith(EVENT_LIST_ROSTER_PREFIX))
                            rosterMsg = eventMsg;
                        else if(text.startsWith(EVENT_LIST_INFO_PREFIX))
                            infoMsg = eventMsg;
                    }
                    else
                    {
                        if(eventMsg.content.startsWith(`\`\`\`prolog\n${EVENT_LIST_ROSTER_PREFIX}`))
                            rosterMsg = eventMsg;
                        else if(eventMsg.content.startsWith(`\`\`\`prolog\n${EVENT_LIST_INFO_PREFIX}`))
                            infoMsg = eventMsg;
                    } 
                }

                var rosterStr  = GenerateRosterMessage(result, eventMessages.last().content);
                var infoStr    = GenerateInfoMessage(result, eventMessages.last().content);

                Util.EditDiscordMessage(eventChannel, rosterMsg,  rosterStr, true, 'roster', 'prolog');
                Util.EditDiscordMessage(eventChannel, infoMsg,    infoStr,   true, 'info',   'prolog');
            });
        });
    });
}



module.exports = 
{
    GenerateEventMessages,

    StartCreateEventProcess,
    HandleCreateEventProcess,
    FinishCreateEventProcess,
}