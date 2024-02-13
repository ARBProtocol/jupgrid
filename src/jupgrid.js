const solanaWeb3 = require("@solana/web3.js");
const { Connection, Keypair } = solanaWeb3;
const { ownerFilter, LimitOrderProvider } = require("@jup-ag/limit-order-sdk");
const fetch = require("cross-fetch");
const { Wallet } = require("@project-serum/anchor");
const bs58 = require("bs58");
const axios = require("axios");
const fs = require("fs");
const fsp = require("fs").promises;
const readline = require("readline");
const dotenv = require("dotenv");

function envload() {
	const envFilePath = ".env";
	const defaultEnvContent = `# Please fill in the following environment variables\nRPC_URL\nPRIVATE_KEY=`;
	try {
		if (!fs.existsSync(envFilePath)) {
			fs.writeFileSync(envFilePath, defaultEnvContent, "utf8");
			console.log(
				".env file created. Please fill in your private information, and start JupGrid again.",
			);
			process.exit(0);
		}
		console.log("Private Key and RPC Loaded Successfully.\n");
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

	return [
		new Wallet(
			solanaWeb3.Keypair.fromSecretKey(
				bs58.decode(process.env.PRIVATE_KEY),
			),
		),
		process.env.RPC_URL,
	];
}

let [wallet, rpcUrl] = envload();

const connection = new Connection(rpcUrl, "confirmed", {
	commitment: "confirmed",
	confirmTransactionInitialTimeout: 30000,
});
const limitOrder = new LimitOrderProvider(connection);
const commitment = "confirmed";
// Create a readline interface
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

// Function to prompt the user and get their input
function questionAsync(question) {
	return new Promise((resolve) => {
		rl.question(question, resolve);
	});
}

let shutDown = false;

const quoteurl = "https://quote-api.jup.ag/v6/quote";
let {
	validTokenA = null,
	validTokenB = null,
	selectedTokenA = null,
	selectedTokenB = null,
	selectedAddressA = null,
	selectedAddressB = null,
	selectedDecimalsA = null,
	selectedDecimalsB = null,
	validTradeSize = false,
	tradeSize = null,
	tradeSizeInLamports = null,
	validSpread = null,
	loaded = false,
	openOrders = [],
	checkArray = [],
	txArray = new Set(),
	tokens = [],
	newPrice = null,
	startPrice = null,
	spread = null,
	spreadbps = null,
	buyInput = null,
	buyOutput = null,
	sellInput = null,
	sellOutput = null,
	recalcs = 0,
	initBalanceA = 0,
	initUsdBalanceA = 0,
	initBalanceB = 0,
	initUsdBalanceB = 0,
	initUsdTotalBalance = 0,
	currUsdTotalBalance = 0,
	marketPercentageChange = 0,
	balancePercentageChange = 0,
	startTime = new Date(),
	profitA = null,
	profitB = null,
	totalProfit = null,
} = {};

let userData = {
	selectedTokenA: null,
	selectedTokenB: null,
	tradeSize: null,
	spread: null,
};

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveUserData() {
	const userData = {
		selectedTokenA,
		selectedAddressA,
		selectedDecimalsA,
		selectedTokenB,
		selectedAddressB,
		selectedDecimalsB,
		tradeSize: tradeSize,
		spread,
	};

	try {
		await fsp.writeFile("userData.json", JSON.stringify(userData));
		console.log("User data saved successfully.");
	} catch (error) {
		console.error("Error saving user data:", error);
	}
}

async function loadUserData() {
	try {
		const data = await fsp.readFile("userData.json");
		const userData = JSON.parse(data);
		selectedTokenA = userData.selectedTokenA;
		selectedAddressA = userData.selectedAddressA;
		selectedDecimalsA = userData.selectedDecimalsA;
		selectedTokenB = userData.selectedTokenB;
		selectedAddressB = userData.selectedAddressB;
		selectedDecimalsB = userData.selectedDecimalsB;
		tradeSize = userData.tradeSize;
		spread = userData.spread;
		console.log("User data loaded successfully.");
		console.log(`Token A: ${selectedTokenA}`);
		console.log(`Token B: ${selectedTokenB}`);
		console.log(`Trade size (Token A): ${tradeSize}`);
		console.log(`Spread: ${spread}`);
	} catch (error) {
		console.log("No user data found. Starting with fresh inputs.");
		// Create a new userData object with default values
		const defaultUserData = {
			selectedTokenA: null,
			selectedTokenB: null,
			tradeSize: null,
			spread: null,
		};
		// Save the default user data to userData.json
		await fsp.writeFile("userData.json", JSON.stringify(defaultUserData));
		console.log("New user data file created.");
	}
}

async function loadQuestion() {
	try {
		const response = await axios.get("https://token.jup.ag/strict");
		const data = response.data;
		tokens = data.map(({ symbol, address, decimals }) => ({
			symbol,
			address,
			decimals,
		}));
		await fsp.writeFile("tokens.txt", JSON.stringify(tokens));
		console.log("Updated Token List");
		console.log("");

		if (!fs.existsSync("userData.json")) {
			initialize();
			return;
		}

		rl.question(
			"Do you wish to load your saved settings? (Y/N): ",
			async function (responseQ) {
				responseQ = responseQ.toUpperCase(); // Case insensitivity

				if (responseQ === "Y") {
					try {
						const userData = await loadUserData(); // Load but don't apply yet
						// Prompt for confirmation to use these settings
						rl.question(
							"Proceed with these settings? (Y/N): ",
							function (confirmResponse) {
								confirmResponse = confirmResponse.toUpperCase();
								if (confirmResponse === "Y") {
									// Apply loaded settings
									loadUserData();
									console.log(
										"Settings applied successfully!",
									);
									initialize();
								} else {
									console.log(
										"Discarding loaded settings, please continue.",
									);
									selectedTokenA = null;
									selectedTokenB = null;
									tradeSize = null;
									spread = null;
									initialize();
								}
							},
						);
					} catch (error) {
						console.error("Failed to load settings:", error);
						initialize(); // Proceed with initialization in case of error
					}
				} else if (responseQ === "N") {
					console.log("Starting with blank settings.");
					selectedTokenA = null;
					selectedTokenB = null;
					tradeSize = null;
					spread = null;
					initialize();
				} else {
					console.log("Invalid response. Please type 'Y' or 'N'.");
				}
			},
		);
	} catch (error) {
		console.error("Error:", error);
	}
}

async function initialize() {
	try {
		if (selectedTokenA != null) {
			validTokenA = true;
		}
		if (selectedTokenB != null) {
			validTokenB = true;
		}
		if (tradeSize != null) {
			validTradeSize = true;
		}
		if (spread != null) {
			validSpread = true;
		}

		if (userData.selectedTokenA) {
			const tokenAExists = tokens.some(
				(token) => token.symbol === userData.selectedTokenA,
			);
			if (!tokenAExists) {
				console.log(
					`Token ${userData.selectedTokenA} from user data not found in the updated token list. Please re-enter.`,
				);
				userData.selectedTokenA = null; // Reset selected token A
				userData.selectedAddressA = null; // Reset selected address
				userData.selectedDecimalsA = null; // Reset selected token decimals
			} else {
				validTokenA = true;
			}
		}

		while (!validTokenA) {
			const answer = await questionAsync(
				`Please Enter The First Token Symbol (A) (Case Sensitive): `,
			);
			const token = tokens.find((t) => t.symbol === answer);
			if (token) {
				console.log(`Selected Token: ${token.symbol}`);
				console.log(`Token Address: ${token.address}`);
				console.log(`Token Decimals: ${token.decimals}`);
				console.log("");
				const confirmAnswer = await questionAsync(
					`Is this the correct token? (Y/N): `,
				);
				if (
					confirmAnswer.toLowerCase() === "y" ||
					confirmAnswer.toLowerCase() === "yes"
				) {
					validTokenA = true;
					selectedTokenA = token.symbol;
					selectedAddressA = token.address;
					selectedDecimalsA = token.decimals;
				}
				tokenALamports = Math.pow(10, selectedDecimalsA);
			} else {
				console.log(`Token ${answer} not found. Please Try Again.`);
			}
		}

		if (userData.selectedTokenB) {
			const tokenBExists = tokens.some(
				(token) => token.symbol === userData.selectedTokenB,
			);
			if (!tokenBExists) {
				console.log(
					`Token ${userData.selectedTokenB} from user data not found in the updated token list. Please re-enter.`,
				);
				userData.selectedTokenB = null; // Reset selected token B
				userData.selectedAddressB = null; // Reset selected address
				userData.selectedDecimalsB = null; // Reset selected token decimals
			} else {
				validTokenB = true;
			}
		}

		while (!validTokenB) {
			const answer = await questionAsync(
				`Please Enter The Second Token Symbol (B) (Case Sensitive): `,
			);
			const token = tokens.find((t) => t.symbol === answer);
			if (token) {
				console.log(`Selected Token: ${token.symbol}`);
				console.log(`Token Address: ${token.address}`);
				console.log(`Token Decimals: ${token.decimals}`);
				console.log("");
				const confirmAnswer = await questionAsync(
					`Is this the correct token? (Y/N): `,
				);
				if (
					confirmAnswer.toLowerCase() === "y" ||
					confirmAnswer.toLowerCase() === "yes"
				) {
					validTokenB = true;
					selectedTokenB = token.symbol;
					selectedAddressB = token.address;
					selectedDecimalsB = token.decimals;
				}
				tokenBLamports = Math.pow(10, selectedDecimalsB);
			} else {
				console.log(`Token ${answer} not found. Please Try Again.`);
			}
		}
		const selectedTradeToken = "a";

		// Check if trade size is valid
		if (userData.tradeSize) {
			const validTradeSize = !isNaN(parseFloat(userData.tradeSize));
			if (!validTradeSize) {
				console.log(
					"Invalid trade size found in user data. Please re-enter.",
				);
				userData.tradeSize = null; // Reset trade size
			} else validTradeSize = true;
		}

		// If trade size is not valid, prompt the user
		while (!validTradeSize) {
			const tradeSizeInput = await questionAsync(
				`Please Enter the Trade Size: `,
			);
			tradeSize = parseFloat(tradeSizeInput);
			if (!isNaN(tradeSize)) {
				userData.tradeSize = tradeSize;
				validTradeSize = true;
			} else {
				console.log("Invalid trade size. Please enter a valid number.");
			}
		}

		// Ask user for spread %
		// Check if spread percentage is valid
		if (userData.spread) {
			const validSpread = !isNaN(parseFloat(userData.spread));
			if (!validSpread) {
				console.log(
					"Invalid spread percentage found in user data. Please re-enter.",
				);
				userData.spread = null; // Reset spread percentage
			} else validSpread = true;
		}

		// If spread percentage is not valid, prompt the user
		while (!validSpread) {
			const spreadInput = await questionAsync(
				"What % Spread Difference Between Market and Orders? Recommend >0.3% to cover Jupiter Fees:",
			);
			spread = parseFloat(spreadInput);
			if (!isNaN(spread)) {
				userData.spread = spread;
				validSpread = true;
			} else {
				console.log(
					"Invalid spread percentage. Please enter a valid number (No % Symbol).",
				);
			}
		}

		spreadbps = spread * 100;
		// Calculate trade size in lamports based on the token
		if (selectedTradeToken.toLowerCase() === "a") {
			console.log(`${tradeSize}`);
			tradeSizeInLamports = tradeSize * Math.pow(10, selectedDecimalsA);

			console.log(
				`Your Token Selection for A - Symbol: ${selectedTokenA}, Address: ${selectedAddressA}`,
			);
			console.log(
				`Your Token Selection for B - Symbol: ${selectedTokenB}, Address: ${selectedAddressB}`,
			);
			console.log(
				`Order Size for Token A: ${tradeSize} ${selectedTokenA}`,
			);
			console.log(`Order Spread Percentage: ${spread}`);
		}
		rl.close(); // Close the readline interface after question loops are done.

		//First Price check during init
		try {
			const queryParams = {
				inputMint: selectedAddressA,
				outputMint: selectedAddressB,
				amount: tradeSizeInLamports,
				slippageBps: 0,
			};
			const response = await axios.get(quoteurl, { params: queryParams });
			//console.log(`Response for ${selectedTokenA} vs ${selectedTokenB}:`, response.data);
			newPrice = response.data.outAmount;
			startPrice = response.data.outAmount;
			//Calc first price layers
			buyInput = tradeSizeInLamports;
			//Get Lamports for Buy Output
			sellInput = Math.trunc(newPrice * (1 - spreadbps / 10000));
			//Get Lamports for Sell Input
			buyOutput = Math.trunc(newPrice * (1 + spreadbps / 10000));
			//Get Lamports for Sell Output
			sellOutput = tradeSizeInLamports;

			init = true;
			await saveUserData();
			console.log("\u{1F680} Starting Jupiter Gridbot");

			let initialBalances = await getBalance(
				wallet,
				selectedAddressA,
				selectedAddressB,
				selectedTokenA,
				selectedTokenB,
			);
			initBalanceA = initialBalances.balanceA;
			initUsdBalanceA = initialBalances.usdBalanceA;
			initBalanceB = initialBalances.balanceB;
			initUsdBalanceB = initialBalances.usdBalanceB;
			initUsdTotalBalance = initUsdBalanceA + initUsdBalanceB;
			console.log(
				`Total User Balance: $${initUsdTotalBalance.toFixed(2)}`,
			);
			setOrders(tradeSizeInLamports);
		} catch (error) {
			console.error("Error: Connection or Token Data Error");
			console.error("Error:", error);
			return null; // Return null on error
		}
	} catch (error) {
		console.error(error);
	}
}

if (loaded === false) {
	loadQuestion();
}

async function getBalance(
	wallet,
	selectedAddressA,
	selectedAddressB,
	selectedTokenA,
	selectedTokenB,
) {
	const USDC_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
	const SOL_MINT_ADDRESS = "So11111111111111111111111111111111111111112";

	async function getSOLBalanceAndUSDC() {
		const lamports = await connection.getBalance(wallet.publicKey);
		const solBalance = lamports / solanaWeb3.LAMPORTS_PER_SOL;

		let usdBalance = 0;
		if (selectedTokenA === "SOL" || selectedTokenB === "SOL") {
			try {
				const queryParams = {
					inputMint: SOL_MINT_ADDRESS,
					outputMint: USDC_MINT_ADDRESS,
					amount: lamports, // Amount in lamports
					slippageBps: 0,
				};
				const response = await axios.get(quoteurl, {
					params: queryParams,
				});
				usdBalance = response.data.outAmount / Math.pow(10, 6) || 0;
			} catch (error) {
				console.error("Error fetching USDC equivalent for SOL:", error);
			}
		}
		return { balance: solBalance, usdBalance };
	}

	async function getTokenAndUSDCBalance(mintAddress, decimals) {
		if (
			!mintAddress ||
			mintAddress === "So11111111111111111111111111111111111111112"
		) {
			return getSOLBalanceAndUSDC();
		}

		const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
			wallet.publicKey,
			{
				mint: new solanaWeb3.PublicKey(mintAddress),
			},
		);

		if (tokenAccounts.value.length > 0) {
			const balance =
				tokenAccounts.value[0].account.data.parsed.info.tokenAmount
					.uiAmount;
			let usdBalance = 0;

			if (mintAddress !== USDC_MINT_ADDRESS) {
				const queryParams = {
					inputMint: mintAddress,
					outputMint: USDC_MINT_ADDRESS,
					amount: Math.floor(balance * Math.pow(10, decimals)),
					slippageBps: 0,
				};

				try {
					const response = await axios.get(quoteurl, {
						params: queryParams,
					});
					//Save USD Balance and adjust down for Lamports
					usdBalance = response.data.outAmount / Math.pow(10, 6);
				} catch (error) {
					console.error("Error fetching USDC equivalent:", error);
					usdBalance = 1;
				}
			} else {
				usdBalance = balance; // If the token is USDC, its balance is its USD equivalent
			}

			return { balance, usdBalance };
		} else {
			return { balance: 0, usdBalance: 0 };
		}
	}

	let resultA = await getTokenAndUSDCBalance(
		selectedAddressA,
		selectedDecimalsA,
	);
	let resultB = await getTokenAndUSDCBalance(
		selectedAddressB,
		selectedDecimalsB,
	);

	console.log(
		`Balance for Token A (${selectedTokenA}): ${resultA.balance}, $${resultA.usdBalance.toFixed(2)}`,
	);
	console.log(
		`Balance for Token B (${selectedTokenB}): ${resultB.balance}, $${resultB.usdBalance.toFixed(2)}`,
	);

	return {
		balanceA: resultA.balance,
		usdBalanceA: resultA.usdBalance,
		balanceB: resultB.balance,
		usdBalanceB: resultB.usdBalance,
	};
}

