require('color');
const BitField = require('bitfield');
const DHT = require('bittorrent-dht');
const PassThrough = require('stream').PassThrough;
const crypto = require('crypto');
const peerWireSwarm = require('peer-wire-swarm');
const hat = require('hat');

const PieceLoader = require('./piece-loader');

const DEFAULT_PORT = 8181;
const CHUNK_SIZE = 16384;
const ID = '-FRIDGE-' + hat(48);

module.exports = class Pie {
	constructor(torrent) {
		this._torrent = torrent;

		/**
		 * @type {number}
		 * @private
		 */
		this._piecesCount = torrent.pieceLength;

		/**
		 * @type {Buffer}
		 * @private
		 */
		this._pie = Buffer.alloc(this._piecesCount);

		/**
		 * @type {PassThrough}
		 * @private
		 */
		this._rs = new PassThrough();

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

		console.time('all');
		this._torrent.pieces.reduce((result, current, index) => {
			return result.then(() => {
				console.log(`####### Load ${index} of ${this._torrent.pieces.length}`);
				console.timeEnd('item');
				this._pieceLoader = new PieceLoader({
					wires: this._wires,
					chunkSize: CHUNK_SIZE,
					pieceIndex: index,
					offset: 0,
					length: this._torrent.pieceLength,
					hash: this._torrent.pieces[index]
				});
				console.time('item');
				return this._pieceLoader.load();
			});
		}, Promise.resolve()).then(() => console.timeEnd('all'));


		dht.on('error', (err) => console.error('dht error', err));
		this._swarm.on('error', (err) => console.error('swarm error', err));
		dht.listen(DEFAULT_PORT);
		this._swarm.listen(DEFAULT_PORT);

		dht.lookup(hash);
	}

	/**
	 * @return {PassThrough}
	 */
	getReadStream() {
		// TODO: Set data to stream
		return this._rs;
	}

	/**
	 * @return {string}
	 */
	sha1() {
		return crypto.createHash('sha1')
			.update(this._pie)
			.digest('hex');
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
		this._wires.push(wire);
		this._pieceLoader.addWires([wire]);
	}
}
