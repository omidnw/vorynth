# Add Evaluation

Create a new evaluator for assessing agent performance.

## Instructions

1. Ask me what aspect to evaluate (accuracy, tool usage, response quality, latency, etc.)
2. Create an evaluator in `src/evals/evaluators.ts`:

```typescript
import type { EvaluationResult } from "langsmith/evaluation";

export const myEvaluator = async ({
  input,
  prediction,
  reference,
}: EvalInput): Promise<EvaluationResult> => {
  // Extract relevant data
  const messages = prediction.messages || [];
  const lastMessage = messages.at(-1);
  
  // Evaluation logic
  const score = /* 0 to 1 */;
  
  return {
    key: "my_metric",
    score,
    comment: "Explanation of score",
  };
};
```

3. Add to the `evaluators` array export
4. Run `pnpm eval` to test

## Evaluator Types

### Heuristic (Fast, Deterministic)
- Response length checks
- Keyword presence/absence
- Error detection
- Tool call counting

### Reference-Based (Compares to Expected)
- Correct tool selection
- Expected content matching
- Result accuracy

### LLM-as-Judge (Subjective Quality)
- Helpfulness rating
- Coherence assessment
- Tone/style evaluation

## Example Evaluators to Add

- **Latency**: Track response time
- **Coherence**: Check if response makes sense
- **Factuality**: Verify claims against search results
- **Safety**: Detect harmful content
- **Conciseness**: Penalize overly verbose responses

