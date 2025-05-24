import { ImageAssertions, ImageTone } from '../src/index';

import fs from 'node:fs';
import path from 'node:path';

const readImageAsBase64 = (filename: string): string => {
  const imagePath = path.join(__dirname, 'images', filename);
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
};

// Image prompts for reference:
// image1.png: A fluffy orange cat sitting on a windowsill
// image2.png: A man wearing an AWS Lambda t-shirt presenting on stage at a conference
// image3.png: A black and white photo realistic image of a woman reading a book by a poolside with a coffee and a cake on her table

describe.skip('LLM Image Assertions', () => {
  let imageAssertions: ImageAssertions;

  beforeAll(() => {
    imageAssertions = new ImageAssertions();
  });

  it('should validate an orange cat image', async () => {
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

  it('should validate failing image - man presenting (failing test)', async () => {
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

  it('should validate that the image is black and white and matches the prompt', async () => {
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
});
