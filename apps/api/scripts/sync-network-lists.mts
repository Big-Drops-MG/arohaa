import { syncNetworkLists } from '../src/services/network-list-sync.service.js'

const skipInternal = process.argv.includes('--skip-internal')
const result = await syncNetworkLists({ skipInternal })
console.log(JSON.stringify(result, null, 2))
if (!result.ok) process.exitCode = 1
