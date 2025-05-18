const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const { mineflayer: mineflayerViewer } = require('prismarine-viewer');

const { executeAction } = require('./actions');
const { streamCppCommands } = require('./ipc');

const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: 'CppBot'
});

// Load plugins
bot.loadPlugin(pathfinder);

// On successful spawn
bot.once('spawn', () => {
    console.log('Bot spawned into the world.');

    // Start 3D viewer
    mineflayerViewer(bot, { port: 3007, firstPerson: false });
    console.log('Viewer started at http://localhost:3007');

    // Initial position used as origin (could be set dynamically)
    const origin = {
        x: Math.floor(bot.entity.position.x),
        y: Math.floor(bot.entity.position.y),
        z: Math.floor(bot.entity.position.z)
    };

    // Let C++ know we're ready
    bot.chat("CppBot is ready!");
    process.stderr.write('[BOT] {"status":"ready","origin":' + JSON.stringify(origin) + '}\n');

    // Start command stream
    streamCppCommands(bot, origin, executeAction);
});

// Handle disconnects
bot.on('end', () => {
    console.error('[BOT] Disconnected from server.');
    process.stderr.write('[BOT] {"status":"disconnected"}\n');
    process.exit(1); // Or restart if you want a persistent bot
});

// Handle errors
bot.on('error', (err) => {
    console.error('[BOT ERROR]', err.message);
    process.stderr.write('[BOT] {"status":"error","message":"' + err.message + '"}\n');
});

// Optional: Export bot for external usage (e.g. testing or debug)
module.exports = { bot };