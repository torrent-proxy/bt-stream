import test from 'ava';
const Readeble = require('stream').Readable;

const BTStream = require('../index');

const HASH = '1d805df84b254a9317ef5a6bf702bf7da77445fa';

let btStream = null;

test.beforeEach((t) => t.context.btStream = new BTStream());
test.afterEach((t) => t.context.btStream.destroy());

test('create', (t) => {
	const { btStream } = t.context;

	t.true(btStream instanceof BTStream);
});

test('должен удовлетворять интерфейсу', (t) => {
	const { btStream } = t.context;
	t.is(typeof btStream.destroy, 'function');
	t.is(typeof btStream.downloadTorrent, 'function');
	t.is(typeof btStream.getMetaData, 'function');
});

test.serial('должен получить метадату', async (t) => {
	const torrent = await t.context.btStream.getMetaData(HASH);
	t.true(typeof torrent === 'object' && torrent !== null);
});

test.serial('должен получить ридстрим для скачивания', async (t) => {
	const { btStream } = t.context;
	const torrent = await btStream.getMetaData(HASH);
	const stream = await btStream.downloadTorrent(torrent);

	t.true(stream instanceof Readeble);

	stream.destroy();
});
