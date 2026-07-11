import { tenantExtension } from './tenant.extension';
import { TenantContext } from './tenant-context';

// Drive the extension's $allOperations hook directly with a fake `query` sink,
// so we can assert exactly how it rewrites args before hitting the DB.
function hook(companyId: string | null) {
  const tenant = { companyId } as unknown as TenantContext;
  const op = tenantExtension(tenant).query.$allModels.$allOperations;
  const calls: any[] = [];
  const query = (args: any) => {
    calls.push(args);
    return Promise.resolve(args);
  };
  return { op, calls, query };
}

describe('tenantExtension', () => {
  it('fails closed when no tenant context is set', async () => {
    const { op, query } = hook(null);
    await expect(op({ model: 'Employee', operation: 'findMany', args: {}, query })).rejects.toThrow(/Tenant context required/);
  });

  it('never scopes the unscoped tenant-root model (Company)', async () => {
    const { op, calls, query } = hook(null); // even with no context, Company passes through
    await op({ model: 'Company', operation: 'findUnique', args: { where: { slug: 'acme' } }, query });
    expect(calls[0]).toEqual({ where: { slug: 'acme' } });
  });

  it('merges companyId into where for list reads', async () => {
    const { op, calls, query } = hook('c1');
    await op({ model: 'Employee', operation: 'findMany', args: { where: { name: 'Maya' } }, query });
    expect(calls[0].where).toEqual({ AND: [{ name: 'Maya' }, { companyId: 'c1' }] });
  });

  it('adds companyId as an extra unique filter for findUnique/update/delete', async () => {
    const { op, calls, query } = hook('c1');
    await op({ model: 'Employee', operation: 'findUnique', args: { where: { id: 'e1' } }, query });
    expect(calls[0].where).toEqual({ id: 'e1', companyId: 'c1' });
  });

  it('stamps companyId onto create data', async () => {
    const { op, calls, query } = hook('c1');
    await op({ model: 'Employee', operation: 'create', args: { data: { name: 'Maya' } }, query });
    expect(calls[0].data.companyId).toBe('c1');
  });

  it('stamps companyId onto every row of createMany', async () => {
    const { op, calls, query } = hook('c1');
    await op({ model: 'Employee', operation: 'createMany', args: { data: [{ name: 'A' }, { name: 'B' }] }, query });
    expect(calls[0].data).toEqual([
      { name: 'A', companyId: 'c1' },
      { name: 'B', companyId: 'c1' },
    ]);
  });

  it('scopes the where AND stamps the create branch of upsert', async () => {
    const { op, calls, query } = hook('c1');
    await op({
      model: 'CompanySettings',
      operation: 'upsert',
      args: { where: { id: 's1' }, create: { companyName: 'Acme' }, update: {} },
      query,
    });
    expect(calls[0].where).toEqual({ id: 's1', companyId: 'c1' });
    expect(calls[0].create).toEqual({ companyName: 'Acme', companyId: 'c1' });
  });
});
