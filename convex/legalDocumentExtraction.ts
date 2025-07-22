// import { v } from "convex/values";
// import { action } from "./_generated/server";
// import Groq from "groq-sdk";
// import Reducto from "reductoai";

// // Main extraction function - handles natural language requests
// export const extract = action({
//   args: {
//     documentUrl: v.string(),
//     request: v.string(),
//     options: v.optional(
//       v.object({
//         includeCitations: v.optional(v.boolean()),
//         pageRange: v.optional(
//           v.object({
//             start: v.number(),
//             end: v.number(),
//           })
//         ),
//         outputFormat: v.optional(
//           v.union(v.literal("structured"), v.literal("narrative"))
//         ),
//       })
//     ),
//   },
//   handler: async (ctx, args) => {
//     const groq = new Groq();
//     const reducto = new Reducto();

//     try {
//       // Generate extraction schema from natural language
//       const schemaResponse = await groq.chat.completions.create({
//         model: "moonshotai/kimi-k2-instruct",
//         messages: [
//           {
//             role: "system",
//             content: SCHEMA_GENERATION_PROMPT,
//           },
//           {
//             role: "user",
//             content: args.request,
//           },
//         ],
//         response_format: { type: "json_object" },
//         temperature: 0.3, // Lower temperature for more consistent schemas
//       });

//       const extractionSchema = JSON.parse(
//         schemaResponse.choices[0].message.content || "{}"
//       );

//       // Validate schema has required structure
//       if (!extractionSchema.type || !extractionSchema.properties) {
//         throw new Error("Invalid schema generated");
//       }

//       // Create system prompt that incorporates the user's request
//       const systemPrompt = createSystemPrompt(
//         args.request,
//         args.options?.outputFormat
//       );

//       // Execute extraction
//       const extractionOptions: any = {
//         document_url: args.documentUrl,
//         schema: extractionSchema,
//         system_prompt: systemPrompt,
//       };

//       // Add optional parameters
//       if (args.options?.pageRange) {
//         extractionOptions.page_range = [
//           args.options.pageRange.start,
//           args.options.pageRange.end,
//         ];
//       }

//       if (args.options?.includeCitations) {
//         extractionOptions.advanced_options = {
//           ...extractionOptions.advanced_options,
//           citations: true,
//         };
//       }

//       const result = await reducto.extract.run(extractionOptions);

//       // Post-process results
//       const processedData = postProcessExtraction(result.result, args.request);

//       return {
//         success: true,
//         request: args.request,
//         data: processedData,
//         citations: args.options?.includeCitations
//           ? result.citations
//           : undefined,
//         metadata: {
//           timestamp: new Date().toISOString(),
//           pages_processed: result.usage?.pages || 0,
//           credits_used: result.usage?.credits || 0,
//           schema_generated: extractionSchema,
//         },
//       };
//     } catch (error) {
//       console.error("Extraction failed:", error);

//       // Provide helpful error messages
//       if (error.message.includes("schema")) {
//         throw new Error(
//           "Failed to understand the extraction request. Please try rephrasing."
//         );
//       } else if (error.message.includes("document")) {
//         throw new Error(
//           "Failed to process the document. Please check the URL is accessible."
//         );
//       } else {
//         throw new Error(`Extraction failed: ${error.message}`);
//       }
//     }
//   },
// });

// // Batch extraction for multiple requests on the same document
// export const batchExtract = action({
//   args: {
//     documentUrl: v.string(),
//     requests: v.array(v.string()),
//   },
//   handler: async (ctx, args) => {
//     const results = await Promise.all(
//       args.requests.map((request) =>
//         extract(ctx, {
//           documentUrl: args.documentUrl,
//           request,
//           options: { includeCitations: false },
//         }).catch((error) => ({
//           success: false,
//           request,
//           error: error.message,
//         }))
//       )
//     );

//     return {
//       documentUrl: args.documentUrl,
//       results,
//       summary: {
//         total: results.length,
//         successful: results.filter((r) => r.success).length,
//         failed: results.filter((r) => !r.success).length,
//       },
//     };
//   },
// });

// // Helper function to create system prompts
// function createSystemPrompt(
//   request: string,
//   outputFormat?: "structured" | "narrative"
// ): string {
//   const basePrompt = `You are analyzing a legal document. ${request}

// Guidelines:
// - Be precise and thorough
// - Include all relevant details and context
// - Use exact quotes when extracting specific language
// - Note section references when available
// - Flag any ambiguities or unclear provisions`;

