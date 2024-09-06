import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response } from 'express';
import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { StructuredOutputParser, OutputFixingParser } from 'langchain/output_parsers';


dotenv.config();

const port = process.env.PORT || 3001;
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('OPENAI_API_KEY is not defined. Exiting...');
  process.exit(1);
}

const app = express();
app.use(express.json());

//  Initializes the OpenAI model

const model = new OpenAI({
  temperature: 0,
  openAIApiKey: apiKey,
  modelName: "gpt-3.5-turbo",
});


// Defines the parser for the structured output

const parser = StructuredOutputParser.fromZodSchema(z.object({
  day1: z.string(),
  day2: z.string(),
  day3: z.string(),
  day4: z.string(),
  day5: z.string(),
}).describe("A JSON object with the forecast for the next 5 days.")
)

//  Gets the format instructions from the parser

const outputFixingParser = OutputFixingParser.fromLLM(model, parser);
const formatInstructions = outputFixingParser.getFormatInstructions();

//  This is the prompt template

const promptTemplate = new PromptTemplate({
  template: 'You are a sports announcer. Provide an exciting and energetic play-by-play of the weather forecast for the next 5 days in {location}. Make it sound like a thrilling sport commentary! Return the forecast as a JSON object with each days forecast as a property. The keys should be "day1", "day2", "day3", "day4", and "day5". The JSON should be properly formatted.',
  inputVariables: ['location'],
  partialVariables: { format_instructions: formatInstructions },
});

// prompt function that takes user input and returns the response

const promptFunc = async (input: string) => {

  try {
  //  Format the prompt with the user input

  const promptInput = await promptTemplate.format({ location: input });

  //  Call the model with the formatted prompt
  const response = await model.invoke(promptInput);
  //  return the JSON response
  if (typeof response === 'string') {
    return JSON.parse(response);
  } 
  return response;

  //  Catch any errors and log them to the console
} catch (error) {
  console.error('Error:', error);
  throw error;
}};

// Endpoint to handle request
app.post('/forecast', async (req: Request, res: Response): Promise<void> => {
  try {
    const location: string = req.body.location;
    if (!location) {
      res.status(400).json({
        error: 'Please provide a location in the request body.',
      });
    }
    const result: any = await promptFunc(location);
    res.json({ result });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