function formatElapsedTime(startTime) {
	const currentTime = new Date();
	const elapsedTime = currentTime - startTime; // Difference in milliseconds

	let totalSeconds = Math.floor(elapsedTime / 1000);
	let hours = Math.floor(totalSeconds / 3600);
	totalSeconds %= 3600;
	let minutes = Math.floor(totalSeconds / 60);
	let seconds = totalSeconds % 60;

	// Padding with '0' if necessary
	hours = String(hours).padStart(2, "0");
	minutes = String(minutes).padStart(2, "0");
	seconds = String(seconds).padStart(2, "0");

	console.log(`Run time: ${hours}:${minutes}:${seconds}`);
}

async function monitorPrice(
	selectedAddressA,
	selectedAddressB,
	tradeSizeInLamports,
	maxRetries = 5,
) {
	if (shutDown) return;
	console.clear();
	console.log("Jupiter GridBot v0.1.0");
	formatElapsedTime(startTime);
	let retries = 0;

	while (retries < maxRetries) {
		try {
			const queryParams = {
				inputMint: selectedAddressA,
				outputMint: selectedAddressB,
				amount: tradeSizeInLamports,
				slippageBps: 0,
			};

			const response = await axios.get(quoteurl, { params: queryParams });
			const newPrice = response.data.outAmount;
			marketPercentageChange =
				((newPrice - startPrice) / startPrice) * 100;
			console.log(
				`\nSell Price : ${sellInput / Math.pow(10, selectedDecimalsB)} ${selectedTokenB} For ${buyInput / Math.pow(10, selectedDecimalsA)} ${selectedTokenA}`,
			);
			console.log(
				`Current Price : ${newPrice / Math.pow(10, selectedDecimalsB)} For ${buyInput / Math.pow(10, selectedDecimalsA)} ${selectedTokenA}`,
			);
			console.log(
				`Buy Price : ${sellOutput / Math.pow(10, selectedDecimalsA)} ${selectedTokenA} For ${buyOutput / Math.pow(10, selectedDecimalsB)} ${selectedTokenB}\n`,
			);

			await checkOpenOrders();

			if (checkArray.length !== 2) {
				const action =
					checkArray.length === 0
						? "Orders Reset Succesfully, Resetting price points and placing new orders."
						: checkArray.length > 2
							? "More than 2 open orders. Closing all orders and Resetting."
							: "Less than 2 open orders. Resetting price points and placing new orders.";
				console.log(action);
				await recalculateLayers(
					tradeSizeInLamports,
					spreadbps,
					newPrice,
				);
				orderSuccess = 0;
			} else {
				console.log("2 open orders. Waiting for change.");
				await delay(5000);
				return monitorPrice(
					selectedAddressA,
					selectedAddressB,
					tradeSizeInLamports,
					maxRetries,
				);
			}

			break; // Break the loop if we've successfully handled the price monitoring
		} catch (error) {
			console.error(
				`Error: Connection or Token Data Error (Attempt ${retries + 1} of ${maxRetries})`,
			);
			console.log(error);
			retries++;

			if (retries === maxRetries) {
				console.error(
					"Maximum number of retries reached. Unable to retrieve data.",
				);
				return null;
			}

			await new Promise((resolve) => setTimeout(resolve, 2000)); // Delay before retrying
		}
	}
}

