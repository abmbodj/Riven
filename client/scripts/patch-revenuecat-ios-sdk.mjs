import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageSwiftPath = path.resolve(
  __dirname,
  '..',
  'node_modules',
  '@revenuecat',
  'purchases-capacitor',
  'Package.swift'
);

const oldDependency = '.package(url: "https://github.com/RevenueCat/purchases-hybrid-common.git", exact: "17.52.0")';
const newDependency = '.package(url: "https://github.com/RevenueCat/purchases-hybrid-common.git", exact: "17.53.0")';

async function patchRevenueCatPackage() {
  const source = await readFile(packageSwiftPath, 'utf8');

  if (source.includes(newDependency)) {
    console.log('RevenueCat iOS Swift package already patched to 17.53.0');
    return;
  }

  if (!source.includes(oldDependency)) {
    throw new Error(
      `Could not find the expected RevenueCat dependency pin in ${packageSwiftPath}`
    );
  }

  const updated = source.replace(oldDependency, newDependency);
  await writeFile(packageSwiftPath, updated, 'utf8');
  console.log('Patched RevenueCat Capacitor iOS dependency to purchases-hybrid-common 17.53.0');
}

patchRevenueCatPackage().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
