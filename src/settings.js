const solanaWeb3 = require("@solana/web3.js");
const { Wallet } = require("@project-serum/anchor");
const bs58 = require("bs58");
const fs = require("fs");
const dotenv = require("dotenv");

function envload() {
	const envFilePath = ".env";
	const defaultEnvContent = `RPC_URL=Your_RPC_Here\nPRIVATE_KEY=Your_Private_Key_Here`;
	try {
		if (!fs.existsSync(envFilePath)) {
			fs.writeFileSync(envFilePath, defaultEnvContent, "utf8");
			console.log(
				".env file created. Please fill in your private information, and start JupGrid again."
			);
			process.exit(0);
		}
		console.log("Private Key and RPC Loaded Successfully.\n");
	} catch (error) {
		console.error(
			"An error occurred while checking or creating the .env file:",
			error
		);
		process.exit(1);
	}
	dotenv.config();
	if (!process.env.PRIVATE_KEY || !process.env.RPC_URL) {
		console.error(
			"Missing required environment variables in .env file. Please ensure PRIVATE_KEY and RPC_URL are set."
		);
		process.exit(1);
	}

	return [
		new Wallet(
			solanaWeb3.Keypair.fromSecretKey(
				bs58.decode(process.env.PRIVATE_KEY)
			)
		),
		process.env.RPC_URL,
	];
}


async function saveUserData(selectedTokenA, selectedAddressA, selectedDecimalsA, selectedTokenB, selectedAddressB, selectedDecimalsB, tradeSize, spread, rebalanceAllowed, rebalancePercentage, rebalanceSlippageBPS) {
	try {
		await fsp.writeFile("userData.json", JSON.stringify({
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
			rebalanceSlippageBPS
		}));
		console.log("User data saved successfully.");
	} catch (error) {
		console.error("Error saving user data:", error);
	}
}

module.exports = {
	envload,
	saveUserData
}