async function recalculateLayers(tradeSizeInLamports, spreadbps, newPrice) {
	// Recalculate layers based on the new price
	console.log("\u{1F504} Calculating new price layers");
	buyInput = tradeSizeInLamports;
	//Get Lamports for Buy Output
	sellInput = Math.trunc(newPrice * (1 - spreadbps / 10000));
	//Get Lamports for Sell Input
	buyOutput = Math.trunc(newPrice * (1 + spreadbps / 10000));
	//Get Lamports for Sell Output
	sellOutput = tradeSizeInLamports;

	await cancelOrder(checkArray, wallet);
	orderSuccess = 0;
	recalcs++;
}

async function setOrders() {
	if (shutDown) return;
	let base1 = Keypair.generate();
	console.log("");
	let base2 = Keypair.generate();
	try {
		async function sendTransactionAsync(
			input,
			output,
			inputMint,
			outputMint,
			base,
			delay,
		) {
			await new Promise((resolve) => {
				setTimeout(async () => {
					try {
						const transaction = await sendTx(
							input,
							output,
							inputMint,
							outputMint,
							base,
						);
						resolve();
					} catch (error) {
						console.error("Error sending transaction:", error);
						resolve(); // Resolve the promise even in case of an error to continue with the next transaction
					}
				}, delay);
			});
		}

		// Send the "buy" transactions
		console.log("\u{1F4C9} Placing Buy Layer");
		await sendTransactionAsync(
			buyInput,
			buyOutput,
			selectedAddressA,
			selectedAddressB,
			base1,
			1000,
		);

		// Send the "sell" transaction
		console.log("\u{1F4C8} Placing Sell Layer");
		await sendTransactionAsync(
			sellInput,
			sellOutput,
			selectedAddressB,
			selectedAddressA,
			base2,
			1000,
		);

		for (const item of txArray) {
			console.log(item);
		}
		//Pause to allow Jupiter to store orders on chain
		console.log(
			"Pause for 5 seconds to allow orders to finalize on blockchain.",
		);

		await delay(5000);

		await monitorPrice(
			selectedAddressA,
			selectedAddressB,
			tradeSizeInLamports,
		);
	} catch (error) {
		console.error("Error:", error);
	}
}

