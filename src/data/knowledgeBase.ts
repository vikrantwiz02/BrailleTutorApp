// Offline Braille Knowledge Base
// Replaces external cloud LLMs to provide instantaneous, offline answers

export interface KnowledgeEntry {
  id: string;
  query: string;
  aliases: string[];
  response: string;
}

export const brailleKnowledgeBase: KnowledgeEntry[] = [
  {
    id: "kb_what_is_braille",
    query: "What is Braille?",
    aliases: [
      "explain braille to me",
      "what exactly is braille",
      "tell me about braille",
      "how does braille work"
    ],
    response: "Braille is a tactile writing system used by people who are blind or visually impaired. It is traditionally written with embossed paper and consists of cells containing up to six raised dots."
  },
  {
    id: "kb_who_invented",
    query: "Who invented Braille?",
    aliases: [
      "who made braille",
      "where did braille come from",
      "who is the creator of braille"
    ],
    response: "Braille was invented by Louis Braille, a Frenchman who lost his sight as a child. He published the system in eighteen twenty-nine when he was just fifteen years old."
  },
  {
    id: "kb_how_to_read",
    query: "How do you read Braille?",
    aliases: [
      "how do I read it",
      "how is braille read",
      "can you teach me how to read"
    ],
    response: "You read Braille by moving your fingertips smoothly across the raised dots from left to right. It takes practice to develop the tactile sensitivity needed to identify the patterns quickly."
  },
  {
    id: "kb_what_is_cell",
    query: "What is a Braille cell?",
    aliases: [
      "explain the cell",
      "what are the six dots",
      "how many dots are in a cell"
    ],
    response: "A standard Braille cell is composed of six dots arranged in a rectangle containing two columns of three dots each. The left column contains dots one, two, and three, and the right column contains dots four, five, and six."
  },
  {
    id: "kb_dot_1",
    query: "What is dot 1?",
    aliases: [
      "where is dot 1",
      "explain dot 1"
    ],
    response: "Dot 1 is the top left dot in the Braille cell. By itself, it represents the letter A."
  },
  {
    id: "kb_alphabet_a",
    query: "How do you write the letter A?",
    aliases: [
      "what is the letter a in braille",
      "how to write a"
    ],
    response: "The letter A is written using just dot 1, which is the top left dot."
  },
  {
    id: "kb_alphabet_b",
    query: "How do you write the letter B?",
    aliases: [
      "what is the letter b in braille",
      "how to write b"
    ],
    response: "The letter B is written using dots 1 and 2, which are the top and middle dots on the left side."
  },
  {
    id: "kb_alphabet_c",
    query: "How do you write the letter C?",
    aliases: [
      "what is the letter c in braille",
      "how to write c"
    ],
    response: "The letter C is written using dots 1 and 4, which are the two top dots across the cell."
  },
  {
    id: "kb_numbers",
    query: "How do you write numbers in Braille?",
    aliases: [
      "how to write numbers",
      "what are numbers in braille",
      "explain numbers"
    ],
    response: "Numbers are written using the letters A through J, preceded by a special number sign made of dots 3, 4, 5, and 6. For example, the number 1 is the number sign followed by the letter A."
  },
  {
    id: "kb_capital_letters",
    query: "How do you capitalize a letter?",
    aliases: [
      "how to make capital letters",
      "what is the capital sign",
      "how are capitals written"
    ],
    response: "To capitalize a letter, you place a capital sign directly in front of it. The capital sign consists of a single dot 6."
  },
  {
    id: "kb_hardware_connect",
    query: "How do I connect the braille plotter?",
    aliases: [
      "how to connect device",
      "connect the bluetooth printer",
      "my device won't connect"
    ],
    response: "To connect your Braille plotter, just say 'Connect device' or navigate to the device screen. Make sure your plotter is turned on and bluetooth is enabled on your phone."
  },
  {
    id: "kb_greeting",
    query: "Hello",
    aliases: [
      "hi there",
      "hey buddy",
      "good morning",
      "good afternoon"
    ],
    response: "Hello there! I am Braille Buddy, your personal tutor. What would you like to learn today?"
  },
  {
    id: "kb_how_are_you",
    query: "How are you doing?",
    aliases: [
      "how are you",
      "how is your day",
      "how do you feel"
    ],
    response: "I'm doing wonderfully, thank you for asking! I'm ready whenever you are to practice some braille."
  },
  {
    id: "kb_thanks",
    query: "Thank you",
    aliases: [
      "thanks",
      "I appreciate it",
      "that helps"
    ],
    response: "You're very welcome! Let me know if you need help with anything else."
  }
];
