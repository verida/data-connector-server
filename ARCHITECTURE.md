# Overview

The `DID server` provides a public `DID Registry` (via a REST API) for a Verida DID Method that supports creating, updating and removing `DID documents` from the Verida network that meet the [DID Core v1.0 specification](https://www.w3.org/TR/did-core/).

This API acts as a discovery service, providing information on public keys and endpoints available for each DID.

This API is currently centralized and managed by Verida. In due course, this REST API will be replaced with a decentralized solution when we feel there is an appropriately mature solution that doesn't compromise on usability, reliability and price. There are existing options such as [Ceramic Network](https://ceramic.network/) and [ION](https://github.com/decentralized-identity/ion) that may be suitable candidates in the future. There is also the [ethr-did-registry](https://github.com/uport-project/ethr-did-registry) that could be utilized on a cheaper, faster EVM compatible layer 2.

This API is a MVP and only supports basic features.

A `Verida account` is a DID stored in this `DID Registry` with a DID Method prefix `did:vda`.

# User stories

This REST API addresses the following user stories:

- As a `User` on the Verida network I can register a new `Verida account` by creating a new DID (`did:vda`)
- As a `Client SDK` of the Verida network I can lookup and verify a `Verida account` exists
- As a `Verida account` I can register a new connection to an `Application context` by adding application context public keys
- As a `Client SDK` of the Verida network I can discover the network endpoints to establish a connection with a `Verida Account` for a given `Application context` for a given purpose (database, data storage, messaging, notification)
- As a `Client SDK` I can discover the public asymmetric key for another `Verida account` to send an encrypted payload
- As a `Verida account` I can update my Verida network endpoints for a given `Application context`
- As a `REST API` I can ensure only the controller of a DID can update their `DID document`

It is designed to address these user stories related to Verida architecture:

- As a `Smart Contract` I can verify data signed off-chain by a `Verida account`

It does not address these user stories:

- As a `Verida account` I can revoke or replace a key in a DID document I control

# Security

- Each `DID document` is converted to a string (via `JSON.stringify`), hashed using `keccak256` and signed using `secp256k1` (Ethereum hashing and signing algorithms) by the `DID document` controller via the `proof` property. The format of this proof matches the `proof` format as defined in the [Veriable Credentials standard](https://www.w3.org/TR/vc-data-model/#proofs-signatures)
- The API verifies the `DID document` proof before writing any document changes to the `DID registry`
- The `proof` remains on the `DID document` for any third party to verify

An example `proof` property in the `DID Document`:

```
{
  "proof": {
    "type": "EcdsaSecp256k1VerificationKey2019",
    "verificationMethod": "did:example:123456789abcdefghi",
    "proofPurpose": "assertionMethod",
    "proofValue": "<signature>"
  }
}
```

# Key revocation / rotation

Key revocation is not currently supported, due to its non-trivial nature. In theory a DID could replace a signing key in the `DID document`, however doing so would prevent previously signed data from being verified as the key has changed.

In the future, it's expected that key revocation will be supported by providing a method to identify the valid public keys at a specific point in time. This will be implemented by storing timestamped version histories of each `DID document`.

See [DID-Core Revocation Semantics](https://www.w3.org/TR/did-core/#revocation-semantics) for a deeper explanation of the considerations.

It may be possible to implement key rotation in such a way that a chain of previous keys can be formed to deterministically build the currently active private keys linked to the `DID document`.

# How Verida uses this DID registry

## DID document explained

A Verida account (`did:vda`) can be used to access multiple `Application context`'s.

An `Application context` is a human readable string representing the application name (ie: `Verida: Vault`).

@todo: Document the exact format. By convention it should be in the form `<Organisation Name>: <Application Name>`.

**Consideration:** Follow domain name style convention (ie: `application.verida`)

Each `Application context` has multiple `serviceEndpoint` entries, one for each supported endpoint type (`Database`, `Storage`, `Message`, `Notification`). The `Application context` is specified as a query parameter (`context`) in the `id` URI of the `serviceEndpoint`.

Each `Application context` has a public signing key (`assertionMethod`) and a public encryption key (`keyAgreement`). The actual key material is defined in the `verificationMethod` property.

The `Application context` isn't stored directly. A `Context hash` is generated:

```
contextHash = keccak256(`did:vda` + `Application context`)
```

```
{
  "@context": [
    "https://www.w3.org/ns/did/v1"
  ],

  "id": "did:vda:123456789abcdefghi",

  "service": [{
    "id":"did:example:123456789abcdefghi?context=context-hash-1#databaseEndpoint",
    "type": "VeridaDatabase", 
    "serviceEndpoint": "https://db.testnet.verida.io"
  },{
    "id":"did:example:123456789abcdefghi?context=context-hash-1#storageEndpoint",
    "type": "VeridaStorage", 
    "serviceEndpoint": "https://files.testnet.verida.io"
  },{
    "id":"did:example:123456789abcdefghi?context=context-hash-1#messageEndpoint",
    "type": "VeridaMessage", 
    "serviceEndpoint": "https://db.testnet.verida.io"
  },{
    "id":"did:example:123456789abcdefghi?context=context-hash-1#notificationEndpoint",
    "type": "VeridaNotification", 
    "serviceEndpoint": "https://notifications.testnet.verida.io"
  }],

  "verificationMethod": [{
      "id": "did:example:123456789abcdefghi?context=context-hash-1#sign",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "did:example:123456789abcdefghi"
      "publicKeyHex": "027560af3387d375e3342a6968179ef3c6d04f5d33b2b611cf326d4708badd7770"
  }, {
      "id": "did:example:123456789abcdefghi?context=context-hash-1#asym",
      "type": "Curve25519EncryptionPublicKey",
      "controller": "did:example:123456789abcdefghi"
      "publicKeyHex": "027560af3387d375e3342a6968179ef3c6d04f5d33b2b611cf326d4708badd7770"
  }],

  "assertionMethod": [
    "did:example:123456789abcdefghi?context=context-hash-1#sign"
  ],
  
  "keyAgreement": [
      "did:example:123456789abcdefghi?context=context-hash-1#asym"
  ],

  "proof": {
    "type": "EcdsaSecp256k1VerificationKey2019",
    "verificationMethod": "did:example:123456789abcdefghi",
    "proofPurpose": "assertionMethod",
    "proofValue": "<signature>"
  }

}
```

This architecture allows `Verida account` holders to have a publicly discoverable DID they can share with anyone to initiate a connection (`did:vda:123456789abcdefghi`). A third party can encrypt data for a `Verida account` and `Application context` by calculating the `Context hash` and looking up the `asym` public key. Similarly a third party can verify a signature by calculating the `Context hash` and looking up the `sign` public key.

Each `Application context` represents a siloed subset of data on the Verida network for a given `Verida account`. This ensures websites / dApps can be granted access to a subset of data for a given end user, instead of unlocking all of their data.

For example:

- Jane has a `Verida account` (`did:vda:0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7`)
- Jane connects to the `Verida: Demo Chat` application on the Verida network. As she is connecting for the first time, the Verida Client SDK will generate an `Application context` signing public key and asymmetric public key for Jane and add them to Jane's `DID document`

## Private keys

The Verida `Client SDK` is designed to deterministically generate a private key for each `Application context` using the master seed phrase for the `Verida account`. While not essential, this prevents the need to save any additional private keys and allows the `Verida account` to easily unlock all the keys for all the `Application context`'s controlled by the user.

When key rotation is implemented, this will need to change, allowing new key material to be securely stored off chain for each `Application context`.

## Signatures

Data is signed using a key that is unique for each `Application context`. The public key is available in the `DID document` for the `did:vda`:

```
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1"
  ],

  "id": "did:vda:123456789abcdefghi",

  "verificationMethod": [{
      "id": "did:vda:123456789abcdefghi?context=context-hash-1#sign",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "did:example:123456789abcdefghi"
      "publicKeyHex": "027560af3387d375e3342a6968179ef3c6d04f5d33b2b611cf326d4708badd7770"
  }],

  "assertionMethod": [
    "did:vda:123456789abcdefghi?context=context-hash-1#sign"
  ],
}
```

Data can be verified by ensuring the signature generates a signing address that matches the hex representation of `publicKeyHex`

## Performance considerations

There is a lot of data being stored in the `DID document` and it will grow proportional to the number of connected `Application context`'s. Additionally, each new `Application context` requires re-writing the whole document.

## Privacy considerations

The `DID document` is public, so once it is stored in an immutable storage engine (ie: a blockchain) the information will be public forever.

This could be improved by exposing a single `serviceEndpoint` for each `DID document` that provides the details of each connected `Application context`. This would offer the following benefits:

- Connected `Application context`'s can be removed and there is no immutable record of that history (although this doesn't prevent an indexer caching the data in a third party system)
- An authentication layer could be added to the `serviceEndpoint` requiring a third party to be authorized by the DID controller before accessing `Application context` data. Such authentication could offer authorization to only access certain `Application context`'s.

## Off-chain / On-chain data considerations

The Verida network is designed to support signed off-chain data being made available to on-chain smart contracts (in a verifiable way) across multiple chains. For this to work correctly, the smart contract needs to be able to verify the data has been signed by a trusted third party.

While the exact mechanics of that is out of scope for this document, what's important is to ensue we utilize a signature scheme that is cheap to execute on popular blockchains.

The Ethereum Virtual Machine (EVM) is currently the most popular blockchain engine and in turn, it's native signature schema (`Secp256k1`) and hashing algorithm (`keccak256`) is natively supported by most other blockchain virtual machines. For this reason, this `DID Registry` and the Verida `Client SDK` uses the `Secp256k1` signature scheme and `keccak256` hashing algorithm via the `ethers.js` library.