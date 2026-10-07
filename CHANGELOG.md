# CHANGELOG

## v1.0.0 - 2025-01-XX

### Added
- Initial release of ETL-PowerOutages
- Support for NZ power outage data from multiple utilities (Orion Group, PowerCo, Wellington Electricity)
- Configurable filtering by minimum customers affected
- Configurable filtering by utility
- Configurable filtering by outage type (planned/unplanned)
- Display of outage details including cause, status, crew status, and estimated restoration time
- Integration with TAK.NZ iconset (INC.04.PowerOutage)

### Changed
- Update GitHub Actions to releases that run on Node.js 24, clearing the Node.js 20 deprecation warnings: `actions/checkout` v7, `actions/setup-node` v7 and `aws-actions/configure-aws-credentials` v6. `aws-actions/amazon-ecr-login` v2 already runs on Node.js 24. Not yet run in CI on these versions
- Pin the workflow runners to `ubuntu-24.04` instead of `ubuntu-latest`, so the `ubuntu-latest` migration to Ubuntu 26 (starting October 19, 2026) does not change the build environment unannounced
