## Jupiter GridBot v0.1.0

Requires Node and NPM

https://nodejs.org/en/download

https://docs.npmjs.com/downloading-and-installing-node-js-and-npm

This bot operates a gridbot, to secure trading profits from volatility in markets.
It will place 2 orders on the Jupiter DEX Limit Order Book, 1 to buy and 1 to sell.
The difference between these orders, which will be repeatedly adjusted given market volatility is your profit.
Jupiter does charge 0.1% of your order value, per order however.

Initializing the bot:

```
npm install

node jupgrid.js
```

Breakdown of Operation:

-   On first run, the bot will create a .env file for you. Please fill that in with your Private Key and your RPC connection. (Phantom Private Key and Quicknode/Alchemy used in testing.)
-   Restart the bot with node jupgrid.js
-   The bot will then gather token information from Jupiter Strict List.
-   Strict List was chosen to provide user protection against possible scam/duplicate tokens.
-   The bot will ask you for parameters on this second run. They will be saved for future use.
-   Token A - This is the ticker for the BASE token you wish to trade. This is used for pricing. Recommend you use USDC or SOL here, makes use far easier. (USDC, SOL, etc)
-   Token B - This is the ticker for the token you wish to trade for. This cannot be the same as Token A. (SOL, Bonk, JUP, ARB, etc)
-   Size - This number is relative to Token A only. For example, Token A is USDC. Entering a size of 10 will create trades for $10 (both buys and sells, Sell enough Token B to be worth $10, or spend $10 buying Token B)
-   Recommended to have at least 10-15x your size in available currencies (both TokenA and TokenB), so that if the market trends one way for a while, you will continue to be able to place orders.
-   Recommended you have as close to equal $ value of both tokens available in your wallet.
-   Spread - Spread is measured in %. The distance from the current market price (taken at bot init) to your buy OR your sell is the spread, so if you wish to place market orders 1% away from current price, enter 1 for example. 1 = 1%, 0.5 = 0.5%.
-   Jupiter takes 0.1% of each trade, so to ensure you remain profitable, > 0.5 % is recommended.
-   Try not to place the spread too tight. This is the Alpha version, and it isnt as fast as it could be, resulting in orders being filled before the bot is ready to monitor them. If this happens, you will see constant "Recalculating Orders".

Thank you VERY much for reading this, and hopefully trying my bot.

If you have any questions or concerns (Or advice!) - Please reach out to me on X at https://twitter.com/SpuddyA7X
