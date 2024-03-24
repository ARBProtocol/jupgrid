## Jupgrid: Decentralized Grid Trading Bot Version 0.3.3 Alpha (Infinity)

=======

![GitHub last commit](https://img.shields.io/github/last-commit/ARBProtocol/jupgrid) ![GitHub issues](https://img.shields.io/github/issues/ARBProtocol/jupgrid) ![GitHub number of milestones](https://img.shields.io/github/milestones/all/ARBProtocol/jupgrid) ![GitHub stars](https://img.shields.io/github/stars/ARBProtocol/jupgrid?style=social)
[![Twitter Follow](https://img.shields.io/twitter/follow/arbprotocol?style=social)](https://twitter.com/arbprotocol)

JupGrid is a cutting-edge, fully decentralized cryptocurrency grid trading bot designed to operate on the Jupiter Limit Order Book. It runs locally on your machine, offering a secure and personal way to automate a grid trading bot. This bot only places 1 buy and 1 sell order at a time, meaning you can be more capital-efficient!

Use of this bot/script is at your own risk. Use of this bot/script can lead to loss of funds, so please exercise proper due diligence and DYOR before continuing.

## Table of Contents

-   [Features](#features-)
-   [Installation](#installation-)
-   [Usage](#usage-)
-   [Configuration](#configuration-)
-   [Contributing](#contributing-)
-   [License](#license-)

## Features ✨

-   **Fully Decentralized Trading:** Operates on the Jupiter Limit Order Book, ensuring full control over your trading data and strategy.
    [Jupiter Limit Order Book](https://jup.ag/limit/SOL-USDC)
-   **Local Operation:** Runs on your own machine or a VPS, providing an additional layer of security and privacy.
-   **Simple Grid Strategy:** Places one buy order and one sell order based on user-defined parameters, optimizing for market conditions, whilst being capital efficient.
-   **Easy Setup:** Comes with a straightforward installation and setup process, including auto-creation of necessary user files.
-   **User Prompted Parameters:** Dynamically prompts the user for trading parameters, allowing for flexible and responsive trading setups.

## Installation 🔧

Download the source code by cloning it:

```bash
git clone https://github.com/ARBProtocol/jupgrid
npm install
```

## Usage 🚀

1. **Initial Setup:** Run Jupgrid for the first time to create the necessary user configuration files:

```bash
    node .
```

This will generate a `.env` file where you will fill in your secure data.

2. **Configuration:** Open the `.env` file in a text editor and input your Phantom wallet Private Key, and the URL to your RPC.

3. **Encryption:** Start Jupgrid with `node .` again. This time you will be prompted to enter a password to locally encrypt your private key and RPC connection.

4. **Start JupGrid!** Start JupGrid a 3rd time with `node .` and this time you will be prompted to enter the password you entered previously. You will then be show the start-up prompts, which allow you to modify the following parameters:

    - Token A:
    - Token B:
    - Size (In Token A):
    - Spread (% difference from current market price to orders):
    - Rebalancing (Y/N)
    - Rebalancing Threshold (% balance at which to Rebalance your holdings)-(User has $100 total, $80 in SOL and $20 USDC. Setting 20% or higher would rebalance you to approx 50/50)
    - Rebalancing Slippage (The maximum allowed slippage at which your rebalance swap can have)

Jupgrid will then place one buy and one sell order based on the parameters you have set.

## Configuration ⚙️

The `.env` file will need to contain your Phantom Wallet Private Key and URL to your RPC connection. Ensure you fill it out before running the bot for the second time:

-   `RPC_URL`=YourRPCURLHere
-   `PRIVATE_KEY`=YourPrivateKeyHere

Once these are encrypted, they are no longer human-readable. Please ensure you have other copies of this information saved elsewhere.

There will also be `userSettings.json` and `userPriceLayers.json` files created. This will contain data on the parameters you set during setup.

## Contributing 🤝

We welcome contributions from everyone! To contribute:

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Create a new Pull Request
6. ❤️

#### Follow us on Twitter: [@arbsolana](https://twitter.com/arbprotocol) for more updates.

## License 📄

This project is licensed under the MIT License - see the `LICENSE` file for details.
