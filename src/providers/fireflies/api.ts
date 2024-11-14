import axios, { AxiosResponse } from 'axios';

export interface FireFliesConfig {
    apiKey: string;
    baseUrl?: string;
}

export interface User {
    user_id: string;
    name: string;
    email: string;
    is_admin?: string;
    num_transcripts?: string;
    integrations?: string[]; 
    
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

    private async executeQuery<T>(query: string, variables?: Record<string, any>): Promise<GraphQLResponse<T>> {
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
        const query = userId 
            ? `
                query User($userId: String!) {
                    user(id: $userId) {
                        user_id    
                        name
                        email
                    }
                }
            `
            : `
                query {
                    user {
                        user_id
                        name
                        email
                    }
                }
            `;
    
        // Pass variables only if userId is defined
        const response = userId
            ? await this.executeQuery<{ user: User }>(query, { userId })
            : await this.executeQuery<{ user: User }>(query);
    
        return response.data.user;
    }
    
    // You can add more methods to handle other queries or mutations here
}
