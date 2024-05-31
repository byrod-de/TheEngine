const { ShardingManager } = require('discord.js');
const { readConfig } = require('./helper/misc');

const { discordConf } = readConfig();
const token = discordConf.token;

console.log('Starting up...');

const manager = new ShardingManager('./theEngine.js', {
    token: token,
    totalShards: 'auto'
});

manager.on('shardCreate', shard => {
    console.log(`Launched shard ${shard.id}`);
});

manager.spawn().catch(error => {
    console.error('Error spawning shards:', error);
});
