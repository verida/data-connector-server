// import { LLM } from "../llm";
// import EmailDataSchema from "../schemas/email"
// const nlp = require('compromise')
// const SummarizerManager = require("node-summarizer").SummarizerManager;
// import { SorensenDiceSimilarity, DefaultTextParser, ConsoleLogger, RelativeSummarizerConfig, Summarizer, AbsoluteSummarizerConfig, NullLogger, Sentence } from "ts-textrank";


// export default class ProcessEmail {

//     public static async process(email: any) {
//         // email.metadata = {}
//         email.indexableText = EmailDataSchema.getBodyText(email)
//         return email
//         // const summarizer = new SummarizerManager(email.rawText, 3)
//         // email.summary = await summarizer.getSummaryByRank()

//         // const doc = nlp(email.rawText);
//         // const people = doc.people().out('array');
//         // const places = doc.places().out('array');
//         // const sentences = doc.sentences().out('array');

//         // console.log("People:", people); // Output: ["John"]
//         // console.log("Places:", places); // Output: ["New York"]
//         // console.log("Sentences", sentences)

//         /////

//         //Only one similarity function implemented at this moment.
//         //More could come in future versions.
//         const sim = new SorensenDiceSimilarity()

//         //Only one text parser available a this moment
//         const parser = new DefaultTextParser()

//         //Do you want logging?
//         const logger = new ConsoleLogger()

//         //You can implement LoggerInterface for different behavior,
//         //or if you don't want logging, use this:
//         //const logger = new NullLogger()

//         //Set the summary length as a percentage of full text length
//         const ratio = .25 

//         //Damping factor. See "How it works" for more info.
//         const d = .85

//         //How do you want summary sentences to be sorted?
//         //Get sentences in the order that they appear in text:
//         const sorting = Summarizer.SORT_OCCURENCE
//         //Or sort them by relevance:
//         //const sorting = Summarizer.SORT_SCORE
//         // const config = new RelativeSummarizerConfig(ratio, sim, parser, d, sorting)

//         //Or, if you want a fixed number of sentences:
//         //const number = 5
//         const config = new AbsoluteSummarizerConfig(10, sim, parser, d, sorting)    

//         const summarizer2 = new Summarizer(config, logger)

//         //Language is used for stopword removal.
//         //See https://github.com/fergiemcdowall/stopword for supported languages
//         const lang = "en"

//         //summary will be an array of sentences summarizing text
//         const summary = summarizer2.summarize(email.rawText, lang)

//         console.log('----')
//         console.log(email.rawText)
//         console.log("Original length", email.rawText.length)
//         // console.log("Summary 1", email.summary)
//         // console.log("Summary 1 length", email.summary.length)
//         console.log("Summary 2", summary)
//         console.log("Summary 2 length", summary.join(" ").length)
//         // console.log("sentences length", sentences.join(" ").length)
        

//         return {
//             // messageText: email.messageText,
//             // rawText: email.rawText,
//             // rawTextLength: email.rawText.length,
//             // messageTextLength: email.messageText.length,
//             // summary: email.summary,
//             // people,
//             // places
//         }

//         // const summarizer = new SummarizerManager(email.)
//     }

//     public static async processRAG(email: any, llm: LLM) {
//         const systemPrompt = `You are a semantic data expert and will extract semantic information from an email and will generate a JSON object that adheres to this schema. Do not include the schema in the output.
// {
//     "type": "object",
//     "properties": {
//         // "summary": {
//         //     "type": "string",
//         //     "description": "Summarize the key points of the email with up to 10 dot points as a string"
//         // },
//         // "content": {
//         //     "type": "string",
//         //     "description": "Raw content of the email, removing all HTML, links, advertising, headers, footers and excess white space"
//         // },
//         "priority": {
//             "type": "string",
//             "description": "Priority level of this email",
//             "enum": [
//                 "High",
//                 "Medium",
//                 "Low"
//             ]
//         },
//         "generalCategory": {
//             "type": "string",
//             "description": "General email category for this email",
//             "enum": [
//                 "Conversation",
//                 "Finance",
//                 "Shopping",
//                 "News",
//                 "Travel",
//                 "Health",
//                 "Education",
//                 "Legal",
//                 "Subscriptions",
//                 "Social",
//                 "Promotions",
//                 "Spam/Junk"
//             ]
//         },
//         "keywords": {
//             "type": "array",
//             "items": {
//                 "type": "string"
//             },
//             "description": "An array of the most important keywords extracted from the email. Maximum of 15."
//         },
//         "entities": {
//             "type": "object",
//             "properties": {
//                 "people": {
//                     "type": "array",
//                     "items": {
//                         "type": "string"
//                     },
//                     "description": "Names of people mentioned in the email"
//                 },
//                 "organizations": {
//                     "type": "array",
//                     "items": {
//                         "type": "string"
//                     },
//                     "description": "Names of organizations mentioned in the email"
//                 },
//                 "locations": {
//                     "type": "array",
//                     "items": {
//                         "type": "string"
//                     },
//                     "description": "Names of locations mentioned in the email"
//                 }
//             },
//             "description": "Entities extracted from the email content"
//         },
//     },
//     "required": [
//         "priorityCategories",
//         "generalCategories",
//         "keywords",
//         "entities",
//     ]
// } 
//     `
//     console.log(Object.keys(email))
//         const userPrompt = `Here is the email:\n\n${EmailDataSchema.getRagContent(email)}`

//         const result = await llm.prompt(userPrompt, systemPrompt, true)
//         return result
//     }

// }