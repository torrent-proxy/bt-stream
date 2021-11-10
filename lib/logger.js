const fs = require('fs');
const util = require('util');

const logFilePath = `${__dirname}/logs/debug-${new Date().toISOString()}.log.md`;
const logFileWriteStream = fs.createWriteStream(logFilePath, {flags : 'w'});

const transports = {
	console: (...args) => {
		console.log(...args);
	},
	file: (...args) => {
		logFileWriteStream.write(args.reduce((acc, cur) => `${acc} ${util.format(cur)}`) + '\n');
	},
};

const send = (...args) => {
	transports.console(...args);
	transports.file(...args);
};

const createLogger = (moduleName) => {
	let prefix = null;

	const log = (...args) => {
		const time = new Date().toISOString();

		if (prefix) {
			send(time, `[${moduleName}]`, `[${prefix()}]`, ...args);
		} else {
			send(time, `[${moduleName}]`, ...args);
		}
	};

	log.info = (...args) => {
		log('INFO', ...args);
	};

	log.warn = (...args) => {
		log('WARN', ...args);
	};

	log.debug = (...args) => {
		log('DEBUG', ...args);
	};

	log.error = (...args) => {
		log('ERROR', ...args);
	};

	log.setPrefix = (prefix_) => {
		prefix = prefix_;
	};

	log.skip = () => {};

	return log;
};

module.exports = (moduleName) => createLogger(moduleName);
