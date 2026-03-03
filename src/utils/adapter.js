/**
 * MessageAdapter - Wraps Discord interactions and messages into a unified interface
 * so commands can work with both prefix (!) and slash (/) commands.
 */
class MessageAdapter {
    constructor(source) {
        this._source = source;
        this._isInteraction = source.isCommand?.() || source.isChatInputCommand?.();
        this._deferred = false;
        this._replied = false;
    }

    get isInteraction() {
        return this._isInteraction;
    }

    get author() {
        return this._isInteraction ? this._source.user : this._source.author;
    }

    get member() {
        return this._source.member;
    }

    get guild() {
        return this._source.guild;
    }

    get channel() {
        return this._source.channel;
    }

    get client() {
        return this._source.client;
    }

    async deferIfNeeded() {
        if (this._isInteraction && !this._deferred && !this._replied) {
            await this._source.deferReply();
            this._deferred = true;
        }
    }

    async reply(content) {
        try {
            if (this._isInteraction) {
                if (this._deferred) {
                    return await this._source.editReply(content);
                } else if (!this._replied) {
                    this._replied = true;
                    return await this._source.reply(content);
                } else {
                    return await this._source.followUp(content);
                }
            } else {
                return await this._source.reply(content);
            }
        } catch (err) {
            console.error('Reply error:', err.message);
        }
    }

    async send(content) {
        try {
            if (this._isInteraction) {
                if (this._deferred) {
                    return await this._source.editReply(content);
                } else if (!this._replied) {
                    this._replied = true;
                    return await this._source.reply(content);
                } else {
                    return await this._source.followUp(content);
                }
            } else {
                return await this._source.channel.send(content);
            }
        } catch (err) {
            console.error('Send error:', err.message);
        }
    }
}

module.exports = { MessageAdapter };
