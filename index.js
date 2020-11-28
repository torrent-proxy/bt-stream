const DHT = require('bittorrent-dht');
const peerWireSwarm = require('peer-wire-swarm');
const hat = require('hat');
const {Swarm} = require('./lib/swarm');
const BTStream = require('./lib/bt-stream');

const createBTStream = ({dhtPort, hash: _hash}) => {
	const dht = new DHT();
	const id = '-FRIDGE-' + hat(48);

	let hash = _hash;
	if (hash.includes(`magnet:?xt=urn:btih:`)) {
		hash = hash.substr(`magnet:?xt=urn:btih:`.length);
	}

	const peerSwarm = new peerWireSwarm(hash, id, {size: 1000, speed: 10});

	const swarm1 = new Swarm({dht, peerSwarm, port: dhtPort, hash});
	const swarm = new Swarm({dht: new DHT(), peerSwarm: new peerWireSwarm(hash, id, {size: 1000, speed: 10}), port: dhtPort + 1, hash, swarm: swarm1});

	return new BTStream({swarm});
};

module.exports = {BTStream, createBTStream};
