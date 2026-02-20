import { Type, TSchema } from '@sinclair/typebox';
import { fetch } from '@tak-ps/etl';
import ETL, { Event, SchemaType, handler as internal, local, InvocationType, DataFlowType } from '@tak-ps/etl';

const Env = Type.Object({
    'API_URL': Type.String({
        description: 'Power Outages API URL',
        default: 'https://utils.tak.nz/power-outages/outages'
    }),
    'Min Customers': Type.String({
        description: 'Minimum customers affected to display',
        default: '0'
    }),
    'Utility Filter': Type.Optional(Type.String({
        description: 'Filter by utility ID (e.g., ORION_NZ, POWERCO_NZ)'
    })),
    'Outage Type': Type.Optional(Type.String({
        description: 'Filter by outage type (planned, unplanned)'
    }))
});

const PowerOutageSchema = Type.Object({
    outageId: Type.String({ description: 'Unique outage identifier' }),
    utility: Type.Object({
        name: Type.String({ description: 'Utility company name' }),
        id: Type.String({ description: 'Utility company ID' })
    }),
    region: Type.String({ description: 'NZ region name' }),
    regionCode: Type.String({ description: 'ISO 3166-2:NZ region code' }),
    outageStart: Type.String({ description: 'Outage start timestamp' }),
    estimatedRestoration: Type.Optional(Type.String({ description: 'Estimated restoration time' })),
    cause: Type.String({ description: 'Cause of outage' }),
    status: Type.String({ description: 'Outage status (active, resolved)' }),
    outageType: Type.Optional(Type.String({ description: 'Type of outage (planned, unplanned)' })),
    customersAffected: Type.Number({ description: 'Number of customers affected' }),
    crewStatus: Type.Optional(Type.String({ description: 'Crew status information' })),
    location: Type.Object({
        coordinates: Type.Object({
            latitude: Type.Number({ description: 'Latitude' }),
            longitude: Type.Number({ description: 'Longitude' })
        }),
        areas: Type.Array(Type.String(), { description: 'Affected areas' }),
        streets: Type.Array(Type.String(), { description: 'Affected streets' })
    }),
    metadata: Type.Optional(Type.Object({
        feeder: Type.Optional(Type.String({ description: 'Feeder name' })),
        lastUpdate: Type.Optional(Type.String({ description: 'Last update timestamp' })),
        aggregationType: Type.Optional(Type.String({ description: 'Aggregation type' })),
        outageCount: Type.Optional(Type.Number({ description: 'Number of aggregated outages' }))
    }))
});

interface PowerOutage {
    outageId: string;
    utility: {
        name: string;
        id: string;
    };
    region: string;
    regionCode: string;
    outageStart: string;
    estimatedRestoration?: string;
    cause: string;
    status: string;
    outageType?: string;
    customersAffected: number;
    crewStatus?: string;
    location: {
        coordinates: {
            latitude: number;
            longitude: number;
        };
        areas: string[];
        streets: string[];
    };
    metadata?: {
        feeder?: string;
        lastUpdate?: string;
        aggregationType?: string;
        outageCount?: number;
    };
}

interface PowerOutagesResponse {
    version: string;
    timestamp: string;
    summary: {
        totalUtilities: number;
        totalOutages: number;
        totalCustomersAffected: number;
    };
    utilities: Array<{
        name: string;
        id: string;
        status: string;
        outageCount: number;
    }>;
    outages: PowerOutage[];
}

export default class Task extends ETL {
    static name = 'etl-poweroutages';
    static flow = [ DataFlowType.Incoming ];
    static invocation = [ InvocationType.Schedule ];

    private static readonly ICON = 'bb4df0a6-ca8d-4ba8-bb9e-3deb97ff015e:Incidents/INC.04.PowerOutage';

    async schema(
        type: SchemaType = SchemaType.Input,
        flow: DataFlowType = DataFlowType.Incoming
    ): Promise<TSchema> {
        if (flow === DataFlowType.Incoming) {
            if (type === SchemaType.Input) {
                return Env;
            } else {
                return PowerOutageSchema;
            }
        } else {
            return Type.Object({});
        }
    }

    async control() {
        try {
            const env = await this.env(Env);
            
            const minCustomers = Number(env['Min Customers']);
            if (isNaN(minCustomers) || minCustomers < 0) {
                throw new Error('Invalid minimum customers value');
            }

            let url = env['API_URL'];
            const params = new URLSearchParams();
            
            if (minCustomers > 0) {
                params.append('minCustomers', minCustomers.toString());
            }
            if (env['Utility Filter']) {
                params.append('utility', env['Utility Filter']);
            }
            if (env['Outage Type']) {
                params.append('outageType', env['Outage Type']);
            }
            
            if (params.toString()) {
                url += '?' + params.toString();
            }

            console.log(`ok - Fetching power outages from ${url}`);
            
            const res = await fetch(url);
            
            if (!res.ok) {
                throw new Error(`Failed to fetch data: ${res.status} ${res.statusText}`);
            }
            
            const body = await res.json() as PowerOutagesResponse;
            const features: object[] = [];
            
            for (const outage of body.outages) {
                const lon = outage.location.coordinates.longitude;
                const lat = outage.location.coordinates.latitude;
                
                const remarks = [
                    `Utility: ${outage.utility.name}`,
                    `Customers Affected: ${outage.customersAffected}`,
                    `Status: ${outage.status}`,
                    `Cause: ${outage.cause}`,
                    `Region: ${outage.region}`,
                    `Areas: ${outage.location.areas?.join(', ') || 'Unknown'}`,
                    ...(outage.location.streets && outage.location.streets.length > 0 ? [`Streets: ${outage.location.streets.join(', ')}`] : []),
                    `Outage Start: ${new Date(outage.outageStart).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })} NZT`,
                    ...(outage.estimatedRestoration ? [`Estimated Restoration: ${new Date(outage.estimatedRestoration).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })} NZT`] : []),
                    ...(outage.outageType ? [`Type: ${outage.outageType}`] : []),
                    ...(outage.crewStatus ? [`Crew Status: ${outage.crewStatus}`] : []),
                    ...(outage.metadata?.feeder ? [`Feeder: ${outage.metadata.feeder}`] : []),
                    ...(outage.metadata?.aggregationType ? [`Aggregated: ${outage.metadata.outageCount} outages`] : [])
                ];

                features.push({
                    id: `poweroutage-${outage.outageId}`,
                    type: 'Feature',
                    properties: {
                        callsign: `${outage.utility.name} - ${outage.location.areas?.[0] || outage.region}`,
                        type: 'a-f-X-i',
                        icon: Task.ICON,
                        time: new Date(outage.outageStart).toISOString(),
                        start: new Date(outage.outageStart).toISOString(),
                        stale: outage.estimatedRestoration 
                            ? new Date(outage.estimatedRestoration).toISOString()
                            : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                        metadata: outage,
                        remarks: remarks.join('\n')
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [lon, lat]
                    }
                });
            }
            
            const fc: { type: string; features: object[] } = {
                type: 'FeatureCollection',
                features
            };
            console.log(`ok - fetched ${features.length} power outages (${body.summary.totalCustomersAffected} customers affected)`);
            await this.submit(fc as unknown as Parameters<typeof this.submit>[0]);
        } catch (error) {
            console.error(`Error in ETL process: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
}

await local(new Task(import.meta.url), import.meta.url);
export async function handler(event: Event = {}) {
    return await internal(new Task(import.meta.url), event);
}
