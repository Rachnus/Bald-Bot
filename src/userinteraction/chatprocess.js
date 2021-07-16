var Util   = require('../util');

const OPTIONAL_MESSAGE = ' (OPTIONAL: Type . to skip this step)';

class ChatStep
{
    constructor(name, desc, minLetter, maxLetter, optional = false, response = "", completed = false)
    {
        this.m_szName = name;
        this.m_szDescription = desc;
        this.m_bCompleted = completed;
        this.m_iMinimumCharCount = minLetter;
        this.m_iMaximumCharCount = maxLetter;
        this.m_szResponse = response;
        this.m_bOptional = optional;
    }

    Complete()
    {
        this.m_bCompleted = true;
    }

    Uncomplete()
    {
        this.m_bCompleted = false;
        this.m_szResponse = "";
    }

    IsResponseValid(response)
    {
        return response.length >= this.m_iMinimumCharCount && response.length <= this.m_iMaximumCharCount;
    }

    Respond(response)
    {
        if(!this.IsResponseValid(response))
            return false;

        this.m_szResponse = response;
        this.Complete();
        return true;
    }
}

class ChatProcess
{
    constructor(name, msg)
    {
        this.m_szName = name;
        this.m_Steps = [];
        this.m_iCurrentStep = 0;
        this.m_DiscordID = msg.author.id;
        this.m_Guild = msg.guild;     // Discord server this process started in
    }

    AddStep(name, desc, minLetter, maxLetter, optional)
    {
        this.m_Steps.push(new ChatStep(name, desc, minLetter, maxLetter, optional));
    }

    GotoStep(stepName)
    {
        var currStep = 0;
        for(const val of this.m_Steps) 
        {
            if(val.m_szName === stepName)
            {
                this.m_iCurrentStep = currStep;
                return;
            }
            currStep++;
        }
    }

    GetCurrentStep()
    {
        return this.m_Steps[this.m_iCurrentStep];
    }

    GetStep(name)
    {
        for(const val of this.m_Steps) {
            if(val.m_szName === name)
                return val;
        }
        return null;
    }

    GetMaxSteps()
    {
        return this.m_Steps.length;
    }

    IsCompleted()
    {
        for(const val of this.m_Steps) 
        {
            if(!val.m_bCompleted)
                return false;
        }

        return true;
    }

    CompleteStep()
    {
        this.GetCurrentStep().Complete();
        this.m_iCurrentStep = 0;

        for(const val of this.m_Steps) {
            if(val.m_bCompleted)
                this.m_iCurrentStep++;
        }
    }

    UncompleteStep(stepName)
    {
        this.m_iCurrentStep = 0;
        for(const val of this.m_Steps) 
        {
            if(val.m_szName === stepName)
            {
                val.Uncomplete();
            }
        }
    }
}

class ChatProcessPrototype
{
    constructor()
    {
        this.m_fStartProcess = null;
        this.m_fHandleProcess = null;
        this.m_fFinishProcess = null;

        this.m_szProcessName = null;
    }
}

class ChatProcessHandler
{
    constructor()
    {

    }

    /**
     * 
     * @param processName - Name of the process
     * @param msg         - Discord message that started the process
     */
    static StartChatProcess(processName, msg)
    {
        // Stop any existing chat processes
        ChatProcessHandler.StopChatProcess(msg);
    
        var botProcess = new ChatProcess(processName, msg);
        ChatProcessHandler.m_Processes.set(msg.author.id, botProcess);
    
        // Some error handling
        if(!ChatProcessHandler.CheckChatProcessErrors(msg))
        {
            ChatProcessHandler.m_Processes.delete(msg.author.id);
            return;
        }
        
        var prot = ChatProcessHandler.m_Prototypes.get(processName);
        if(prot != null)
            prot.m_fStartProcess(msg, botProcess);
    }

