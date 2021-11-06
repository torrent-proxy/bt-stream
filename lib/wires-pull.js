const Deferred = require('./deferred');

const deleteItem = (array, item) => {
	const i = array.indexOf(item);
	array.splice(i, 1);
};

const catchErrAsync = async (callback) => {
	let err = null;
	let result = null;

	try {
		result = await callback();
	} catch (e) {
		err = e;
	}

	return [err, result];
};

const WiresPull = class {
	constructor() {
		this._allWires = [];
		this._freeWires = [];
		this._waitingOrder = [];
	}

	addWire(wire) {
		const request = wire.request.bind(wire);

		wire.request = async (...args) => {
			if (this._freeWires.includes(wire)) {
				throw new Error('Start request after release');
			}

			const [err, result] = await catchErrAsync(async () => await request(...args));

			if (this._allWires.includes(wire)) {
				this._freeWires.push(wire);

				if (this._waitingOrder.length > 0) {
					setImmediate(() => {
						deleteItem(this._freeWires, wire);
						const getFreeWireDeferred = this._waitingOrder.shift();
						getFreeWireDeferred.resolve(wire);
					});
				}
			}

			if (err) {
				throw err;
			}

			return result;
		};

		this._allWires.push(wire);
		this._freeWires.push(wire);
	}

	async getFreeWire() {
		if (this._freeWires.length > 0) {
			const freeWire = this._freeWires.shift();

			return Promise.resolve(freeWire);
		}

		const deferred = new Deferred();
		this._waitingOrder.push(deferred);

		return deferred.promise();
	}

	removeWire(wire) {
		deleteItem(this._freeWires, wire);
		deleteItem(this._allWires, wire);
	}

	getFreeWiresCount() {
		return this._freeWires.length;
	}
};

module.exports = {
	WiresPull,
};
