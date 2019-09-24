const DHT = require('bittorrent-dht');
const peerWireSwarm = require('peer-wire-swarm');
const hat = require('hat');
const {Swarm} = require('./lib/swarm/swarm');
const BTStream = require('./lib/bt-stream');

const createBTStream = ({dhtPort, hash}) => {
	const dht = new DHT();
	const id = '-FRIDGE-' + hat(48);

	const peerSwarm = new peerWireSwarm(hash, id, {size: 1000, speed: 10});

	const swarm = new Swarm({dht, peerSwarm, port: dhtPort, hash});

	return new BTStream({swarm});
};

module.exports = {BTStream, createBTStream};
