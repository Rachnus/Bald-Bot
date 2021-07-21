const Discord = require('discord.js');
const Token = require('../token.js');
const bot = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });

var Commands       = require('./commands.js');
var Events         = require('./userinteraction/events');
var BotChatProcess = require('./userinteraction/chatprocess');
var Signup         = require('./userinteraction/signup');
var Util           = require('./util');
var Init           = require('./init.js');

const WOWAPI       = require('wowgamedataapi-js');
const WCLOGSAPI    = require('warcraftlogsapi-js');


// Initialize APIs
WOWAPI.InitAPI().then(() => 
{
    Init.WOWAPI_LOADED = true;
    WCLOGSAPI.InitAPI(Token.WCRAFTLOGS_AUTH).then(() => 
    {
        Init.WCLOGSAPI_LOADED = true;
    })
});

bot.on('ready', () => 
{
    console.log('BALDBOT ONLINE');
})

bot.on('message', msg =>
{
    // Dont do anything if the bot was author
    if(msg.author.id === bot.user.id)
        return;

    // PMS
    if(msg.channel.type === "dm")
    {
        BotChatProcess.ChatProcessHandler.HandleChatProcess(msg);
        return;
    }

    var parent = msg.guild.channels.cache.get(msg.channel.parentID);
    if(parent != null && parent.name == Util.CATEGORY_SIGNUP)
    {
        if(msg.channel.name.includes('-signup'))
        {
            // If this message is in a channel under signup category
            Signup.HandleSignup(msg);
            return;
        }
    }

    if(!msg.content.startsWith(Commands.COMMAND_PREFIX) || msg.author.bot)
        return;

    const args = msg.content.slice(Commands.COMMAND_PREFIX.length).split(' ');
    const command = args.shift().toLowerCase();

    for(var i = 0; i < Commands.commands.length; i++)
    {
        var cmd = Commands.commands[i];
        if(command === cmd.getName())
        {
            var perm = cmd.getPermission();
            if(perm.length > 0 && !msg.member.hasPermission(perm))
                return msg.author.send('You do not have permission to use this command.');

            if(!cmd.call(bot, msg, args))
                return msg.channel.send(`${msg.author}\nInvalid arguments.\nUsage: ${cmd.getUsage()}`);
        }
    }
})

bot.on('messageReactionRemove', async (reaction, user) => 
{
    // dont care about DMs
    if(reaction.message.channel.type === "dm")
        return;
    
    // we only care about channels under a catergory called SIGNUP
    var parent = reaction.message.guild.channels.cache.get(reaction.message.channel.parentID);
    if(parent == null || parent.name != Util.CATEGORY_SIGNUP)
        return;

    // dont care about bot added reactions
    if(user.id === bot.user.id)
        return;

    Events.GenerateEventMessages(reaction.message.channel);
});

bot.on('messageReactionAdd', async (reaction, user) => 
{

    // dont care about DMs
    if(reaction.message.channel.type === "dm")
        return;

    // we only care about channels under a catergory called SIGNUP
    var parent = reaction.message.guild.channels.cache.get(reaction.message.channel.parentID);
    if(parent == null || parent.name != Util.CATEGORY_SIGNUP)
        return;

    // dont care about bot added reactions
    if(user.id === bot.user.id)
        return;

	// When we receive a reaction we check if the reaction is partial or not
	if (reaction.partial) 
    {
        console.log("partial reaction");
		// If the message this reaction belongs to was removed the fetching might result in an API error, which we need to handle
		try 
        {
			await reaction.fetch();
		} 
        catch (error) 
        {
			console.error('Something went wrong when fetching the message: ', error);
			// Return as `reaction.message.author` may be undefined/null
			return;
		}
	}

    var tup = '%F0%9F%91%8D';
    var tdown = '%F0%9F%91%8E';
    var hglass1 = '%E2%8F%B3';
    var hglass2 = '%E2%8C%9B';

    var message = reaction.message.content;
    var emote = reaction.emoji.identifier;

    if((message.includes('ALERT') || message.includes('alert')) && reaction.count == 1)
    {
        if(emote == tup)
        {
            // Player got accepted
            reaction.message.author.send(`You've been accepted in ${reaction.message.guild.name} - #${reaction.message.channel.name}`);
        }
        else if(emote == tdown)
        {
            // Player got declined
            reaction.message.author.send(`You've been declined in ${reaction.message.guild.name} - #${reaction.message.channel.name}`);
        }
        else if(emote == hglass1 || emote == hglass2)
        {
            // Player on hold
            reaction.message.author.send(`You've been put on hold in ${reaction.message.guild.name} - #${reaction.message.channel.name}`);
        }
    }

    Events.GenerateEventMessages(reaction.message.channel);
});


bot.login(Token.TOKEN);