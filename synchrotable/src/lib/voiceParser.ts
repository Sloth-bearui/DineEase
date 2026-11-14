import { MENU_ITEMS } from './data';
import { CourseType } from './types';

export interface ParsedVoiceItem {
  dishId: string;
  dishName: string;
  course: CourseType;
  quantity: number;
  price: number;
  matchedPhrase: string;
}

export interface VoiceOrderParseResult {
  rawTranscript: string;
  confidence: number;
  matchedItems: ParsedVoiceItem[];
  unmatchedPhrases: string[];
  totalEstimatedCost: number;
  success: boolean;
  explanation: string;
}

// Number word converter
const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  a: 1,
  an: 1,
  single: 1,
  double: 2,
  triple: 3,
  pair: 2,
};

// Natural language keywords matching our menu
const DISH_ALIASES: Record<string, string[]> = {
  main_smash_burger: ['smash cheeseburgers', 'smash burger', 'smash burgers', 'cheeseburgers', 'cheeseburger', 'classic burger', 'single burger', 'burger', 'burgers'],
  main_double_burger: ['double bacon burgers', 'double bacon burger', 'double burgers', 'double burger', 'double smash', 'bacon burger', 'double cheeseburger'],
  main_grilled_cheese: ['grilled cheese', 'cheese toastie', 'cheese toasties', 'three cheese melt', 'cheese melt', 'toastie', 'melt sandwich'],
  starter_garlic_sourdough: ['garlic bread', 'garlic sourdough', 'sourdough bread', 'artisan bread', 'bread with butter'],
  starter_crispy_fries: ['truffle fries', 'parmesan fries', 'truffle parmesan fries', 'french fries', 'crispy fries', 'fries', 'chips'],
  dessert_molten_lava: ['lava cake', 'lava cakes', 'chocolate cake', 'molten lava', 'dessert cake', 'warm chocolate'],
  bev_specialty_espresso: ['flat white', 'oat flat white', 'espresso', 'coffee', 'latte', 'cappuccino', 'iced coffee'],
};

/**
 * Intelligent client/server voice-to-dish parser
 * Takes raw transcript (e.g. "I would like two smash cheeseburgers and one truffle fries please")
 * and converts it into structured order items.
 */
export function parseVoiceOrder(transcript: string): VoiceOrderParseResult {
  if (!transcript || transcript.trim() === '') {
    return {
      rawTranscript: '',
      confidence: 0,
      matchedItems: [],
      unmatchedPhrases: [],
      totalEstimatedCost: 0,
      success: false,
      explanation: 'No speech input detected.',
    };
  }

  const clean = transcript.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ');
  const words = clean.split(/\s+/).filter(Boolean);

  const matchedItems: ParsedVoiceItem[] = [];
  const matchedTokens = new Set<number>();

  // Check aliases against the text
  for (const [dishId, aliases] of Object.entries(DISH_ALIASES)) {
    const dish = MENU_ITEMS.find((d) => d.id === dishId);
    if (!dish) continue;

    for (const alias of aliases) {
      const aliasWords = alias.split(' ');
      
      // Look for alias occurrences in token stream
      for (let i = 0; i <= words.length - aliasWords.length; i++) {
        let isMatch = true;
        for (let j = 0; j < aliasWords.length; j++) {
          if (words[i + j] !== aliasWords[j]) {
            isMatch = false;
            break;
          }
        }

        if (isMatch) {
          // Check preceding words for quantity (e.g., "two", "2", "3")
          let qty = 1;
          if (i > 0) {
            const prevWord = words[i - 1];
            if (/^\d+$/.test(prevWord)) {
              qty = parseInt(prevWord, 10);
              matchedTokens.add(i - 1);
            } else if (NUMBER_WORDS[prevWord]) {
              qty = NUMBER_WORDS[prevWord];
              matchedTokens.add(i - 1);
            }
          }

          // Mark words as matched
          for (let j = 0; j < aliasWords.length; j++) {
            matchedTokens.add(i + j);
          }

          // Merge if already matched same dish
          const existing = matchedItems.find((m) => m.dishId === dish.id);
          if (existing) {
            existing.quantity += qty;
          } else {
            matchedItems.push({
              dishId: dish.id,
              dishName: dish.name,
              course: dish.course,
              quantity: qty,
              price: dish.price,
              matchedPhrase: alias,
            });
          }
          break; // Stop after first alias match for this dish
        }
      }
    }
  }

  const totalCost = matchedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Extract leftover unmatched phrases for feedback
  const unmatched = words
    .filter((_, idx) => !matchedTokens.has(idx))
    .filter((w) => !['i', 'would', 'like', 'want', 'please', 'and', 'a', 'an', 'for', 'me', 'to', 'order', 'have', 'get'].includes(w));

  return {
    rawTranscript: transcript,
    confidence: matchedItems.length > 0 ? 0.95 : 0.2,
    matchedItems,
    unmatchedPhrases: unmatched,
    totalEstimatedCost: Number(totalCost.toFixed(2)),
    success: matchedItems.length > 0,
    explanation:
      matchedItems.length > 0
        ? `Successfully recognized ${matchedItems.length} item(s): ${matchedItems.map((m) => `${m.quantity}x ${m.dishName}`).join(', ')}.`
        : 'Could not match spoken items to current menu dishes. Try saying: "Two cheeseburgers and one truffle fries".',
  };
}

