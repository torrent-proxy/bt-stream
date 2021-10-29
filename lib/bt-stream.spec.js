const Readeble = require('stream').Readable;
const fs = require('fs');
const BTStream = require('./bt-stream');
const {Swarm} = require('./test-mocks/mocks');

const DHT_PORT = 8080;
const HASH = '52b278c6769eb2edb9773ff6fe0923598ff42fea';
// const HASH = '2dca8e028d7ff766162a9cbc2002ce8c6ca04555';
// const HASH = 'cb54c5f53e2b4bacdadb2d44293b9cae4df69790';

const createBTStream = () => {
	const swarm = new Swarm();
	return new BTStream({swarm});
};

describe(`BTStream`, () => {
	it('Should implement the interface', () => {
		const btStream = createBTStream();

		expect(typeof btStream.destroy).toEqual('function');
		expect(typeof btStream.getMetaData).toEqual('function');
	});

	it('Should get metadata', async (done) => {
		const btStream = createBTStream();
		const torrent = await btStream.getMetaData(HASH);

		expect(typeof torrent).toEqual('object');
		expect(torrent).not.toEqual(null);

		btStream.destroy();
		done();
	});

	it('Should get read stream with file', async (done) => {
		const btStream = createBTStream();
		const torrent = await btStream.getMetaData(HASH);
		const file = torrent.files[0];

		const stream = btStream.downloadFile({torrent, file});

		expect(stream instanceof Readeble).toEqual(true);

		stream.destroy();
		btStream.destroy();

		done();
	});

	it('Should load file two match', async (done) => {
		const btStream = createBTStream();

		return new Promise(async (resolve) => {
			const torrentOne = await btStream.getMetaData(HASH);
			const torrentTwo = await btStream.getMetaData(HASH);

			resolve();

			btStream.destroy();
			done();
		});
	});

	it('Should load file', async (done) => {
		return new Promise(async (resolve) => {
			const btStream = createBTStream();

			const torrent = await btStream.getMetaData(HASH);
			const file = torrent.files[0];

			const stream = btStream.downloadFile({torrent, file});
			const wstream = fs.createWriteStream(`./it-file`);

			stream.pipe(wstream);
			stream.on('end', () => {
				resolve();

				btStream.destroy();
				done();
			});
		});
	});

	xit('Should get read stream with file by name', (t) => {
		// const stream = await btStream.downloadFileByName({torrent, name});
	});

	xit('Should get read stream with file by path', (t) => {
		// const stream = await btStream.downloadFileByPath({torrent, path});
	});
});
