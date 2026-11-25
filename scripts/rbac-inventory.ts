import * as fs from 'fs';
import * as path from 'path';
import { generateRbacInventory, formatInventoryMarkdown } from '../src/auth/rbac-inventory';

export { generateRbacInventory, formatInventoryMarkdown };

async function main() {
  console.log('Scanning controller routes...');
  const routes = generateRbacInventory();

  const counts: Record<string, number> = {};
  for (const r of routes) {
    counts[r.tier] = (counts[r.tier] || 0) + 1;
  }

  console.log('=== RBAC Route Inventory Summary ===');
  console.log(`TOTAL ROUTES: ${routes.length}`);
  console.log(`PERM:         ${counts['PERM'] || 0}`);
  console.log(`AUTH:         ${counts['AUTH'] || 0}`);
  console.log(`PUBLIC:       ${counts['PUBLIC'] || 0}`);
  console.log(`APIKEY:       ${counts['APIKEY'] || 0}`);
  console.log(`LEGACY:       ${counts['LEGACY'] || 0}`);
  console.log(`UNCLASSIFIED: ${counts['UNCLASSIFIED'] || 0}`);

  const md = formatInventoryMarkdown(routes);
  const docsDir = path.resolve(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  const outFile = path.join(docsDir, 'RBAC-ROUTES.md');
  fs.writeFileSync(outFile, md, 'utf-8');
  console.log(`Wrote documentation to ${outFile}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('rbac:inventory failed:', err);
    process.exit(1);
  });
}
