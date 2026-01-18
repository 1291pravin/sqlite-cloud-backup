#!/usr/bin/env node

/**
 * Publish script for sqlite-cloud-backup
 *
 * Usage:
 *   node scripts/publish.js patch   # 0.1.2 -> 0.1.3
 *   node scripts/publish.js minor   # 0.1.2 -> 0.2.0
 *   node scripts/publish.js major   # 0.1.2 -> 1.0.0
 *
 * Or via npm:
 *   npm run publish:patch
 *   npm run publish:minor
 *   npm run publish:major
 */

const { execSync } = require('child_process');
const readline = require('readline');

const VALID_TYPES = ['patch', 'minor', 'major'];

function run(cmd, options = {}) {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...options });
}

function runSilent(cmd) {
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

async function main() {
  const type = process.argv[2];

  // Validate version type
  if (!type || !VALID_TYPES.includes(type)) {
    console.error(`\nUsage: node scripts/publish.js <${VALID_TYPES.join('|')}>\n`);
    console.error('Examples:');
    console.error('  node scripts/publish.js patch   # 0.1.2 -> 0.1.3');
    console.error('  node scripts/publish.js minor   # 0.1.2 -> 0.2.0');
    console.error('  node scripts/publish.js major   # 0.1.2 -> 1.0.0');
    process.exit(1);
  }

  try {
    // Get current version
    const currentVersion = runSilent('node -p "require(\'./package.json\').version"');
    console.log(`\nCurrent version: ${currentVersion}`);

    // Check for uncommitted changes
    const status = runSilent('git status --porcelain');
    if (status) {
      console.error('\nError: You have uncommitted changes. Please commit or stash them first.\n');
      console.log(status);
      process.exit(1);
    }

    // Check we're on main branch
    const branch = runSilent('git branch --show-current');
    if (branch !== 'main') {
      console.warn(`\nWarning: You're on branch '${branch}', not 'main'.`);
      if (!await confirm('Continue anyway?')) {
        process.exit(0);
      }
    }

    // Pull latest
    console.log('\nPulling latest changes...');
    run('git pull origin main');

    // Run tests
    console.log('\nRunning tests...');
    run('npm test');

    // Run typecheck
    console.log('\nRunning typecheck...');
    run('npm run typecheck');

    // Calculate new version
    const versionParts = currentVersion.split('.').map(Number);
    let newVersion;
    if (type === 'major') {
      newVersion = `${versionParts[0] + 1}.0.0`;
    } else if (type === 'minor') {
      newVersion = `${versionParts[0]}.${versionParts[1] + 1}.0`;
    } else {
      newVersion = `${versionParts[0]}.${versionParts[1]}.${versionParts[2] + 1}`;
    }

    console.log(`\nVersion bump: ${currentVersion} -> ${newVersion}`);

    if (!await confirm(`\nReady to publish v${newVersion}?`)) {
      console.log('Aborted.');
      process.exit(0);
    }

    // Bump version (creates commit and tag)
    console.log('\nBumping version...');
    run(`npm version ${type}`);

    // Push to GitHub
    console.log('\nPushing to GitHub...');
    run('git push origin main --tags');

    console.log(`\n✅ Successfully published v${newVersion}!`);
    console.log('\nGitHub Actions will now:');
    console.log('  1. Run tests');
    console.log('  2. Build the package');
    console.log('  3. Publish to npm with provenance');
    console.log(`\nMonitor: https://github.com/1291pravin/sqlite-cloud-backup/actions`);

  } catch (error) {
    console.error('\n❌ Publish failed:', error.message);
    process.exit(1);
  }
}

main();
