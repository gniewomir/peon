import assert from 'node:assert';

export function getRandomNumber(min: number, max: number): number {
  assert(min <= max, 'Min must be less than or equal to max');
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRandomElement<T>(array: T[]): T {
  assert(Array.isArray(array) && array.length > 0, 'Array must have at least one element');
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex] as T;
}

export function getRandomElementAndRemove<T>(array: T[]): T {
  assert(Array.isArray(array) && array.length > 0, 'Array must have at least one element');
  const randomIndex = Math.floor(Math.random() * array.length);
  const element = array[randomIndex];
  array.splice(randomIndex, 1);
  return element as T;
}

export const getRandomElementOfArray = getRandomElement;
