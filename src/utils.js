import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import readline from 'readline';

import solanaWeb3 from '@solana/web3.js';

function delay(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function questionAsync(question) {
	return new Promise((resolve) => {
		rl.question(question, resolve);
	});
}

async function downloadTokensList() {
	const response = await axios.get("https://token.jup.ag/strict");
	const { data } = response;
	const tokens = data.map(({ symbol, address, decimals }) => ({
		symbol,
		address,
		decimals
	}));
	fs.writeFileSync("tokens.txt", JSON.stringify(tokens));
	return data;
}

async function getTokens() {
	if (!fs.existsSync("tokens.txt")) {
		await downloadTokensList();
	}
	return JSON.parse(fs.readFileSync("tokens.txt"));
}

class Encrypter {
	constructor(encryptionKey) {
		this.algorithm = "aes-192-cbc";
		this.key = crypto.scryptSync(encryptionKey, "salt", 24);
	}

	encrypt(clearText) {
		const iv = crypto.randomBytes(16);
		const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
		const encrypted = cipher.update(clearText, "utf8", "hex");
		return [
			encrypted + cipher.final("hex"),
			Buffer.from(iv).toString("hex")
		].join("|");
	}

	decrypt(encryptedText) {
		const [encrypted, iv] = encryptedText.split("|");
		if (!iv) throw new Error("IV not found");
		const decipher = crypto.createDecipheriv(
			this.algorithm,
			this.key,
			Buffer.from(iv, "hex")
		);
		return (
			decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8")
		);
	}
}

async function getTokenAccounts(connection, address, tokenMintAddress) {
	return await connection.getParsedTokenAccountsByOwner(
		address,
		{
			mint: new solanaWeb3.PublicKey(tokenMintAddress)
		}
	);
}

async function arbGate(connection, address) {
	const ata = await getTokenAccounts(connection, address, "9tzZzEHsKnwFL1A3DyFJwj36KnZj3gZ7g4srWp9YTEoh");
	if (ata.value.length === 0) {
		console.error(`You do not have any ARB token accounts! Please hold at least 30k ARB to run this bot.`);
		process.exit(0);
	}
	const balget = await connection.getTokenAccountBalance(ata.value[0].pubkey);
	const amt = balget.value.amount / 1e6;
	if (amt < 25e3) {
		console.error(`You do not have enough ARB to run this bot! Please hold at least 25k ARB in your wallet(${address}) run this bot. You currently have: ${amt} ARB.`);
		process.exit(0);
	}
	console.log(`You have enough ARB to run this bot! You have: ${amt} ARB. Welcome to JupGrid!`);
}

export {
	arbGate,
	delay,
	downloadTokensList,
	Encrypter,
	getTokenAccounts,
	getTokens,
	questionAsync,
	rl
};