async function sendTx(inAmount, outAmount, inputMint, outputMint, base) {
	if (shutDown) return;
	// Dynamically import ora
	const ora = await import("ora").then((module) => module.default);

	// Initialize the spinner
	const spinner = ora("Sending transaction...").start();

	// Define maximum retries and delay function
	const maxRetries = 5; // Maximum number of retries
	const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	let attempt = 0;
	while (attempt < maxRetries) {
		attempt++;
		try {
			// Fetch the recent block hash
			const { blockhash } = await connection.getLatestBlockhash();

			// Make the API call to create the order and get back the transaction details
			const response = await fetch(
				"https://jup.ag/api/limit/v1/createOrder",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						owner: wallet.publicKey.toString(),
						inAmount,
						outAmount,
						inputMint: inputMint.toString(),
						outputMint: outputMint.toString(),
						expiredAt: null,
						base: base.publicKey.toString(),
					}),
				},
			);

			if (!response.ok) {
				throw new Error(
					`Failed to create order: ${response.statusText}`,
				);
			}

			const responseData = await response.json();
			const { tx: encodedTransaction } = responseData;

			// Deserialize the raw transaction
			const transactionBuf = Buffer.from(encodedTransaction, "base64");
			const transaction = solanaWeb3.Transaction.from(transactionBuf);

			// Set the recent block hash and fee payer
			transaction.recentBlockhash = blockhash;
			transaction.feePayer = wallet.publicKey;

			const signers = [wallet.payer, base];

			// Send and confirm the transaction
			const txid = await solanaWeb3.sendAndConfirmTransaction(
				connection,
				transaction,
				signers,
				{
					commitment: "confirmed",
					preflightCommitment: "processed",
				},
			);

			spinner.succeed(`Transaction confirmed with ID: ${txid}`);
			console.log(`https://solscan.io/tx/${txid}`);
			console.log("Order Successful");
			await delay(2000);

			return txid; // Exit the loop on success
		} catch (error) {
			spinner.fail(
				`Attempt ${attempt} - Error in transaction: ${error.message}`,
			);
			console.error(`Attempt ${attempt} - Error:`, error);

			if (attempt < maxRetries) {
				console.log(`Retrying... Attempt ${attempt + 1}`);
				await delay(1000 * attempt); // Exponential backoff
			} else {
				console.error(
					"Maximum number of retries reached. Transaction failed.",
				);
				return null; // Exit the function after max retries
			}
		}
	}
}

