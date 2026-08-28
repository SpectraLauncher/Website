import fs from 'node:fs'
import pg from 'pg'
const url = fs.readFileSync('.env', 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const c = new pg.Client({ connectionString: url })
await c.connect()

const me = (await c.query(`SELECT id, username FROM "user" WHERE lower(username) = 'makotopd'`)).rows[0]
if (!me) { console.log('nie ma konta makotopd'); process.exit(1) }

const day = (back) => new Date(Date.now() - back * 86400000).toISOString().slice(0, 10)
let added = 0
for (const back of [0, 1, 2, 4, 7, 9, 15, 22, 40, 60]) {
  await c.query(
    `INSERT INTO user_activity (user_id, day, launches, seconds) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, day) DO NOTHING`,
    [me.id, day(back), 1 + (back % 3), 600 + back * 120])
  added++
}
console.log('wstawiono dni testowych:', added, 'dla', me.username)
await c.end()
