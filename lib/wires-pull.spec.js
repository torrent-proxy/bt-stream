const {WiresPull} = require('./wires-pull');
const {Wire} = require('./wire');
const Mock = require('./test-mocks/mocks');

describe(`WorkerBase`, () => {
	it('Should implement interface', () => {
		const wiresPull = new WiresPull();

		expect(typeof wiresPull.addWire).toEqual('function');
		expect(typeof wiresPull.getFreeWire).toEqual('function');
		expect(typeof wiresPull.getFreeWiresCount).toEqual('function');
	});

	it('Should add wire', async () => {
		const wiresPull = new WiresPull();
		const wire = new Wire({wire: new Mock.Wire()});

		expect(wiresPull.getFreeWiresCount()).toEqual(0);

		wiresPull.addWire(wire);

		expect(wiresPull.getFreeWiresCount()).toEqual(1);
	});

	it('Should async getting free wire', async () => {
		const wiresPull = new WiresPull();
		const wire = new Wire({wire: new Mock.Wire()});

		wiresPull.addWire(wire);

		const freeWire = await wiresPull.getFreeWire();

		expect(freeWire).toEqual(wire);
		expect(wiresPull.getFreeWiresCount()).toEqual(0);
	});

	it('Should set wire is free after requested', async () => {
		const wiresPull = new WiresPull();
		const wire = new Wire({wire: new Mock.Wire()});

		wiresPull.addWire(wire);

		const freeWire = await wiresPull.getFreeWire();

		expect(wiresPull.getFreeWiresCount()).toEqual(0);

		await freeWire.request({pieceIndex: 0, offset: 0, chunkSize: 1024, timeout: 1000});

		expect(wiresPull.getFreeWiresCount()).toEqual(1);
	});

	it('Not should start request after release', async () => {
		const wiresPull = new WiresPull();
		const wire = new Wire({wire: new Mock.Wire()});

		wiresPull.addWire(wire);

		const freeWire = await wiresPull.getFreeWire();

		await freeWire.request({pieceIndex: 0, offset: 0, chunkSize: 1024, timeout: 1000});

		await expect(async () => {
			await freeWire.request({pieceIndex: 0, offset: 0, chunkSize: 1024, timeout: 1000});
		}).rejects.toThrowError('Start request after release');
	});

	it('Should can second request after getting', async () => {
		const wiresPull = new WiresPull();
		const wire = new Wire({wire: new Mock.Wire()});

		wiresPull.addWire(wire);

		let freeWire = await wiresPull.getFreeWire();
		await freeWire.request({pieceIndex: 0, offset: 0, chunkSize: 1024, timeout: 1000});

		freeWire = await wiresPull.getFreeWire();
		await freeWire.request({pieceIndex: 0, offset: 0, chunkSize: 1024, timeout: 1000});

		expect(true).toBeTruthy();
	});


	it('Should get free wire too after that finished', async () => {
		const wiresPull = new WiresPull();
		const wire = new Wire({wire: new Mock.Wire()});

		wiresPull.addWire(wire);

		expect(wiresPull.getFreeWiresCount()).toEqual(1);

		const freeWire1 = await wiresPull.getFreeWire();
		const freeWirePromise = wiresPull.getFreeWire();

		expect(wiresPull.getFreeWiresCount()).toEqual(0);

		await freeWire1.request({pieceIndex: 0, offset: 0, chunkSize: 1024, timeout: 1000});

		expect(wiresPull.getFreeWiresCount()).toEqual(1);

		const freeWire2 = await freeWirePromise;

		expect(wiresPull.getFreeWiresCount()).toEqual(0);

		await freeWire2.request({pieceIndex: 0, offset: 0, chunkSize: 1024, timeout: 1000});

		expect(wiresPull.getFreeWiresCount()).toEqual(1);
		expect(freeWire1).toEqual(freeWire2);
	});

	it('Should set wire is free after error', async () => {
		const wiresPull = new WiresPull();
		const wire = new Wire({wire: new Mock.Wire({
			requestRejected: true
		})});

		wiresPull.addWire(wire);

		const freeWire = await wiresPull.getFreeWire();

		expect(wiresPull.getFreeWiresCount()).toEqual(0);

		try {
			await freeWire.request({pieceIndex: 0, offset: 0, chunkSize: 1024, timeout: 1000});
		} catch {}

		expect(wiresPull.getFreeWiresCount()).toEqual(1);
	});

	describe('Remove wire', () => {
		it('Should delete wire', async () => {
			const wiresPull = new WiresPull();
			const wire = new Wire({wire: new Mock.Wire({})});

			wiresPull.addWire(wire);
			expect(wiresPull.getFreeWiresCount()).toEqual(1);

			wiresPull.removeWire(wire);
			expect(wiresPull.getFreeWiresCount()).toEqual(0);
		});

		it('Should not added wire after request finished if wire was removed', async () => {
			const wiresPull = new WiresPull();
			const wire = new Wire({wire: new Mock.Wire({})});

			wiresPull.addWire(wire);
			const freeWire = await wiresPull.getFreeWire();
			const request = freeWire.request({pieceIndex: 0, offset: 0, chunkSize: 1024, timeout: 1000});

			wiresPull.removeWire(freeWire);

			await request;

			expect(wiresPull.getFreeWiresCount()).toEqual(0);
		});
	});
});
