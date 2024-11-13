import axios, { AxiosResponse } from 'axios';

export interface FireFliesConfig {
    apiKey: string;
    baseUrl?: string;
}

export interface User {
    name: string;
    integrations: string[];
    // Add more properties as necessary
}

export interface GraphQLResponse<T> {
    data: T;
    errors?: { message: string }[];
}

export class FireFliesClient {
    private apiKey: string;
    private baseUrl: string;

    constructor(config: FireFliesConfig) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://api.fireflies.ai/graphql';
    }

    private get headers() {
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`
        };
    }

    private async executeQuery<T>(query: string, variables: Record<string, any>): Promise<GraphQLResponse<T>> {
        const payload = { query, variables };

        try {
            const response: AxiosResponse<GraphQLResponse<T>> = await axios.post(this.baseUrl, payload, { headers: this.headers });
            if (response.data.errors) {
                throw new Error(`GraphQL error: ${response.data.errors.map(e => e.message).join(', ')}`);
            }
            return response.data;
        } catch (error) {
            console.error('Error executing GraphQL query:', error);
            throw error;
        }
    }

    /**
     *  
     * @param userId Optional
     * 
     * @returns Owner by default
     */
    public async getUser(userId?: string): Promise<User> {
        const query = `
            query User($userId: String!) {
                user(id: $userId) {
                    name
                    integrations
                }
            }
        `;
        const variables = { userId };

        const response = await this.executeQuery<{ user: User }>(query, variables);
        return response.data.user;
    }

    // You can add more methods to handle other queries or mutations here
}
