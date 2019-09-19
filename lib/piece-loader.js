const Deferred = require('./deferred');

const WireStatus = {
	BUSY: `busy`,
	FREE: `free`,
};

module.exports = class PieceLoader {
	constructor({wires, chunkSize, pieceIndex, pieceSize}) {
		this._wires = wires.map((wire) => ({wire, status: WireStatus.FREE}));
		this._chunkSize = chunkSize;
		this._chunksCount = Math.ceil(pieceSize / chunkSize);
		this._pieceIndex = pieceIndex;

		this._piece = {};
		this._onFinishDeferred = new Deferred();
	}

	async load() {
		if (this._wires.length) {
			this._work();
		}
		return this._onFinishDeferred.promise()
			.then(() => {
				return this._piece;
		});
	}

	addWires(wires) {
		this._wires = this._wires.concat(wires.map((wire) => ({ wire, status: WireStatus.FREE })));
		this._work();

		return this._onFinishDeferred.promise()
	}

	destroy() {
		this._wires = null;
		this._piece = null;
		this._onFinishDeferred = null;
	}

	_work() {
		const freePieces = this._getFreeChunksIndex();

		freePieces.forEach((pieceIndex, i) => {
			const freeWires = this._wires.filter((wire) => wire.status === WireStatus.FREE);

			if (!freeWires.length) {
				return;
			}

			const index = Math.floor(getRandomArbitrary(0, freeWires.length));
			const freeWire = freeWires[index];

			if (!freeWire) {
				return;
			}

			this._piece[pieceIndex] = true;

			const offset = pieceIndex * this._chunkSize;

			return this._loadBlock({wire: freeWire, offset})
				.then((block) => {
					this._piece[pieceIndex] = block;

					if (this._isAllChunksDownloaded(this._piece, this._chunksCount)) {
						this._onFinishDeferred.resolve(this._piece);
						console.log('wires length', this._wires.length);
						return;
					}

					this._work();
				})
				.catch((err) => {
					// console.error('err', err)
					delete this._piece[pieceIndex];
					if (err && err.message && err.message.includes('wire is closed')) {
						// TODO: Может быть можно как то переиспользовать wire
						const l = this._wires.length;
						// TODO: Добаить индекс и посмотреть.
						// TODO: Предположительно я пытаюсь удалить, то, что уже удалено
						const index = this._wires.indexOf(freeWire);
						if (index > -1) {
							this._wires.splice(index, 1);
						}
						// this._wires = this._wires.filter((wire) => wire !== freeWire);
						if (l > this._wires.length) {
							console.log('remove wire', l, this._wires.length);
						}
					}

					freeWire.wire.emit('error', pieceIndex, err);
					this._work();
				});
		});
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

	_loadBlock({wire, offset}) {
		return new Promise((resolve, reject) => {
			wire.status = WireStatus.BUSY;

			const timeoutId = setTimeout(() => reject('timeout'), 1000 * 3);

			wire.wire.request(this._pieceIndex, offset, this._chunkSize, (err, block) => {
				clearTimeout(timeoutId);
				if (err) {
					wire.status = WireStatus.FREE;
					reject(err);
				} else {
					wire.status = WireStatus.FREE;
					resolve(block);
				}
			});
		});
	}

	_isAllChunksDownloaded(piece, chunksCount) {
		const finishedItems = Object.keys(piece).filter((key) => piece[key] && piece[key] !== true).length;
		return finishedItems === chunksCount;
	}
};

function getRandomArbitrary(min, max) {
	return Math.random() * (max - min) + min;
}
