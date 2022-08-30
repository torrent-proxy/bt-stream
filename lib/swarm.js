const BitField = require('bitfield');
const EventEmitter = require(`events`);
const bncode = require(`bncode`);
const parseTorrent = require(`parse-torrent`);
const exchangeMetadata = require(`./exchange-metadata`);
const {Wire, Status: WireStatus} = require(`./wire`);
const log = require('./logger')('Swarm');

const shuffle = (array) => {
	return array.slice().sort(() => Math.random() - 0.5);
};

const Swarm = class extends EventEmitter {
	constructor({dht, peerSwarm, port, hash}) {
		super();

		this._dht = dht;
		this._peerSwarm = peerSwarm;
		this._hash = hash;
		this._port = port;
		this._wires = [];
		this._bitfield = null;

		this._onPeer = this._onPeer.bind(this);
		this._onWire = this._onWire.bind(this);

		this._peerSwarm.on(`wire`, this._onWire);
		this._dht.on(`peer`, this._onPeer);

		this.on(this.EVENT_WIRES_CHANGE, (wires) => {
			log(`wires::length`, wires.length)
		});
	}

	lookup() {
		log(`lookup`);
		this._dht.listen(this._port);
		this._peerSwarm.listen(this._port);
		this._dht.lookup(this._hash);
	}

	getWires() {
		log(`getWires`);
		return this._wires;
	}

	getFreeWires() {
		log(`getFreeWires`);
		return this._wires.filter((wire) => wire.getStatus() === WireStatus.FREE);
	}

	getFreeWire() {
		let targets = this.getFreeWires().slice().sort((a, b) => {
			return a._timeoutDiff - b._timeoutDiff;
		});

		return shuffle(targets)[0] || null;
	}

	destroy() {
		log(`destroy`);
		this._dht.off(`peer`, this._onPeer);
		this._peerSwarm.off(`wire`, this._onWire);

		this._dht.destroy();
		this._peerSwarm.destroy();
	}

	_onPeer(peer, infoHash, from) {
		log(`_onPeer`);
		this._peerSwarm.add(peer.host + `:` + peer.port);
	}

	_onWire(wire) {
		log(`_onWire`);
		if (!this._bitfield) {
			exchangeMetadata({infoHash: this._hash}, (metadata) => {
				const buf = bncode.encode({
					info: bncode.decode(metadata),
					'announce-list': []
				});

				const torrent = parseTorrent(buf);

				this._bitfield = new BitField(torrent.pieces.length);
				this._wirePreprocessing({wire, port: this._port, bitfield: this._bitfield});

				this.emit(this.EVENT_METADATA_LOADED, torrent);
			})(wire);
		} else {
			this._wirePreprocessing({wire, port: this._port, bitfield: this._bitfield});
		}
	}

	_wirePreprocessing({wire, port, bitfield}) {
		wire.on(`error`, (err) => {
			if (String(err).indexOf(`wire is closed`) > -1) {
				// TODO: Отписать wire от всех событий. Иначе его может не забрать GC
				this._peerSwarm.remove(wire.peerAddress);
				log(`pre removing`, this._wires.length)
				this._wires = this._wires.filter((it) => it._wire !== wire);
				log(`post removing`, this._wires.length)

				this.emit(this.EVENT_REMOVED_WIRE, wire);
				this.emit(this.EVENT_WIRES_CHANGE, this._wires);
			}
		});

		wire.on(`close`, (err) => {
			log(`_wirePreprocessing::onclose::wire`);
			// TODO: Отписать wire от всех событий. Иначе его может не забрать GC
			this._peerSwarm.remove(wire.peerAddress);
			this._wires = this._wires.filter((it) => it._wire !== wire);

			this.emit(this.EVENT_REMOVED_WIRE, wire);
			this.emit(this.EVENT_WIRES_CHANGE, this._wires);
		});

		wire.port(port);
		wire.bitfield(bitfield);
		wire.interested();

		wire.on(`unchoke`, () => {
			wire.setKeepAlive(true);

			// TODO: хранить все вирес и унчокет вирес
			this._wires = this._wires.concat(new Wire({wire}));

			this.emit(this.EVENT_ADDED_WIRE, this._wires[this._wires.length - 1]);
			this.emit(this.EVENT_WIRES_CHANGE, this._wires);
		});

		// wire.on(`close`, () => {
		// 	this._peerSwarm.remove(wire.peerAddress);
		// 	this._wires = this._wires.filter((it) => it !== wire);
		//
		// 	this.emit(this.EVENT_REMOVED_WIRE, wire);
		// 	this.emit(this.EVENT_WIRES_CHANGE, this._wires);
		// })
	}

	_removeAllWireListeners() {
		// TODO: Do it
		this._wires.forEach((wire) => {
			wire.removeAllListeners();
			wire.uninterested();
		});
	}

	get EVENT_ADDED_WIRE() {
		return `EVENT_ADDED_WIRE`;
	}
	get EVENT_REMOVED_WIRE() {
		return `EVENT_REMOVED_WIRE`;
	}
	get EVENT_WIRES_CHANGE() {
		return `EVENT_WIRES_CHANGE`;
	}
	get EVENT_METADATA_LOADED() {
		return `EVENT_METADATA_LOADED`;
	}
};

module.exports = {Swarm};
