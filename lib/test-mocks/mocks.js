const EventEmitter = require('events');
const bncode = require('bncode');

const noop = () => {};


const Dht = class extends EventEmitter {
	listen() {}
	lookup() {
		this.emit(`peer`, {
			peerExtensions: {
				extended: true,
			}
		});
	}
};

const Wire = class extends EventEmitter {
	constructor() {
		super();

		this.peerExtensions = {
			extended: true,
		};

		this.EVENT_EXTENDED = `extended`;
	}

	extended() {}
};

const PeerSwarm = class extends EventEmitter {
	listen() {}
	add() {
		const wire = new Wire();
		this.emit(`wire`, wire);
		setImmediate(() => wire.emit(wire.EVENT_EXTENDED, 0, bncode.encode({
			'm': {
				'ut_metadata': 1,
			},
		})));
	}
};

const Swarm = class extends EventEmitter {
	lookup() {
		setTimeout(() => {
			const torrent = {
				files: [{
					offset: 0,
				}],
				pieces: [],
				pieceSize: 0,
			};
			this.emit(`EVENT_METADATA_LOADED`, torrent)
		}, 100);
	}
	destroy() {}
	getWires() {
		return [];
	}
	get EVENT_METADATA_LOADED() {
		return `EVENT_METADATA_LOADED`;
	}
};


module.exports = {
	Dht, PeerSwarm, Swarm
};
