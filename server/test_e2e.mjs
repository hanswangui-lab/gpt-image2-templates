import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = {}
fs.readFileSync('.env','utf8').split('\n').filter(l=>l&&!l.startsWith('#')).forEach(l=>{const [k,...v]=l.split('=');env[k.trim()]=v.join('=').trim()})
// Sign in with anon key to get a user token
const anon = createClient(env.SUPABASE_URL, 'sb_publishable_QlJbHWlCkVVU2ILqgaloRQ_IpVJIwZx')
const {data:signIn, error:signInErr} = await anon.auth.signInWithPassword({email:'hanswangui@gmail.com', password:'wjm15889337618'})
if (signInErr || !signIn.session) { console.log('SIGN IN FAILED:', signInErr?.message); process.exit(1) }
const token = signIn.session.access_token

const res = await fetch('http://localhost:3001/api/admin/announcements', {
  method:'POST',
  headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
  body:JSON.stringify({content:'端到端测试'})
})
const body = await res.json()
console.log('STATUS:', res.status, 'BODY:', JSON.stringify(body))
process.exit(0)
