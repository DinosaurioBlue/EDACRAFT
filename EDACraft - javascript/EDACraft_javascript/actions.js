const { Movements, goals } = require('mineflayer-pathfinder');
const mcData = require('minecraft-data')('1.19'); // or bot.version dynamically

function sendBotFeedback(msgObj, bot = null) {
    const jsonLine = JSON.stringify(msgObj) + '\n';

    if (bot && typeof bot.sendToCpp === 'function') {
        bot.sendToCpp(msgObj); // ← Send back to C++
    } else {
        process.stderr.write('[BOT] ' + jsonLine);
    }
}


async function executeAction(bot, actionObj, origin = { x: 0, y: 0, z: 0 }) {
    const action = actionObj.action;

    switch (action) {
        case 'walk_path':
            const path = actionObj.path;
            const defaultMovements = new Movements(bot, mcData);
            bot.pathfinder.setMovements(defaultMovements);

            for (const step of path) {
                const pos = {
                    x: origin.x + step.x,
                    y: origin.y + step.y,
                    z: origin.z + step.z
                };

                const goal = new goals.GoalBlock(
                    Math.floor(pos.x),
                    Math.floor(pos.y),
                    Math.floor(pos.z)
                );

                await bot.pathfinder.goto(goal);
                bot.chat("Arrived!");
                sendBotFeedback({ status: 'done', action: 'move', pos: { x, y, z } });
            }
            break;

        case 'move': {
            const { x, y, z } = actionObj;

            if ([x, y, z].some(v => typeof v !== 'number')) {
                console.error('Invalid move target:', actionObj);
                break;
            }

            const mcData = require('minecraft-data')(bot.version);
            const movements = new Movements(bot, mcData);
            bot.pathfinder.setMovements(movements);

            const goal = new goals.GoalBlock(
                Math.floor(x),
                Math.floor(y),
                Math.floor(z)
            );

            bot.chat(`Moving to (${x}, ${y}, ${z})`);
            await bot.pathfinder.goto(goal);
            bot.chat("Arrived!");
            break;
        }

        case 'look':
            bot.look(actionObj.yaw, actionObj.pitch, true);
            break;

        case 'dig':
            const blockToDig = bot.blockAt({
                x: actionObj.x,
                y: actionObj.y,
                z: actionObj.z
            });
            if (blockToDig && bot.canDigBlock(blockToDig)) {
                await bot.dig(blockToDig);
                sendBotFeedback({ status: 'dug', pos: { x: actionObj.x, y: actionObj.y, z: actionObj.z } });
            } else {
                console.log("Can't dig block or block missing");
                sendBotFeedback({ status: 'error', message: "Can't dig block or block missing" });
            }
            break;

        case 'chat':
            bot.chat(actionObj.message);
            sendBotFeedback({ status: 'said', message: actionObj.message });
            break;

        case 'place':
            const refBlock = bot.blockAt({
                x: actionObj.x,
                y: actionObj.y,
                z: actionObj.z
            });

            const item = bot.inventory.items().find(i => i.name === actionObj.item);
            if (!item) return console.log("Item not found in inventory:", actionObj.item);

            await bot.equip(item, 'hand');
            await bot.placeBlock(refBlock, { x: 0, y: 1, z: 0 });
            break;

            // New case: jump
        case 'jump':
            bot.setControlState('jump', true);
            setTimeout(() => bot.setControlState('jump', false), 500); // jump for 0.5s
            break;

        // attack nearest hostile entity
        case 'attack':
            const entity = bot.nearestEntity(e => e.type === 'mob');
            if (entity) {
                bot.attack(entity);
                bot.chat(`Attacking ${entity.name}`);
            } else {
                bot.chat("No mob to attack");
            }
            break;

        // Use an item, Equivalent to right click
        case 'use':
            bot.activateItem();
            break;

        // New case: collect (items within radius)
        case 'collect':
            const items = Object.values(bot.entities).filter(e => e.name === 'item');
            for (const item of items) {
                bot.chat(`Collecting ${item.metadata[7].itemId}`);
                await bot.pathfinder.goto(new goals.GoalBlock(
                    Math.floor(item.position.x),
                    Math.floor(item.position.y),
                    Math.floor(item.position.z)
                ));
            }
            break;

        // Equip an item
        case 'equip':
            const slot = actionObj.slot || 'hand';
            const equipItem = bot.inventory.items().find(i => i.name === actionObj.item);
            if (!equipItem) return bot.chat(`Item ${actionObj.item} not found`);
            await bot.equip(equipItem, slot);
            bot.chat(`Equipped ${actionObj.item} in ${slot}`);
            break;

        // Send back inventory data to C++
        case 'inventory': {
            const inv = bot.inventory.items().map(i => ({ name: i.name, count: i.count }));
            sendBotFeedback({ type: 'inventory', items: inv });
            break;
        }

        // Send back bot position data to C++
        case 'position': {
            const pos = bot.entity.position;
            sendBotFeedback({
                type: 'position', x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z)});
            break;
        }

        case 'entities': {
            const nearby = Object.values(bot.entities)
                .filter(e => e.type === 'mob' || e.type === 'player')
                .map(e => ({
                    name: e.name,
                    type: e.type,
                    distance: bot.entity.position.distanceTo(e.position)
                }));
            sendBotFeedback({type: 'entities', data: nearby});
            break;
        }

        // Send back requested find command outcome to C++
        case 'find_block': {
            const block = bot.findBlock({
                matching: actionObj.blockName || null, // e.g. 'stone'
                maxDistance: actionObj.maxDistance || 32,
                count: 1
            });
            if (block) {
                sendBotFeedback({
                    type: 'found_block',
                    block: {
                        name: block.name,
                        position: block.position
                    }
                });
            } else {
                sendBotFeedback({ type: 'found_block', message: 'Not found' });
            }
            break;
        }

        // Send back health and food status to C++
        case 'status': {
            sendBotFeedback({
                type: 'status',
                health: bot.health,
                food: bot.food,
                isUsingItem: bot.isUsingItem()
            });
            break;
        }

        // Send back requested specific block info to C++
        case 'block_at': {
            const pos = actionObj;
            const block = bot.blockAt(pos);
            if (block) {
                sendBotFeedback({
                    type: 'block_at',
                    name: block.name,
                    hardness: block.hardness,
                    position: block.position
                });
            } else {
                sendBotFeedback({ type: 'block_at', message: 'No block found' });
            }
            break;
        }

        // Send back item held to C++
        case 'held_item': {
            const item = bot.heldItem;
            if (item) {
                sendBotFeedback({
                    type: 'held_item',
                    name: item.name,
                    count: item.count
                });
            } else {
                sendBotFeedback({ type: 'held_item', message: 'Nothing held' });
            }
            break;
        }

        default:
            console.log('Unknown action:', action);
    }
}

async function runActionSequence(bot, actions, origin = { x: 0, y: 0, z: 0 }) {
    for (const action of actions) {
        await executeAction(bot, action, origin);
    }
}

module.exports = { executeAction, runActionSequence };
