// API server for custom frontends/webuis

const express = require("express");

class APIServer {
	constructor(tradelogger) {
		this.app = express();
		this.tradelog = tradelogger;

		this.app.use(express.json());

		this.app.get("/log", (req, res) => {
			res.send(this.tradelog.log);
		});
	}

	start() {
		this.app.listen(3333, () => {
			console.log("API Server listening on port 3333");
		});
	}
}

module.exports = {
	APIServer,
};
