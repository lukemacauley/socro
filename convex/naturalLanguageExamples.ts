// // Examples of natural language requests and their generated schemas

// export const naturalLanguageExamples = [
//   {
//     request: "Get me the main terms out of this contract",
//     generatedSchema: {
//       type: "object",
//       properties: {
//         parties: {
//           type: "array",
//           items: {
//             type: "object",
//             properties: {
//               name: { type: "string", description: "Party name or entity" },
//               role: { type: "string", description: "Role in the agreement (e.g., Buyer, Seller, Licensor)" },
//               entity_type: { type: "string", enum: ["individual", "corporation", "llc", "partnership", "other"] }
//             }
//           }
//         },
//         agreement_type: { type: "string", description: "Type of agreement" },
//         effective_date: { type: "string", description: "When the agreement takes effect" },
//         term_length: { type: "string", description: "Duration of the agreement" },
//         consideration: { type: "string", description: "What each party provides" },
//         key_obligations: {
//           type: "array",
//           items: { type: "string" },
//           description: "Primary obligations of each party"
//         },
//         termination_events: {
//           type: "array",
//           items: { type: "string" },
//           description: "Events that can end the agreement"
//         },
//         governing_law: { type: "string", description: "Applicable law and jurisdiction" }
//       }
//     }
//   },
//   {
//     request: "Extract all payment obligations and deadlines",
//     generatedSchema: {
//       type: "object",
//       properties: {
//         payment_obligations: {
//           type: "array",
//           items: {
//             type: "object",
//             properties: {
//               payor: { type: "string", description: "Who makes the payment" },
//               payee: { type: "string", description: "Who receives the payment" },
//               amount: { type: "number", description: "Payment amount" },
//               currency: { type: "string", description: "Currency of payment" },
//               description: { type: "string", description: "What the payment is for" },
//               due_date: { type: "string", description: "When payment is due" },
//               frequency: {
//                 type: "string",
//                 enum: ["one-time", "weekly", "monthly", "quarterly", "annually", "upon occurrence", "other"],
//                 description: "How often payment occurs"
//               },
//               conditions: { type: "string", description: "Any conditions for payment" },
//               late_payment_terms: { type: "string", description: "Interest or penalties for late payment" }
//             }
//           }
//         },
//         payment_methods: {
//           type: "array",
//           items: { type: "string" },
//           description: "Acceptable payment methods"
//         },
//         total_contract_value: { type: "number", description: "Total value if specified" }
//       }
//     }
//   },
//   {
//     request: "Find the intellectual property assignments and licenses",
//     generatedSchema: {
//       type: "object",
//       properties: {
//         ip_assignments: {
//           type: "array",
//           items: {
//             type: "object",
//             properties: {
//               assignor: { type: "string", description: "Party assigning IP" },
//               assignee: { type: "string", description: "Party receiving IP" },
//               ip_description: { type: "string", description: "Description of IP being assigned" },
//               ip_type: {
//                 type: "string",
//                 enum: ["patent", "trademark", "copyright", "trade_secret", "know-how", "other"]
//               },
//               consideration: { type: "string", description: "What is given in exchange" },
//               warranties: { type: "string", description: "IP warranties provided" }
//             }
//           }
//         },
//         ip_licenses: {
//           type: "array",
//           items: {
//             type: "object",
//             properties: {
//               licensor: { type: "string", description: "Party granting license" },
//               licensee: { type: "string", description: "Party receiving license" },
//               licensed_ip: { type: "string", description: "IP being licensed" },
//               license_scope: {
//                 type: "string",
//                 enum: ["exclusive", "non-exclusive", "sole"],
//                 description: "Type of license"
//               },
//               territory: { type: "string", description: "Geographic scope" },
//               field_of_use: { type: "string", description: "Permitted uses" },
//               duration: { type: "string", description: "License term" },
//               royalties: { type: "string", description: "Royalty terms if any" },
//               restrictions: { type: "string", description: "License restrictions" }
//             }
//           }
//         },
//         work_product_ownership: { type: "string", description: "Who owns work created under agreement" },
//         background_ip: { type: "string", description: "Treatment of pre-existing IP" }
//       }
//     }
//   },
//   {
//     request: "Show me the indemnification provisions and liability caps",
//     generatedSchema: {
//       type: "object",
//       properties: {
//         indemnification_provisions: {
//           type: "array",
//           items: {
//             type: "object",
//             properties: {
//               indemnitor: { type: "string", description: "Party providing indemnification" },
//               indemnitee: { type: "string", description: "Party being indemnified" },
//               scope: { type: "string", description: "What is covered by indemnification" },
//               exclusions: { type: "string", description: "What is excluded from indemnification" },
//               procedures: { type: "string", description: "Notice and defense procedures" },
//               survival_period: { type: "string", description: "How long indemnity survives termination" }
//             }
//           }
//         },
//         liability_limitations: {
//           type: "object",
//           properties: {
//             general_cap: { type: "string", description: "Overall liability cap amount or formula" },
//             cap_exceptions: {
//               type: "array",
//               items: { type: "string" },
//               description: "Exceptions to liability cap (e.g., willful misconduct, IP indemnity)"
//             },
//             consequential_damages_waiver: { type: "boolean", description: "Are consequential damages excluded" },
//             consequential_damages_exceptions: { type: "string", description: "Exceptions to consequential damages waiver" }
//           }
//         },
//         mutual_provisions: { type: "boolean", description: "Are indemnity/limitation provisions mutual" },
//         insurance_requirements: { type: "string", description: "Required insurance coverage" }
//       }
//     }
//   },
//   {
//     request: "Extract all conditions precedent to closing",
//     generatedSchema: {
//       type: "object",
//       properties: {
//         closing_date: { type: "string", description: "Scheduled closing date" },
//         conditions_precedent: {
//           type: "array",
//           items: {
//             type: "object",
//             properties: {
//               condition: { type: "string", description: "Description of the condition" },
//               responsible_party: { type: "string", description: "Party responsible for satisfying condition" },
//               deadline: { type: "string", description: "Deadline for satisfaction" },
//               waivable_by: { type: "string", description: "Who can waive this condition" },
//               category: {
//                 type: "string",
//                 enum: ["regulatory_approval", "third_party_consent", "financing", "due_diligence", "corporate_approval", "legal_opinion", "other"]
//               }
//             }
//           }
//         },
//         material_adverse_change_clause: { type: "string", description: "MAC clause if present" },
//         termination_rights: { type: "string", description: "Rights if conditions not met" }
//       }
//     }
//   },
//   {
//     request: "Get me a summary of the confidentiality obligations",
//     generatedSchema: {
//       type: "object",
//       properties: {
//         confidential_information_definition: { type: "string", description: "How confidential information is defined" },
//         exclusions: {
//           type: "array",
//           items: { type: "string" },
//           description: "Information excluded from confidentiality"
//         },
//         permitted_uses: { type: "string", description: "Allowed uses of confidential information" },
//         permitted_disclosures: {
//           type: "array",
//           items: { type: "string" },
//           description: "When disclosure is permitted (e.g., court order, advisors)"
//         },
//         protection_standard: { type: "string", description: "Standard of care required" },
//         duration: { type: "string", description: "How long confidentiality lasts" },
//         return_destruction: { type: "string", description: "Requirements to return/destroy information" },
//         remedies: { type: "string", description: "Remedies for breach (e.g., injunction rights)" },
//         residual_knowledge: { type: "string", description: "Treatment of residual knowledge if addressed" }
//       }
//     }
//   }
// ];

// // Example of how the system would work in practice:
// /*
// User: "Find all the warranties and representations with their survival periods"

// System generates schema → Reducto extracts → Returns:
// {
//   "representations_warranties": [
//     {
//       "party": "Seller",
//       "representation": "Company has good title to all assets",
//       "section_reference": "Section 4.1",
//       "survival_period": "24 months after closing",
//       "knowledge_qualifier": "to Seller's knowledge"
//     },
//     {
//       "party": "Seller",
//       "representation": "Financial statements are accurate",
//       "section_reference": "Section 4.5",
//       "survival_period": "Until expiration of applicable statute of limitations",
//       "knowledge_qualifier": "none"
//     }
//   ],
//   "fundamental_representations": [
//     "Organization and authority",
//     "Title to shares"
//   ],
//   "general_survival_period": "18 months",
//   "survival_exceptions": "Tax and fundamental representations survive indefinitely"
// }
// */
