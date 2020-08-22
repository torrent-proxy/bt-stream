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

module.exports = {
	Dht, PeerSwarm
};
