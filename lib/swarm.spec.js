const {Swarm} = require(`./swarm`);
const {Dht, PeerSwarm} = require(`./test-mocks/mocks`);

const HASH = '30FE875E6188FD5ADFACBFBC93300D27D7461AAE';
// const HASH = '2dca8e028d7ff766162a9cbc2002ce8c6ca04555';
// const HASH = 'cb54c5f53e2b4bacdadb2d44293b9cae4df69790';
const DHT_PORT = 1234;

const createSwarm = () => {
	const dht = new Dht();
	const peerSwarm = new PeerSwarm();

	return new Swarm({hash: HASH, port: DHT_PORT, dht, peerSwarm});
};

describe(`Swarm`, () => {
	it(`Should implement the interface`, (t) => {
		const swarm = createSwarm();
		
		expect(typeof swarm.lookup).toEqual(`function`);
		expect(typeof swarm.getWires).toEqual(`function`);
		expect(typeof swarm.destroy).toEqual(`function`);
		expect(typeof swarm.on).toEqual(`function`);
		expect(typeof swarm.off).toEqual(`function`);
		expect(typeof swarm.EVENT_ADDED_WIRE).toEqual(`string`);
		expect(typeof swarm.EVENT_REMOVED_WIRE).toEqual(`string`);
		expect(typeof swarm.EVENT_WIRES_CHANGE).toEqual(`string`);
	});

	it(`Should get metadata`, (t) => {
		return new Promise((resolve) => {
			const swarm = createSwarm();

			swarm.on(swarm.EVENT_METADATA_LOADED, (event, metadata) => {
				t.is(true, true);
				resolve();
			});

			swarm.lookup();
		});
	});

	it(`Should add wire`, (t) => {
		return new Promise((resolve) => {
			const swarm = createSwarm();

			swarm.on(swarm.EVENT_ADDED_WIRE, (event, wire) => () => {});

			swarm.lookup();
		});
	});

	it(`Should remove wire`, (t) => {
		return new Promise((resolve) => {
			const swarm = createSwarm();

			swarm.on(swarm.EVENT_REMOVED_WIRE, (event, wire) => console.log());

			swarm.lookup();
		});
	});

	it(`Should change wires`, (t) => {
		return new Promise((resolve) => {
			const swarm = createSwarm();

			swarm.on(swarm.EVENT_WIRES_CHANGE, (event, wires) => console.log());

			swarm.lookup();
		});
	});

	test.todo(`Should get wires are interested`);

	test.todo(`Should call destroy disable dht`);

	test.todo(`Should call destroy disable peerSwarmProtocol`);
});
