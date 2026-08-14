/**
 * Applique api/schema.sql sur la base pointee par DATABASE_URL.
 * Idempotent : les `create table if not exists` peuvent etre rejoues.
 *
 *   npm run db:init
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');

// Charge .env sans dependance : une ligne CLE=valeur, les # sont des commentaires.
try {
  for (const ligne of readFileSync(join(racine, '.env'), 'utf8').split('\n')) {
    const trim = ligne.trim();
    if (!trim || trim.startsWith('#')) continue;
    const separateur = trim.indexOf('=');
    if (separateur === -1) continue;
    const cle = trim.slice(0, separateur).trim();
    const valeur = trim
      .slice(separateur + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!process.env[cle]) process.env[cle] = valeur;
  }
} catch {
  // Pas de .env : on compte sur les variables deja presentes dans l'environnement.
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant. Cree un fichier .env a partir de .env.example.');
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(join(racine, 'api', 'schema.sql'), 'utf8');

// Le driver HTTP n'accepte qu'une instruction a la fois.
const instructions = schema
  .split(';')
  .map((x) => x.trim())
  .filter((x) => x && !x.split('\n').every((ligne) => ligne.trim().startsWith('--')));

for (const instruction of instructions) {
  // sql`` est reserve aux templates ; ici le SQL vient d'un fichier.
  await sql.query(instruction);
  console.log('✓', instruction.split('\n')[0].slice(0, 70));
}

console.log('\nBase prete.');
