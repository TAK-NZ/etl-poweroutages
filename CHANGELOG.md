# CHANGELOG

## v1.1.0 - 2026-10-07
### Added
- Add a `capabilities.json` manifest so CloudTAK can read the task's requirements from the image (TAK-NZ/CloudTAK#165). It declares a single required permission, `feature:submit` (the only CloudTAK API the task uses is `submit()`), 1024 MB memory / 120 s timeout, and a default `rate(5 minutes)` schedule. The schedule and memory/timeout values are estimates, not measured, and can be tuned per layer. It is validated against `StaticCapabilitiesSchema` from `@tak-ps/etl`, and a test guards it in CI
- Add a basic test suite (`npm test`, `node:test` run through `tsx`) covering the task's static config, input and output schemas and the manifest; the `lint` script now also covers `test/`. Previously `npm test` was `exit 0`
- Add a `.dockerignore` so `.git`, `.github`, `node_modules`, `dist`, `test`, `docs`, `.env*` and markdown files are kept out of the image build context. `capabilities.json`, `task.ts`, `package*.json` and `tsconfig.json` stay in the context
### Changed
- Build and push the image with `docker buildx` in the demo and production deploy jobs, embedding `capabilities.json` as the `com.cloudtak.capabilities` OCI annotation, with `docker/setup-buildx-action@v4` providing the `docker-container` builder the annotation needs. The annotation has not been checked in the demo environment; the Docker image build and its contents were checked locally
- Deliberately NOT adopting the `cloudtak-etl` CLI from `@tak-ps/etl` for the build and push: its `bin/build.ts` hardcodes the destination ECR repository as `tak-vpc-<Environment>-cloudtak-tasks`, which does not match the `<stackname>-etltasks` repository used by TAK.NZ base-infra. The existing lookup of the repository through the `EcrEtlTasksRepoArn` CloudFormation export is kept unchanged
- Use `Task.init()` for the local and Lambda entry points. No change in Lambda behaviour, `ETL_TOKEN` is always provided there
- Require Node 24 (`engines` `>= 24`), and use Node 24 in the lint and deploy workflows (previously Node 18), matching the Lambda base image
- Update dependencies: `@tak-ps/etl` minimum raised to `^10.13.0` (required for `capabilities.json`) and resolved to 10.22.2, `eslint` 10.12.0 and `typescript-eslint` 8.71.1, plus patched transitive dependencies; `tsx` added as a dev dependency. `npm audit` now reports 0 vulnerabilities (9 before: 1 low, 4 moderate, 3 high, 1 critical), which also fixes the `Security audit` step in CI. `typescript` stays on 6.0.3 as `typescript-eslint` still limits supported versions to below 6.1.0

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