//   if (outputFormat === "narrative") {
//     return `${basePrompt}
// - Provide explanations and context for extracted information
// - Highlight important implications or risks`;
//   }

//   return `${basePrompt}
// - Extract only what is explicitly stated
// - Do not infer or interpret beyond the document text`;
// }

// // Post-process extracted data for common improvements
// function postProcessExtraction(data: any, request: string): any {
//   // Normalize dates to ISO format
//   const processedData = normalizeDates(data);

//   // Clean up monetary amounts
//   const withCleanAmounts = cleanMonetaryAmounts(processedData);

//   // Sort arrays by relevance if applicable
//   const sorted = sortExtractedArrays(withCleanAmounts);

//   return sorted;
// }

// function normalizeDates(obj: any): any {
//   if (typeof obj !== "object" || obj === null) return obj;

//   const processed = Array.isArray(obj) ? [] : {};

//   for (const key in obj) {
//     const value = obj[key];

//     if (typeof value === "string" && isDateString(value)) {
//       processed[key] = attemptDateParse(value);
//     } else if (typeof value === "object") {
//       processed[key] = normalizeDates(value);
//     } else {
//       processed[key] = value;
//     }
//   }

//   return processed;
// }

// function isDateString(str: string): boolean {
//   const datePatterns = [
//     /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
//     /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,
//     /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/i,
//   ];

//   return datePatterns.some((pattern) => pattern.test(str));
// }

// function attemptDateParse(dateStr: string): string {
//   try {
//     const parsed = new Date(dateStr);
//     if (!isNaN(parsed.getTime())) {
//       return parsed.toISOString().split("T")[0];
//     }
//   } catch {
//     // Return original if parsing fails
//   }
//   return dateStr;
// }

// function cleanMonetaryAmounts(obj: any): any {
//   if (typeof obj !== "object" || obj === null) return obj;

//   const processed = Array.isArray(obj) ? [] : {};

//   for (const key in obj) {
//     const value = obj[key];

//     if (
//       key.toLowerCase().includes("amount") ||
//       key.toLowerCase().includes("price")
//     ) {
//       if (typeof value === "string") {
//         const cleaned = value.replace(/[$,]/g, "");
//         const parsed = parseFloat(cleaned);
//         processed[key] = isNaN(parsed) ? value : parsed;
//       } else {
//         processed[key] = value;
//       }
//     } else if (typeof value === "object") {
//       processed[key] = cleanMonetaryAmounts(value);
//     } else {
//       processed[key] = value;
//     }
//   }

//   return processed;
// }

// function sortExtractedArrays(obj: any): any {
//   // Sort arrays by importance or date where applicable
//   // This is a simplified version - could be enhanced
//   return obj;
// }

// // System prompt for schema generation
// const SCHEMA_GENERATION_PROMPT = `You are a legal document extraction expert. Convert natural language requests into JSON schemas for Reducto.

// Rules:
// 1. Output ONLY a valid JSON schema - no explanations
// 2. Use descriptive field names that match legal terminology
// 3. Keep structure flat (max 2-3 levels)
// 4. Include helpful descriptions
// 5. Use enums for predictable values
// 6. All fields should be optional unless universally present

// Common patterns:
// - Parties: name, role, entity_type
// - Dates: use string type with description
// - Money: use number type, note currency separately
// - Terms: use string or array of strings
// - Complex provisions: break into subfields

// Example request: "Get the parties and effective date"
// Example schema:
// {
//   "type": "object",
//   "properties": {
//     "parties": {
//       "type": "array",
//       "items": {
//         "type": "object",
//         "properties": {
//           "name": {"type": "string", "description": "Party name"},
//           "role": {"type": "string", "description": "Role in agreement"}
//         }
//       }
//     },
//     "effective_date": {"type": "string", "description": "Agreement effective date"}
//   }
// }`;

// // Common extraction templates for quick access
// export const templates = {
//   dueDiligence:
//     "Extract parties, deal structure, purchase price, conditions precedent, representations and warranties, indemnification terms, and closing conditions",

//   contractReview:
//     "Get the parties, effective date, term, payment obligations, key deliverables, termination rights, governing law, and dispute resolution",

//   leaseAnalysis:
//     "Extract landlord, tenant, premises description, rent amount, lease term, permitted use, maintenance obligations, and renewal options",

//   employmentTerms:
//     "Find employer, employee, position, compensation, benefits, start date, probation period, termination provisions, and restrictive covenants",

//   ipreview:
//     "Extract IP ownership, licenses granted, scope of use, territory, royalties, improvements ownership, and background IP treatment",
// };
