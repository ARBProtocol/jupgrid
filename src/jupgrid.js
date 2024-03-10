import axios from 'axios';
import chalk from 'chalk';
import fetch from 'cross-fetch';
import * as fs from 'fs';
import ora from 'ora';

import {
	LimitOrderProvider,
	ownerFilter
} from '@jup-ag/limit-order-sdk';
import * as solanaWeb3 from '@solana/web3.js';

import packageInfo from '../package.json' assert { type: 'json' };
import {
	envload,
	loaduserSettings,
	saveuserSettings
} from './settings.js';
import {
	arbGate,
	delay,
	downloadTokensList,
	getTokenAccounts,
	getTokens,
	questionAsync,
	rl
} from './utils.js';
import e from 'express';

const { Connection, Keypair, VersionedTransaction } = solanaWeb3;

const version = packageInfo.version;

let [wallet, rpcUrl] = envload();

const connection = new Connection(rpcUrl, "processed", {
	confirmTransactionInitialTimeout: 5000,
});
const limitOrder = new LimitOrderProvider(connection);

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
	stopLossUSD=  null,
	infinityTarget = null,
	loaded = false,
	openOrders = [],
	checkArray = [],
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
	currBalanceA = 0,
	currBalanceB = 0,
	currCalcBalA = 0,
	currCalcBalB = 0,
	prevBalA = 0,
	prevBalB = 0,
	currUSDBalanceA = 0,
	currUSDBalanceB = 0,
	initUsdTotalBalance = 0,
	currUsdTotalBalance = 0,
	marketPercentageChange = 0,
	balancePercentageChange = 0,
	tokenRebalanceValue = null,
	tokenARebalanceValue = 0,
	tokenBRebalanceValue = 0,
	rebalanceAllowed = null,
	validRebalanceAllowed = false,
	rebalanceSlippageBPS = 25,
	validRebalanceSlippage = false,
	rebalancePercentage = 0,
	validRebalancePercentage = false,
	validStopLossUSD = false,
	validInfinityTarget = false,
	startTime = new Date(),
	profitA = null,
	profitB = null,
	profitSumA = 0,
	profitSumB = 0,
	buysFilled = 0,
	sellsFilled = 0,
	totalProfit = null,
	monitorDelay = null,
	buyKey = null,
	sellKey = null,
	txFeeBuy = 0,
	txFeeSell = 0,
	txFeeCancel = 0,
	recoveredTransactionsCount = 0,
	lastFilledOrder = null, // 'buy' or 'sell'
	sortedLayers,
	infinityMode = false,
	adjustmentA = 0,
	adjustmentB = 0,
	userSettings = {
		selectedTokenA: null,
		selectedTokenB: null,
		tradeSize: null,
		spread: null,
		rebalanceAllowed: null,
		rebalancePercentage: null,
		rebalanceSlippageBPS: null,
		monitorDelay: null,
		stopLossUSD: null,
		infinityTarget: null,
	},
} = {};

