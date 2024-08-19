// import Groq from "groq-sdk"
import Axios from 'axios'
import CONFIG from "../config"

const enum BedrockModels {
  LLAMA3_70B = "meta.llama3-70b-instruct-v1:0",
  LLAMA3_8B = "meta.llama3-8b-instruct-v1:0",
  MIXTRAL_8_7B = "mistral.mixtral-8x7b-instruct-v0:1"
}

const BEDROCK_KEY = CONFIG.verida.llms.bedrockKey
const BEDROCK_ENDPOINT = CONFIG.verida.llms.bedrockEndpoint

export class LLMServices {

    public static async bedrock(prompt: string, model: BedrockModels = BedrockModels.LLAMA3_70B) {
      const response = await Axios.post(BEDROCK_ENDPOINT, {
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        model,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BEDROCK_KEY}` 
        }
      });

      return response.data.choices[0].message.content
    }
}