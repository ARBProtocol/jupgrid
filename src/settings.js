import bs58 from "bs58";
import dotenv from "dotenv";
import fs from "fs";
import promptSync from "prompt-sync";

import { Wallet } from "@project-serum/anchor";
import * as solanaWeb3 from "@solana/web3.js";

import { initialize } from "./jupgrid.js";
import * as utils from "./utils.js";

const prompt = promptSync({ sigint: true });

function envload() {
	const envFilePath = ".env";
	const defaultEnvContent = `RPC_URL=Your_RPC_Here\nPRIVATE_KEY=Your_Private_Key_Here`;
	const encflag = "love_from_the_jupgrid_devs_<3";
	try {
		if (!fs.existsSync(envFilePath)) {
			fs.writeFileSync(envFilePath, defaultEnvContent, "utf8");
			console.log(
				".env file created. Please fill in your private information, and start JupGrid again.",
			);
			process.exit(0);
		}
		console.log("Env Loaded Successfully.\n");
	} catch (error) {
		console.error(
			"An error occurred while checking or creating the .env file:",
			error,
		);
		process.exit(1);
	}
	dotenv.config();
	if (!process.env.PRIVATE_KEY || !process.env.RPC_URL) {
		console.error(
			"Missing required environment variables in .env file. Please ensure PRIVATE_KEY and RPC_URL are set.",
		);
		process.exit(1);
	}
	try {
		if (process.env.FLAG) {
			const password = prompt(
				"Enter your password to decrypt your private key: ",
			);
			const cryptr = new utils.Encrypter(password);
			const decdflag = cryptr.decrypt(process.env.FLAG);
			if (decdflag != encflag) {
				console.error(
					"Invalid password. Please ensure you are using the correct password.",
				);
				process.exit(1);
			}
			const wallet = new Wallet(
				solanaWeb3.Keypair.fromSecretKey(
					bs58.decode(cryptr.decrypt(process.env.PRIVATE_KEY)),
				),
			);
			const rpcUrl = process.env.RPC_URL;
			const l = [wallet, rpcUrl];
			console.log(l);
			return l;
		} else {
			const pswd = prompt(
				"Enter a password to encrypt your private key with: ",
			);
			const cryptr = new utils.Encrypter(pswd);
			const encryptedKey = cryptr.encrypt(process.env.PRIVATE_KEY, pswd);
			const encryptedFlag = cryptr.encrypt(encflag, pswd);
			fs.writeFileSync(
				envFilePath,
				`RPC_URL=${process.env.RPC_URL}\n//Do NOT touch these two - you risk breaking encryption!\nPRIVATE_KEY=${encryptedKey}\nFLAG=${encryptedFlag}`,
				"utf8",
			);
			console.log(
				"Encrypted private key and flag saved to .env file. Please restart JupGrid to continue.",
			);
			process.exit(0);
		}
	} catch (error) {
		console.error("An error occurred during crypting: ", error);
		return [null, null];
	}
}

function saveUserData(
	selectedTokenA,
	selectedAddressA,
	selectedDecimalsA,
	selectedTokenB,
	selectedAddressB,
	selectedDecimalsB,
	tradeSize,
	spread,
	rebalanceAllowed,
	rebalancePercentage,
	rebalanceSlippageBPS,
	monitorDelay,
) {
	try {
		fs.writeFileSync(
			"userData.json",
			JSON.stringify(
				{
					selectedTokenA,
					selectedAddressA,
					selectedDecimalsA,
					selectedTokenB,
					selectedAddressB,
					selectedDecimalsB,
					tradeSize,
					spread,
					rebalanceAllowed,
					rebalancePercentage,
					rebalanceSlippageBPS,
					monitorDelay,
				},
				null,
				4,
			),
		);
		console.log("User data saved successfully.");
	} catch (error) {
		console.error("Error saving user data:", error);
	}
}

function loadUserData() {
	try {
		const data = fs.readFileSync("userData.json");
		const userData = JSON.parse(data);
		return userData;
	} catch (error) {
		console.log("No user data found. Starting with fresh inputs.");
		initialize();
	}
}

export { envload, loadUserData, saveUserData };
