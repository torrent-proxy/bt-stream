require('color');
const DHT = require('bittorrent-dht');
const crypto = require('crypto');
const peerWireSwarm = require('peer-wire-swarm');
const hat = require('hat');
const { Readable } = require('stream');

const PieceLoader = require('./piece-loader');

const DEFAULT_PORT = 8181;
const CHUNK_SIZE = 16384;
const ID = '-FRIDGE-' + hat(48);

module.exports = class Pie {
	constructor({pieces, pieceSize, bytesOffset, torrentHash, firstOffset, lastLength, bitField}) {
		this._pieces = pieces;
		this._pieceLength = this._pieces.length;
		this._pieceSize = pieceSize;
		this._offset = Math.floor(bytesOffset / pieceSize);
		this._firstOffest = firstOffset;
		this._lastLength = lastLength;

		/**
		 * @type {PassThrough}
		 * @private
		 */
		this._readStream = new Readable();
		this._readStream._read = () => {};

		/**
		 * @type {BitField}
		 * @private
		 */
		this._bitfield = bitField;

		/**
		 * @type {Swarm}
		 * @private
		 */
		this._swarm = peerWireSwarm(torrentHash, ID, {size: 1000, speed: 10});

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

		this._dht = new DHT();
		const dht = this._dht;

		dht.on('peer', (peer, infoHash, from) => {
			this._swarm.add(peer.host + ':' + peer.port)
				});
		this._swarm.on('wire', (wire) => this._onWire(wire));

		this.init();

		console.timeEnd('all');

		dht.on('error', (err) => console.error('dht error', err));
		this._swarm.on('error', (err) => console.error('swarm error', err));
		dht.listen(DEFAULT_PORT);
		this._swarm.listen(DEFAULT_PORT);

		dht.lookup(torrentHash);
	}

	async init() {
		console.time('all');

		const generator = this._generatorPieLoader();
		let item = await generator.next();
		while (!item.done) {
			item = await generator.next();
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
		this._removeAllWireListeners();
		this._dht.destroy();
		this._swarm.destroy();
		this._readStream.destroy();

		this._pieceLoader.destroy();
		this._pieceLoader = null;
	}

	/**
	 * @return {string}
	 */
	sha1(data) {
		return crypto.createHash('sha1')
			.update(data)
			.digest('hex');
	}

	async *_generatorPieLoader() {
		const loadedPieces = [];

		let length = this._pieceLength;
		console.log('_generatorPieLoader', {loadedPieces, length});
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
			console.log({time, speed: CHUNK_SIZE / time});

			this._pieceLoader.destroy();
			this._pieceLoader = null;

			let buffer = this._createBuffer(piece, CHUNK_SIZE);
			const isGood = this._verifyPiece(buffer, hash);
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

		try {
			this._readStream.end();
		} catch (e) {
			console.error(e);
		}
		this._readStream.emit('end');

		return true;
	}

	_createBuffer(piece, size) {
		const buffersPieces = Object.values(piece).map((data) => data);
		return Buffer.concat(buffersPieces, buffersPieces.length * size);
	}

	_verifyPiece(buffer, referecneHash) {
		const pieceHash = this.sha1(buffer);
		return pieceHash === referecneHash;
	}

	_onWire(wire) {
		wire.port(DEFAULT_PORT);
		wire.bitfield(this._bitfield);
		wire.interested();

		wire.on('unchoke', () => this._onUnChoke(wire));
		wire.on('error', (err) => {
			if (String(err) === 'wire is closed') {
				this._swarm.remove(wire.peerAddress);
			}
		});
	}

	_removeAllWireListeners() {
		this._wires.forEach((wire) => {
			wire.removeAllListeners();
			wire.uninterested();
		});
	}

	_onUnChoke(wire) {
		wire.setKeepAlive(true);
		this._wires.push(wire);

		if (this._pieceLoader) {
			this._pieceLoader.addWires([wire]);
		}
	}
};