async function loadQuestion() {
	try {
		await downloadTokensList();
		console.log("Updated Token List\n");

		if (!fs.existsSync("userSettings.json")) {
			console.log("No user data found. Starting with fresh inputs.");
			initialize();
		} else {
			const askForLoadSettings = () => {
				rl.question(
					"Do you wish to load your saved settings? (Y/N): ",
					function (responseQ) {
						responseQ = responseQ.toUpperCase(); // Case insensitivity

						if (responseQ === "Y") {
							try {
								// Show user data
								const userSettings = loaduserSettings();
								console.log("User data loaded successfully.");
								console.log(
									`Token A: ${userSettings.selectedTokenA}`,
								);
								console.log(
									`Token B: ${userSettings.selectedTokenB}`,
								);
								console.log(
									`Order Size (in ${userSettings.selectedTokenA}): ${userSettings.tradeSize}`,
								);
								console.log(
									`Spread: ${userSettings.spread}`
								);
								console.log(
									`Stop Loss: ${userSettings.stopLossUSD}`
								);
								console.log(
									`Monitoring delay: ${userSettings.monitorDelay}ms`,
								);
								console.log(
									`Rebalancing is ${userSettings.rebalanceAllowed ? "enabled" : "disabled"}`,
								);
								if (userSettings.rebalanceAllowed) {
									console.log(
										`Rebalance Threshold: ${userSettings.rebalancePercentage}%`,
									);
									console.log(
										`Rebalance Swap Slippage: ${userSettings.rebalanceSlippageBPS / 100}%`,
									);
								}								

								// Prompt for confirmation to use these settings
								rl.question(
									"Proceed with these settings? (Y/N): ",
									function (confirmResponse) {
										confirmResponse =
											confirmResponse.toUpperCase();
										if (confirmResponse === "Y") {
											// Apply loaded settings
											({
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
												stopLossUSD,
												infinityTarget,
											} = userSettings);
											console.log(
												"Settings applied successfully!",
											);
											initialize();
										} else if (confirmResponse === "N") {
											console.log(
												"Discarding saved settings, please continue.",
											);
											initialize(); // Start initialization with blank settings
										} else {
											console.log(
												"Invalid response. Please type 'Y' or 'N'.",
											);
											askForLoadSettings(); // Re-ask the original question
										}
									},
								);
							} catch (error) {
								console.error(
									"Failed to load settings:",
									error,
								);
								initialize(); // Proceed with initialization in case of error
							}
						} else if (responseQ === "N") {
							console.log("Starting with blank settings.");
							initialize();
						} else {
							console.log(
								"Invalid response. Please type 'Y' or 'N'.",
							);
							askForLoadSettings(); // Re-ask if the response is not Y/N
						}
					},
				);
			};

			askForLoadSettings(); // Start the question loop
		}
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
		if (rebalanceAllowed != null) {
			validRebalanceAllowed = true;
		}
		if (
			rebalancePercentage != null &&
			rebalancePercentage > 0 &&
			rebalancePercentage <= 10000
		) {
			validRebalancePercentage = true;
		}
		if (
			rebalanceSlippageBPS != null &&
			rebalanceSlippageBPS >= 0.1 &&
			rebalanceSlippageBPS <= 100
		) {
			validRebalanceSlippage = true;
		}
		let validMonitorDelay = false;
		if (monitorDelay >= 5000) {
			validMonitorDelay = true;
		}
		let validStopLossUSD = false;
		if (stopLossUSD != null) {
			validStopLossUSD = true;
		}
		let validInfinityTarget = false;
		if (infinityTarget != null) {
			validInfinityTarget = true;
		}

		tokens = await getTokens();

		if (userSettings.selectedTokenA) {
			const tokenAExists = tokens.some(
				(token) => token.symbol === userSettings.selectedTokenA,
			);
			if (!tokenAExists) {
				console.log(
					`Token ${userSettings.selectedTokenA} from user data not found in the updated token list. Please re-enter.`,
				);
				userSettings.selectedTokenA = null; // Reset selected token A
				userSettings.selectedAddressA = null; // Reset selected address
				userSettings.selectedDecimalsA = null; // Reset selected token decimals
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
				//let tokenALamports = Math.pow(10, selectedDecimalsA);
			} else {
				console.log(`Token ${answer} not found. Please Try Again.`);
			}
		}

		if (userSettings.selectedTokenB) {
			const tokenBExists = tokens.some(
				(token) => token.symbol === userSettings.selectedTokenB,
			);
			if (!tokenBExists) {
				console.log(
					`Token ${userSettings.selectedTokenB} from user data not found in the updated token list. Please re-enter.`,
				);
				userSettings.selectedTokenB = null; // Reset selected token B
				userSettings.selectedAddressB = null; // Reset selected address
				userSettings.selectedDecimalsB = null; // Reset selected token decimals
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
				//let tokenBLamports = Math.pow(10, selectedDecimalsB);
			} else {
				console.log(`Token ${answer} not found. Please Try Again.`);
			}
		}
		const selectedTradeToken = "a";

		// Check if trade size is valid
		if (userSettings.tradeSize) {
			validTradeSize = !isNaN(parseFloat(userSettings.tradeSize));
			if (!validTradeSize) {
				console.log(
					"Invalid trade size found in user data. Please re-enter.",
				);
				userSettings.tradeSize = null; // Reset trade size
			} else validTradeSize = true;
		}

		// If trade size is not valid, prompt the user
		while (!validTradeSize) {
			const tradeSizeInput = await questionAsync(
				`Please Enter the Trade Size: `,
			);
			tradeSize = parseFloat(tradeSizeInput);
			if (!isNaN(tradeSize)) {
				userSettings.tradeSize = tradeSize;
				validTradeSize = true;
			} else {
				console.log("Invalid trade size. Please enter a valid number.");
			}
		}

		// Ask user for spread %
		// Check if spread percentage is valid
		if (userSettings.spread) {
			validSpread = !isNaN(parseFloat(userSettings.spread));
			if (!validSpread) {
				console.log(
					"Invalid spread percentage found in user data. Please re-enter.",
				);
				userSettings.spread = null; // Reset spread percentage
			} else validSpread = true;
		}

		// If spread percentage is not valid, prompt the user
		while (!validSpread) {
			const spreadInput = await questionAsync(
				"What % Spread Difference Between Market and Orders? Recommend >0.3% to cover Jupiter Fees:",
			);
			spread = parseFloat(spreadInput);
			if (!isNaN(spread)) {
				userSettings.spread = spread;
				validSpread = true;
			} else {
				console.log(
					"Invalid spread percentage. Please enter a valid number (No % Symbol).",
				);
			}
		}

		if (userSettings.stopLossUSD) {
			validStopLossUSD = !isNaN(parseFloat(userSettings.stopLossUSD));
			if (!validStopLossUSD) {
				console.log(
					"Invalid stop loss value found in user data. Please re-enter.",
				);
				userSettings.stopLossUSD = null; // Reset stop loss value
			} else validStopLossUSD = true;
		}
		
		// If stop loss value is not valid, prompt the user
		while (!validStopLossUSD) {
			const stopLossUSDInput = await questionAsync(
				`Please Enter the Stop Loss Value in USD: `,
			);
			stopLossUSD = parseFloat(stopLossUSDInput);
			if (!isNaN(stopLossUSD)) {
				userSettings.stopLossUSD = stopLossUSD;
				validStopLossUSD = true;
			} else {
				console.log("Invalid stop loss value. Please enter a valid number.");
			}
		}

		// Ask the user if they want to enable Infinity Mode
		const infinityModeInput = await questionAsync(
			`Would you like Infinity Mode? (Y/N): `,
		);
		infinityMode = infinityModeInput.toLowerCase() === 'y';

		if (infinityMode) {
			if (userSettings.infinityTarget) {
				validInfinityTarget = !isNaN(parseFloat(userSettings.infinityTarget));
				if (!validInfinityTarget) {
					console.log(
						"Invalid infinity target value found in user data. Please re-enter.",
					);
					userSettings.infinityTarget = null; // Reset infinity target value
				} else validInfinityTarget = true;
			}

			// If infinity target value is not valid, prompt the user
			while (!validInfinityTarget) {
				const infinityTargetInput = await questionAsync(
					`Please Enter the Infinity Target Value: `,
				);
				infinityTarget = Math.floor(parseFloat(infinityTargetInput));
				if (!isNaN(infinityTarget) && Number.isInteger(infinityTarget) && infinityTarget > userSettings.stopLossUSD) {
					userSettings.infinityTarget = infinityTarget;
					validInfinityTarget = true;
				} else {
					console.log("Invalid infinity target value. Please enter a valid integer that is larger than the stop loss value.");
				}
			}
		}

		while (rebalanceAllowed === null) {
			const rebalanceQuestion = await questionAsync(
				"Do you want to allow rebalancing of Tokens (Currently Experimental)? (Y/N): ",
			);

			if (rebalanceQuestion.trim().toUpperCase() === "Y") {
				rebalanceAllowed = true;

				const percentageQuestion = await questionAsync(
					"At what balance percentage do you want to rebalance your lower balance token? (Enter a number between 1 and 100): ",
				);
				const parsedPercentage = parseFloat(percentageQuestion.trim());
				if (
					!isNaN(parsedPercentage) &&
					parsedPercentage > 0 &&
					parsedPercentage <= 100
				) {
					rebalancePercentage = parsedPercentage;
				} else {
					console.log(
						"Invalid percentage. Please enter a number between 1 and 100.",
					);
					continue; // Ask the rebalance percentage question again
				}

				// Loop for maximum allowed slippage question until a valid answer is given or default is accepted
				let isValidSlippage = false;
				while (!isValidSlippage) {
					const slippageQuestion = await questionAsync(
						`What is the maximum allowed slippage for the rebalance transaction? (Enter a number between 0.1 and 100, representing percentage, default 0.3%): `,
					);

					let parsedSlippage;
					if (slippageQuestion.trim() === "") {
						// User accepted the default value
						parsedSlippage = 0.3;
						isValidSlippage = true;
					} else {
						// User entered a value, attempt to parse it
						parsedSlippage = parseFloat(slippageQuestion.trim());
						if (
							!isNaN(parsedSlippage) &&
							parsedSlippage >= 0.1 &&
							parsedSlippage <= 100
						) {
							// Valid slippage value entered
							isValidSlippage = true;
						} else {
							console.log(
								"Invalid slippage value. Please enter a number between 0.1 and 100, or press Enter to accept the default value.",
							);
						}
					}

					if (isValidSlippage) {
						rebalanceSlippageBPS = parsedSlippage * 100;
					}
				}
			} else if (rebalanceQuestion.trim().toUpperCase() === "N") {
				rebalanceAllowed = false;
				break; // Exit the loop if rebalancing is not allowed
			} else {
				console.log(
					"Invalid input. Please enter 'Y' for Yes or 'N' for No.",
				);
				// Loop will continue asking the rebalance permission question
			}
		}

		// ask for monitor delay
		while (!validMonitorDelay) {
			const monitorDelayQuestion = await questionAsync(
				`Enter the delay between price checks in milliseconds (minimum 5000ms): `,
			);
			const parsedMonitorDelay = parseInt(monitorDelayQuestion.trim());
			if (!isNaN(parsedMonitorDelay) && parsedMonitorDelay >= 5000) {
				monitorDelay = parsedMonitorDelay;
				validMonitorDelay = true;
			} else {
				console.log(
					"Invalid monitor delay. Please enter a valid number greater than or equal to 5000.",
				);
			}
		}

		spreadbps = spread * 100;
		// Calculate trade size in lamports based on the token
		if (selectedTradeToken.toLowerCase() === "a") {
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
			const layers = generatePriceLayers(startPrice, spreadbps, 500)
			//Calc first price layers
			buyInput = tradeSizeInLamports;

			sellInput = layers[1];
			buyOutput = layers[-1];

			//Get Lamports for Sell Output
			sellOutput = tradeSizeInLamports;

			saveuserSettings(
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
				stopLossUSD,
				infinityTarget,
			);
			console.clear();
			console.log(`\n\u{1F680} Starting Jupgrid! Version ${version}`);

			if (!infinityMode) {
				console.log("Starting Grid Mode");
			startGrid();
			} else {
				console.log("Infinity Mode is currently disabled. Please check back later.")
				process.exit(0);
				
				//console.log("Starting Infinity Mode");
				//startInfinity();
			}

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
	await arbGate(connection, wallet.publicKey);
	loadQuestion();
}

async function startGrid () {
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

	let currentBalances = await getBalance(
		wallet,
		selectedAddressA,
		selectedAddressB,
		selectedTokenA,
		selectedTokenB,
	);
	currBalanceA = currentBalances.balanceA;
	currBalanceB = currentBalances.balanceB;
	currUSDBalanceA = currentBalances.usdBalanceA;
	currUSDBalanceB = currentBalances.usdBalanceB;
	currUsdTotalBalance = currUSDBalanceA + currUSDBalanceB;

	console.log(
		`${chalk.cyan(selectedTokenA)} Balance: ${chalk.cyan(initBalanceA)}, worth $${chalk.cyan(initUsdBalanceA.toFixed(2))}`,
		`\n${chalk.magenta(selectedTokenB)} Balance: ${chalk.magenta(initBalanceB)}, worth $${chalk.magenta(initUsdBalanceB.toFixed(2))}`,
		`\nTotal User Balance: $${initUsdTotalBalance.toFixed(2)}`,
	);
	setOrders(tradeSizeInLamports);
}

async function startInfinity() {
	//Balance check and rebalance to start
	//await balanceCheck();
	infinityGrid();
}

function generatePriceLayers(newPrice, spreadbps, totalLayers) {
    const layers = {};
    const adjustment = newPrice * spreadbps / 10000; // Fixed adjustment value

    for (let i = 1; i <= totalLayers; i++) {
        const upperLayerPrice = Math.trunc(Number(newPrice) - adjustment * i);
        const lowerLayerPrice = Math.trunc(Number(newPrice) + adjustment * i);

        // Only add the layer if the price is not negative
        if (upperLayerPrice >= 0) {
            layers[i] = upperLayerPrice;
        }
        if (lowerLayerPrice >= 0) {
            layers[-i] = lowerLayerPrice;
        }
    }
    layers[0] = Number(newPrice);

    // Convert the layers object to an array of [key, value] pairs
    const layersArray = Object.entries(layers);

    // Sort the array in descending order by key (layer number)
    layersArray.sort((a, b) => Number(b[0]) - Number(a[0]));

    // Convert the sorted array back to an object
    const localSortedLayers = Object.fromEntries(layersArray);

    fs.writeFileSync('userPriceLayers.json', JSON.stringify(localSortedLayers, null, 2), 'utf8');

    // Assign localSortedLayers to the global variable
    sortedLayers = localSortedLayers;

    return localSortedLayers;
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
		if (solBalance === 0) {
			console.log(`You do not have any SOL, please check and try again.`);
			process.exit(0);
		}
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
				tokenRebalanceValue =
					response.data.outAmount / (lamports / Math.pow(10, 3));
			} catch (error) {
				console.error("Error fetching USDC equivalent for SOL:", error);
			}
		}
		return { balance: solBalance, usdBalance, tokenRebalanceValue };
	}

	async function getTokenAndUSDCBalance(mintAddress, decimals) {
		if (
			!mintAddress ||
			mintAddress === "So11111111111111111111111111111111111111112"
		) {
			return getSOLBalanceAndUSDC();
		}

		const tokenAccounts = await getTokenAccounts(
			connection,
			wallet.publicKey,
			mintAddress,
		);
		if (tokenAccounts.value.length > 0) {
			const balance =
				tokenAccounts.value[0].account.data.parsed.info.tokenAmount
					.uiAmount;
			let usdBalance = 0;
			if (balance === 0) {
				console.log(
					`You do not have a balance for ${mintAddress}, please check and try again.`,
				);
				process.exit(0);
			}
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
					tokenRebalanceValue =
						response.data.outAmount / (balance * Math.pow(10, 6));
				} catch (error) {
					console.error("Error fetching USDC equivalent:", error);
					usdBalance = 1;
				}
			} else {
				usdBalance = balance; // If the token is USDC, its balance is its USD equivalent
				if (usdBalance === 0) {
					console.log(
						`You do not have any USDC, please check and try again.`,
					);
					process.exit(0);
				}
				tokenRebalanceValue = 1;
			}

			return { balance, usdBalance, tokenRebalanceValue };
		} else {
			return { balance: 0, usdBalance: 0, tokenRebalanceValue: null };
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

	if (resultA.balance === 0 || resultB.balance === 0) {
		console.log(
			"Please ensure you have a balance in both tokens to continue.",
		);
		process.exit(0);
	}
	prevBalA = resultA.balance;
	prevBalB = resultB.balance;
	return {
		balanceA: resultA.balance,
		usdBalanceA: resultA.usdBalance,
		tokenARebalanceValue: resultA.tokenRebalanceValue,
		balanceB: resultB.balance,
		usdBalanceB: resultB.usdBalance,
		tokenBRebalanceValue: resultB.tokenRebalanceValue,
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

async function infinityGrid() {
	
	

let currentBalances = await getBalance(wallet, selectedAddressA, selectedAddressB, selectedTokenA, selectedTokenB);
currBalanceA = currentBalances.balanceA;
currBalanceB = currentBalances.balanceB;
currUSDBalanceA = currentBalances.usdBalanceA;
currUSDBalanceB = currentBalances.usdBalanceB;
currUsdTotalBalance = currUSDBalanceA + currUSDBalanceB;
let tokenBPrice = currUSDBalanceB / currBalanceB;
let tokenAPrice = currUSDBalanceA / currBalanceA;

if (currUsdTotalBalance < stopLossUSD) {
	//Emergency Stop Loss
	console.log(`\n\u{1F6A8} Emergency Stop Loss Triggered! - Cashing out and Exiting`);

}

// Calculate the new prices of tokenB when it's up 1% and down 1%
let newPriceBUp = tokenBPrice * 1.01;
let newPriceBDown = tokenBPrice * 0.99;
let exchangeRate = tokenBPrice / tokenAPrice;

// Place sell order for B to A when tokenB is up 1%
let tokenBSellAmount = newPriceBUp - infinityTarget;
let tokenBToTokenAOut = (tokenBSellAmount * exchangeRate) / Math.pow(10, selectedDecimalsA);
let tokenBToTokenAIn = ((tokenBToTokenAOut / Math.pow(10, selectedDecimalsB)) * exchangeRate) *1.01;
let tokenAReceiveAmountLamports = tokenBToTokenAIn * Math.pow(10, selectedDecimalsB);
let estimatedMarketPriceUp = (tokenBToTokenAIn / tokenBToTokenAOut) * Math.pow(10, selectedDecimalsB);


let recieve = (infinityTarget - (infinityTarget * 1.01)) / newPriceBUp; 
let send = recieve * newPriceBUp;
let market = send / recieve;

console.log("Current Market Price: ", tokenBPrice);
console.log(`Infinity Target: ${infinityTarget}`);

console.log(`\n${selectedTokenB} up 1%: ${newPriceBUp}`);

console.log("Amount of B to send: ", send);
console.log("Amount of A to receive: ", recieve);
console.log("Calculated Market Price: ", market);
/*
console.log("Amount of B to send: ", tokenBToTokenAOut.toFixed(9));
console.log("Amount of A to receive: ", tokenAReceiveAmountLamports);
console.log("Calculated Market Price: ", estimatedMarketPriceUp);
*/
// Calculate the amount of tokenB to buy to maintain the target USD value
let tokenBBuyAmount = (infinityTarget - (infinityTarget * 0.99)) / newPriceBDown;

// Calculate the amount of tokenA to offer
let tokenAOfferAmount = tokenBBuyAmount * newPriceBDown;

// Calculate the expected market price
let expectedMarketPriceDown = tokenAOfferAmount / tokenBBuyAmount;

console.log(`\n${selectedTokenB} down 1%: ${newPriceBDown}`);
console.log("Amount of B to recieve: ", tokenBBuyAmount);
console.log("Amount of A to send: ", tokenAOfferAmount);
console.log("Calculated Market Price: ", expectedMarketPriceDown);


}


async function monitorPrice(
	selectedAddressA,
	selectedAddressB,
	tradeSizeInLamports,
	maxRetries = 5,
) {
	if (shutDown) return;
	let retries = 0;
	await updateMainDisplay();
	while (retries < maxRetries) {
		try {
			await checkOpenOrders();

			if (checkArray.length !== 2) {
				let missingKeys = [];
				let remainingKeys = []; // Adjusted to track multiple remaining keys
				const queryParams = {
					inputMint: selectedAddressA,
					outputMint: selectedAddressB,
					amount: tradeSizeInLamports,
					slippageBps: 0,
				};

				const response = await axios.get(quoteurl, {
					params: queryParams,
				});
				const newPrice = response.data.outAmount;

				if (checkArray.length === 0) {
					console.log("No orders found. Resetting.");
					await recalculateLayers(
						tradeSizeInLamports,
						spreadbps,
						newPrice,
					);
				} else if (checkArray.length === 1) {
					// Identify which key(s) are missing
					if (!checkArray.includes(buyKey)) {
						lastFilledOrder = "buy";
						missingKeys.push("Buy Key");
					} else {
						remainingKeys.push("Buy Key"); // Buy Key is not missing, so it's remaining
					}
					if (!checkArray.includes(sellKey)) {
						lastFilledOrder = "sell";
						missingKeys.push("Sell Key");
					} else {
						remainingKeys.push("Sell Key"); // Sell Key is not missing, so it's remaining
					}

					// Adjust balances and profits based on which key is missing
					if (missingKeys.includes("Buy Key")) {
						currCalcBalA =
							prevBalA -
							buyInput / Math.pow(10, selectedDecimalsA);
						currCalcBalB =
							prevBalB +
							(buyOutput * 0.999) /
								Math.pow(10, selectedDecimalsB);
						profitSumA =
							profitSumA -
							buyInput / Math.pow(10, selectedDecimalsA);
						profitSumB =
							profitSumB +
							(buyOutput * 0.999) /
								Math.pow(10, selectedDecimalsB);
						buysFilled++;
					} else if (missingKeys.includes("Sell Key")) {
						currCalcBalA =
							prevBalA +
							(sellOutput * 0.999) /
								Math.pow(10, selectedDecimalsA);
						currCalcBalB =
							prevBalB -
							sellInput / Math.pow(10, selectedDecimalsB);
						profitSumA =
							profitSumA +
							(sellOutput * 0.999) /
								Math.pow(10, selectedDecimalsA);
						profitSumB =
							profitSumB -
							sellInput / Math.pow(10, selectedDecimalsB);
						sellsFilled++;
					}
					prevBalA = currCalcBalA;
					prevBalB = currCalcBalB;

					console.log(
						"Missing Key: " +
							missingKeys[0] +
							". Resetting price points and placing new orders.",
					);
					await recalculateLayers(
						tradeSizeInLamports,
						sortedLayers
					);
				} else if (checkArray.length > 2) {
					console.log(
						"Excessive orders found, identifying valid orders and resetting.",
					);
					await recalculateLayers(
						tradeSizeInLamports,
						sortedLayers
					);
					// Here, you'd identify which orders are valid, potentially adjusting remainingKeys accordingly
				}
			} else {
				console.log("2 open orders. Waiting for change.");
				await delay(monitorDelay);
				return monitorPrice(
					selectedAddressA,
					selectedAddressB,
					tradeSizeInLamports,
					maxRetries,
				);
			}

			break; // Break the loop if we've successfully handled the price monitoring
		} catch (error) {
			console.log(error)
			console.error(
				`Error: Connection or Token Data Error (Monitor Price) - (Attempt ${retries + 1} of ${maxRetries})`,
			);
			retries++;

			if (retries === maxRetries) {
				console.error(
					"Maximum number of retries reached. Unable to retrieve data.",
				);
				return null;
			}
		}
	}
}

async function updateUSDVal(mintAddress, balance, decimals) {
	const queryParams = {
		inputMint: mintAddress,
		outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		amount: Math.floor(balance * Math.pow(10, decimals)),
		slippageBps: 0,
	};

	try {
		const response = await axios.get(quoteurl, {
			params: queryParams,
		});
		//Save USD Balance and adjust down for Lamports
		const usdBalance = response.data.outAmount / Math.pow(10, 6);
		return usdBalance;
	} catch (error) {
		// Error is not critical. 
		// Reuse the previous balances and try another update again next cycle.
	}
}

async function updateMainDisplay() {
	console.clear();
	console.log(`Jupgrid v${version}`);
	formatElapsedTime(startTime);
	console.log(
		`Settings: ${chalk.cyan(selectedTokenA)}/${chalk.magenta(selectedTokenB)} - Spread: ${spread}%`,
	);
	console.log(`-`);

	try {
		// Attempt to fetch the new USD values
		const tempUSDBalanceA = await updateUSDVal(
			selectedAddressA,
			currBalanceA,
			selectedDecimalsA,
		);
		const tempUSDBalanceB = await updateUSDVal(
			selectedAddressB,
			currBalanceB,
			selectedDecimalsB,
		);

		currUSDBalanceA = tempUSDBalanceA ?? currUSDBalanceA; // Fallback to current value if undefined
		currUSDBalanceB = tempUSDBalanceB ?? currUSDBalanceB; // Fallback to current value if undefined
		currUsdTotalBalance = currUSDBalanceA + currUSDBalanceB; // Recalculate total
	} catch (error) {
		//Error is not critical. Reuse the previous balances and try another update again next cycle.
	}

	console.log(`Starting Balance : $${initUsdTotalBalance.toFixed(2)}`);
	console.log(`Current Balance  : $${currUsdTotalBalance.toFixed(2)}`);
	let profitOrLoss = currUsdTotalBalance - initUsdTotalBalance;
	let percentageChange = (profitOrLoss / initUsdTotalBalance) * 100;
	if (profitOrLoss > 0) {
		console.log(
			`Profit : ${chalk.green(`+$${profitOrLoss.toFixed(2)} (${percentageChange.toFixed(2)}%)`)}`,
		);
	} else if (profitOrLoss < 0) {
		console.log(
			`Loss : ${chalk.red(`-$${Math.abs(profitOrLoss).toFixed(2)} (${Math.abs(percentageChange).toFixed(2)}%)`)}`,
		);
	} else {
		console.log(`Difference : $${profitOrLoss.toFixed(2)} (0.00%)`); // Neutral
	}
	console.log(`-`);

	console.log(
		`Latest Snapshot Balance ${chalk.cyan(selectedTokenA)}: ${chalk.cyan(currBalanceA.toFixed(5))}`,
	);
	console.log(
		`Latest Snapshot Balance ${chalk.magenta(selectedTokenB)}: ${chalk.magenta(currBalanceB.toFixed(5))}`,
	);
	console.log(`-`);

	console.log(`Experimental Data Below...`);
	console.log(
		`${chalk.cyan(selectedTokenA)} Calculated Change: ${chalk.cyan(profitSumA.toFixed(5))}`,
	);
	console.log(
		`${chalk.magenta(selectedTokenB)} Calculated Change: ${chalk.magenta(profitSumB.toFixed(5))}`,
	);
	console.log(`Buy Orders Filled: ${buysFilled}`);
	console.log(`Sell Orders Filled: ${sellsFilled}`);
	console.log(`Recovered Transactions: ${recoveredTransactionsCount}\n`);
}

async function recalculateLayers(tradeSizeInLamports, layers) {
    console.log("\u{1F504} Calculating new price layers");
    buyInput = tradeSizeInLamports;
    sellOutput = tradeSizeInLamports;

    let currentBuyLayer = Object.keys(layers).find(key => layers[key] === sellInput);
    let currentSellLayer = Object.keys(layers).find(key => layers[key] === buyOutput);

    if (lastFilledOrder === 'buy') {
        // Price went down, move both orders down
        currentBuyLayer = Number(currentBuyLayer) - 1;
        currentSellLayer = Number(currentSellLayer) - 1;
        console.log(`Last filled order was a buy. Moving down to layer ${currentBuyLayer} for buy order and layer ${currentSellLayer} for sell order.`);
    } else if (lastFilledOrder === 'sell') {
        // Price went up, move both orders up
        currentBuyLayer = Number(currentBuyLayer) + 1;
        currentSellLayer = Number(currentSellLayer) + 1;
        console.log(`Last filled order was a sell. Moving up to layer ${currentBuyLayer} for buy order and layer ${currentSellLayer} for sell order.`);
    } else {
        console.log(`No order has been filled yet. Setting buy order to layer ${currentBuyLayer} and sell order to layer ${currentSellLayer}.`);
    }

    sellInput = layers[currentBuyLayer];
    buyOutput = layers[currentSellLayer];

    await cancelOrder(checkArray, wallet);
    recalcs++;
}

async function sendTransactionAsync(
	input,
	output,
	inputMint,
	outputMint,
	delay,
) {
	let orderPubkey = null;
	let base = Keypair.generate();
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
				if (transaction) {
					orderPubkey = transaction.orderPubkey;
				}
				resolve();
			} catch (error) {
				console.error("Error sending transaction:", error);
				resolve(); // Resolve the promise even in case of an error to continue with the next transaction
			}
		}, delay);
	});
	return orderPubkey;
}

