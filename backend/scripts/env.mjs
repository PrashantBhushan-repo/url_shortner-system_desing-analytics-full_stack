import { spawn } from 'node:child_process';
import path from 'node:path';
import { backendRoot, loadEnvironment, validateEnvironment } from '../src/config/environment.js';

const args = process.argv.slice(2);
if (args[0] && !args[0].startsWith('--')) process.env.NODE_ENV = args.shift();
loadEnvironment();
validateEnvironment();

if (args.length === 0 || args[0] === '--check') {
  // Deliberately print no URLs, passwords, keys, or other variable values.
  console.log(`Environment configuration valid (${process.env.NODE_ENV}). No secrets displayed.`);
} else {
  if (args.shift() !== '--' || !args.length) throw new Error('Usage: node scripts/env.mjs [development|production|test] [--check | -- script.js arguments]');
  const child = spawn(process.execPath, [path.resolve(backendRoot, args.shift()), ...args], {
    cwd: backendRoot, env: process.env, stdio: 'inherit',
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
}