async function checkOpenOrders() {
	if (shutDown) return;
	// Record the start time
	const startTime = new Date();
	openOrders.length = 0;
	checkArray.length = 0;

	// Make the JSON request
	openOrders = await limitOrder.getOrders([
		ownerFilter(wallet.publicKey, commitment),
	]);

	// Create an array to hold publicKey values
	checkArray = openOrders.map((order) => order.publicKey.toString());

	// Record the end time
	const endTime = new Date();

	// Calculate the time difference in milliseconds
	const elapsedTime = endTime - startTime;

	// Log the elapsed time
	console.log(`Open Order Check took ${elapsedTime} milliseconds`);
	console.log("");
	if (profitA != null && profitB != null) {
		console.log(
			`Profits Since Last Reset: (${selectedTokenA}): $${profitA.toFixed(2)}`,
		);
		console.log(
			`Profits Since Last Reset: (${selectedTokenB}): $${profitB.toFixed(2)}`,
		);
		console.log("");
		console.log(`Current Balance: $${currUsdTotalBalance.toFixed(2)}`);
		console.log(`Start Balance: $${initUsdTotalBalance}`);
		console.log(`-`);
		console.log(`Total Profits: $${totalProfit}`);

		console.log(
			`Balance Percent Change Since Start: ${balancePercentageChange.toFixed(2)}%`,
		);
		console.log(
			`Market Percent Change Since Start: ${marketPercentageChange.toFixed(2)}%`,
		);
	} else {
		console.log("Please wait for first orders to fill before statistics");
	}
}

