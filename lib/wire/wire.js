const EventEmitter = require(`events`);

const Status = {
	BUSY: `busy`,
	FREE: `free`,
};

const Wire = class extends EventEmitter {
	constructor({wire}) {
		super();

		this._wire = wire;
		this._status = Status.FREE;
	}

	getStatus() {
		return this._status;
	}

	request({pieceIndex, offset, chunkSize, timeout}) {
		this._status = Status.BUSY;
		return new Promise((resolve, reject) => {
			const errorTimeoutId = setTimeout(() => {
				this._status = Status.FREE;
				reject(this.EVENT_ERROR_TIMEOUT);
			}, timeout);

			this._wire.request(pieceIndex, offset, chunkSize, (err, chunk) => {
				clearTimeout(errorTimeoutId);
				this._status = Status.FREE;

				if (err) {
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
