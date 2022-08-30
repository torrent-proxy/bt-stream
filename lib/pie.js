const { Readable } = require('stream');
const PieceLoader = require('./piece-loader');
const {createBuffer, verifyPiece} = require('./pie.utils');

const CHUNK_SIZE = 16384;
const READ_STREAM_ITERATION_COUNT = 8;

module.exports = class Pie {
	constructor({pieces, pieceSize, pieceOffset, firstOffset, lastLength, swarm}, {from, to}) {
		console.log('Pie::args', {pieces: pieces.length, pieceSize, pieceOffset, firstOffset, lastLength}, {from, to})
		this._pieces = pieces;
		this._pieceSize = pieceSize;
		this._pieceOffset = pieceOffset;
		this._firstBytesOffset = firstOffset;
		this._lastLength = lastLength;
		this._swarm = swarm;

		this._from = from;
		this._to = to;

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

		// TODO: Remove onWire, because all use `swarm.getFreeWires()`
		this._swarm.getWires().forEach((it) => this._onWire(it));
		this._swarm.on(this._swarm.EVENT_ADDED_WIRE, (wire) => this._onWire(wire));

		this._init();
	}

	_init() {
		console.log('pie::_init')
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
		const loadedPieces = [];

		const length = this._pieces.length;

		for (let i = 0; i < length; i++) {
			const index = i;

			// console.log(`####### Load ${index + 1} of ${length}`);

			// TODO: Иногда загрузка висит на месте.
			// TODO: скорее всего нужно убивать его спустя какое-то время.
			const pieceSize = index === length - 1 ? this._lastLength : this._pieceSize;
			const lastSize = index === length - 1 ? pieceSize % CHUNK_SIZE || CHUNK_SIZE : CHUNK_SIZE;

			// console.log('Pie::lastSize', lastSize)
			this._pieceLoader = new PieceLoader({
				swarm: this._swarm,
				chunkSize: CHUNK_SIZE,
				pieceIndex: index + this._pieceOffset,
				pieceSize,
				lastSize: lastSize === 2047 ? 2048 : lastSize,
			});

			const hash = this._pieces[index];
			const now = Date.now();

			// console.log(`####### start load`);
			console.log(`####### Load ${index + 1} of ${length}`)
			const piece = await this._pieceLoader.load();
			// console.log(`####### finish load`);

			// const time = Date.now() - now;
			// console.log({time, speed: CHUNK_SIZE / time / 1000});

			this._pieceLoader.destroy();
			this._pieceLoader = null;

			let buffer = createBuffer(piece);
			const isGood = verifyPiece(buffer, hash);
			console.log(`####### Loaded ${index + 1} of ${length}`, `TARGET`, {i, pieceSize, lastSize}, 'verify is', isGood)
			!isGood && console.log('verify is BAD!!!', isGood);

			loadedPieces.push(1);

			if (index === 0 && length > 1) {
				buffer = Buffer.from(buffer.buffer, this._firstBytesOffset % pieceSize);
				// buffer = Buffer.from(buffer.buffer, this._from);
			} else if (index === length - 1) {
				console.log(`!!!!!!!!!!!!`, `create buffer from last`);
				buffer = Buffer.from(buffer.buffer, 0, this._lastLength);
				// buffer = Buffer.from(buffer.buffer, 0, this._to);
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
