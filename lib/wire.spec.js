const {Wire, Status} = require(`./wire`);


const noop = () => {};
const mockWire = {
	on: noop,
	request: noop,
	peerExtensions: {
		extended: false,
	},
};

describe(`Wire`, () => {
	it(`Should implement the interface`, () => {
		const wire = new Wire({wire: mockWire});

		expect(typeof wire.EVENT_ERROR).toEqual(`string`);
		expect(typeof wire.EVENT_ERROR_TIMEOUT).toEqual(`string`);
		expect(typeof wire.getStatus).toEqual(`function`);
		expect(typeof wire.request).toEqual(`function`);
		expect(typeof wire.leave).toEqual(`function`);

		expect(typeof wire.emit).toEqual(`function`);
		expect(typeof wire.on).toEqual(`function`);
		expect(typeof wire.off).toEqual(`function`);

		expect(typeof Status.BUSY).toEqual(`string`);
		expect(typeof Status.FREE).toEqual(`string`);
	});

	xit(`Should change status to BUSY then start request`, () => {
		const wire = new Wire({wire: mockWire});

		wire.request({timeout: 3000});

		expect(wire.getStatus()).toEqual(Status.BUSY);
	});

	xit(`Should change status to FREE then leave`, () => {
		const wire = new Wire({wire: mockWire});

		const oldStatus = wire.getStatus();

		wire.request({timeout: 3000});
		wire.leave()
			.then(() => {
				expect(wire.getStatus()).toEqual(Status.FREE);
			});

		expect(wire.getStatus()).toEqual(oldStatus);
	});

	xit(`Should return promise then call request`, () => {
		const wire = new Wire({wire: mockWire});

		const promise = wire.request({timeout: 3000});

		expect(promise instanceof Promise).toEqual(true);
	});

	xit(`Should return promise then call leave`, () => {
		const wire = new Wire({wire: mockWire});

		const promise = wire.leave();

		expect(promise instanceof Promise).toEqual(true);
	});

	xit(`Should reject request by timeout`, (t) => {
		const wire = new Wire({wire: mockWire});

		return wire.request({timeout: 100})
			.then(() => t.fail())
			.catch((err) => {
				expect(err).toEqual(wire.EVENT_ERROR_TIMEOUT);
			});
	});

	xit(`Should change status to FREE after resolve request`, () => {
		const wire = new Wire({wire: mockWire});

		return wire.request({timeout: 3000})
			.then(() => {
				expect(wire.getStatus()).toEqual(Status.FREE);
			});
	});

	xit(`Should change status to FREE after reject by timeout`, (t) => {
		const wire = new Wire({wire: mockWire});

		return wire.request({timeout: 200})
			.then(() => t.fail())
			.catch(() => {
				expect(wire.getStatus()).toEqual(Status.FREE);
			});
	});

	xit(`Should resolve request with Buffer`, () => {
		const wire = new Wire({wire: mockWire});

		return wire.request({timeout: 3000})
			.then((result) => {
				expect(result instanceof Buffer).toEqual(true);
			});
	});
});
