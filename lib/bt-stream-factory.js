const DHT = require('bittorrent-dht');
const peerWireSwarm = require('./vendor/peer-wire-swarm');
const hat = require('hat');
const {Swarm} = require('./swarm');
const BTStream = require('./bt-stream');

const createBTStream = ({dhtPort, hash: _hash}) => {
	const dht = new DHT();
	const id = '-FRIDGE-' + hat(48);

	let hash = _hash;
	if (hash.includes(`magnet:?xt=urn:btih:`)) {
		hash = hash.substr(`magnet:?xt=urn:btih:`.length);
	}

	const peerSwarm = new peerWireSwarm(hash, id, {size: 1000, speed: 10});

	const swarm = new Swarm({dht, peerSwarm, port: dhtPort, hash});

	return new BTStream({swarm});
};


module.exports = {
	createBTStream,
};