async function setOrders() {
	if (shutDown) return;
	console.log("");
	try {
		// Send the "buy" transactions
		if (shutDown) return;
		console.log("\u{1F4C9} Placing Buy Layer");
		const buyOrder = await sendTransactionAsync(
			buyInput,
			buyOutput,
			selectedAddressA,
			selectedAddressB,
			1000,
		);
		if (buyOrder) {
			buyKey = buyOrder;
		}

		// Send the "sell" transaction
		if (shutDown) return;
		console.log("\u{1F4C8} Placing Sell Layer");
		const sellOrder = await sendTransactionAsync(
			sellInput,
			sellOutput,
			selectedAddressB,
			selectedAddressA,
			1000,
		);
		if (sellOrder) {
			sellKey = sellOrder;
		}
		//Pause to allow Jupiter to store orders on chain
		console.log(
			"Pause for 5 seconds to allow orders to finalize on blockchain.",
		);

		await delay(5000);

		monitorPrice(selectedAddressA, selectedAddressB, tradeSizeInLamports);
	} catch (error) {
		console.error("Error:", error);
	}
}
/*
async function getTxFee(txhash) {	
	const tx = await connection.getTransaction(txhash, "confirmed");
	return tx.meta.fee;
}
*/
async function sendTx(inAmount, outAmount, inputMint, outputMint, base) {
	if (shutDown) return;

	const spinner = ora("Sending transaction...").start();

	const maxRetries = 5;
	const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	let attempt = 0;
	
	let blockHeightErrorOccurred = false; // This flag resets with each function call

	while (attempt < maxRetries) {
		attempt++;
		try {
			let PRIORITY_RATE = 100 * attempt;
			let PRIORITY_FEE_IX = solanaWeb3.ComputeBudgetProgram.setComputeUnitPrice({microLamports: PRIORITY_RATE})
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
						referralAccount: "7WGULgEo4Veqj6sCvA3VNxGgBf3EXJd8sW2XniBda3bJ",
						referralName: "Jupiter Gridbot",
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
			const { blockhash } =
				await connection.getLatestBlockhash("processed");
			transaction.recentBlockhash = blockhash;
			transaction.feePayer = wallet.publicKey;
			transaction.add(PRIORITY_FEE_IX);
			const signers = [wallet.payer, base];

			// Send and confirm the transaction
			const txid = await solanaWeb3.sendAndConfirmTransaction(
				connection,
				transaction,
				signers,
				{
					commitment: "processed",
					preflightCommitment: "processed",
				},
			);

			//let txFee = await getTxFee(txid);
			//console.log(txFee);

			spinner.succeed(`Transaction confirmed with ID: ${txid}`);
			console.log(`https://solscan.io/tx/${txid}`);
			console.log("Order Successful");
			await delay(2000);

			return {
				txid: txid,
				orderPubkey: responseData.orderPubkey,
			};
		} catch (error) {
			if (
				blockHeightErrorOccurred &&
				error.message.toLowerCase().includes("0x0")
			) {
				// Increment the global counter for recovered transactions
				recoveredTransactionsCount++;
				spinner.succeed(`Transaction confirmed, no TXID available.`);
				// Reset the block height error flag for the next use of the function
				blockHeightErrorOccurred = false;

				// Return as if successful
				return {
					//txid: txid,
					orderPubkey: responseData.orderPubkey,
				};
			} else if (
				error.message.toLowerCase().includes("block height exceeded")
			) {
				spinner.fail(
					`Attempt ${attempt} - Block height exceeded error: ${error.message}`,
				);
				blockHeightErrorOccurred = true;
				await delay(2000);
			} else {
				// Handle all other errors
				spinner.fail(
					//`Attempt ${attempt} - Error in transaction: ${error.message}`,
					spinner.fail(`Attempt ${attempt} - Error in transaction: ${error.message}, Full error: ${JSON.stringify(error, null, 2)}`),
				);
				await delay(2000);
			}
		}
	}
	//If we get here, its proper broken...
	blockHeightErrorOccurred = false;
	throw new Error("Transaction failed after maximum attempts.");
}

