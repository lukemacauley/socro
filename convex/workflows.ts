import { v } from "convex/values";
import { action } from "./_generated/server";
import Groq from "groq-sdk";
import { type Id } from "./_generated/dataModel";
import Reducto from "reductoai";
import { z, toJSONSchema } from "zod";
import { api } from "./_generated/api";

export const createWorkflow = action({
  args: {
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const uploadUrl = await ctx.storage.getUrl(
      "kg2e2wxtw98mb9st0ehj8vdckn7m05qd" as Id<"_storage">
    );

    let parsedContent: string | undefined = undefined;
    let jobId: string | undefined = undefined;

    if (!uploadUrl) {
      return;
    }

    try {
      const reducto = new Reducto();

      const { result, job_id } = await reducto.parse.run({
        document_url: uploadUrl,
        // options: { ocr_mode: "standard", extraction_mode: "hybrid" },
        // advanced_options: {
        //   keep_line_breaks: true,
        //   ocr_system: "highres",
        // },
      });

      parsedContent =
        result.type === "full"
          ? result.chunks.map((c) => c.content).join("\n\n")
          : result.url;
      jobId = job_id;
    } catch (error) {
      console.error(`[REDUCTO] Error processing user upload:`, error);
    }

    try {
      const groq = new Groq();

      const response = await groq.chat.completions.create({
        model: "moonshotai/kimi-k2-instruct",
        messages: [
          {
            role: "system",
            content: `You are a legal document analysis expert integrated with Reducto AI capabilities. 
            Based on the user's request, determine:
            1. The type of legal workflow required
            2. Which Reducto tools should be used for document processing
            3. The specific extraction or analysis tasks needed

            Available Reducto tools:
            - OCR: For scanned documents or images
            - Table Extraction: For extracting structured data from tables
            - Form Extraction: For extracting data from forms and structured documents
            - Text Extraction: For general text extraction and parsing
            - Key-Value Extraction: For extracting specific fields and their values
            - Entity Recognition: For identifying legal entities, dates, amounts, etc.
            - Document Classification: For categorizing document types
            - Summary Generation: For creating document summaries`,
          },
          {
            role: "user",
            content: `I want you to extract the terms from this document and create a workflow for it.
            The document content is as follows:
            ${parsedContent}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "workflow",
            schema: toJSONSchema(WORKFLOW_SCHEMA),
          },
        },
      });

      const rawResult = JSON.parse(response.choices[0].message.content || "{}");
      const result = WORKFLOW_SCHEMA.parse(rawResult);
      console.log(result);

      const reductoRes = await ctx.runAction(
        api.workflows.executeWorkflowWithReducto,
        { workflow: result, documentUrl: uploadUrl }
      );

      console.log(reductoRes);
    } catch (error) {
      console.error("Error initializing Groq client:", error);
    }
  },
});

const WORKFLOW_SCHEMA = z
  .object({
    workflow_name: z.string().describe("Descriptive name for this workflow"),
    workflow_type: z.enum([
      "rental_contract",
      "merger_contract",
      "technical_contract",
      "employment_contract",
      "purchase_agreement",
      "service_agreement",
      "nda_confidentiality",
      "partnership_agreement",
      "general_legal_document",
    ]),
    reducto_tools: z.array(
      z.object({
        tool_name: z.enum([
          "ocr",
          "table_extraction",
          "form_extraction",
          "text_extraction",
          "key_value_extraction",
          "entity_recognition",
          "document_classification",
          "summary_generation",
        ]),
        tool_config: z.object({
          priority: z.enum(["high", "medium", "low"]),
          specific_targets: z
            .array(z.string())
            .describe("Specific elements to target with this tool"),
        }),
      })
    ),
    extraction_targets: z.object({
      key_terms: z.array(z.string()).describe("Types of key terms to extract"),
      entities: z.array(
        z.enum([
          "party_names",
          "effective_dates",
          "termination_dates",
          "monetary_values",
          "obligations",
          "conditions_precedent",
          "warranties",
          "indemnities",
          "governing_law",
          "dispute_resolution",
        ])
      ),
      custom_fields: z
        .array(
          z.object({
            field_name: z.string(),
            field_type: z.enum(["string", "number", "boolean", "entity"]),
            description: z.string().optional(),
          })
        )
        .optional(),
    }),
    processing_options: z
      .object({
        preserve_formatting: z.boolean().optional(),
        extract_metadata: z.boolean().optional(),
        confidence_threshold: z.number().min(0).max(1).optional(),
        output_format: z
          .enum(["json", "structured_text", "markdown", "xml"])
          .optional(),
      })
      .optional(),
  })
  .strict();

export type Workflow = z.infer<typeof WORKFLOW_SCHEMA>;

// Dynamic schema generation based on workflow configuration
function generateExtractionSchema(workflow: Workflow) {
  const schema: Record<string, any> = {
    type: "object",
    properties: {},
    required: [],
  };

  // Add properties based on workflow type and extraction targets
  if (workflow.extraction_targets.entities.includes("party_names")) {
    schema.properties.parties = {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          entity_type: {
            type: "string",
            enum: ["individual", "company", "organization"],
          },
        },
      },
    };
    schema.required.push("parties");
  }

  if (workflow.extraction_targets.entities.includes("effective_dates")) {
    schema.properties.dates = {
      type: "object",
      properties: {
        effective_date: { type: "string", format: "date" },
        expiration_date: { type: "string", format: "date" },
        notice_periods: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              duration: { type: "string" },
            },
          },
        },
      },
    };
  }

  if (workflow.extraction_targets.entities.includes("monetary_values")) {
    schema.properties.financial_terms = {
      type: "object",
      properties: {
        amounts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              amount: { type: "number" },
              currency: { type: "string" },
              frequency: {
                type: "string",
                enum: ["one-time", "monthly", "quarterly", "annually"],
              },
            },
          },
        },
      },
    };
  }

  // Add custom fields
  if (workflow.extraction_targets.custom_fields) {
    workflow.extraction_targets.custom_fields.forEach((field) => {
      const fieldSchema: any = {
        type: field.field_type === "entity" ? "string" : field.field_type,
      };
      if (field.description) {
        fieldSchema.description = field.description;
      }
      schema.properties[field.field_name] = fieldSchema;
    });
  }

  // Add workflow-specific fields
  switch (workflow.workflow_type) {
    case "rental_contract":
      Object.assign(schema.properties, {
        property_details: {
          type: "object",
          properties: {
            address: { type: "string" },
            type: { type: "string" },
            bedrooms: { type: "number" },
            bathrooms: { type: "number" },
          },
        },
        lease_terms: {
          type: "object",
          properties: {
            monthly_rent: { type: "number" },
            security_deposit: { type: "number" },
            pet_policy: { type: "string" },
            utilities_included: { type: "array", items: { type: "string" } },
          },
        },
      });
      break;

    case "employment_contract":
      Object.assign(schema.properties, {
        position_details: {
          type: "object",
          properties: {
            job_title: { type: "string" },
            department: { type: "string" },
            reporting_to: { type: "string" },
            employment_type: {
              type: "string",
              enum: ["full-time", "part-time", "contract"],
            },
          },
        },
        compensation: {
          type: "object",
          properties: {
            base_salary: { type: "number" },
            bonus_structure: { type: "string" },
            benefits: { type: "array", items: { type: "string" } },
            equity: { type: "string" },
          },
        },
      });
      break;

    case "merger_contract":
      Object.assign(schema.properties, {
        transaction_details: {
          type: "object",
          properties: {
            purchase_price: { type: "number" },
            payment_terms: { type: "string" },
            escrow_amount: { type: "number" },
            closing_conditions: { type: "array", items: { type: "string" } },
          },
        },
        representations_warranties: {
          type: "array",
          items: {
            type: "object",
            properties: {
              party: { type: "string" },
              warranty: { type: "string" },
              survival_period: { type: "string" },
            },
          },
        },
      });
      break;
  }

  return schema;
}

// Generate system prompt based on workflow
function generateSystemPrompt(workflow: Workflow): string {
  const basePrompt = `You are analyzing a ${workflow.workflow_type.replace(
    /_/g,
    " "
  )}. 
Be precise and thorough in extracting information. 
Focus on identifying and extracting the following key information:`;

  const targets = workflow.extraction_targets.key_terms.join(", ");
  const entities = workflow.extraction_targets.entities.join(", ");

  return `${basePrompt}
- Key terms: ${targets}
- Entities: ${entities}
${
  workflow.workflow_type === "merger_contract"
    ? "\nPay special attention to conditions precedent, warranties, and indemnification clauses."
    : ""
}
${
  workflow.workflow_type === "employment_contract"
    ? "\nEnsure you capture all compensation details including base salary, bonuses, and benefits."
    : ""
}
${
  workflow.workflow_type === "rental_contract"
    ? "\nExtract all property details, lease terms, and tenant obligations."
    : ""
}`;
}

export const executeWorkflowWithReducto = action({
  args: {
    workflow: v.any(),
    documentUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const workflow = WORKFLOW_SCHEMA.parse(args.workflow);
    const reducto = new Reducto();

    try {
      // Generate extraction schema based on workflow
      const extractionSchema = generateExtractionSchema(workflow);
      const systemPrompt = generateSystemPrompt(workflow);

      // Use Reducto's extraction API
      const result = await reducto.extract.run({
        document_url: args.documentUrl,
        schema: extractionSchema,
        system_prompt: systemPrompt,
        generate_citations: true,
        // Configure based on workflow processing options
        // ...(workflow.processing_options && {
        //   advanced_options: {
        //     use_ocr: workflow.reducto_tools.some((t) => t.tool_name === "ocr"),
        //     enable_tables: workflow.reducto_tools.some(
        //       (t) => t.tool_name === "table_extraction"
        //     ),
        //     confidence_threshold:
        //       workflow.processing_options.confidence_threshold,
        //   },
        // }),
      });

      // Post-process results based on workflow type
      const processedResults = {
        workflow_name: workflow.workflow_name,
        workflow_type: workflow.workflow_type,
        extracted_data: result.result,
        metadata: {
          processing_date: new Date().toISOString(),
          document_url: args.documentUrl,
          // confidence_scores: result.confidence_scores || {},
        },
      };

      // Additional processing for specific tools
      if (
        workflow.reducto_tools.some((t) => t.tool_name === "summary_generation")
      ) {
        const summaryResult = await reducto.extract.run({
          document_url: args.documentUrl,
          schema: {
            type: "object",
            properties: {
              executive_summary: {
                type: "string",
                description: "Brief executive summary",
              },
              key_points: { type: "array", items: { type: "string" } },
              risk_factors: { type: "array", items: { type: "string" } },
            },
          },
          system_prompt:
            "Generate a concise summary focusing on key terms, obligations, and potential risks.",
        });
        // @ts-ignore
        processedResults.extracted_data.summary = summaryResult.result;
      }

      return processedResults;
    } catch (error) {
      console.error("Error executing workflow with Reducto:", error);
      throw new Error(`Workflow execution failed: ${error}`);
    }
  },
});
