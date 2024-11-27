const { ShardingManager } = require('discord.js');
const { readConfig, printLog } = require('./helper/misc');

const { discordConf } = readConfig();
const token = discordConf.token;

printLog('Starting up...');

const manager = new ShardingManager('./theEngine.js', {
    token: token,
    totalShards: 'auto'
});

manager.on('shardCreate', shard => {
    printLog(`Launched shard ${shard.id}`);
});

manager.spawn().catch(error => {
    printLog('Error spawning shards:' + error, 'error');
});