async function rebalanceTokens(
	inputMint,
	outputMint,
	rebalanceValue,
	rebalanceSlippageBPS,
	quoteurl,
) {
	if (shutDown) return;
	const rebalanceLamports = Math.floor(rebalanceValue);
	console.log(`Rebalancing Tokens ${selectedTokenA} and ${selectedTokenB}`);
	try {
		// Fetch the quote
		const quoteResponse = await axios.get(
			`${quoteurl}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${rebalanceLamports}&slippageBps=${rebalanceSlippageBPS}`,
		);
		//console.log(quoteResponse.data);

		const swapApiResponse = await fetch(
			"https://quote-api.jup.ag/v6/swap",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					quoteResponse: quoteResponse.data,
					userPublicKey: wallet.publicKey,
					wrapAndUnwrapSol: true,
				}),
			},
		);

		const { blockhash } = await connection.getLatestBlockhash();
		const swapData = await swapApiResponse.json();

		if (!swapData || !swapData.swapTransaction) {
			throw new Error("Swap transaction data not found.");
		}

		// Deserialize the transaction correctly for a versioned message
		const swapTransactionBuffer = Buffer.from(
			swapData.swapTransaction,
			"base64",
		);
		let transaction = VersionedTransaction.deserialize(
			swapTransactionBuffer,
		);
		//console.log(transaction);

		transaction.recentBlockhash = blockhash;
		transaction.sign([wallet.payer]);
		// Send it
		const rawTransaction = transaction.serialize();
		const txid = await connection.sendRawTransaction(rawTransaction, {
			skipPreflight: false,
			preflightCommitment: "processed",
			maxRetries: 5,
		});
		await connection.confirmTransaction(txid, "processed");
		console.log(`Transaction confirmed: https://solscan.io/tx/${txid}`);
	} catch (error) {
		console.error("Error during the transaction:", error);
	}
}

