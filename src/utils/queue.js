/**
 * MusicQueue - Per-guild music queue manager
 */
class MusicQueue {
    constructor() {
        this.songs = [];
        this.volume = 50;
        this.playing = false;
        this.loop = false;
        this.connection = null;
        this.player = null;
        this.resource = null;
        this.textChannel = null;
    }

    addSong(song) {
        this.songs.push(song);
    }

    removeSong(index) {
        if (index < 0 || index >= this.songs.length) return null;
        return this.songs.splice(index, 1)[0];
    }

    clear() {
        this.songs.splice(1); // Keep current song, remove rest
    }

    shuffle() {
        if (this.songs.length <= 2) return;
        // Shuffle everything except the currently playing song (index 0)
        for (let i = this.songs.length - 1; i > 1; i--) {
            const j = 1 + Math.floor(Math.random() * i);
            [this.songs[i], this.songs[j]] = [this.songs[j], this.songs[i]];
        }
    }

    get currentSong() {
        return this.songs[0] || null;
    }

    get queueLength() {
        return Math.max(0, this.songs.length - 1);
    }

    destroy() {
        this.songs = [];
        this.playing = false;
        this.loop = false;
        if (this.ytdlpProcess) {
            this.ytdlpProcess.kill('SIGTERM');
            this.ytdlpProcess = null;
        }
        if (this.player) {
            this.player.stop(true);
            this.player = null;
        }
        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
        }
        this.resource = null;
    }
}

function getQueue(client, guildId) {
    if (!client.queues.has(guildId)) {
        client.queues.set(guildId, new MusicQueue());
    }
    return client.queues.get(guildId);
}

function deleteQueue(client, guildId) {
    const queue = client.queues.get(guildId);
    if (queue) {
        queue.destroy();
        client.queues.delete(guildId);
    }
}

module.exports = { MusicQueue, getQueue, deleteQueue };
