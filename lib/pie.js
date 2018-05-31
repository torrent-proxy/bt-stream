require('color');
const BitField = require('bitfield');
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
	constructor(torrent) {
		this._torrent = torrent;

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
		this._bitfield = new BitField(this._torrent.pieces.length);

		const hash = this._torrent.infoHash;

		/**
		 * @type {Swarm}
		 * @private
		 */
		this._swarm = peerWireSwarm(hash, ID, {size: 1000, speed: 10});

		/**
		 * @type {?Promise}
		 * @private
		 */
		this._wires = [];

		const dht = new DHT();

		dht.on('peer', (peer, infoHash, from) => this._swarm.add(peer.host + ':' + peer.port));
		this._swarm.on('wire', (wire) => this._onWire(wire));

		this.init();

		console.timeEnd('all');

		dht.on('error', (err) => console.error('dht error', err));
		this._swarm.on('error', (err) => console.error('swarm error', err));
		dht.listen(DEFAULT_PORT);
		this._swarm.listen(DEFAULT_PORT);

		dht.lookup(hash);
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
		// TODO: Set data to stream
		return this._readStream;
	}

	/**
	 * @return {string}
	 */
	sha1(data) {
		return crypto.createHash('sha1')
			.update(data)
			.digest('hex');
	}

	async *_generatorPieLoader () {
		const loadedPieces = [];

		while (loadedPieces !== this._torrent.pieces.length) {
			const index = loadedPieces.length;
			console.log(`####### Load ${index} of ${this._torrent.pieces.length}`);
			console.timeEnd('item');

			this._pieceLoader = new PieceLoader({
				wires: this._wires,
				chunkSize: CHUNK_SIZE,
				pieceIndex: index,
				offset: 0,
				length: this._torrent.pieceLength
			});

			const hash = this._torrent.pieces[index];
			const piece = await this._pieceLoader.load();
			// console.log(piece)
			this._pieceLoader.destructor();
			console.time('item');

			const buffer = this._createBuffer(piece, CHUNK_SIZE);
			const isGood = this._verifyPiece(buffer, hash);
			console.log('verify is', isGood);
			loadedPieces.push(1);
			this._readStream.push(buffer);

			yield true;
		}

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

	_onUnChoke(wire) {
		wire.setKeepAlive(true);
		this._wires.push(wire);
		this._pieceLoader.addWires([wire]);
	}
}