async function checkOpenOrders() {
	openOrders.length = 0;
	checkArray.length = 0;

	// Make the JSON request
	openOrders = await limitOrder.getOrders([
		ownerFilter(wallet.publicKey, "processed"),
	]);

	// Create an array to hold publicKey values
	checkArray = openOrders.map((order) => order.publicKey.toString());
}

async function cancelOrder(checkArray) {
	if (checkArray.length === 0) {
		setOrders();
		return;
	}
	const spinner = ora("Cancelling orders...").start();

	//Retry parameters
	const maxRetries = 30; // Maximum number of retries
	const cpause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	let attempt = 1; // Initialize attempt counter

	while (attempt <= maxRetries) {
		try {
			let PRIORITY_RATE = 100 * attempt;
			let PRIORITY_FEE_IX = solanaWeb3.ComputeBudgetProgram.setComputeUnitPrice({microLamports: PRIORITY_RATE})
			openOrders.length = 0;
			checkArray.length = 0;

			// Simulating your original logic to get orders
			openOrders = await limitOrder.getOrders([
				ownerFilter(wallet.publicKey, "processed"),
			]);

			checkArray = openOrders.map((order) => order.publicKey.toString());
			if (checkArray.length === 0) {
				spinner.succeed("No open orders found, resetting.");
				setOrders();
				return; // Exit if no orders need cancelling
			}

			spinner.text = "Cancelling Orders, Please Wait";

			const requestData = {
				owner: wallet.publicKey.toString(),
				feePayer: wallet.publicKey.toString(),
				orders: Array.from(checkArray),
			};

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
			transaction.add(PRIORITY_FEE_IX);
			const { blockhash } = await connection.getLatestBlockhash();
			transaction.recentBlockhash = blockhash;
			const signers = [wallet.payer];

			const txid = await solanaWeb3.sendAndConfirmTransaction(
				connection,
				transaction,
				signers,
				{
					skipPreflight: false,
					preflightCommitment: "processed",
					commitment: "processed",
				},
			);

			spinner.succeed(`Cancellation Transaction Confirmed: ${txid}`);
			console.log(`Transaction Receipt: https://solscan.io/tx/${txid}`);
			await balanceCheck();
			setOrders(); // Calls setOrders and exits if successful
			return; // Exit after successful processing
		} catch (error) {
			spinner.fail(
				`Attempt ${attempt} failed: ${error.message}, retrying...`,
			);
			if (attempt >= maxRetries) {
				spinner.fail(
					`Error canceling order after ${maxRetries} attempts: ${error.message}`,
				);
				console.error(`Final error canceling orders: ${error.message}`);
				return; // Exit function after max retries
			}
			await cpause(5000); // Exponential backoff or constant delay
			attempt++; // Increment attempt counter
		}
	}
}

