const readline = require("readline");

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

module.exports = {
	delay,
	questionAsync,
	rl,
};