async function cancelOrder(checkArray) {
	// Dynamically import
	const ora = (await import("ora")).default;
	const spinner = ora("Cancelling orders...").start();

	//Retry parameters
	const maxRetries = 30; // Maximum number of retries
	const cpause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const requestData = {
				owner: wallet.publicKey.toString(),
				feePayer: wallet.publicKey.toString(),
				orders: Array.from(checkArray),
			};

			//Get cancel order info
			console.log(" Please Wait");
			const response = await fetch(
				"https://jup.ag/api/limit/v1/cancelOrders",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestData),
				},
			);

			if (!response.ok) {
				if (response.status === 500) {
					throw new Error(`Server error! Status: ${response.status}`);
				} else {
					spinner.fail(`HTTP error! Status: ${response.status}`);
					throw new Error(`HTTP error! Status: ${response.status}`);
				}
			}

			const responseData = await response.json();
			const transactionBase64 = responseData.tx;
			const transactionBuf = Buffer.from(transactionBase64, "base64");
			const transaction = solanaWeb3.Transaction.from(transactionBuf);
			const signers = [wallet.payer];

			const txid = await solanaWeb3.sendAndConfirmTransaction(
				connection,
				transaction,
				signers,
				{
					skipPreflight: false,
					preflightCommitment: "processed",
					commitment: "confirmed",
				},
			);

			spinner.succeed(`Cancellation Transaction Confirmed: ${txid}`);
			console.log(`Transaction Receipt: https://solscan.io/tx/${txid}`);
			await cpause(7000);
			console.log("Orders Cancelled, Resetting");

			//Update balances and profits
			let currentBalances = await getBalance(
				wallet,
				selectedAddressA,
				selectedAddressB,
				selectedTokenA,
				selectedTokenB,
			);

			// Calculate profit
			profitA = currentBalances.usdBalanceA - initUsdBalanceA;
			profitB = currentBalances.usdBalanceB - initUsdBalanceB;
			currUsdTotalBalance =
				currentBalances.usdBalanceA + currentBalances.usdBalanceB;
			balancePercentageChange =
				((currUsdTotalBalance - initUsdTotalBalance) /
					initUsdTotalBalance) *
				100;
			totalProfit = (profitA + profitB).toFixed(2);
			console.log(
				`Profit for Token A since initial check: $${profitA.toFixed(2)}`,
			);
			console.log(
				`Profit for Token B since initial check: $${profitB.toFixed(2)}`,
			);

			// Reset new orders
			setOrders();

			// If the request was successful, break out of the loop
			break;
		} catch (error) {
			if (attempt === maxRetries) {
				spinner.fail(
					`Error canceling order after ${maxRetries} attempts: ${error.message}`,
				);
				console.error(`Error canceling order/s: ${checkArray}:`, error);
				break; // Exit the loop and function after max retries
			}

			console.log(`Attempt ${attempt} failed, retrying...`);
			await cpause(2000 * attempt); // Exponential backoff
		}
	}
}

