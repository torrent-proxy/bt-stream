const EventEmitter = require('events');


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

const PeerSwarm = class extends EventEmitter {
	listen() {}
	add() {
		this.emit(`wire`, {});
	}
};

const Swarm = class extends EventEmitter {
	lookup() {
		setTimeout(() => {
			const torrent = {};
			this.emit(`EVENT_METADATA_LOADED`, torrent)
		}, 100);
	}
	destroy() {}
	get EVENT_METADATA_LOADED() {
		return `EVENT_METADATA_LOADED`;
	}
};


module.exports = {
	Dht, PeerSwarm, Swarm
};
