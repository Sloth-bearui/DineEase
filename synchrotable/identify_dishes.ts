import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

async function identify() {
  for (let i = 1; i <= 12; i++) {
    const filePath = path.join(__dirname, 'public', `dish_${i}.jpeg`);
    const buffer = fs.readFileSync(filePath);
    const base64Data = buffer.toString('base64');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: 'image/jpeg',
            },
          },
          'Identify what food or beverage item this is in exactly 2 to 4 words (e.g. "Wood-fired Pizza", "Truffle Pasta", "Chocolate Dessert", "Burrata Salad", etc.).',
        ],
      });
      console.log(`Dish ${i}: ${response.text?.trim()}`);
    } catch (e: any) {
      console.log(`Dish ${i} failed: ${e.message}`);
    }
  }
}

identify();
