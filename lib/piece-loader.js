const Deferred = require('./deferred');

const log = (...args) => {
	console.log('PieceLoader::', ...args);
};

const shuffle = (array) => {
	return array.slice().sort(() => Math.random() - 0.5);
};

const createChunksMap = (count, pieces) => {
	const map = new Array(count).fill(`-`).map((it, i) => {
		if (pieces[i] === true) {
			return `0`;
		} else if (pieces[i] === undefined) {
			return `-`
		} else {
			return `x`
		}
	});

	return map.join(``);
};

const loadChunk = async ({wire, offset, pieceIndex, chunkSize}) => {
	//log(`load chunk`, {wire: typeof wire, offset, pieceIndex, chunkSize});

	// TODO: Use method Wire. Not use private property.
	if (!wire || wire._wire.peerChoking) {
		throw new Error(`Wire is not ready for load chunk`);
	}

	return await wire.request({offset, pieceIndex, chunkSize, timeout: 3000})
};

const isAllChunksDownloaded = (piece, chunksCount) => {
	const finishedItems = Object.keys(piece)
		.filter((key) => piece[key] && piece[key] !== true)
		.length;

	return finishedItems === chunksCount;
};

/**
 * @return {Array<number>}
 */
const getFreeChunksIndex = ({piece, chunksCount}) => {
	const result = [];

	for (let i = 0; i < chunksCount; i++) {
		if (!piece[i]) {
			result.push(i);
		}
	}

	return result;
};


class PieceLoader {
	constructor({swarm, wires, chunkSize, pieceIndex, pieceSize, lastSize}) {
		this._swarm = swarm;
		this._wires = wires || [];
		this._chunkSize = chunkSize;
		this._chunksCount = Math.ceil(pieceSize / chunkSize);
		this._pieceIndex = pieceIndex;
		this._lastSize = lastSize;

		this._piece = {};
		this._onFinishDeferred = new Deferred();
	}

	async load() {
		// TODO: What will happen if _wires.length === 0?
		if (this._wires.length) {
			this._work();
		}

		const now = Date.now();

		await this._onFinishDeferred.promise();

		log(`Piece is loaded`, {speed: this._chunkSize / (Date.now() - now) / 1000});

		return this._piece;
	}

	addWires(wires) {
		this._wires = this._wires.concat(wires);
		this._work();
	}

	destroy() {
		this._wires = null;
		this._piece = null;
		this._onFinishDeferred = null;
	}

	async _work() {
		const freeChunksIndex = getFreeChunksIndex({piece: this._piece, chunksCount: this._chunksCount});
		const freeWire = this._swarm.getFreeWire();

		if (!freeWire) {
			setTimeout(() => this._work(), 100);
			return;
		}

		for (const chunkIndex of freeChunksIndex) {
			this._piece[chunkIndex] = true;

			const offset = chunkIndex * this._chunkSize;
			let chunkSize = this._chunkSize;

			if (chunkIndex === Object.keys(this._piece).length - 1) {
				chunkSize = this._lastSize;
			}

			loadChunk({wire: freeWire, offset, pieceIndex: this._pieceIndex, chunkSize})
				.then((chunk) => {
					this._piece[chunkIndex] = chunk;

					if (isAllChunksDownloaded(this._piece, this._chunksCount)) {
						this._onFinishDeferred.resolve(this._piece);
						return;
					}

					return this._work();
				})
				.catch((err) => {
					log(`FAILED: id`, freeWire._id, `err`, err, `wires.length`, this._wires.length);

					if (String(err).indexOf(`wire is closed`) > -1) {
						this._wires = this._wires.filter((it) => it !== freeWire);
					}

					delete this._piece[chunkIndex];

					log('Chunk map after error', createChunksMap(this._chunksCount, this._piece));

					return this._work();
				});
		}
	}
}


module.exports = PieceLoader;