process.on("SIGINT", () => {
	console.clear();
	console.log("CTRL+C detected! Performing cleanup...");
	shutDown = true;

	(async () => {
		// Dynamically import ora
		const ora = (await import("ora")).default;
		const spinner = ora(
			"Preparing to close Jupiter GridBot - Cancelling Orders",
		).start();

		// Retry parameters
		const maxRetries = 30; // Maximum number of retries
		const cpause = (ms) =>
			new Promise((resolve) => setTimeout(resolve, ms));
		openOrders.length = 0;
		checkArray.length = 0;

		// Make the JSON request
		openOrders = await limitOrder.getOrders([
			ownerFilter(wallet.publicKey, commitment),
		]);

		checkArray = openOrders.map((order) => order.publicKey.toString());
		if (checkArray.length === 0) {
			process.exit(0);
		}
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const requestData = {
					owner: wallet.publicKey.toString(),
					feePayer: wallet.publicKey.toString(),
					orders: Array.from(checkArray),
				};

				console.log(" - Please Wait");
				const response = await fetch(
					"https://jup.ag/api/limit/v1/cancelOrders",
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify(requestData),
					},
				);

				if (!response.ok) {
					throw new Error(`HTTP error! Status: ${response.status}`);
				}

				const responseData = await response.json();
				const transactionBase64 = responseData.tx;
				const transactionBuf = Buffer.from(transactionBase64, "base64");
				const transaction = solanaWeb3.Transaction.from(transactionBuf);
				const signers = [wallet.payer];

				const txid = await solanaWeb3.sendAndConfirmTransaction(
					connection,
					transaction,
					signers,
					{
						skipPreflight: false,
						preflightCommitment: "processed",
						commitment: "confirmed",
					},
				);

				spinner.succeed(`Cancellation Transaction Confirmed: ${txid}`);
				console.log(
					`Transaction Receipt: https://solscan.io/tx/${txid}`,
				);
				process.exit(0); // Ensure graceful exit
			} catch (error) {
				if (attempt === maxRetries) {
					spinner.fail(
						`Error canceling order after ${maxRetries} attempts: ${error.message}`,
					);
					console.error(
						`Error canceling order/s: ${checkArray}:`,
						error,
					);
					break; // Exit the loop after max retries
				}
				console.log("");
				console.log(`Attempt ${attempt} failed, retrying...`);
				await cpause(2000 * attempt); // Exponential backoff
			}
		}
	})();
});
