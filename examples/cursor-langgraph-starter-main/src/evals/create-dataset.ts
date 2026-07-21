import "dotenv/config";
import { Client } from "langsmith";

const client = new Client();

const DATASET_NAME = "langgraph-agent-evals";
const DATASET_DESCRIPTION = "Evaluation dataset for the LangGraph ReAct agent";

const examples = [
  {
    inputs: {
      messages: [{ role: "user", content: "What is LangGraph?" }],
    },
    outputs: {
      expected_tool: "search",
      expected_topic: "langgraph",
    },
  },
  {
    inputs: {
      messages: [{ role: "user", content: "Calculate 15 * 8 + 20" }],
    },
    outputs: {
      expected_tool: "calculator",
      expected_result: "140",
    },
  },
  {
    inputs: {
      messages: [{ role: "user", content: "Hello, how are you?" }],
    },
    outputs: {
      expected_tool: "null",
      expected_type: "greeting",
    },
  },
  {
    inputs: {
      messages: [
        { role: "user", content: "Search for the latest news about AI agents" },
      ],
    },
    outputs: {
      expected_tool: "search",
      expected_topic: "ai agents",
    },
  },
  {
    inputs: {
      messages: [{ role: "user", content: "What is 100 divided by 4?" }],
    },
    outputs: {
      expected_tool: "calculator",
      expected_result: "25",
    },
  },
  {
    inputs: {
      messages: [{ role: "user", content: "Thank you for your help!" }],
    },
    outputs: {
      expected_tool: "null",
      expected_type: "closing",
    },
  },
  {
    inputs: {
      messages: [
        { role: "user", content: "Find information about TypeScript best practices" },
      ],
    },
    outputs: {
      expected_tool: "search",
      expected_topic: "typescript",
    },
  },
  {
    inputs: {
      messages: [{ role: "user", content: "Compute the sum of 42 + 58" }],
    },
    outputs: {
      expected_tool: "calculator",
      expected_result: "100",
    },
  },
];

async function createDataset() {
  console.log(`🗂️  Creating dataset: ${DATASET_NAME}\n`);

  const existingDatasets = await client.listDatasets({ datasetName: DATASET_NAME });
  for await (const ds of existingDatasets) {
    if (ds.name === DATASET_NAME) {
      console.log(`⚠️  Dataset "${DATASET_NAME}" already exists. Deleting...`);
      await client.deleteDataset({ datasetName: DATASET_NAME });
    }
  }

  const dataset = await client.createDataset(DATASET_NAME, {
    description: DATASET_DESCRIPTION,
  });

  console.log(`✅ Created dataset with ID: ${dataset.id}\n`);

  for (const example of examples) {
    await client.createExample(example.inputs, example.outputs, {
      datasetId: dataset.id,
    });
    console.log(`   Added example: "${example.inputs.messages[0].content.slice(0, 40)}..."`);
  }

  console.log(`\n🎉 Successfully created dataset with ${examples.length} examples`);
  console.log(`\n📊 View at: https://smith.langchain.com/datasets`);

  return dataset;
}

createDataset().catch(console.error);

