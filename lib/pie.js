const crypto = require('crypto');
const { Readable } = require('stream');
const PieceLoader = require('./piece-loader');
const log = require('./logger')('Pie');

const CHUNK_SIZE = 16384;
const READ_STREAM_ITERATION_COUNT = 8;

const createBuffer = (piece, size, hash) => {
	const buffersPieces = Object
		.keys(piece)
		.sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
		.map((key) => piece[key]);

	const buffer = Buffer.concat(buffersPieces, buffersPieces.length * size);

	const isGood = verifyPiece(buffer, hash);
	log('verify is', isGood.toString().toUpperCase());

	return buffer;
};
let id = 0;

/**
 * @return {string}
 */
const sha1 = (data) => {
	return crypto.createHash('sha1')
		.update(data)
		.digest('hex');
};

const verifyPiece = (buffer, referenceHash) => {
	const pieceHash = sha1(buffer);
	return pieceHash === referenceHash;
};


module.exports = class Pie {
	constructor({pieces, pieceSize, firstOffset, lastLength, swarm, pieceIndexOffset}) {
		log.setPrefix(() => `ID::${this.id}::SwarmID:${swarm.id}`);

		this.id = id++;
		this._pieces = pieces;
		this._pieceSize = pieceSize;
		this._pieceIndexOffset = pieceIndexOffset;
		this._firstOffest = firstOffset;
		this._lastLength = lastLength;
		this._swarm = swarm;

		/**
		 * @type {Array<Wire>}
		 * @private
		 */
		this._wires = [];

		/**
		 * @type {?PieceLoader}
		 * @private
		 */
		this._pieceLoader = null;

		this._swarm.getWires().forEach((it) => this._onWire(it));
		this._swarm.on(this._swarm.EVENT_ADDED_WIRE, (wire) => this._onWire(wire));

		this.init();
	}

	init() {
		this._readStream = Readable.from(this._generatorPieLoader(), {
			highWaterMark: READ_STREAM_ITERATION_COUNT,
		})
	}

	/**
	 * @return {PassThrough}
	 */
	getReadStream() {
		return this._readStream;
	}

	destroy() {
		// this._removeAllWireListeners();

		if (this._readStream) {
			this._readStream.destroy();
		}

		if (this._pieceLoader) {
			this._pieceLoader.destroy();
			this._pieceLoader = null;
		}
	}

	async *_generatorPieLoader() {
		const length = this._pieces.length;

		for (let i = 0; i < length; i++) {
			const index = i;
			log(`Load piece ${index + 1} of ${length}`);

			// TODO: Иногда загрузка висит на месте.
			// TODO: скорее всего нужно убивать его спустя какое-то время.
			const pieceSize = index === length - 1 ? this._lastLength : this._pieceSize;
			const lastSize = index === length - 1 ? pieceSize % CHUNK_SIZE : CHUNK_SIZE;

			this._pieceLoader = new PieceLoader({
				swarm: this._swarm,
				wires: this._wires,
				chunkSize: CHUNK_SIZE,
				pieceIndex: index + this._pieceIndexOffset,
				pieceSize,
				lastSize,
			});

			const piece = await this._pieceLoader.load();

			this._pieceLoader.destroy();
			this._pieceLoader = null;

			const hash = this._pieces[index];
			let buffer = createBuffer(piece, CHUNK_SIZE, hash);

			if (index === 0) {
				buffer = Buffer.from(buffer.buffer, this._firstOffest % pieceSize);
			} else if (index === length - 1) {
				log(`Create buffer from last piece`);
				buffer = Buffer.from(buffer.buffer, 0, this._lastLength);
			}

			yield buffer;
		}
	}

	_onWire(wire) {
		this._wires.push(wire);

		if (this._pieceLoader) {
			this._pieceLoader.addWires([wire]);
		}
	}
};
