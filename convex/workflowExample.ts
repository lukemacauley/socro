// // Example: Using the workflow system to extract data from documents

// import { createWorkflow, executeWorkflowWithReducto } from "./workflows";

// // Step 1: User uploads a document and creates a workflow
// // The createWorkflow action analyzes the document and returns a workflow configuration
// const workflowResult = await createWorkflow({
//   content: "Extract the terms from this rental agreement document"
// });

// // Example workflow result:
// const exampleWorkflow = {
//   workflow_name: "Rental Agreement Analysis",
//   workflow_type: "rental_contract",
//   reducto_tools: [
//     {
//       tool_name: "text_extraction",
//       tool_config: { priority: "high", specific_targets: ["lease terms", "payment details"] }
//     },
//     {
//       tool_name: "entity_recognition",
//       tool_config: { priority: "high", specific_targets: ["party names", "dates", "amounts"] }
//     }
//   ],
//   extraction_targets: {
//     key_terms: ["rent amount", "security deposit", "lease duration", "pet policy"],
//     entities: ["party_names", "effective_dates", "monetary_values"],
//     custom_fields: [
//       { field_name: "parking_spaces", field_type: "number", description: "Number of parking spaces" },
//       { field_name: "late_fee", field_type: "number", description: "Late payment fee amount" }
//     ]
//   },
//   processing_options: {
//     preserve_formatting: false,
//     confidence_threshold: 0.8,
//     output_format: "json"
//   }
// };

// // Step 2: Execute the workflow with Reducto
// const extractionResult = await executeWorkflowWithReducto({
//   workflow: exampleWorkflow,
//   documentUrl: "https://example.com/rental-agreement.pdf"
// });

// // Example extraction result:
// const exampleResult = {
//   workflow_name: "Rental Agreement Analysis",
//   workflow_type: "rental_contract",
//   extracted_data: {
//     // Pre-defined fields for rental contracts
//     landlord: "ABC Property Management LLC",
//     tenant: "John Doe",
//     property_address: "123 Main St, Apt 4B, New York, NY 10001",
//     monthly_rent: 2500,
//     security_deposit: 5000,
//     lease_start_date: "2024-01-01",
//     lease_end_date: "2024-12-31",
//     pet_policy: "No pets allowed",
//     utilities: ["Water", "Trash"],
//     termination_notice: "60 days written notice",

//     // Custom fields added by the workflow
//     parking_spaces: 1,
//     late_fee: 50,

//     // Summary (if requested)
//     summary: {
//       executive_summary: "12-month lease for a 2-bedroom apartment with standard terms",
//       key_points: [
//         "Monthly rent of $2,500 due on the 1st",
//         "Security deposit equal to 2 months rent",
//         "No pets allowed",
//         "60-day notice required for termination"
//       ],
//       risks: ["No subletting allowed", "Tenant responsible for all repairs under $100"]
//     }
//   },
//   metadata: {
//     processing_date: "2024-12-20T10:30:00Z",
//     document_url: "https://example.com/rental-agreement.pdf",
//     confidence_scores: {}
//   }
// };

// // Benefits of this approach:
// // 1. Minimal user configuration - pre-defined schemas for common document types
// // 2. Automatic field mapping based on document type
// // 3. Extensible with custom fields
// // 4. Single API call to Reducto's extraction endpoint
// // 5. Structured output ready for database storage or UI display
