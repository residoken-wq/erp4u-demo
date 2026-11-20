export const TENANT_SEEDERS = 'TENANT_SEEDERS';

export interface TenantSeeder {
  readonly name: string;
  seed(): Promise<void>;
}
