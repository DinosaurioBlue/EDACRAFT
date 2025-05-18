const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

function streamCppCommands(bot, origin, executeAction) {
    const cppPath = path.join(__dirname, 'pathfinder', 'pathfinder');
    const proc = spawn(cppPath);

    // reading from C++ -> JS
    const rl = readline.createInterface({ input: proc.stdout });

    rl.on('line', async (line) => {
        try {
            const cmd = JSON.parse(line.trim());
            await executeAction(bot, cmd, origin);
        } catch (err) {
            console.error('Invalid JSON from C++:', line);
        }
    });

    // EXPOSE A SENDER:
    bot.sendToCpp = (msg) => {
        proc.stdin.write(JSON.stringify(msg) + '\n');
    };

    return proc;
}

module.exports = { streamCppCommands };
