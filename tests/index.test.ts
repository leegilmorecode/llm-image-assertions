import { ImageAssertions, ImageTone } from '../src/index';

import fs from 'node:fs';
import path from 'node:path';

const readImageAsBase64 = (filename: string): string => {
  const imagePath = path.join(__dirname, 'images', filename);
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
};

describe('LLM Image Assertions', () => {
  let imageAssertions: ImageAssertions;

  beforeAll(() => {
    imageAssertions = new ImageAssertions();
  });

  it.skip('should validate an orange cat image', async () => {
    const base64Image = readImageAsBase64('./cat.png');

    // The original image prompt: A fluffy orange cat sitting on a windowsill
    const validationResult = await imageAssertions.validateImage({
      base64Image,
      assertionPrompt:
        'The image should contain an orange cat in a photo realistic style',
    });

    expect(validationResult).toSatisfyImageAssertions({
      assertionsMet: true,
      score: 9,
      tone: ImageTone.PHOTO_REALISTIC,
    });
  }, 60000);

  it.skip('should validate an orange cat image and no other elements', async () => {
    const base64Image = readImageAsBase64('./cat.png');

    // The original image prompt: A fluffy orange cat sitting on a windowsill
    const validationResult = await imageAssertions.validateImage({
      base64Image,
      assertionPrompt:
        'The image should contain an orange cat and no other people, objects or text present',
    });

    expect(validationResult).toSatisfyImageAssertions({
      assertionsMet: true,
      score: 9,
      tone: ImageTone.PHOTO_REALISTIC,
    });
  }, 60000);

  it.skip('should validate failing image - man presenting (failing test)', async () => {
    const base64Image = readImageAsBase64('./man-speaking.png');

    // original image prompt: A man wearing an AWS Lambda t-shirt presenting on stage at a conference
    const validationResult = await imageAssertions.validateImage({
      base64Image,
      assertionPrompt:
        'The image should contain a woman on stage at a conference presenting',
    });

    // These assertions should fail since the image doesn't match the assertion
    expect(() => {
      expect(validationResult).toSatisfyImageAssertions({
        assertionsMet: true,
        score: 10,
        tone: ImageTone.BLACK_AND_WHITE,
      });
    }).toThrow();
  }, 60000);

  it.skip('should validate that the image is black and white and matches the prompt', async () => {
    const base64Image = readImageAsBase64('./woman-with-book.png');

    // The original image prompt: A black and white photo realistic image of a woman reading a book by a poolside with a coffee and a cake on her table
    const validationResult = await imageAssertions.validateImage({
      base64Image,
      assertionPrompt:
        'The image should show a woman reading a book by a poolside with refreshments in black and white',
    });

    expect(validationResult).toSatisfyImageAssertions({
      assertionsMet: true,
      score: 10,
      tone: ImageTone.BLACK_AND_WHITE,
    });
  }, 60000);

  it.skip('should validate failing image - couple dreaming (failing test)', async () => {
    const base64Image = readImageAsBase64('./couple-dreaming.png');

    // original image prompt: An image in a dreamy style of a man and woman facing each other day dreaming.
    // They both have thought bubbles above their heads thinking about different style cars.
    const validationResult = await imageAssertions.validateImage({
      base64Image,
      assertionPrompt:
        'The image should contain a man and woman together day dreaming',
    });

    // These assertions should fail since the image doesn't match the assertion
    expect(() => {
      expect(validationResult).toSatisfyImageAssertions({
        assertionsMet: true,
        score: 8,
        tone: ImageTone.PHOTO_REALISTIC, // it is a dreamy style image
      });
    }).toThrow();
  }, 60000);

  it.skip('should generate and validate an image in one flow', async () => {
    const imagePrompt =
      'A dreamy style image of a person sitting under a cherry blossom tree reading a book';
    const assertionPrompt =
      'The image should show a person under a cherry blossom tree in a dreamy style reading a book';

    // Generate the image
    const generationResult = await imageAssertions.generateImage({
      modelId: 'amazon.titan-image-generator-v2:0',
      prompt: imagePrompt,
      imageConfig: {
        quality: 'premium',
        width: 512,
        height: 512,
      },
    });

    // Validate the generated image
    const validationResult = await imageAssertions.validateImage({
      base64Image: generationResult.base64Image,
      assertionPrompt,
    });

    // Assert that the validation result is strong and dreamy
    expect(validationResult).toSatisfyImageAssertions({
      assertionsMet: true,
      score: 8,
      tone: ImageTone.DREAMY,
    });
  }, 90000);
});
