# Changelog

## [0.0.25](https://github.com/i-am-bee/bee-api/compare/v0.0.24...v0.0.25) (2025-02-04)

### Features

* **tools:** switch openAPI tool to framework version ([#153](https://github.com/i-am-bee/bee-api/issues/153)) ([30a93a7](https://github.com/i-am-bee/bee-api/commit/30a93a7af354b95a52d8a7ce3035f40feb17e643))

## [0.0.24](https://github.com/i-am-bee/bee-api/compare/v0.0.23...v0.0.24) (2025-02-03)

### Features

* **projectSecrets:** add CRUDL for project secrets ([#40](https://github.com/i-am-bee/bee-api/issues/40)) ([ecd16bd](https://github.com/i-am-bee/bee-api/commit/ecd16bd1abeb01a9a79130d7a9ad5aed6ed8c245))

### Bug Fixes

* **upm:** use package-db from repo ([#162](https://github.com/i-am-bee/bee-api/issues/162)) ([6962b9f](https://github.com/i-am-bee/bee-api/commit/6962b9f7afe73d654a326776ec7a09bc59b74623))

## [0.0.23](https://github.com/i-am-bee/bee-api/compare/v0.0.22...v0.0.23) (2025-01-29)

### Features

* chat streaming and embeddings support ([#156](https://github.com/i-am-bee/bee-api/issues/156)) ([2a8f729](https://github.com/i-am-bee/bee-api/commit/2a8f7297dd6ce959cbb77e1fc731d62b4257d060))
* **tools:** update OpenAPI tools ([#157](https://github.com/i-am-bee/bee-api/issues/157)) ([1feb69e](https://github.com/i-am-bee/bee-api/commit/1feb69e42ab544b5008a1ff517cfc47a0f5c2e6a))

### Bug Fixes

* **metadata:** add nulability to schema for openai compatibility ([#158](https://github.com/i-am-bee/bee-api/issues/158)) ([e7b8eab](https://github.com/i-am-bee/bee-api/commit/e7b8eab2e1d7438bf30d8729724deea110995187))
* **tool:** fix update api tool api key ([#161](https://github.com/i-am-bee/bee-api/issues/161)) ([9d93ba1](https://github.com/i-am-bee/bee-api/commit/9d93ba1bf5fcb1b3e6a4fc78ea63ca0bb86f45cc))
* **tools:** encrypt updated api keys ([#160](https://github.com/i-am-bee/bee-api/issues/160)) ([1d561d6](https://github.com/i-am-bee/bee-api/commit/1d561d69477f03ba378b936ea29fcdda74e252f6))

## [0.0.22](https://github.com/i-am-bee/bee-api/compare/v0.0.21...v0.0.22) (2025-01-15)

### Features

* **instrumentation:** add shutdown hook ([#142](https://github.com/i-am-bee/bee-api/issues/142)) ([6b9c710](https://github.com/i-am-bee/bee-api/commit/6b9c71007c14e2d19e69e6a609536f3abe05d618))

### Bug Fixes

* **bullmq:** update bullmq to fix error reporting ([#147](https://github.com/i-am-bee/bee-api/issues/147)) ([c1e3c6d](https://github.com/i-am-bee/bee-api/commit/c1e3c6dc86cab913c3a246c4cfafbe2456030355))
* **Observe:** remove observe not found error logs ([#149](https://github.com/i-am-bee/bee-api/issues/149)) ([f50e20d](https://github.com/i-am-bee/bee-api/commit/f50e20d480c199dc9894ba0841dd4a3fb0d23967))
* **tools:** check file existence for system tools ([#145](https://github.com/i-am-bee/bee-api/issues/145)) ([9e6a2e0](https://github.com/i-am-bee/bee-api/commit/9e6a2e07a11eb90bb84412bf9d01b283a14efa58))
* **workers:** add installation command, update pyproject ([#146](https://github.com/i-am-bee/bee-api/issues/146)) ([2780d00](https://github.com/i-am-bee/bee-api/commit/2780d00fb8e0b17441e0f519c29bfe1b78505a73))

## [0.0.21](https://github.com/i-am-bee/bee-api/compare/v0.0.20...v0.0.21) (2024-12-19)

### Features

* **observe:** add response headers and status code ([#141](https://github.com/i-am-bee/bee-api/issues/141)) ([96c06ba](https://github.com/i-am-bee/bee-api/commit/96c06bad0dfb2aaeadc8774899ba2bca1771ad0a))
* **tools:** add llm and calculator tools ([#132](https://github.com/i-am-bee/bee-api/issues/132)) ([1797a53](https://github.com/i-am-bee/bee-api/commit/1797a53ad9a681b5daadca58acba8ca044085efd))

## [0.0.20](https://github.com/i-am-bee/bee-api/compare/v0.0.19...v0.0.20) (2024-12-16)

### Bug Fixes

* **artifact:** update the share token only when the share property changes ([#139](https://github.com/i-am-bee/bee-api/issues/139)) ([c808d39](https://github.com/i-am-bee/bee-api/commit/c808d39b3f8c3af6ef206d553512ab7183fd440d))

## [0.0.19](https://github.com/i-am-bee/bee-api/compare/v0.0.18...v0.0.19) (2024-12-16)

### Features

* **user:** update default assistant for new users ([#138](https://github.com/i-am-bee/bee-api/issues/138)) ([233c138](https://github.com/i-am-bee/bee-api/commit/233c138f3075803bffeb127c1956c2742ee98ea5))

## [0.0.18](https://github.com/i-am-bee/bee-api/compare/v0.0.17...v0.0.18) (2024-12-15)

### Features

* **user:** add default assistant when user created ([#137](https://github.com/i-am-bee/bee-api/issues/137)) ([328c8de](https://github.com/i-am-bee/bee-api/commit/328c8ded996db1d8d8d649fbcff24c67f5cee2ed))

### Bug Fixes

* **limits:** merge window and rate limits, fix streaming headers ([#134](https://github.com/i-am-bee/bee-api/issues/134)) ([e997180](https://github.com/i-am-bee/bee-api/commit/e9971803ae1f2e0d11f3a2d4cc0f4c194e83fb5a))
* **readFile:** fix error for read file tool ([#133](https://github.com/i-am-bee/bee-api/issues/133)) ([05a59d9](https://github.com/i-am-bee/bee-api/commit/05a59d98b035bde280c71284b43c005a604d2128))

## [0.0.17](https://github.com/i-am-bee/bee-api/compare/v0.0.16...v0.0.17) (2024-12-13)

### Features

* **deps:** upgrade bee-agent-framework ([#135](https://github.com/i-am-bee/bee-api/issues/135)) ([ede714f](https://github.com/i-am-bee/bee-api/commit/ede714f7557bcb336f36385c74a6580c9e4d68f3))

## [0.0.16](https://github.com/i-am-bee/bee-api/compare/v0.0.15...v0.0.16) (2024-12-12)

### Bug Fixes

* **log:** update logged properties ([#130](https://github.com/i-am-bee/bee-api/issues/130)) ([e6ee1ec](https://github.com/i-am-bee/bee-api/commit/e6ee1ec5ed071b025b604a6410c5865279659f83))

## [0.0.15](https://github.com/i-am-bee/bee-api/compare/v0.0.14...v0.0.15) (2024-12-11)

### Features

* **artifact:** add search param and allow source_code update ([#104](https://github.com/i-am-bee/bee-api/issues/104)) ([6ca4bf4](https://github.com/i-am-bee/bee-api/commit/6ca4bf436e6b77d44b4d2939ef705aacca82984e))
* **artifact:** message_id is optional ([#125](https://github.com/i-am-bee/bee-api/issues/125)) ([c09898b](https://github.com/i-am-bee/bee-api/commit/c09898b3cf6a50307e8a7bf41f3618f26073c86b))
* **artifact:** rename secret to token ([#118](https://github.com/i-am-bee/bee-api/issues/118)) ([099952c](https://github.com/i-am-bee/bee-api/commit/099952cd7a8f7a086b18a21731bf1428989e2900))
* **chat:** add chat entity ([#127](https://github.com/i-am-bee/bee-api/issues/127)) ([0b46055](https://github.com/i-am-bee/bee-api/commit/0b460552f9950e50b4fdfc4a32e51182e1bedfc1))
* **chat:** constrained decoding support ([#103](https://github.com/i-am-bee/bee-api/issues/103)) ([8151586](https://github.com/i-am-bee/bee-api/commit/81515866e9eb3c7bd30a18f4dc9b0e6ba117c25f))
* **deps:** upgrade bee-agent-framework ([#106](https://github.com/i-am-bee/bee-api/issues/106)) ([178937c](https://github.com/i-am-bee/bee-api/commit/178937c92c407e818c85ec98b408e3d6e174ffbd))
* **deps:** upgrade bee-agent-framework ([#107](https://github.com/i-am-bee/bee-api/issues/107)) ([b15ced1](https://github.com/i-am-bee/bee-api/commit/b15ced13e494af5f539e2407543853d37d9b7e79))
* **deps:** upgrade bee-agent-framework ([#110](https://github.com/i-am-bee/bee-api/issues/110)) ([b999907](https://github.com/i-am-bee/bee-api/commit/b999907bd4e7b04ce0ca53b44d016365de6996b1))
* **docling:** update docling and use hybrid chunker ([#117](https://github.com/i-am-bee/bee-api/issues/117)) ([592c4f8](https://github.com/i-am-bee/bee-api/commit/592c4f8db15705e637ca8211705a244321d46651))
* **log:** add basic tracking ([#128](https://github.com/i-am-bee/bee-api/issues/128)) ([9deeb27](https://github.com/i-am-bee/bee-api/commit/9deeb27dbb9fe929d9b3e5e3ec8224e1c6ceed4b))
* **observe:** implement opentelemetry ([#113](https://github.com/i-am-bee/bee-api/issues/113)) ([f67e300](https://github.com/i-am-bee/bee-api/commit/f67e3006429032a83562e1420653e8d7b37e400b))
* **python:** add opentelemetry logs and traces ([#114](https://github.com/i-am-bee/bee-api/issues/114)) ([f3ee5c5](https://github.com/i-am-bee/bee-api/commit/f3ee5c5b11d08c541cc246445d7ea17ac9d9c759))
* **user:** make user name modifiable ([#108](https://github.com/i-am-bee/bee-api/issues/108)) ([2f57e2a](https://github.com/i-am-bee/bee-api/commit/2f57e2ad575db13d68f91211c115449f06acd5f6))

### Bug Fixes

* **build:** import ioredis parseUrl from module ([#120](https://github.com/i-am-bee/bee-api/issues/120)) ([957001f](https://github.com/i-am-bee/bee-api/commit/957001f7843875539538f9bdb79e6171725c10c7))
* fs error logs in production ([#123](https://github.com/i-am-bee/bee-api/issues/123)) ([36af5fa](https://github.com/i-am-bee/bee-api/commit/36af5fa3e92c37a70674cba59930a8b24e9c1830))
* **logs:** make sure errors are visible in elastic ([#111](https://github.com/i-am-bee/bee-api/issues/111)) ([3712103](https://github.com/i-am-bee/bee-api/commit/3712103dbff933940b6ef01ce72f6d16eaad14c8))
* **migration:** default projects ([#112](https://github.com/i-am-bee/bee-api/issues/112)) ([626310a](https://github.com/i-am-bee/bee-api/commit/626310aaf40c858184d698fa833fe20970c11b4b))
* otel python disable ([#121](https://github.com/i-am-bee/bee-api/issues/121)) ([31dc458](https://github.com/i-am-bee/bee-api/commit/31dc45893ab4d6389d8d88ec67414cf8cad3033a))
* **redis:** properly close redis connections ([#109](https://github.com/i-am-bee/bee-api/issues/109)) ([d274908](https://github.com/i-am-bee/bee-api/commit/d27490839b08d62aed73346b8daa4ab94e6ea93b))

## [0.0.14](https://github.com/i-am-bee/bee-api/compare/v0.0.13...v0.0.14) (2024-12-03)

### Features

* chat completion endpoint for authorized and artifact users ([#92](https://github.com/i-am-bee/bee-api/issues/92)) ([b40c204](https://github.com/i-am-bee/bee-api/commit/b40c20413191a054ea38a5bbe2d47df620180970))
* **deps:** upgrade bee-agent-framework and refactor ([#102](https://github.com/i-am-bee/bee-api/issues/102)) ([fc014df](https://github.com/i-am-bee/bee-api/commit/fc014df8d756042e5490028ad03d7b0d0b24a743))
* **ui:** modules_to_packages endpoint ([#101](https://github.com/i-am-bee/bee-api/issues/101)) ([6c203cc](https://github.com/i-am-bee/bee-api/commit/6c203cc28a8423151e2fcb398c4c8da9bfcccf39))

### Bug Fixes

* **artifact:** fix schema and type ([#97](https://github.com/i-am-bee/bee-api/issues/97)) ([7a585cd](https://github.com/i-am-bee/bee-api/commit/7a585cd80930973107b40f3a0e4e6cbfd6dbd664))
* **assistant:** tools check for streamlit agent ([#94](https://github.com/i-am-bee/bee-api/issues/94)) ([0d4ff85](https://github.com/i-am-bee/bee-api/commit/0d4ff854a48a1d0b386bf9a5cc3453b6c60b5c5d))

## [0.0.13](https://github.com/i-am-bee/bee-api/compare/v0.0.12...v0.0.13) (2024-11-25)

### Features

* **agents:** add streamlit agent ([#87](https://github.com/i-am-bee/bee-api/issues/87)) ([cc3445c](https://github.com/i-am-bee/bee-api/commit/cc3445c1a85363c03a57597a9417e66fbbd584ee))
* **artifact:** add artifacts CRUDL ([#82](https://github.com/i-am-bee/bee-api/issues/82)) ([6b8b684](https://github.com/i-am-bee/bee-api/commit/6b8b6841ad692d00dc6e9a8879fa3fa36072d821)), closes [i-am-bee/internal#18](https://github.com/i-am-bee/internal/issues/18)
* **deps:** remove langchain dependency ([#80](https://github.com/i-am-bee/bee-api/issues/80)) ([1255cab](https://github.com/i-am-bee/bee-api/commit/1255cabfdde7a2f4e590ce126ee8fba657f2e9d7))
* integrate docling extraction ([#74](https://github.com/i-am-bee/bee-api/issues/74)) ([f649be3](https://github.com/i-am-bee/bee-api/commit/f649be3d6314f63b2532cf606dd862571b63f53d))
* **limits:** add quotas for runs and vector store files ([#78](https://github.com/i-am-bee/bee-api/issues/78)) ([a8d3d33](https://github.com/i-am-bee/bee-api/commit/a8d3d3357022dc1197c816d35abb6e4fdb21c742))
* use granite agent for granite model ([#75](https://github.com/i-am-bee/bee-api/issues/75)) ([b15da33](https://github.com/i-am-bee/bee-api/commit/b15da3302f8ccb64ec7ba8269320532362b88dac))

### Bug Fixes

* dayjs import ([#93](https://github.com/i-am-bee/bee-api/issues/93)) ([933110f](https://github.com/i-am-bee/bee-api/commit/933110fb18ca1253c327969a8378090636b19499))
* **docker:** copy .npmrc before installing deps ([#86](https://github.com/i-am-bee/bee-api/issues/86)) ([92f3ce3](https://github.com/i-am-bee/bee-api/commit/92f3ce3426ed1aea8dd4fd2c373a503d418a24f7))
* free disk space for github build and publish action ([#88](https://github.com/i-am-bee/bee-api/issues/88)) ([94cb0ad](https://github.com/i-am-bee/bee-api/commit/94cb0adda404a5de1839e4502f9ad5487fbc604c))
* **redis:** add healthcheck and more retries to python redis client ([#81](https://github.com/i-am-bee/bee-api/issues/81)) ([c9d8950](https://github.com/i-am-bee/bee-api/commit/c9d8950516e6a84ea8a2854e446954f0e88f87e8))

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
