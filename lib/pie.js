const crypto = require('crypto');
const { Readable } = require('stream');

const PieceLoader = require('./piece-loader');

const CHUNK_SIZE = 16384;

const createBuffer = (piece, size) => {
	const buffersPieces = Object.values(piece).map((data) => data);
	return Buffer.concat(buffersPieces, buffersPieces.length * size);
};

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
	constructor({pieces, pieceSize, bytesOffset, firstOffset, lastLength, swarm}) {
		this._pieces = pieces;
		this._pieceSize = pieceSize;
		this._offset = Math.floor(bytesOffset / pieceSize);
		this._firstOffest = firstOffset;
		this._lastLength = lastLength;
		this._swarm = swarm;

		/**
		 * @type {PassThrough}
		 * @private
		 */
		this._readStream = new Readable();
		this._readStream._read = () => {};
		this._readStream.on(`end`, () => this.destroy());

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

	async init() {
		console.time('all');

		const generator = this._generatorPieLoader();
		let item = await generator.next();
		while (!item.done) {
			console.time(`generator`)
			item = await generator.next();
			console.timeEnd(`generator`)
		}

		console.timeEnd('all');
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
		const loadedPieces = [];

		let length = this._pieces.length;
		while (loadedPieces.length !== length) {
			const index = loadedPieces.length;
			console.log(`####### Load ${index + 1} of ${length}`);

			// TODO: Иногда загрузка висит на месте.
			// TODO: скорее всего нужно убивать его спустя какое-то время.
			this._pieceLoader = new PieceLoader({
				wires: this._wires,
				chunkSize: CHUNK_SIZE,
				pieceIndex: index + this._offset,
				pieceSize: this._pieceSize
			});

			const hash = this._pieces[index];
			const now = Date.now();

			const piece = await this._pieceLoader.load();

			const time = Date.now() - now;
			console.log({time, speed: CHUNK_SIZE / time / 1000});

			this._pieceLoader.destroy();
			this._pieceLoader = null;

			let buffer = createBuffer(piece, CHUNK_SIZE);
			const isGood = verifyPiece(buffer, hash);
			console.log('verify is', isGood);
			loadedPieces.push(1);

			if (index === 0) {
				buffer = Buffer.from(buffer.buffer, this._firstOffest);
			} else if (index === this._pieces.length - 1) {
				buffer = Buffer.from(buffer, 0, this._lastLength);
			}

			this._readStream.push(buffer);

			yield true;
		}

		this._readStream.emit('end');

		return true;
	}

	_onWire(wire) {
		this._wires.push(wire);

		if (this._pieceLoader) {
			this._pieceLoader.addWires([wire]);
		}
	}
};
