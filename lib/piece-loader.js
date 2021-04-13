const Deferred = require('./deferred');

let log = console.log
// log = () => {}

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
	log(`load chunk`, {wire: typeof wire, offset, pieceIndex, chunkSize})

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

		log({pieceSize, chunkSize, count: this._chunksCount})

		console.log(`####### start load`, {
			pieceSize,
			lastSize,
			delenie: pieceSize / chunkSize,
		});

		log(`11111!!!!!!!!!!!!!!!!! last size`, this._lastSize)

		this._piece = {};
		this._onFinishDeferred = new Deferred();
	}

	async load() {
		if (this._wires.length) {
			this._work();
		}

		await this._onFinishDeferred.promise();

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

		if (!freeWire) {
			setTimeout(() => this._work(), 100);
			return;
		}

		for (const chunkIndex of freeChunksIndex) {
			let freeWire = (() => {
				let targets = freeWires.slice().sort((a, b) => {
					return a._timeoutDiff - b._timeoutDiff;
				});

				targets = targets.slice(0, Math.round(targets.length / 2))

				return shuffle(targets)[0];
			})();

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
					log(`FAILED: id`, freeWire._id, `err`, err);

					if (String(err).indexOf(`wire is closed`) > -1) {
						this._wires = this._wires.filter((it) => it !== freeWire)
					}

					log('err', err, `work::catch::wires.length`, this._wires.length);
					delete this._piece[chunkIndex];

					log(createChunksMap(this._chunksCount, this._piece));

					return this._work();
				});
		}
	}
}


module.exports = PieceLoader;
