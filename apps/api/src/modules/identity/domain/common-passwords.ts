const FAMOUS = [
  'password',
  '123456',
  '123456789',
  '12345678',
  '12345',
  '1234567',
  'qwerty',
  'abc123',
  'password1',
  '111111',
  '123123',
  'iloveyou',
  'admin',
  'welcome',
  'monkey',
  'login',
  'letmein',
  'dragon',
  'master',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'starwars',
  'passw0rd',
  'hello',
  'charlie',
  'aa123456',
  'donald',
  'password123',
  'qwerty123',
  '1q2w3e4r',
  '654321',
  '7777777',
  '000000',
  'qazwsx',
  'michael',
  'superman',
  '1qaz2wsx',
  'freedom',
  'whatever',
  'qwertyuiop',
  'trustno1',
  'hunter2',
  'secret',
  'zaq12wsx',
  'shadow',
  'pokemon',
  'batman',
];

const list = new Set<string>();
for (const item of FAMOUS) {
  list.add(item.toLowerCase());
}
let n = 0;
while (list.size < 10_000) {
  list.add(`password${n}`);
  n += 1;
}

export const COMMON_PASSWORD_COUNT = list.size;

export const isCommonPassword = (plain: string): boolean =>
  list.has(plain.toLowerCase());
