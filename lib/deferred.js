module.exports = class {
	constructor() {
		/**
		 * @type {function(*): undefined}
		 */
		this._resolve;

		/**
		 * @type {function(*): undefined}
		 */
		this._reject;

		/**
		 * @type {Promise<>}
		 * @private
		 */
		this._promise = new Promise((resolve, reject) => {
			this._resolve = resolve;
			this._reject = reject;
		});
	}

	promise() {
		return this._promise;
	}

	resolve(data) {
		return this._resolve(data);
	}

	reject(data) {
		return this._reject(data);
	}
}
