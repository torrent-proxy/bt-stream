const EventEmitter = require(`events`);
const log = require('./logger')('Wire');

const MAX_REQUESTS_COUNT = 2;
const Status = {
	BUSY: `busy`,
	FREE: `free`,
};

let id = 0;

const Wire = class extends EventEmitter {
	constructor({wire}) {
		super();

		this._wire = wire;
		this._id = id++;
		this._status = Status.FREE;
		this._requestsCount = 0;
		this._timeoutDiff = 0;

		this._wire.on(`close`, () => {
			this._closed = true;
		});

		this._wire.on('choke', () => {
			this._closed = true;
		});

		this._wire.on('unchoke', () => {
			this._closed = false;
		});
	}

	getStatus() {
		if (this._status === Status.BUSY) {
			return this._status;
		}

		if (this._closed) {
			return Status.BUSY;
		}

		return this._status;
	}

	request({pieceIndex, offset, chunkSize, timeout}) {
		return new Promise((resolve, reject) => {
			if (this.getStatus() === Status.BUSY) {
				reject(Status.BUSY);
				return;
			}

			this._requestsCount = this._requestsCount + 1;

			if (this._requestsCount > MAX_REQUESTS_COUNT) {
				this._status = Status.BUSY;
			}

			const errorTimeoutId = setTimeout(() => {
				this._status = Status.FREE;
				this._requestsCount = this._requestsCount - 1;
				this._timeoutDiff = this._timeoutDiff + 100;

				reject(this.EVENT_ERROR_TIMEOUT + ':' + (timeout + this._timeoutDiff));
			}, timeout + this._timeoutDiff);

			this._wire.request(pieceIndex, offset, chunkSize, (err, chunk) => {
				clearTimeout(errorTimeoutId);

				this._status = Status.FREE;
				this._requestsCount = this._requestsCount - 1;

				if (err) {
					log.debug(`@#@!#!@#!@#!@#`, err);
					if (err.message.includes('wire is closed')) {
						this._closed = true;
					}
					reject(err);
				} else {
					resolve(chunk);
				}
			});
		});
	}

	leave() {
		return new Promise((resolve) => {
			this._status = Status.FREE;
			resolve();
		});
	}

	get EVENT_ERROR() {
		return `error`;
	}
	get EVENT_ERROR_TIMEOUT() {
		return `error-timeout`;
	}
};


module.exports = {Wire, Status};
