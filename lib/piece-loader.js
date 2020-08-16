const Deferred = require('./deferred');
let indexx = 0;
const WireStatus = {
	BUSY: `busy`,
	FREE: `free`,
};

let log = console.log
log = () => {}

const ISource = {
	ondata() {},
	onend() {},
	pause() {},
	resume() {},
	destroy() {},
}

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

const foo = () => {
	class SourceWrapper extends Readable {
		constructor(source, options) {
			super(options);

			this._source = source;

			// Every time there's data, push it into the internal buffer.
			this._source.ondata = (chunk) => {
				// If push() returns false, then stop reading from source.
				if (!this.push(chunk))
					this._source.destoy();
			};

			// When the source ends, push the EOF-signaling `null` chunk.
			this._source.onend = () => {
				this.push(null);
			};
		}
		// _read() will be called when the stream wants to pull more data in.
		// The advisory size argument is ignored in this case.
		_read(size) {
			this._source.resume();
		}
	}
}

const loadChunk = ({wire, offset, pieceIndex, chunkSize}) => {
	log(`load chunk`, {wire: typeof wire, offset, pieceIndex, chunkSize})
	return new Promise((resolve, reject) => {
		// wire.status = WireStatus.BUSY;

		// const timeoutId = setTimeout(() => reject('timeout'), 1000 * 3);

		// wire.wire.request(pieceIndex, offset, chunkSize, (err, chunk) => {
		// 	clearTimeout(timeoutId);
		// 	if (err) {
		// 		wire.status = WireStatus.FREE;
		// 		reject(err);
		// 	} else {
		// 		wire.status = WireStatus.FREE;
		// 		resolve(chunk);
		// 	}
		// });

		if (!wire || wire._wire.peerChoking) {
			return;
		}
		wire.request({offset, pieceIndex, chunkSize, timeout: 3000})
			.then(resolve, reject);
	});
};

const isAllChunksDownloaded = (piece, chunksCount) => {
	const finishedItems = Object.keys(piece).filter((key) => piece[key] && piece[key] !== true).length;
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

const getRandomArbitrary = (min, max) => {
	return Math.random() * (max - min) + min;
};

const getFreeWires = (getWires) => {
	return new Promise((resolve, reject) => {
		const freeWires = getWires().filter((wire) => wire.getStatus() !== WireStatus.BUSY);

		log(`load2::getFreeWires::length`, freeWires.length)
		if (freeWires.length) {
			resolve(freeWires);
			return null;
		}

		setTimeout(() => {
			log(`load2::getFreeWires::setTimeout`)
			getFreeWires(getWires).then(resolve);
		}, 100);
	});
};

const getFreeWire = (freeWires) => {
	const index = Math.floor(getRandomArbitrary(0, freeWires.length - 1));
	return freeWires[index];
}

module.exports = class PieceLoader {
	constructor({swarm, wires, chunkSize, pieceIndex, pieceSize, lastSize}) {
		this._swarm = swarm;
		this._wires = wires || [];
		this._chunkSize = chunkSize;
		this._chunksCount = Math.ceil(pieceSize / chunkSize);
		log({pieceSize, chunkSize, count: this._chunksCount})
		this._pieceIndex = pieceIndex;
		this._lastSize = lastSize;

		console.log(`####### start load`, {
			pieceSize,
			lastSize,
			delenie: pieceSize / chunkSize,
		});

		log(`11111!!!!!!!!!!!!!!!!! last size`, this._lastSize)

		this._piece = {};
		this._onFinishDeferred = new Deferred();
	}
/*
	async load2() {
		return
		log(`load2::head`)

		const freeChunksIndexes = getFreeChunksIndex({piece: this._piece, chunksCount: this._chunksCount});

		const dododo = [];

		for (const chunkIndex of freeChunksIndexes) {
			const dodo = async () => {
				try {
					const freeWires = await getFreeWires(() => this._wires);
					if (freeWires.length === 0) {
						log(`!!!!!!!!!!!!!!!!!!!!!!!!!!! length is 0`)
					}
					const freeWire = getFreeWire(freeWires);
					if (!freeWire) {
						log(`!!!!!!!!!!!!!!!!!!!!!!!!!!! wire is undefined`)
					}
					log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!`, {freeWire})

					const offset = chunkIndex * this._chunkSize;
					let chunkSize = this._chunkSize;

					console.log(`CHUNK INDEX`, chunkIndex)

					if (chunkIndex === this._piece.length - 1) {
						log(`APPLY LAST SIZE`)
						chunkSize = this._lastSize;
					}

					this._piece[chunkIndex] = await loadChunk({
						wire: freeWire, offset, pieceIndex: this._pieceIndex, chunkSize
					});
				} catch (e) {
					await dodo();
				}
			};

			dododo.push(dodo());
		}

		await Promise.all(dododo);

		this._onFinishDeferred.resolve(this._piece);

		log(`!!!!!!finish`, dododo.length);
	}
*/
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
		// this._wires = this._wires.concat(wires.map((wire) => ({ wire, status: WireStatus.FREE })));
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

		const freeWires = this._swarm.getFreeWires();
		if (!freeWires.length) {
			return;
		}

		for (const chunkIndex of freeChunksIndex) {
			const freeWire = (() => {
				let targets = freeWires.slice().sort((a, b) => {
					return a._timeoutDiff - b._timeoutDiff;
				});

				targets = targets.slice(0, Math.round(targets.length / 2))
				function shuffle(array) {
					return array.slice().sort(() => Math.random() - 0.5);
				}

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
					log(`FAILED: id`, freeWire._id, `err`, err)
					if (String(err).indexOf(`wire is closed`) > -1) {
						this._wires = this._wires.filter((it) => it !== freeWire)
					}
					log('err', err, `work::catch::wires.length`, this._wires.length)
					delete this._piece[chunkIndex];

					log(createChunksMap(this._chunksCount, this._piece))

					return this._work();
				});
		}
	}
};
