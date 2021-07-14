
const WOWAPI       = require('wowgamedataapi-js');

var Util           = require('../util');
var Signup         = require('./signup');
var ChatProcess = require('./chatprocess');

const EVENT_LIST_ROSTER_PREFIX = "\`\`\`prolog\nROSTER\n\n";
const EVENT_LIST_INFO_PREFIX   = "\`\`\`prolog\nINFO\n\n";
const EVENT_LIST_GROUPS_PREFIX = "\`\`\`prolog\nGROUPS\n\n";

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
    process.AddStep("FORMAT",      "Enter additional signup format (Example: Frost Res - Attuned - Experience)", 1, 256, true);
    process.AddStep("FORMAT_EX",   "Enter an example signup (Following example format: 150 FR - Attuned - Cleared)", 1, 256, true);
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
    else if(currStep.m_szName === "FORMAT")
    {
        var format = currStep.m_szResponse.toLowerCase();
        if(format.includes("spec") && !format.includes("spec"))
        {
            msg.author.send(`Error: Cannot have spec without class field'`);
            currStep.Uncomplete();
            return false;
        }
        else
        {
            var response = currStep.m_szResponse;
            currStep.m_szResponse = "Name - Class - Spec - Race";

            if(response.length > 0)
                currStep.m_szResponse += " - " + response;
        }
    }
    else if(currStep.m_szName === "FORMAT_EX")
    {
        var response = currStep.m_szResponse;
        currStep.m_szResponse = "Notbald - Warrior - Prot - Human";
        if(response.length > 0)
            currStep.m_szResponse += " - " + response;
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

            let msg = GenerateEventMessage(process, signupChannel);
            eventChannel.send(msg);
            eventChannel.send(`${EVENT_LIST_ROSTER_PREFIX}\`\`\``);
            eventChannel.send(`${EVENT_LIST_INFO_PREFIX}\`\`\``);
            eventChannel.send(`${EVENT_LIST_GROUPS_PREFIX}\`\`\``);
        })
    })
}

function GenerateSignupMessage(process)
{
    var raids       = process.GetStep("RAIDS").m_szResponse;
    var dateStr     = process.GetStep("DATE").m_szResponse;
    var timeStr     = process.GetStep("TIME").m_szResponse;
    var formatStr   = process.GetStep("FORMAT").m_szResponse;
    var formatExStr = process.GetStep("FORMAT_EX").m_szResponse;

    let date = Util.GenerateDate(dateStr, timeStr);

    var raidList = raids.split(",");
    raids = raidList[0];
    for(var i = 1; i < raidList.length; i++)
        raids += " & " + raidList[i];

    var message = `**Signup for ${raids} ${Util.DATE_DAYS[date.getDay()].toUpperCase()} ${timeStr} Server Time - ${dateStr}**`;

    message += "\n\n**Signup Format**:\n"
    message += `${formatStr}`

    message += "\n\n**Example**:\n"
    message += formatExStr;

    message += "\n\n**You may also add any additional info to your sign up at the end of your message**:"
    message += `\n${formatExStr} - ALERT - Can tank NR hydros**`

    message += "\n\n**If you have the word 'ALERT' in your signup, a bot will message you once you get accepted/declined or put on hold.**";
    message += "\nInclude gear planner if possible :)";

    message += `\n\n ${Util.EMOJI_THUMBS_UP} means accepted`;
    message += `\n\n ${Util.EMOJI_THUMBS_DOWN} means not accepted`;
    message += `\n\n ${Util.EMOJI_HOURGLASS} means put on hold`;

    return message;
}

function GenerateEventMessage(process, signupChannel)
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

    var message = "@everyone";

    message += `**${title}**`;
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

/**
 * Creates or edits (if it exists) the roster message posted with the creation of the event channel
 * 
 * @param signupChannel - Discord.Channel object
 */
function GenerateRosterMessage(signupChannel)
{
    Signup.GetSignupsFromChannel(signupChannel).then((result) => 
    {
        Signup.GetEventChannelFromSignupChannel(signupChannel).then((eventChannel) =>
        {
            eventChannel.messages.fetch({after: 1, limit: 100}).then((eventMessages) => 
            {
                const rosterPadding = 46;
                const signupNamePadding = 12;
                const signupClassPadding = 10;

                var rosterMsg = null;
                for (const [key, eventMsg] of eventMessages.entries()) 
                {
                    if(eventMsg.content.startsWith(EVENT_LIST_ROSTER_PREFIX))
                    {
                        rosterMsg = eventMsg;
                        break;
                    }
                }

                // Roster
                var tankList = [];
                var dpsList = [];
                var healerList = [];

                // Backups/Bench
                var bTankList = [];
                var bDpsList = [];
                var bHealerList = [];

                for(var i = 0; i < result.length; i++)
                {   
                    var signup = result[i];
                    var name = `${signup.m_szName.padEnd(signupNamePadding)} ${signup.m_Class.m_szName.padEnd(signupClassPadding)} ${signup.m_Spec.m_szName}`;

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

                var rosterStr = EVENT_LIST_ROSTER_PREFIX;

                rosterStr += `TOTAL SIGNUPS: ${result.length}\n`;
                rosterStr += `RAID SIZE: ${tankList.length + dpsList.length + healerList.length}/25\n`;
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

                rosterStr += '```';

                if(rosterMsg != null)
                {
                    // Found the message, edit it
                    rosterMsg.edit(rosterStr);
                }
                else
                {
                    // Could not find the message, create a new one
                    eventChannel.send(rosterStr);
                }
            });
        });
    });
}



module.exports = 
{
    GenerateRosterMessage,

    StartCreateEventProcess,
    HandleCreateEventProcess,
    FinishCreateEventProcess,
}