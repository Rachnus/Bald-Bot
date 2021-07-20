var ClientOAuth2 = require('client-oauth2');

const TOKEN = 'discord-bot-token-goes-here'

const WCRAFTLOGS_AUTH  = new ClientOAuth2({
    clientId:         'warcraft-logs-client-id-goes-here',
    clientSecret:     'warcraft-logs-client-secret-goes-here',
    accessTokenUri:   'https://classic.warcraftlogs.com/oauth/token',
    authorizationUri: 'https://classic.warcraftlogs.com/oauth/authorize',
    redirectUri:      'http://example.com/auth/github/callback'
})

const WOW_REALM = "Firemaw";
const WOW_REGION = "EU";

module.exports = 
{
	TOKEN,
	WCRAFTLOGS_AUTH,

    WOW_REALM,
    WOW_REGION,
};