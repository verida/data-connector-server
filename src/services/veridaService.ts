import { IContext } from "@verida/types"


export class VeridaService {
    protected did: string
    protected context: IContext

    constructor(did: string, context: IContext) {
        this.did = did
        this.context = context
    }
}