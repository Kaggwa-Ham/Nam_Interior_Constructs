// Helper for generating a password hash you can paste into an environment
// variable or a SQL statement.
//
//   npm run hash -- "MyNewPassword123"
//   npm run hash                 (prompts via a random suggestion)

import { hashPassword } from '../server/lib/auth.js';

const plain = process.argv[2];

if (!plain) {
  console.log('\nUsage: npm run hash -- "YourPasswordHere"\n');
  process.exit(1);
}
if (plain.length < 8) {
  console.error('\n✖ Password must be at least 8 characters.\n');
  process.exit(1);
}

const hash = await hashPassword(plain);
console.log('\nPassword hash generated.\n');
console.log(hash);
console.log('\nPaste this into ADMIN_PASSWORD to seed it, or into the DB directly.\n');
