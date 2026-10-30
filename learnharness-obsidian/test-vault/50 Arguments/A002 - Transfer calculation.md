---
id: demo-a002
type: argument
demo: true
premise_ids: [demo-p001, demo-p003]
conclusion_ids: [demo-p002]
source: "[[20 Sessions/DEMO-002 - Learner teacher simulation]]"
---
# Transfer calculation: 3 of 5 and 7 of 15

Group A has 3 successes from 5 attempts, so its rate is 60%. Group B has 7 successes from 15 attempts, so its rate is 46⅔%.

The equal-group mean is (60% + 46⅔%) / 2 = 53⅓%. That answers "What is the average of these two group rates?"

The pooled attempt rate is (3 + 7) / (5 + 15) = 10/20 = 50%. That answers "What fraction of all attempts succeeded?"

The attempt weights are 5/20 and 15/20, giving (5/20 × 60%) + (15/20 × 46⅔%) = 50%.

## Checks
- Numerators sum to 10 successes.
- Denominators sum to 20 attempts.
- The pooled result is between the group rates.
- The larger group contributes three times as many attempts, so it has three times the weight for the pooled-attempt question.

This assumes disjoint groups, the same success definition and one count per attempt. See [[40 Knowledge/P003 - Choose the right weighting target]].
