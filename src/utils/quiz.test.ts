import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuizPrompt,
  evaluateQuizAnswers,
  isValidQuizCategory,
  parseQuizResponse,
  QUIZ_CATEGORIES,
} from './quiz';

test('QUIZ_CATEGORIES has the exact three requested categories', () => {
  assert.deepEqual(
    QUIZ_CATEGORIES.map((c) => c.label),
    ['Local cuisine', 'Art and culture', 'Local history']
  );
  assert.equal(isValidQuizCategory('Local cuisine'), true);
  assert.equal(isValidQuizCategory('Sports'), false);
});

test('buildQuizPrompt includes cityState, category, and stripped insights context', () => {
  const prompt = buildQuizPrompt(
    'Shibuya, Tokyo',
    'Local history',
    '<ul><li>Hachiko waited at Shibuya Station.</li></ul>'
  );
  assert.ok(prompt.includes('Shibuya, Tokyo'));
  assert.ok(prompt.includes('Local history'));
  assert.ok(prompt.includes('Hachiko waited at Shibuya Station.'));
  assert.ok(!prompt.includes('<ul>'));
});

test('parseQuizResponse normalizes 3 multiple choice questions cleanly', () => {
  const sampleJson = JSON.stringify({
    questions: [
      {
        question: 'Which loyal dog is commemorated outside Shibuya Station?',
        options: ['Hachiko', 'Taro', 'Jiro', 'Kuro'],
        correctIndex: 0,
        explanation: 'Hachiko waited at Shibuya Station for his owner every day for nearly ten years.',
      },
      {
        question: 'What is the busiest pedestrian intersection in Shibuya called?',
        options: ['Ginza Crossing', 'Shibuya Scramble Crossing', 'Roppongi Square', 'Asakusa Gate'],
        correctIndex: 1,
        explanation: 'Shibuya Scramble Crossing sees up to 3,000 pedestrians cross at once.',
      },
      {
        question: 'Which train station serves as the historic hub of Shibuya?',
        options: ['Ueno Station', 'Shibuya Station', 'Shinagawa Station', 'Ikebukuro Station'],
        correctIndex: 1,
        explanation: 'Shibuya Station opened in 1885 and anchored the district’s rapid growth.',
      },
    ],
  });

  const parsed = parseQuizResponse(sampleJson, 'Shibuya, Tokyo', 'Local history');
  assert.equal(parsed.questions.length, 3);
  assert.equal(parsed.questions[0].correctIndex, 0);
  assert.equal(parsed.questions[1].options.length, 4);
});

test('evaluateQuizAnswers computes score and per-question correctness accurately', () => {
  const questions = [
    {
      id: 'q-1',
      question: 'Q1',
      options: ['A', 'B', 'C', 'D'] as [string, string, string, string],
      correctIndex: 2,
      explanation: 'C is right.',
    },
    {
      id: 'q-2',
      question: 'Q2',
      options: ['A', 'B', 'C', 'D'] as [string, string, string, string],
      correctIndex: 1,
      explanation: 'B is right.',
    },
    {
      id: 'q-3',
      question: 'Q3',
      options: ['A', 'B', 'C', 'D'] as [string, string, string, string],
      correctIndex: 0,
      explanation: 'A is right.',
    },
  ];

  const result = evaluateQuizAnswers(questions, {
    'q-1': 2,
    'q-2': 0,
    'q-3': 0,
  });

  assert.equal(result.score, 2);
  assert.equal(result.total, 3);
  assert.equal(result.items[0].isCorrect, true);
  assert.equal(result.items[1].isCorrect, false);
  assert.equal(result.items[2].isCorrect, true);
});
