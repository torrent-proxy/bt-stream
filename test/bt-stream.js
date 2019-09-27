const test = require('ava');
const Readeble = require('stream').Readable;
const fs = require('fs');

const {createBTStream, BTStream} = require('../index');

const DHT_PORT = 8080;
const HASH = '52b278c6769eb2edb9773ff6fe0923598ff42fea';
// const HASH = '2dca8e028d7ff766162a9cbc2002ce8c6ca04555';
// const HASH = 'cb54c5f53e2b4bacdadb2d44293b9cae4df69790';

let btStream = null;

test.beforeEach((t) => t.context.btStream = createBTStream({dhtPort: DHT_PORT, hash: HASH}));
// test.afterEach((t) => t.context.btStream.destroy());

test('create', (t) => {
	const { btStream } = t.context;

	t.true(btStream instanceof BTStream);
});

test('Should implement the interface', (t) => {
	const { btStream } = t.context;
	t.is(typeof btStream.destroy, 'function');
	t.is(typeof btStream.downloadTorrent, 'function');
	t.is(typeof btStream.getMetaData, 'function');
});

test.serial('Should get metadata', async (t) => {
	const torrent = await t.context.btStream.getMetaData(HASH);
	t.true(typeof torrent === 'object' && torrent !== null);
});

test.serial('Should get read stream with file', async (t) => {
	const { btStream } = t.context;

	const torrent = await btStream.getMetaData(HASH);
	const file = torrent.files[0];

	const stream = btStream.downloadFile({torrent, file});

	t.true(stream instanceof Readeble);

	stream.destroy();
});

test.serial('Should load file two match', async (t) => {
	return new Promise(async (resolve) => {
		const { btStream } = t.context;

		const torrentOne = await btStream.getMetaData(HASH);
		const torrentTwo = await btStream.getMetaData(HASH);

		t.true(true);
		resolve();
	});
});

test.serial.only('Should load file', async (t) => {
	return new Promise(async (resolve) => {
		const btStream = createBTStream({dhtPort: 8900, hash: HASH});

		console.log(`create btstream`, {btStream});
		const torrent = await btStream.getMetaData(HASH);
		console.log(`get metadata`);
		const file = torrent.files[0];

		const stream = btStream.downloadFile({torrent, file});
		const wstream = fs.createWriteStream(`./test-file`);

		stream.pipe(wstream);
		stream.on('end', () => {
			console.log(`END!!!`);
			t.true(true);
			resolve();
		});
	});
});


test.serial.skip('Should get read all', async (t) => {
	global.console.log = () => {};

	const { btStream } = t.context;

	const torrent = await btStream.getMetaData(HASH);
	const file = torrent.files[0];
	console.log('files', torrent.files.length);

	const stream = btStream.downloadTorrent({torrent, file});
	const wstream = fs.createWriteStream(`./test-file`);

	stream.pipe(wstream);
	stream.on('end', () => {
		console.log('END!!!!!');
		stream.destroy();
	});

	return new Promise(() => {});
});

test.skip('Should get read stream with file by name', (t) => {
    // const stream = await btStream.downloadFileByName({torrent, name});
});

test.skip('Should get read stream with file by path', (t) => {
    // const stream = await btStream.downloadFileByPath({torrent, path});
});
