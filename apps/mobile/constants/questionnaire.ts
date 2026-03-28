export type QuestionType = 'single-select' | 'multi-select' | 'scale';

export interface QuestionOption {
  key: string;
  label: string;
  emoji?: string;
}

export interface Question {
  key: string;
  type: QuestionType;
  question: string;
  subtitle?: string;
  options?: QuestionOption[];
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  required: boolean;
}

export const QUESTIONNAIRE_QUESTIONS: Question[] = [
  {
    key: 'social_energy',
    type: 'single-select',
    question: 'How would you describe your social energy?',
    subtitle: 'We use this to match you with compatible people',
    options: [
      { key: 'introvert', label: 'Introvert', emoji: '🌙' },
      { key: 'ambivert', label: 'Ambivert', emoji: '⚡' },
      { key: 'extrovert', label: 'Extrovert', emoji: '☀️' },
    ],
    required: true,
  },
  {
    key: 'interests',
    type: 'multi-select',
    question: 'What are you into?',
    subtitle: 'Pick all that apply',
    options: [
      { key: 'food', label: 'Food & Dining', emoji: '🍜' },
      { key: 'outdoors', label: 'Outdoors & Nature', emoji: '🏔️' },
      { key: 'arts', label: 'Arts & Culture', emoji: '🎨' },
      { key: 'music', label: 'Music & Concerts', emoji: '🎵' },
      { key: 'sports', label: 'Sports & Fitness', emoji: '🏃' },
      { key: 'gaming', label: 'Games & Trivia', emoji: '🎮' },
      { key: 'tech', label: 'Tech & Science', emoji: '💻' },
      { key: 'travel', label: 'Travel & Adventure', emoji: '✈️' },
      { key: 'wellness', label: 'Wellness & Mindfulness', emoji: '🧘' },
      { key: 'books', label: 'Books & Learning', emoji: '📚' },
    ],
    required: true,
  },
  {
    key: 'group_vibe',
    type: 'multi-select',
    question: 'What kind of group vibe are you looking for?',
    subtitle: 'Pick all that apply — we\'ll find your perfect mix',
    options: [
      { key: 'chill', label: 'Chill & relaxed', emoji: '😌' },
      { key: 'lively', label: 'Lively & energetic', emoji: '🎉' },
      { key: 'intellectual', label: 'Deep conversations', emoji: '🧠' },
      { key: 'adventurous', label: 'Spontaneous & adventurous', emoji: '🚀' },
      { key: 'foodie', label: 'Food & drink focused', emoji: '🍷' },
      { key: 'active', label: 'Active & outdoorsy', emoji: '🏃' },
    ],
    required: true,
  },
  {
    key: 'age_range',
    type: 'single-select',
    question: 'What\'s your age range?',
    options: [
      { key: '18-24', label: '18-24' },
      { key: '25-30', label: '25-30' },
      { key: '31-35', label: '31-35' },
      { key: '36-40', label: '36-40' },
      { key: '41+', label: '41+' },
    ],
    required: true,
  },
  {
    key: 'activity_preference',
    type: 'multi-select',
    question: 'What kinds of activities are you down for?',
    subtitle: 'Select everything you\'d enjoy — more = better matches',
    options: [
      { key: 'food_drink', label: 'Food & drinks', emoji: '🍻' },
      { key: 'outdoor', label: 'Outdoor activities', emoji: '🌳' },
      { key: 'indoor', label: 'Indoor hangouts', emoji: '🏠' },
      { key: 'culture', label: 'Arts & culture', emoji: '🎨' },
      { key: 'games', label: 'Games & trivia', emoji: '🎮' },
      { key: 'any', label: 'Surprise me!', emoji: '🎲' },
    ],
    required: true,
  },
  {
    key: 'openness',
    type: 'scale',
    question: 'How open are you to meeting very different people?',
    subtitle: 'We balance similarity and diversity in groups',
    scaleMin: 1,
    scaleMax: 5,
    scaleMinLabel: 'Similar to me',
    scaleMaxLabel: 'Very different',
    required: true,
  },
  {
    key: 'goal',
    type: 'multi-select',
    question: 'What are you hoping to get from Squad?',
    options: [
      { key: 'friends', label: 'Make new friends', emoji: '👥' },
      { key: 'network', label: 'Expand my network', emoji: '🤝' },
      { key: 'dates', label: 'Maybe meet someone special', emoji: '💫' },
      { key: 'fun', label: 'Just have fun', emoji: '🎉' },
      { key: 'explore', label: 'Explore the city', emoji: '🗺️' },
    ],
    required: true,
  },
  {
    key: 'drinking_preference',
    type: 'single-select',
    question: 'How do you feel about drinking at meetups?',
    subtitle: 'We use this to match you with the right vibe',
    options: [
      { key: 'drinking', label: 'I enjoy drinks', emoji: '🍻' },
      { key: 'sober_friendly', label: 'I prefer sober hangouts', emoji: '🧃' },
      { key: 'no_preference', label: 'No preference', emoji: '🤷' },
    ],
    required: true,
  },
  {
    key: 'budget_preference',
    type: 'single-select',
    question: 'What\'s your preferred spend for a night out?',
    subtitle: 'Helps us find venues that work for everyone',
    options: [
      { key: 'budget', label: 'Keep it affordable', emoji: '💵' },
      { key: 'mid_range', label: 'Mid-range is fine', emoji: '💳' },
      { key: 'upscale', label: 'Happy to splurge', emoji: '✨' },
    ],
    required: true,
  },
];

export const REQUIRED_QUESTION_KEYS = QUESTIONNAIRE_QUESTIONS
  .filter((q) => q.required)
  .map((q) => q.key);
