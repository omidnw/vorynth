# Run Evaluations

Execute the evaluation suite against the LangGraph agent.

## Quick Commands

```bash
# First time: Create the evaluation dataset
pnpm eval:create-dataset

# Run evaluations
pnpm eval

# With custom settings
EVAL_DATASET=my-dataset EVAL_PREFIX=experiment-v2 pnpm eval
```

## Prerequisites

1. **LangSmith API Key**: Set `LANGCHAIN_API_KEY` in `.env`
2. **Enable Tracing**: Set `LANGCHAIN_TRACING_V2=true`
3. **OpenAI API Key**: Required for agent execution

## Evaluation Flow

1. `pnpm eval:create-dataset` - Creates/resets dataset in LangSmith
2. `pnpm eval` - Runs agent against each example, applies evaluators
3. View results at https://smith.langchain.com

## Current Evaluators

| Evaluator | What it Checks |
|-----------|----------------|
| `helpfulness` | Response has meaningful content |
| `tool_usage` | Tools used when appropriate |
| `response_length` | Within acceptable bounds |
| `correct_tool` | Matches expected tool from dataset |

## Interpreting Results

- **Score 1.0**: Perfect on this metric
- **Score 0.0**: Failed this metric
- **Aggregate**: Average across all examples

## Troubleshooting

- **"Dataset not found"**: Run `pnpm eval:create-dataset` first
- **API errors**: Check `LANGCHAIN_API_KEY` is valid
- **Timeouts**: Reduce `maxConcurrency` in `run.ts`

