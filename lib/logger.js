const transports = {
	console: (...args) => {
		console.log(...args);
	},
	file: (...args) => {
		// TODO
	},
};

const send = transports.console;

const createLogger = (moduleName) => {
	let prefix = null;

	const log = (...args) => {
		if (prefix) {
			send(moduleName, prefix(), ...args);
		} else {
			send(moduleName, ...args);
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

	return log;
};

module.exports = (moduleName) => createLogger(moduleName);
