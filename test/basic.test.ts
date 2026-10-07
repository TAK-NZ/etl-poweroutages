import test from 'node:test';
import assert from 'node:assert';
import { SchemaType, DataFlowType, InvocationType, StaticCapabilities, PERMISSIONS } from '@tak-ps/etl';

// task.ts calls Task.init() at module scope which requires an ETL environment,
// so these must be set before the dynamic import below
process.env.ETL_API = process.env.ETL_API || 'http://localhost:5001';
process.env.ETL_LAYER = process.env.ETL_LAYER || '1';
process.env.ETL_TOKEN = process.env.ETL_TOKEN || 'etl.test-token';

const { default: Task } = await import('../task.js');

test('Task static config', () => {
    assert.equal(Task.name, 'etl-poweroutages');
    assert.deepEqual(Task.flow, [DataFlowType.Incoming]);
    assert.deepEqual(Task.invocation, [InvocationType.Schedule]);
});

test('Incoming Input schema', async () => {
    const task = await Task.init();
    const schema = await task.schema(SchemaType.Input, DataFlowType.Incoming);

    assert.equal(schema.type, 'object');
    for (const key of [
        'API_URL',
        'Min Customers',
        'Utility Filter',
        'Outage Type'
    ]) {
        assert.ok(schema.properties[key], `Env schema missing property: ${key}`);
    }

    assert.equal(schema.properties.API_URL.type, 'string');
    assert.equal(schema.properties.API_URL.default, 'https://utils.tak.nz/power-outages/outages');
    assert.equal(schema.properties['Min Customers'].type, 'string');
    assert.equal(schema.properties['Min Customers'].default, '0');
});

test('Incoming Output schema', async () => {
    const task = await Task.init();
    const schema = await task.schema(SchemaType.Output, DataFlowType.Incoming);

    assert.equal(schema.type, 'object');
    for (const key of [
        'outageId',
        'utility',
        'region',
        'regionCode',
        'outageStart',
        'estimatedRestoration',
        'cause',
        'status',
        'outageType',
        'customersAffected',
        'crewStatus',
        'location'
    ]) {
        assert.ok(schema.properties[key], `Output schema missing property: ${key}`);
    }

    assert.equal(schema.properties.customersAffected.type, 'number');
});

test('Outgoing flow is not provided', async () => {
    const task = await Task.init();
    const schema = await task.schema(SchemaType.Input, DataFlowType.Outgoing);

    assert.deepEqual(schema.properties, {});
});

test('capabilities.json is a valid manifest matching the task', async () => {
    const doc = await StaticCapabilities.read(new URL('../capabilities.json', import.meta.url).pathname);

    assert.equal(doc.name, 'NZ Power Outages');
    assert.ok(doc.permissions.length > 0);

    for (const permission of doc.permissions) {
        // Resources are expressed as <permission>:<level>, where <level> may be a wildcard
        const [name, level] = permission.resource.split(':');
        assert.ok(PERMISSIONS[name], `Unknown permission: ${permission.resource}`);
        assert.ok(level === '*' || PERMISSIONS[name].includes(level), `Unknown permission level: ${permission.resource}`);
    }

    assert.equal(doc.invocations.incoming?.schedule?.default.schedule, 'rate(5 minutes)');
});
