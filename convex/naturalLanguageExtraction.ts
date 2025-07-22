// import { v } from "convex/values";
// import { action } from "./_generated/server";
// import Groq from "groq-sdk";
// import Reducto from "reductoai";

// // Natural language examples that legal professionals might use:
// // - "Get me the main terms out of this contract"
// // - "Extract all payment obligations and deadlines"
// // - "Find the parties, effective date, and termination clauses"
// // - "Pull out all the warranties and representations"
// // - "Show me the indemnification provisions and liability caps"
// // - "Extract the governing law and dispute resolution terms"
// // - "Find all monetary amounts mentioned in this agreement"
// // - "Get me a summary of the key business terms"
// // - "Extract all the conditions precedent to closing"
// // - "Find the intellectual property assignments and licenses"

// export const extractFromNaturalLanguage = action({
//   args: {
//     documentUrl: v.string(),
//     request: v.string(), // Natural language request from user
//   },
//   handler: async (ctx, args) => {
//     const groq = new Groq();
//     const reducto = new Reducto();

//     // Step 1: Use LLM to translate natural language into extraction schema
//     const schemaResponse = await groq.chat.completions.create({
//       model: "moonshotai/kimi-k2-instruct",
//       messages: [
//         {
//           role: "system",
//           content: `You are a legal document analysis expert. Convert natural language requests into Reducto extraction schemas.

// Key principles:
// 1. Field names should match how terms appear in legal documents
// 2. Keep structure relatively flat (max 2-3 levels of nesting)
// 3. Use descriptive field names that a lawyer would understand
// 4. Include enums for fields with predictable values
// 5. Make fields optional unless they're universally present
// 6. Add helpful descriptions to guide extraction

// Common legal extraction patterns:
// - Parties: names, types (individual/entity), roles
// - Dates: effective, expiration, notice periods
// - Money: amounts, payment terms, fees, penalties
// - Obligations: performance requirements, conditions
// - Rights: permissions, restrictions, remedies
// - Governance: applicable law, dispute resolution
// - Risk: warranties, indemnities, limitations

// Return ONLY a valid JSON schema with no additional text.`,
//         },
//         {
//           role: "user",
//           content: `Convert this request into a Reducto extraction schema: "${args.request}"`,
//         },
//       ],
//       response_format: { type: "json_object" },
//     });

//     const extractionSchema = JSON.parse(schemaResponse.choices[0].message.content || "{}");

//     // Step 2: Create a system prompt based on the request
//     const systemPrompt = `Extract the requested information based on this instruction: "${args.request}". Be thorough and precise. Include all relevant details and context.`;

//     // Step 3: Execute extraction with Reducto
//     try {
//       const result = await reducto.extract.run({
//         document_url: args.documentUrl,
//         schema: extractionSchema,
//         system_prompt: systemPrompt,
//         // Enable advanced features for better extraction
//         advanced_options: {
//           use_ocr: true,
//           enable_tables: true,
//           citations: true, // Include source citations
//         },
//       });

//       return {
//         request: args.request,
//         extracted_data: result.result,
//         citations: result.citations || [],
//         metadata: {
//           processing_date: new Date().toISOString(),
//           pages_processed: result.usage?.pages || 0,
//           schema_used: extractionSchema,
//         },
//       };
//     } catch (error) {
//       console.error("Extraction error:", error);
//       throw new Error(`Failed to extract data: ${error.message}`);
//     }
//   },
// });

// // Example schemas that would be generated for common requests:

// const exampleSchemas = {
//   // "Get me the main terms out of this contract"
//   mainTerms: {
//     type: "object",
//     properties: {
//       parties: {
//         type: "array",
//         items: {
//           type: "object",
//           properties: {
//             name: { type: "string", description: "Party name" },
//             role: { type: "string", description: "Role in agreement" },
//           },
//         },
//       },
//       effective_date: { type: "string", description: "When agreement becomes effective" },
//       term_duration: { type: "string", description: "Length of agreement" },
//       key_obligations: {
//         type: "array",
//         items: { type: "string" },
//         description: "Main obligations of each party",
//       },
//       payment_terms: { type: "string", description: "Payment amounts and schedule" },
//       termination_provisions: { type: "string", description: "How agreement can be ended" },
//       governing_law: { type: "string", description: "Applicable law and jurisdiction" },
//     },
//   },

//   // "Extract all payment obligations and deadlines"
//   paymentObligations: {
//     type: "object",
//     properties: {
//       payment_obligations: {
//         type: "array",
//         items: {
//           type: "object",
//           properties: {
//             description: { type: "string", description: "What payment is for" },
//             amount: { type: "number", description: "Payment amount" },
//             currency: { type: "string", enum: ["USD", "EUR", "GBP", "Other"] },
//             due_date: { type: "string", description: "When payment is due" },
//             frequency: {
//               type: "string",
//               enum: ["one-time", "monthly", "quarterly", "annually", "other"],
//             },
//             late_penalties: { type: "string", description: "Penalties for late payment" },
//           },
//         },
//       },
//     },
//   },

//   // "Find all monetary amounts mentioned in this agreement"
//   monetaryAmounts: {
//     type: "object",
//     properties: {
//       monetary_references: {
//         type: "array",
//         items: {
//           type: "object",
//           properties: {
//             context: { type: "string", description: "What this amount relates to" },
//             amount: { type: "number" },
//             currency: { type: "string" },
//             section_reference: { type: "string", description: "Document section" },
//           },
//         },
//       },
//     },
//   },
// };
