const WOWAPI    = require('wowgamedataapi-js');
const WCLOGSAPI = require('warcraftlogsapi-js');

var ChatProcess    = require('./userinteraction/chatprocess');
var Init           = require('./init.js');

const COMMAND_PREFIX = '/'

/**
 * Command class
 */
class Command
{
	/**
	 * Command
	 *
	 * @param name            name of command
	 * @param callback        callback function for this command
	 * @param argc            amount of arguments required
	 * @param usage           usage string
	 * @param desc            description of this command
	 * @param permission      what permissions is required for this command
	 */
	constructor(name, callback, argc, usage, desc, permission = '')
	{
		this.m_szName = name;
		this.m_fCallback = callback;
		this.m_iArgCount = argc;
		this.m_szUsage = usage;
		this.m_szDescription = desc;
		this.m_szPermission = permission;
	}

	call(bot, msg, args)
	{
		if(args.length < this.m_iArgCount)
			return false;

		this.m_fCallback(bot, msg, this, args);
		return true;
	}

	getName()
	{
		return this.m_szName;
	}

	getUsage()
	{
		return this.m_szUsage;
	}

	getDescription()
	{
		return this.m_szDescription;
	}

	getPermission()
	{
		return this.m_szPermission;
	}

	getArgCount()
	{
		return this.m_iArgCount;
	}
}

// List of all commands Command name - Callback, Arg Count, Usage string, Description
const g_Commands = [new Command('roll',         CmdRoll,        0, `${COMMAND_PREFIX}roll <number>`,                                       'Roll (same as in wow)'),
					new Command('parses',       CmdParses,      5, `${COMMAND_PREFIX}parses <Name> <Server> <Region> <dps/hps> <Boss> `,   'Lists recent parses from a player'),

					new Command('event-create', CmdEventCreate, 0, `${COMMAND_PREFIX}event-create`,'Creates event', 'ADMINISTRATOR')]

function CmdEventCreate(bot, msg, command, args)
{
	if(command.m_szName === "event-create")
		ChatProcess.ChatProcessHandler.StartChatProcess("Event Setup", msg);

	return true;
}

function CmdRoll(bot, msg, command, args)
{
    var i = 100;
    if(args.length > 0)
    {
        i = parseInt(args[0]);
        if(typeof(i) !== 'number')
            return false;
    }
    var number = Math.floor(Math.random() * i) + 1;
 
    msg.channel.send(`${msg.author} rolls ${number} (1-${i})`);

    return true;
}

function CmdParses(bot, msg, command, args)
{
	// If one of the APIs are not loaded
	if(!Init.WOWAPI_LOADED || !Init.WCLOGSAPI_LOADED)
		return false;

	var name = args[0];
	var server = args[1];
	var region = args[2];
	var metric = args[3];
	var boss = args[4];

	metric = metric.toLowerCase();

	if(args.length > 5)
	{
		boss += " ";
		for(var i = 5; i < args.length; i++)
		{
			boss += args[i];
			if(i != args.length -1)
				boss += " ";
		}
	}
	
	var bossEnc = WOWAPI.DungeonEncounters.GetEncounter(boss);
	if(bossEnc == null)
	{
		console.log(`Cant find boss: '${boss}'`);
		return false;
	}
	
	if(metric != 'dps' && metric != 'hps')
		return false;

	var metricType = null;
	if(metric == 'dps')
		metricType = WCLOGSAPI.Types.WCLOGSCharacterRankingMetricType.DPS;
	else if(metric == 'hps')
		metricType = WCLOGSAPI.Types.WCLOGSCharacterRankingMetricType.HPS;

	if(metricType == null)
		return false;

	var opt = new WCLOGSAPI.Rankings.WCLOGSRankingOptions();
	opt.m_Metric = metricType;
	
	WCLOGSAPI.Rankings.GetParses(name, server, region, bossEnc.m_iID, opt).then((result) => 
	{

		if(result == null)
			return false;

		var clsData = WCLOGSAPI.Classes.GetClass(result.raw.classID);

		var embedStr = null;
		embedStr = "\`\`\`prolog\n";

		embedStr += `${name} @ ${server}-${region.toUpperCase()} (${clsData.m_szName})\n`;
		embedStr += `>>\"${boss}\"<<\n\n`;
		embedStr += '#'.padEnd(4);
		embedStr += 'Parse'.padEnd(8);
		embedStr += metric.toUpperCase().padEnd(10);
		embedStr += 'Kill Time'.padEnd(12);
		embedStr += 'Date'.padEnd(12);
		embedStr += 'Spec';
		embedStr += '\n';

		var count = 1;
		for(const val of result.encounterRankings.m_Ranks) 
		{

			var date = new Date(val.m_iStartTime);
			var dateFormat = date.getDate().toString().padStart(2, "0") + '/' + (date.getMonth()+1).toString().padStart(2, "0") + '/' + date.getFullYear();

			embedStr += `${count++}`.padEnd(4);
			embedStr += `${val.m_flRankPercent.toFixed(1)}`.padEnd(8);
			embedStr += `${val.m_flAmount.toFixed(1)}`.padEnd(10);
			embedStr += `${val.m_iDuration/1000}s`.padEnd(12);
			embedStr += `${dateFormat}`.padEnd(12);
			embedStr += `\'${val.m_szSpec}\'\n`;	
		}

		embedStr += '\n';
		embedStr += 'Best'.padEnd(8);
		embedStr += 'Median'.padEnd(10);
		embedStr += 'Total Kills'.padEnd(16);
		embedStr += 'Fastest';
		embedStr += '\n';

		embedStr += `${result.encounterRankings.m_flBestAmount}`.padEnd(8);
		embedStr += `${result.encounterRankings.m_flMedianPerformance.toFixed(1)}`.padEnd(10);
		embedStr += `${result.encounterRankings.m_iTotalKills}`.padEnd(16);
		embedStr += `${result.encounterRankings.m_iFastestKill/1000}s`;

		embedStr += "\`\`\`";

		msg.channel.send(embedStr);
	})

    return true;
}

module.exports =
{
	commands:g_Commands,
	COMMAND_PREFIX:COMMAND_PREFIX
};