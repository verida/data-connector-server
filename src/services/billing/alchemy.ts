import { Alchemy, Network } from "alchemy-sdk"
import { Utils } from "../../utils"
import CONFIG from "../../config"
const API_KEY = CONFIG.verida.alchemy.key

const VDA_ADDRESS = "0x683565196c3eab450003c964d4bad1fd3068d4cc"
const VDA_NETWORK = Network.MATIC_MAINNET
const PRICE_CACHE_DURATION_MINS = 15

// Configures the Alchemy SDK
const config = {
    apiKey: API_KEY, // Replace with your API key
    network: VDA_NETWORK, // Replace with your network
};

let priceCache: number = undefined
let priceCacheExpiry: number = undefined

export interface TransactionInfo {
    to: string
    from: string
    amount: BigInt
}

class AlchemyManager {

    private connection: Alchemy

    constructor() {
        this.connection = new Alchemy(config)
    }

    public async getTransaction(txnHash: string): Promise<TransactionInfo> {
        const response = await this.connection.transact.getTransaction(txnHash)
        const block = response.blockNumber
        const tokenAddress = VDA_ADDRESS
        let result: TransactionInfo
        
        let logs = []
        try {
            // Fetch the logs
            logs = await this.connection.core.getLogs({
              fromBlock: block, // Starting block number
              toBlock: block,     // Ending block number or "latest"
              address: tokenAddress, // ERC20 token contract address
            });
        } catch (error) {
            console.error(error);
            throw new Error("Error fetching transaction logs")
        }
        
        // Decode and display logs
        logs.forEach((log: any) => {
            if (log.transactionHash != txnHash) {
                return
            }

            const amount = BigInt(log.data)
            const from = `0x${log.topics[1].slice(26)}`; // Decode the "from" address from the topics
            const to = `0x${log.topics[2].slice(26)}`;   // Decode the "to" address from the topics

            result = {
                to,
                from,
                amount
            }
        });

        if (!result) {
            throw new Error('Transaction not found')
        }

        return result
    }

    public async getVDAPrice(): Promise<number> {
        if (priceCache && priceCacheExpiry < Utils.nowEpoch()) {
            return priceCache
        }

        const result = await this.connection.prices.getTokenPriceByAddress([{
            network: VDA_NETWORK,
            address: VDA_ADDRESS
        }])

        if (result.data?.length) {
            const vdaPrice = result.data[0]
            priceCache = parseFloat(vdaPrice.prices[0].value)
        } else {
            console.error(`Unable to locate VDA price`)
        }

        priceCacheExpiry = Utils.nowEpoch() + PRICE_CACHE_DURATION_MINS*60
        return priceCache
    }

}

const alchemy = new AlchemyManager()
export default alchemy