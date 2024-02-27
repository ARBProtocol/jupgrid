import readline from 'readline';
import axios from 'axios';
import fs from 'fs';
//import { connection } from './jupgrid.js';

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function questionAsync(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

async function downloadTokensList() {
    const response = await axios.get('https://token.jup.ag/strict');
    const data = response.data;
    let tokens = data.map(({ symbol, address, decimals }) => ({
        symbol,
        address,
        decimals,
    }));
    fs.writeFileSync('tokens.txt', JSON.stringify(tokens));
    return data;
}

async function getTokens() {
    if (!fs.existsSync('tokens.txt')) {
        await downloadTokensList();
    }
    return JSON.parse(fs.readFileSync('tokens.txt'));
}

export {
    delay,
    rl,
    questionAsync,
    downloadTokensList,
    getTokens,
};
