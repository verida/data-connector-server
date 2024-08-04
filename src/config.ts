import serverconfig from './serverconfig.example.json' 
import localconfig from './serverconfig.local.json'
export default {
    ...serverconfig,
    ...localconfig
}