async function balanceCheck() {
	//Update balances and profits
	let currentBalances = await getBalance(
		wallet,
		selectedAddressA,
		selectedAddressB,
		selectedTokenA,
		selectedTokenB,
	);
	console.log("Balances Updated");
	// Calculate profit
	profitA = currentBalances.usdBalanceA - initUsdBalanceA;
	profitB = currentBalances.usdBalanceB - initUsdBalanceB;
	currBalanceA = currentBalances.balanceA;
	currBalanceB = currentBalances.balanceB;
	currUSDBalanceA = currentBalances.usdBalanceA;
	currUSDBalanceB = currentBalances.usdBalanceB;
	currUsdTotalBalance = currUSDBalanceA + currUSDBalanceB;
	let percentageOfA = 0;
	let percentageOfB = 0;
	if (currUsdTotalBalance > 0) {
		percentageOfA = (currUSDBalanceA / currUsdTotalBalance) * 100;
		percentageOfB = (currUSDBalanceB / currUsdTotalBalance) * 100;
	}
	tokenARebalanceValue = currentBalances.tokenARebalanceValue;
	tokenBRebalanceValue = currentBalances.tokenBRebalanceValue;

	
	//Rebalancing allowed check
	if ( rebalanceAllowed && (percentageOfA < rebalancePercentage || percentageOfB < rebalancePercentage) || infinityMode ) {
		if (infinityMode) {
			if (!currUsdTotalBalance > infinityTarget) {
				console.log(`Your total balance is not high enough for your Infinity Target. Please either increase your wallet balance or reduce your target.`);
				process.exit(0); // Exit program
			}
			let targetUsdBalancePerToken = infinityTarget;
			if (currUSDBalanceB < targetUsdBalancePerToken) {
				// Calculate how much more of TokenB we need to reach the target
				let deficit = (targetUsdBalancePerToken - currUSDBalanceB) * Math.pow(10, selectedDecimalsA);
			
				// Calculate how much of TokenA we need to sell to buy the deficit amount of TokenB
				adjustmentA = -1 * deficit / tokenARebalanceValue;
			} else if (currUSDBalanceB > targetUsdBalancePerToken) {
				// Calculate how much we have exceeded the target
				let surplus = (currUSDBalanceB - targetUsdBalancePerToken) * Math.pow(10, selectedDecimalsB);
			
				// Calculate how much of TokenB we need to sell to get rid of the surplus
				adjustmentB = -1 * (surplus / tokenBRebalanceValue);
			}
			//adjustmentA = currBalanceA - targetUsdBalancePerToken;
			//adjustmentB = targetUsdBalancePerToken - currBalanceB;
			rebalanceSlippageBPS = 100;
			console.log("Infinity Mode Enabled");
		} else {
			let targetUsdBalancePerToken = currUsdTotalBalance / 2;
		adjustmentA = targetUsdBalancePerToken - currUSDBalanceA;
		adjustmentB = targetUsdBalancePerToken - currUSDBalanceB;
		}

		//console.log(adjustmentA / Math.pow(10, selectedDecimalsA))
		//console.log(adjustmentB / Math.pow(10, selectedDecimalsB))		
		if (adjustmentA < 0) {
			// Token A's USD balance is above the target, calculate how much Token A to sell
			let rebalanceValue = adjustmentA;
			if (!infinityMode) {
				rebalanceValue = (Math.abs(adjustmentA) / Math.abs(tokenARebalanceValue)) * Math.pow(10, selectedDecimalsA);
			}
			console.log(
				`Need to sell ${chalk.cyan(rebalanceValue / Math.pow(10, selectedDecimalsA))} ${chalk.cyan(selectedTokenA)} to balance.`,
			);
			await rebalanceTokens(
				selectedAddressA,
				selectedAddressB,
				Math.abs(rebalanceValue),
				rebalanceSlippageBPS,
				quoteurl,
			);
		} else if (adjustmentB < 0) {
			// Token B's USD balance is above the target, calculate how much Token B to sell
			let rebalanceValue = adjustmentB;
			if (!infinityMode) {
				rebalanceValue = (Math.abs(adjustmentB) / Math.abs(tokenBRebalanceValue)) * Math.pow(10, selectedDecimalsB);Can 
			}
			console.log(
				`Need to sell ${chalk.magenta(rebalanceValue / Math.pow(10, selectedDecimalsB))} ${chalk.magenta(selectedTokenB)} to balance.`,
			);
			await rebalanceTokens(
				selectedAddressB,
				selectedAddressA,
				Math.abs(rebalanceValue),
				rebalanceSlippageBPS,
				quoteurl,
			);
		}
	}
	balancePercentageChange =
		((currUsdTotalBalance - initUsdTotalBalance) / initUsdTotalBalance) *
		100;
	totalProfit = (profitA + profitB).toFixed(2);
	console.log(
		`Balance for Token A (${chalk.cyan(selectedTokenA)}): ${chalk.cyan(currBalanceA)}, $${chalk.cyan(currentBalances.usdBalanceA.toFixed(2))}`,
	);
	console.log(
		`Balance for Token B (${chalk.magenta(selectedTokenB)}): ${chalk.magenta(currBalanceB)}, $${chalk.magenta(currentBalances.usdBalanceB.toFixed(2))}`,
	);
	console.log(`${selectedTokenA} profit since start: $${profitA.toFixed(2)}`);
	console.log(`${selectedTokenB} profit since start: $${profitB.toFixed(2)}`);
}

