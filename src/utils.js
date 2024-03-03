import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import readline from "readline";

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
	const response = await axios.get("https://token.jup.ag/strict");
	const data = response.data;
	let tokens = data.map(({ symbol, address, decimals }) => ({
		symbol,
		address,
		decimals,
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
			Buffer.from(iv).toString("hex"),
		].join("|");
	}

	decrypt(encryptedText) {
		const [encrypted, iv] = encryptedText.split("|");
		if (!iv) throw new Error("IV not found");
		const decipher = crypto.createDecipheriv(
			this.algorithm,
			this.key,
			Buffer.from(iv, "hex"),
		);
		return (
			decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8")
		);
	}
}

export { delay, downloadTokensList, Encrypter, getTokens, questionAsync, rl };
