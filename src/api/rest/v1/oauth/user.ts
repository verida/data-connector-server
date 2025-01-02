
export class VeridaOAuthUser {

    protected did: string

    constructor(did: string) {
        this.did = did
    }

    public get id() {
        return this.did
    }

}