process.on("SIGINT", () => {
	//console.clear();
	console.log("CTRL+C detected! Performing cleanup...");
	shutDown = true;

	(async () => {
		// Dynamically import ora
		const spinner = ora(
			"Preparing to close Jupgrid - Cancelling Orders",
		).start();

		// Retry parameters
		
		const maxRetries = 30; // Maximum number of retries
		const cpause = (ms) =>
			new Promise((resolve) => setTimeout(resolve, ms));
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			openOrders.length = 0;
			checkArray.length = 0;

			// Make the JSON request
			openOrders = await limitOrder.getOrders([
				ownerFilter(wallet.publicKey, "processed"),
			]);

			checkArray = openOrders.map((order) => order.publicKey.toString());
			if (checkArray.length === 0) {
				spinner.succeed("No open orders found, exiting now.");
				process.exit(0);
			} else {
				try {
					// Update spinner text instead of using console.log
					spinner.text = "Please Wait";
					let PRIORITY_RATE = 100 * attempt;
					let PRIORITY_FEE_IX = solanaWeb3.ComputeBudgetProgram.setComputeUnitPrice({microLamports: PRIORITY_RATE})
					const requestData = {
						owner: wallet.publicKey.toString(),
						feePayer: wallet.publicKey.toString(),
						orders: Array.from(checkArray),
					};

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
						throw new Error(
							`HTTP error! Status: ${response.status}`,
						);
					}

					const responseData = await response.json();
					const transactionBase64 = responseData.tx;
					const transactionBuf = Buffer.from(
						transactionBase64,
						"base64",
					);
					const transaction =
						solanaWeb3.Transaction.from(transactionBuf);
					const signers = [wallet.payer];
						transaction.add(PRIORITY_FEE_IX);
					const txid = await solanaWeb3.sendAndConfirmTransaction(
						connection,
						transaction,
						signers,
						{
							skipPreflight: false,
							preflightCommitment: "processed",
							commitment: "processed",
						},
					);

					spinner.succeed(
						`Cancellation Transaction Confirmed: ${txid}`,
					);
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
					// Use spinner.fail to indicate a failed attempt but keep the process alive for retries
					spinner.fail(`Attempt ${attempt} failed, retrying...`);
					await cpause(5000); // 5 sec pause

					// Restart the spinner with the original message for the next attempt
					spinner.start(
						"Preparing to close Jupgrid - Cancelling Orders",
					);
				}
			}
		}
	})();
});

export { connection, initialize };
