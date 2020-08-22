const test = require(`ava`);
const {Wire, Status} = require(`../wire`);

test(`Should implement the interface`, (t) => {
	const wire = new Wire();

	t.is(`string`, typeof wire.EVENT_ERROR);
	t.is(`string`, typeof wire.EVENT_ERROR_TIMEOUT);
	t.is(`function`, typeof wire.getStatus);
	t.is(`function`, typeof wire.request);
	t.is(`function`, typeof wire.leave);

	t.is(`function`, typeof wire.emit);
	t.is(`function`, typeof wire.on);
	t.is(`function`, typeof wire.off);

	t.is(`string`, typeof Status.BUSY);
	t.is(`string`, typeof Status.FREE);
});

test(`Should change status to BUSY then start request`, (t) => {
	const wire = new Wire();

	wire.request({timeout: 3000});

	t.is(Status.BUSY, wire.getStatus());
});

test(`Should change status to FREE then leave`, (t) => {
	const wire = new Wire();

	const oldStatus = wire.getStatus();

	wire.request({timeout: 3000});
	wire.leave()
		.then(() => t.is(Status.FREE, wire.getStatus()));

	t.is(oldStatus, wire.getStatus());
});

test(`Should return promise then call request`, (t) => {
	const wire = new Wire();

	const promise = wire.request({timeout: 3000});

	t.is(true, promise instanceof Promise);
});

test(`Should return promise then call leave`, (t) => {
	const wire = new Wire();

	const promise = wire.leave();

	t.is(true, promise instanceof Promise);
});

test(`Should reject request by timeout`, (t) => {
	const wire = new Wire();

	return wire.request({timeout: 100})
		.then(() => t.fail())
		.catch((err) => {
			t.is(wire.EVENT_ERROR_TIMEOUT, err);
		});
});

test(`Should change status to FREE after resolve request`, (t) => {
	const wire = new Wire();

	return wire.request({timeout: 3000})
		.then(() => {
			t.is(Status.FREE ,wire.getStatus());
		});
});

test(`Should change status to FREE after reject by timeout`, (t) => {
	const wire = new Wire();

	return wire.request({timeout: 200})
		.then(() => t.fail())
		.catch(() => {
			t.is(Status.FREE ,wire.getStatus());
		});
});

test(`Should resolve request with Buffer`, (t) => {
	const wire = new Wire();

	return wire.request({timeout: 3000})
		.then((result) => t.is(true, result instanceof Buffer));
});
