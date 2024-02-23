const fs = require("fs");

// Logs are saved as logs/[unixtimestamp].json and contain a settings object and a log array
// trade objects hold a type (placed/closed), timestamp, order address,
// input/output data (mint address + token value), as well as fee paid in lamports and slot
/*
{
	"type": "placement" | "closure",
	"timestamp": number,
	"order": string,
	"input": {
		"mint": string,
		"value": number
	},
	"output": {
		"mint": string,
		"value": number
	},
	"fee": number,
	"slot": number
*/

class TradeLogger {
	constructor() {
		this.sessionstart = Date.now();
		this.filename = `logs/${this.sessionstart}.json`;
		this.initialized = false;
	}

	initLog() {
		// read userdata.json and create log object
		this.log = {
			settings: JSON.parse(fs.readFileSync("userData.json")),
			log: [],
		};

		// write initial file
		this.writeLog();

		this.initialized = true;
	}

	readLog() {
		this.log = JSON.parse(fs.readFileSync(this.filename));
	}

	writeLog() {
		fs.writeFileSync(this.filename, JSON.stringify(this.log, null, 4));
	}

	logTrade(object) {
		// validate object type
		if (object.type !== "placement" && object.type !== "closure") {
			console.error("Invalid object type");
			return;
		}
		this.readLog();
		this.log.log.push(object);
		this.writeLog();
	}
}