    /**
     * 
     * @param msg - Discord Message object
     */
    static HandleChatProcess(msg)
    {
        var botProcess = ChatProcessHandler.m_Processes.get(msg.author.id);
    
        // There was no process for this client
        if(botProcess == null)
            returnM
    
        if(msg.content.startsWith("!stop") || msg.content.startsWith("!cancel") || msg.content.startsWith("!exit"))
        {
            ChatProcessHandler.StopChatProcess(msg);
            return;
        }
    
        // Handle the process
        var currStep = botProcess.GetCurrentStep();
        if(!currStep.Respond(msg.content))
        {
            msg.author.send(`Error: Message has to be between ${currStep.m_iMinimumCharCount} - ${currStep.m_iMaximumCharCount} characters`);
            return;
        }
    
        if(currStep.m_szResponse === ".")
            currStep.m_szResponse = "";
    
        var passedCheck = true;
    
        var prot = ChatProcessHandler.m_Prototypes.get(botProcess.m_szName);
        if(prot == null)
        {
            console.log(`Error: Could not find prototype for '${botProcess.m_szName}'`)
            return;
        }

        passedCheck = prot.m_fHandleProcess(msg, botProcess);

        if(passedCheck)
        {
            // Goto next step
            botProcess.CompleteStep();
        }
    
        // If theres more steps still
        if(!botProcess.IsCompleted())
        {
            msg.author.send(botProcess.GetCurrentStep().m_szDescription + (botProcess.GetCurrentStep().m_bOptional?` ${OPTIONAL_MESSAGE}`:""));
            return;
        }
        
        ChatProcessHandler.FinishChatProcess(msg);
    }

    static StopChatProcess(msg)
    {
        var botProcess = ChatProcessHandler.m_Processes.get(msg.author.id);

        // There was no process for this client
        if(botProcess == null)
            return;

        msg.author.send(`Stopped ${botProcess.m_szName}`);
        ChatProcessHandler.m_Processes.delete(msg.author.id);
    }

    static FinishChatProcess(msg)
    {
        if(!ChatProcessHandler.CheckChatProcessErrors(msg))
            return false;
    
        var botProcess = ChatProcessHandler.m_Processes.get(msg.author.id);

        var prot = ChatProcessHandler.m_Prototypes.get(botProcess.m_szName);
        if(prot == null)
        {
            console.log(`Error: Could not find prototype for '${botProcess.m_szName}'`)
            return false;
        }

        prot.m_fFinishProcess(msg, botProcess);

        ChatProcessHandler.m_Processes.delete(msg.author.id);
        msg.author.send(`Finished ${botProcess.m_szName}`);
        return true;
    }

    static CheckChatProcessErrors(msg)
    {
        var botProcess = ChatProcessHandler.m_Processes.get(msg.author.id);

        // See if categories exists
        var eventsCategory = botProcess.m_Guild.channels.cache.find(channel => channel.name === Util.CATEGORY_EVENTS);
        var signupCategory = botProcess.m_Guild.channels.cache.find(channel => channel.name === Util.CATEGORY_SIGNUP);

        if(eventsCategory == null)
        {
            msg.author.send(`Error: Server not setup properly, please create a EVENTS category`);
            return false;
        }

        if(signupCategory == null)
        {
            msg.author.send(`Error: Server not setup properly, please create a SIGNUP category`);
            return false;
        }

        return true;
    }

    static AddPrototype(name, startFunc, handleFunc, finishFunc)
    {
        var prot = new ChatProcessPrototype;
        prot.m_szName = name;
        prot.m_fStartProcess = startFunc;
        prot.m_fHandleProcess = handleFunc;
        prot.m_fFinishProcess = finishFunc;
        ChatProcessHandler.m_Prototypes.set(name, prot);
    }

    static m_Processes = new Map();
    static m_Prototypes = new Map();
}

module.exports = 
{
    ChatProcessHandler,
    ChatProcess,
    ChatStep,
}