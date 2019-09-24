const EventEmitter = require(`events`);
const bncode = require(`bncode`);
const parseTorrent = require(`parse-torrent`);
const exchangeMetadata = require(`../exchange-metadata`);


const Swarm = class extends EventEmitter {
	constructor({dht, peerSwarm, port, hash}) {
		super();

		this._dht = dht;
		this._peerSwarm = peerSwarm;
		this._hash = hash;
		this._torrent = null;
		this._wires = [];

		this._onPeer = this._onPeer.bind(this);
		this._onWire = this._onWire.bind(this);

		this._peerSwarm.on(`wire`, this._onWire);
		this._dht.on(`peer`, this._onPeer);

		this._dht.listen(port);
		this._peerSwarm.listen(port);
	}

	lookup() {
		this._dht.lookup(this._hash);
	}

	getWires() {
		return this._wires;
	}

	destroy() {
		// TODO: destroy swarm
		throw Error(`Method not implemented: destroy`);
	}

	_onPeer(peer, infoHash, from) {
		this._peerSwarm.add(peer.host + `:` + peer.port);
	}

	_onWire(wire) {
		wire.on(`error`, (err) => {
			if (String(err) === `wire is closed`) {
				this._peerSwarm.remove(wire.peerAddress);
				this._wires = this._wires.filter((it) => it !== wire);

				this.emit(this.EVENT_REMOVED_WIRE, wire);
				this.emit(this.EVENT_WIRES_CHANGE, this._wires);
			}
		});

		if (!this._torrent) {
			exchangeMetadata({infoHash: this._hash}, (metadata) => {
				const buf = bncode.encode({
					info: bncode.decode(metadata),
					'announce-list': []
				});

				this._torrent = parseTorrent(buf);
				this.emit(this.EVENT_METADATA_LOADED, this._torrent);
			})(wire);
		}

		this._wires = this._wires.concat(wire);

		this.emit(this.EVENT_ADDED_WIRE, wire);
		this.emit(this.EVENT_WIRES_CHANGE, this._wires);
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
