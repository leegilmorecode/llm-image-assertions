import {
  BedrockRuntimeClient,
  type ContentBlock,
  ConversationRole,
  ConverseCommand,
  type ConverseCommandInput,
  ImageFormat,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

import { expect } from '@jest/globals';

/**
 * Enum for image tone classifications.
 */
export enum ImageTone {
  DREAMY = 'dreamy',
  PHOTO_REALISTIC = 'photo-realistic',
  BLACK_AND_WHITE = 'black-and-white',
}

/**
 * Configuration object for image generation
 */
export interface ImageGenerationInput {
  /** The description of the image to be generated */
  prompt: string;
  /** The Bedrock model ID to use (defaults to amazon.titan-image-generator-v2:0) */
  modelId?: string;
  /** The AWS region where the Bedrock model is hosted (defaults to us-east-1) */
  region?: string;
  /** Optional image configuration */
  imageConfig?: {
    /** Image width (defaults to 1024) */
    width?: number;
    /** Image height (defaults to 1024) */
    height?: number;
    /** Image quality (standard, premium - defaults to premium) */
    quality?: 'standard' | 'premium';
    /** CFG Scale for prompt adherence (1.0 to 10.0, defaults to 8.0) */
    cfgScale?: number;
    /** Random seed for reproducibility */
    seed?: number;
  };
}

/**
 * Result of image generation
 */
export interface ImageGenerationResult {
  /** Raw image bytes */
  imageBytes: Uint8Array;
  /** Base64-encoded image string */
  base64Image: string;
  /** Model ID used for generation */
  modelId: string;
}

/**
 * Input parameters for image validation assertions
 */
export interface ImageAssertionsInput {
  /** Raw image bytes from generation (preferred) */
  imageBytes?: Uint8Array;
  /** Base64-encoded image (alternative to imageBytes) */
  base64Image?: string;
  /** A descriptive assertion to validate against */
  assertionPrompt: string;
  /** Optional model ID to use (defaults to us.amazon.nova-premier-v1:0) */
  modelId?: string;
  /** Optional minimum score required to consider assertions met (defaults to 7) */
  confidenceThreshold?: number;
  /** Optional sampling temperature (defaults to 0.3) */
  temperature?: number;
  /** Optional top-p sampling parameter (defaults to 0.7) */
  topP?: number;
  /** Optional maximum tokens to generate (defaults to 500) */
  maxTokensToSample?: number;
}

export const ImageAssertionsMet = {
  yes: true,
  no: false,
};

/**
 * The structure of the image assertion validation response.
 */
export type ImageAssertionResponse = {
  /** Whether all assertions were met */
  assertionsMet: (typeof ImageAssertionsMet)[keyof typeof ImageAssertionsMet];
  /** Confidence score (0-10) */
  score: number;
  /** The detected tone of the image */
  tone: ImageTone;
  /** Explanation of the scoring and evaluation */
  explanation: string;
};

/**
 * Main class for generating and validating AI images against assertions
 */
export class ImageAssertions {
  /** AWS Bedrock client instance */
  private bedrock: BedrockRuntimeClient;
  /** AWS region */
  private region: string;

  constructor(options: { region?: string } = {}) {
    this.region = options.region || 'us-east-1';
    this.bedrock = new BedrockRuntimeClient({ region: this.region });
  }

  /**
   * Generates image bytes from a text prompt using Amazon Bedrock's image generation models.
   */
  public async generateImage(
    options: ImageGenerationInput,
  ): Promise<ImageGenerationResult> {
    const {
      prompt,
      modelId = 'amazon.titan-image-generator-v2:0',
      region = this.region,
      imageConfig = {},
    } = options;

    const client =
      region === this.region
        ? this.bedrock
        : new BedrockRuntimeClient({ region });

    // Default image configuration
    const {
      width = 1024,
      height = 1024,
      quality = 'premium',
      cfgScale = 8.0,
      seed,
    } = imageConfig;

    // Prepare the request body for Titan Image Generator
    const requestBody = {
      taskType: 'TEXT_IMAGE',
      textToImageParams: {
        text: prompt,
      },
      imageGenerationConfig: {
        numberOfImages: 1,
        width,
        height,
        quality,
        cfgScale,
        ...(seed !== undefined && { seed }),
      },
    };

    const command = new InvokeModelCommand({
      modelId,
      body: JSON.stringify(requestBody),
      contentType: 'application/json',
      accept: 'application/json',
    });

    try {
      const response = await client.send(command);

      if (!response.body) {
        throw new Error('No response body received from model');
      }

      // Parse the response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      if (!responseBody.images || responseBody.images.length === 0) {
        throw new Error('No images returned from model');
      }

      const base64Image = responseBody.images[0];

      if (!base64Image) {
        throw new Error('No image data found in response');
      }

      // Convert base64 to bytes
      const imageBytes = new Uint8Array(Buffer.from(base64Image, 'base64'));

      return {
        imageBytes,
        base64Image,
        modelId,
      };
    } catch (error) {
      throw new Error(
        `Image generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Validates a generated image against a descriptive assertion using a Bedrock model.
   */
  public async validateImage(
    options: ImageAssertionsInput,
  ): Promise<ImageAssertionResponse> {
    const {
      imageBytes,
      base64Image,
      assertionPrompt,
      modelId = 'us.amazon.nova-premier-v1:0',
      confidenceThreshold = 7,
      temperature = 0.3,
      topP = 0.7,
      maxTokensToSample = 500,
    } = options;

    if (!imageBytes && !base64Image) {
      throw new Error('Either imageBytes or base64Image must be provided');
    }

    if (!assertionPrompt) {
      throw new Error('Assertion prompt is required');
    }

    const validationPrompt = `Analyze the following image and assertions, and return a single JSON object with this structure:

{
  "assertionsMet": boolean,
  "score": number,             // confidence score 0-10
  "tone": string,              // tone classification
  "explanation": string        // explanation of the evaluation
}

SCORING GUIDELINES:
10: All assertions perfectly match the image content and style.
7-9: Most assertions strongly match with minor discrepancies.
4-6: Some assertions partially match with significant gaps.
0-3: Few or no assertions match the image content.

TONE CLASSIFICATION:
The "tone" must be one of: ${Object.values(ImageTone).join(', ')}

Definitions:
- "dreamy": surreal, soft, ethereal atmosphere; may appear otherworldly or hazy, not sharp or high contrast. Suitable for styles that evoke a calm or fantastical feeling.
- "photo-realistic": highly detailed and mimics real-world photography.
- "black-and-white": grayscale image with no color, may vary in tone depending on contrast and texture.

Evaluate the image against this assertion:
"${assertionPrompt}"

IMPORTANT: "assertionsMet" should be true only if all key details in the assertion are visually matched in the image.`;

    // Use raw bytes if available, otherwise convert from base64
    const bytesToUse = imageBytes || Buffer.from(base64Image || '', 'base64');

    const input: ConverseCommandInput = {
      modelId,
      messages: [
        {
          role: ConversationRole.USER,
          content: [
            {
              text: validationPrompt,
            },
            {
              image: {
                format: ImageFormat.PNG,
                source: {
                  bytes: bytesToUse,
                },
              },
            },
          ],
        },
      ],
      inferenceConfig: {
        temperature,
        topP,
        maxTokens: maxTokensToSample,
      },
    };

    const command = new ConverseCommand(input);
    const response = await this.bedrock.send(command);

    const content = (response.output?.message?.content as ContentBlock[])[0]
      ?.text;

    if (!content) {
      throw new Error('No validation output received from model');
    }

    // Clean and extract JSON from response
    const cleanedResponse = content
      .replace(/```json\s*/, '') // Remove markdown code block start
      .replace(/```\s*/, '') // Remove markdown code block end
      .replace(/\n/g, '') // Remove newlines
      .trim();

    const jsonMatch = cleanedResponse.match(/\{.*\}/s);
    if (!jsonMatch) {
      throw new Error('Model response did not include a valid JSON block');
    }

    const result = JSON.parse(jsonMatch[0].trim());

    const assertionsMet =
      result.score >= confidenceThreshold && result.assertionsMet;

    return {
      assertionsMet,
      score: result.score,
      tone: result.tone as ImageTone,
      explanation: result.explanation,
    };
  }
}

// Extend Jest's global expect with type declarations
declare global {
  namespace jest {
    interface Matchers<R> {
      toSatisfyImageAssertions(expected: Partial<ImageAssertionResponse>): R;
    }
  }
}

// Extend Jest's global expect for image assertions
expect.extend({
  toSatisfyImageAssertions(
    received: ImageAssertionResponse,
    expected: Partial<ImageAssertionResponse>,
  ): jest.CustomMatcherResult {
    const pass = Object.entries(expected).every(([key, value]) => {
      if (key === 'assertionsMet') {
        return received.assertionsMet === value;
      }
      if (key === 'score') {
        return received.score >= (value as number);
      }
      if (key === 'tone') {
        return received.tone === value;
      }
      return received[key as keyof ImageAssertionResponse] === value;
    });

    if (pass) {
      return {
        pass: true,
        message: () =>
          `Expected ${this.utils.printReceived(
            received,
          )} not to satisfy image assertions ${this.utils.printExpected(
            expected,
          )}`,
      };
    }
    return {
      pass: false,
      message: () =>
        `Expected ${this.utils.printReceived(
          received,
        )} to satisfy image assertions ${this.utils.printExpected(expected)}`,
    };
  },
});
