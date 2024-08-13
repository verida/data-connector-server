import Groq from "groq-sdk"
import Axios from 'axios'

const llmUri = 'http://127.0.0.1:11434/api/generate'
//'mixtral-8x7b-32768' // 'llama3-8b-8192' // 'llama3-70b-8192' // 'llama3-8b-8192' //'llama-3.1-8b-instant' //'llama3-70b-8192' // 'llama3-8b-8192' // gemma2-9b-it llama-3.1-70b-versatile
const GROQ_MODEL = 'llama-3.1-70b-versatile'
const GROQ_KEY = process.env.GROQ_KEY

const groq = new Groq({ apiKey: GROQ_KEY });

const enum BedrockModels {
  LLAMA3_70B = "meta.llama3-70b-instruct-v1:0",
  LLAMA3_8B = "meta.llama3-8b-instruct-v1:0",
  MIXTRAL_8_7B = "mistral.mixtral-8x7b-instruct-v0:1"
}

const BEDROCK_KEY = process.env.BEDROCK_KEY
const BEDROCK_ENDPOINT = process.env.BEDROCK_ENDPOINT

export class LLMServices {

    public async groq(query: string, model: string = GROQ_MODEL) {
        const response = await groq.chat.completions.create({
            messages: [
              {
                role: "user",
                content: query,
              },
            ],
            model: GROQ_MODEL,
          });
          return response.choices[0]?.message?.content || ''
    }

    public async llama(prompt: string, model: string = 'llama3') {
        const serverResponse = await Axios.post(llmUri, {
            model,
            prompt,
            stream: false
        })

        return serverResponse.data.response
    }

    public async bedrock(prompt: string, model: BedrockModels = BedrockModels.MIXTRAL_8_7B) {
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