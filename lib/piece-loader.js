const EventEmitter = require('events').EventEmitter;
const crypto = require('crypto');

const Deferred = require('./deferred');

module.exports = class PieceLoader extends EventEmitter {
	constructor({wires, chunkSize, pieceIndex, offset, length, hash}) {
		super();

		this._wires = wires.map((wire) => ({wire, status: 0}));
		this._offset = offset;
		this._chunkSize = chunkSize;
		this._chunksCount = Math.ceil((length - offset) / chunkSize);
		this._pieceIndex = pieceIndex;
		this._hash = hash;
		this._piece = {};
		this._graph = this._createStartGraph(this._chunksCount);
		this._onFinishDeferred = new Deferred();
	}

	load() {
		if (this._wires.length) {
			this._work();
		}
		return this._onFinishDeferred.promise()
			.then(() => {
			const buffer = this._createBuffer(this._piece, this._chunkSize);
			console.log(buffer)
		})
			.then(() => console.timeEnd(123));
	}

	addWires(wires) {
		this._wires = this._wires.concat(wires.map((wire) => ({ wire, status: 0 })));
		this._work()
		return this._onFinishDeferred.promise()
	}

	_work() {
		const freePieces = this._getFreeChunksIndex();

		freePieces.forEach((pieceIndex, i) => {
			const freeWires = this._wires.filter((wire) => wire.status === 0);

			if (freeWires.length === 0) {
				return;
			}

			const preindex = getRandomArbitrary(0, freeWires.length);
			const index = Math.floor(preindex);
			// console.log('random', index, preindex, freeWires.length, this._wires.length);
			const freeWire = freeWires[index];

			if (!freeWire) {
				return;
			}

			this._piece[pieceIndex] = true;

			return this._loadBlock(freeWire, this._offset + pieceIndex * this._chunkSize, this._chunkSize, i)
				.then((block) => {
					this._piece[pieceIndex] = block;
					// console.log('finish', Object.keys(this._piece).length, pieceIndex, 'from', this._chunksCount, this._getFreeChunksIndex().join());
					this._graph = this._changeGraph(this._graph, pieceIndex, '+')
					// console.log(this._graph);

					const finishedItems = Object.keys(this._piece).filter((key) => this._piece[key] && this._piece[key] !== true).length;
					if (finishedItems === this._chunksCount) {
						this._onFinishDeferred.resolve();
						return;
					}

					return this._work();
				})
				.catch((err) => {
					// console.log('errrrrrrr', err)
					delete this._piece[pieceIndex];
					if (err && err.message && err.message.includes('wire is closed')) {
						// console.log('Remove wire')
						this._wires = this._wires.filter((wire) => wire !== freeWire)
					}

					// console.error(err);
					freeWire.wire.emit('error', pieceIndex, err);
					// this._wires = this._wires.filter((wire) => wire !== wire);
					return this._work();
				})
		});
	}

	_createStartGraph(count) {
		const template = '-';
		let result = '';

		for (let i = 0; i < count; i++) {
			result += template;
		}

		return result;
	}

	_changeGraph(graph, index, symbol) {
		let first = graph.substr(0, index);
		first = first + symbol;
		// console.log(first, index, symbol)
		first = first + graph.substr(index + 1);
		return first;
	}

	_createBuffer(pieces, size) {
		console.log('create buffer')
		const buffersPieces = Object.values(pieces).map((data) => data);
		const b = Buffer.concat(buffersPieces, buffersPieces.length * size);

		const pieceHash = sha1(b);
		console.log(pieceHash);
		console.log(this._hash);
		console.log('verify:', pieceHash === this._hash);

		return b;
	}

	/**
	 * @return {Array<number>}
	 */
	_getFreeChunksIndex() {
		const result = [];
		for (let i = 0; i < this._chunksCount; i++) {
			if (!this._piece[i]) {
				result.push(i);
			}
		}
		return result;
	}

	_loadBlock(wire, offset, length) {
		// console.log('load block')
		return new Promise((resolve, reject) => {
			wire.status = 1;

			setTimeout(() => reject('timeout'), 1000 * 3);

			wire.wire.request(this._pieceIndex, offset, length, (err, block) => {
				if (err) {
					// console.error(err);
					wire.status = 0;
					reject(err);
				} else {
					wire.status = 0;
					resolve(block);
				}
			})
		});
	}
}

function getRandomArbitrary(min, max) {
	return Math.random() * (max - min) + min;
}

function sha1(data) {
	return crypto.createHash('sha1').update(data).digest('hex');
}