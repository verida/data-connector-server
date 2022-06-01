import { EnvironmentType } from '@verida/client-ts'
import serverconfig from './serverconfig.json' 

export default serverconfig

export function strToEnvType(s: string) { 
    if (s == EnvironmentType.LOCAL) {
        return EnvironmentType.LOCAL;
    } else if (s == EnvironmentType.TESTNET) {
        return EnvironmentType.TESTNET;
    } else if (s == EnvironmentType.MAINNET) {
        return EnvironmentType.MAINNET;
    } else {
        throw new Error("Invalid EnvironmentType value");
    }
}