# Changelog

## [0.0.12](https://github.com/i-am-bee/bee-api/compare/v0.0.11...v0.0.12) (2024-11-15)

### Bug Fixes

* **build:** support execution under any user ([e1d32be](https://github.com/i-am-bee/bee-api/commit/e1d32be315abd36933059e554cff1a9c5cd2d342))

## [0.0.11](https://github.com/i-am-bee/bee-api/compare/v0.0.10...v0.0.11) (2024-11-14)

## [0.0.10](https://github.com/i-am-bee/bee-api/compare/v0.0.9...v0.0.10) (2024-11-14)

## [0.0.9](https://github.com/i-am-bee/bee-api/compare/v0.0.8...v0.0.9) (2024-11-13)

### Features

* **extraction:** use Unstructured Opensource ([#29](https://github.com/i-am-bee/bee-api/issues/29)) ([549f924](https://github.com/i-am-bee/bee-api/commit/549f924e6203557dfac4a392a0907f35f9ed5540))

### Bug Fixes

* **extraction:** eliminate race condition and other errors ([#61](https://github.com/i-am-bee/bee-api/issues/61)) ([1a821cd](https://github.com/i-am-bee/bee-api/commit/1a821cdce8f2b5f6594e4843358d6662053de725))
* **misc:** migration, redis and mongo SSL connections ([#59](https://github.com/i-am-bee/bee-api/issues/59)) ([3ebd1b1](https://github.com/i-am-bee/bee-api/commit/3ebd1b1a7a2a562f6969ae97eb015655ece2056d))
* **run:** avoid unhandled promises during execution ([#64](https://github.com/i-am-bee/bee-api/issues/64)) ([db5a64f](https://github.com/i-am-bee/bee-api/commit/db5a64f230099900972a55ce1e3b2b3887aeb988))

## [0.0.8](https://github.com/i-am-bee/bee-api/compare/v0.0.7...v0.0.8) (2024-11-08)

### Features

* use framework's tool validation and remove caption ([#54](https://github.com/i-am-bee/bee-api/issues/54)) ([77af525](https://github.com/i-am-bee/bee-api/commit/77af525527141ab1530faa1cc6de9fa2ceaf4f6a))

## [0.0.7](https://github.com/i-am-bee/bee-api/compare/v0.0.6...v0.0.7) (2024-11-05)

### Features

* **apiKey:** add last used at property ([#36](https://github.com/i-am-bee/bee-api/issues/36)) ([3758032](https://github.com/i-am-bee/bee-api/commit/3758032a8c31f3c633faffbd2ff64d30e7ced9b1))
* **apiKey:** add organization apiKey endpoint ([#34](https://github.com/i-am-bee/bee-api/issues/34)) ([188608b](https://github.com/i-am-bee/bee-api/commit/188608b1f0b9bfd5c883bac9224496d5232d38c7))
* **apiKey:** add owner to the response ([#41](https://github.com/i-am-bee/bee-api/issues/41)) ([aba5f3a](https://github.com/i-am-bee/bee-api/commit/aba5f3a6e9f6df6f1b10f5119e33a9e8646ae48f))
* **tools:** add get for system tools ([#33](https://github.com/i-am-bee/bee-api/issues/33)) ([e7ced3f](https://github.com/i-am-bee/bee-api/commit/e7ced3f1ce87e8cd621d218531ef8ee961149d39))
* **tools:** update ArXiv short description ([#37](https://github.com/i-am-bee/bee-api/issues/37)) ([e46b3d6](https://github.com/i-am-bee/bee-api/commit/e46b3d63c21329eb0b65cbfe706d988a1526215e))

### Bug Fixes

* **apiKey:** fix last used_at ([#44](https://github.com/i-am-bee/bee-api/issues/44)) ([87c925c](https://github.com/i-am-bee/bee-api/commit/87c925c2d4d5bef70f9bb7dad8b0d3401554577d))
* **ApiKey:** fix transaction for parallel requests ([#50](https://github.com/i-am-bee/bee-api/issues/50)) ([e220af5](https://github.com/i-am-bee/bee-api/commit/e220af58221a25c9585b4103a9df25be0a27bf46))
* **apiKey:** load project for organization api-keys ([#38](https://github.com/i-am-bee/bee-api/issues/38)) ([dd28eea](https://github.com/i-am-bee/bee-api/commit/dd28eea981e22559a2364fad153b370c232ac3a1))
* **auth:** fix lastUpdatedAt for api key ([#48](https://github.com/i-am-bee/bee-api/issues/48)) ([e7c3aca](https://github.com/i-am-bee/bee-api/commit/e7c3aca41c80ac4833a478c4126dff9f698b7ba1))
* **pagination:** fix pagination for before parameter ([#45](https://github.com/i-am-bee/bee-api/issues/45)) ([389cd2e](https://github.com/i-am-bee/bee-api/commit/389cd2ee3a12b856ae2cb6bc55afb4d15c37c77e))
* **pagination:** fix pagination with filters ([#39](https://github.com/i-am-bee/bee-api/issues/39)) ([20cf9aa](https://github.com/i-am-bee/bee-api/commit/20cf9aa74e1f97f128ae5b19f18c88d620589721))
* **seeder:** importing ORM hangs seeder ([#51](https://github.com/i-am-bee/bee-api/issues/51)) ([dd0d3f6](https://github.com/i-am-bee/bee-api/commit/dd0d3f6b5672e3eb4a942ce40b783f82a33d72f1))
* **thread:** delete vectore store files for thread ([#35](https://github.com/i-am-bee/bee-api/issues/35)) ([177ab3b](https://github.com/i-am-bee/bee-api/commit/177ab3b363ca90102d5b9a9b98c11e8f6ed98d54))
