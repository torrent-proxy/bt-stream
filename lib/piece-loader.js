const Deferred = require('./deferred');
const log = require('./logger')('PieceLoader');

const REQUEST_TIMEOUT = 1000 * 3;

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
	log(`load chunk`, {wire: typeof wire, offset, pieceIndex, chunkSize});

	// TODO: Use method Wire. Not use private property.
	if (!wire || wire._wire.peerChoking) {
		throw new Error(`Wire is not ready for load chunk`);
	}

	return await wire.request({offset, pieceIndex, chunkSize, timeout: REQUEST_TIMEOUT})
};

const isAllChunksDownloaded = (piece, chunksCount) => {
	const finishedItems = Object.keys(piece)
		.filter((key) => piece[key] && piece[key] !== true)
		.length;

	log('isAllChunksDownloaded::', {finishedItems, chunksCount}, finishedItems === chunksCount)
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
	constructor({swarm, chunkSize, pieceIndex, pieceSize, lastSize}) {
		this._swarm = swarm;
		this._chunkSize = chunkSize;
		// TODO: Возможно на последнем куске количество чанков считается неверно
		this._chunksCount = Math.ceil(pieceSize / chunkSize);
		this._pieceIndex = pieceIndex;
		this._lastSize = lastSize;

		log(`PieceLoader::constructor`, {pieceIndex, chunkSize, _chunksCount: this._chunksCount, pieceSize, lastSize})
		log('PieceLoader', {chunkSize, pieceIndex, pieceSize, lastSize, count: this._chunksCount});

		this._piece = {};
		this._onFinishDeferred = new Deferred();
	}

	async load() {
		this._work();

		await this._onFinishDeferred.promise();

		return this._piece;
	}

	addWires() {
		this._work();
	}

	destroy() {
		this._piece = null;
		this._onFinishDeferred = null;
	}

	async _work2() {
		const freeChunksIndex = [];
		const parallels = createParallels({taskCountInTime: 8});

		for (const chunkIndex of freeChunksIndex) {
			parallels.add(() => loadChunk(chunkIndex));
		}

		parallels.run();
		await parallels.complete();
		await parallels.next();

		const piece = {};
		const result = parallels.getTasksResult();

		for (let i = 0; i < result.length; i++) {
			piece[i] = result[i];
		}
	}

	async _work() {
		const freeChunksIndex = getFreeChunksIndex({piece: this._piece, chunksCount: this._chunksCount});
		const freeWire = this._swarm.getFreeWire();

		if (!freeWire) {
			setTimeout(() => this._work(), 100);
			return;
		}

		for (const chunkIndex of freeChunksIndex) {
			log('_work::', {chunkIndex, freeChunksIndex});
			this._piece[chunkIndex] = true;

			const offset = chunkIndex * this._chunkSize;
			let chunkSize = this._chunkSize;

			// Почему то все чанки получаются длиной последнего чанка - 2000 против 16000
			// Возможно дело в проверке ниже

			if (chunkIndex === this._chunksCount - 1) {
				chunkSize = this._lastSize;
			}

			loadChunk({wire: freeWire, offset, pieceIndex: this._pieceIndex, chunkSize})
				.then((chunk) => {
					this._piece[chunkIndex] = chunk;

					if (isAllChunksDownloaded(this._piece, this._chunksCount)) {
						this._onFinishDeferred.resolve(this._piece);
						return;
					}

					log(createChunksMap(this._chunksCount, this._piece));

					this._work();
				})
				.catch((err) => {
					log.error(`FAILED: id`, freeWire._id, `err`, err, `wires.length`, this._swarm._wires.length);

					log('err', err, `work::catch::wires.length`, this._swarm._wires.length);
					delete this._piece[chunkIndex];

					log('Chunk map after error', createChunksMap(this._chunksCount, this._piece));

					this._work();
				});
		}
	}
}


module.exports = PieceLoader;
