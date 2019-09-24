const test = require(`ava`);
const {Swarm} = require(`../swarm`);
const {Dht, PeerSwarm} = require(`./mocks`);

const HASH = '30FE875E6188FD5ADFACBFBC93300D27D7461AAE';
// const HASH = '2dca8e028d7ff766162a9cbc2002ce8c6ca04555';
// const HASH = 'cb54c5f53e2b4bacdadb2d44293b9cae4df69790';
const DHT_PORT = 1234;

const createSwarm = () => {
	const dht = new Dht();
	const peerSwarm = new PeerSwarm();

	return new Swarm({hash: HASH, port: DHT_PORT, dht, peerSwarm});
};

test(`Should implement the interface`, (t) => {
	const swarm = createSwarm();

	t.is(`function`, typeof swarm.lookup);
	t.is(`function`, typeof swarm.getWires);
	t.is(`function`, typeof swarm.destroy);
	t.is(`function`, typeof swarm.on);
	t.is(`function`, typeof swarm.off);
	t.is(`string`, typeof swarm.EVENT_ADDED_WIRE);
	t.is(`string`, typeof swarm.EVENT_REMOVED_WIRE);
	t.is(`string`, typeof swarm.EVENT_WIRES_CHANGE);
});

test(`Should get metadata`, (t) => {
	return new Promise((resolve) => {
		const swarm = createSwarm();

		swarm.on(swarm.EVENT_METADATA_LOADED, (event, metadata) => {
			t.is(true, true);
			resolve();
		});

		swarm.lookup();
	});
});

test.skip(`Should add wire`, (t) => {
	return new Promise((resolve) => {
		const swarm = createSwarm();

		swarm.on(swarm.EVENT_ADDED_WIRE, (event, wire) => () => {});

		swarm.lookup();
	});
});

test.skip(`Should remove wire`, (t) => {
	return new Promise((resolve) => {
		const swarm = createSwarm();

		swarm.on(swarm.EVENT_REMOVED_WIRE, (event, wire) => console.log());

		swarm.lookup();
	});
});

test.skip(`Should change wires`, (t) => {
	return new Promise((resolve) => {
		const swarm = createSwarm();

		swarm.on(swarm.EVENT_WIRES_CHANGE, (event, wires) => console.log());

		swarm.lookup();
	});
});

test.todo(`Should get wires are interested`);

test.todo(`Should call destroy disable dht`);

test.todo(`Should call destroy disable peerSwarmProtocol`);
