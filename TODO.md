# TODO: BitTorrent Stream

- [x] удалить грязь
- [x] сделать полноценным модулем, который можно подключать https://github.com/torrent-proxy/bt-stream/commit/4e672495e73175f26e85351e5d2893fff1d80eab
- [ ] изменить/добавить интерфейс `downloadTorrent(torrent)` на `downloadFile(torrent.files[0])`
- [ ] решить проблему с заканчивающимися wire'ами
- [ ] провести оптимизацию скорости. Генераторы совместно с async работают медленно
- [ ] поэксперементировать с одновременным созданием нескольких pieceLoader'ов. Должно положительно сказаться на скорости.