---
id: demo-session-002
type: learning-simulation
demo: true
simulation: synthetic-roleplay
provider_run: false
---
# DEMO-002 · Learner and teacher role-play

> [!warning] Synthetic simulation record
> This role-play was authored to seed the knowledge base. It did not call DeepSeek or another paid API and is not a native resumable LearnHarness session. The plugin's separate provider-backed AI-learner path is implemented but needs a configured key and live run.

## Environment

A learner is comparing two disjoint groups that use the same success measure. Group A has 1 success in 2 attempts (50%); group B has 9 successes in 10 attempts (90%). The target question is the success rate across all 12 attempts.

**Synthetic learner profile:** curious novice; tends to give each group equal influence; explains uncertainty; does not know the pooled-rate rule yet.

## Simulation transcript

**Teacher:** What is the combined success rate? Say how you chose your calculation.

**Learner:** 70%. I averaged 50% and 90%. There are two groups, so each rate gets half the weight. I am fairly confident because that is the usual way to average two numbers.

**Teacher:** What does each percentage summarize? How many attempts stand behind each one?

**Learner:** The first is 1 out of 2 and the second is 9 out of 10. So the second percentage represents more attempts, but I still thought the groups count equally.

**Teacher:** Before calculating, choose the target. Do you want the average group rate, or the success rate for a randomly selected attempt from the combined set?

**Learner:** The rate across all attempts. Then each attempt should count once. I think I should add the successes and add the attempts.

**Teacher:** Right. The pooled rate is (1 + 9) / (2 + 10) = 10/12 = 83⅓%. The equal-group mean of 70% answers a different question: the average of the two group-level rates. For a pooled attempt rate, the group rates receive weights 2/12 and 10/12.

**Teacher:** Transfer it. Group A has 3 successes in 5 attempts and group B has 7 in 15. What is the rate across all attempts, and why?

**Learner:** I first average 60% and 46⅔%, which gives 53⅓%. But because the question is about all attempts, I should combine counts: 10 successes out of 20 attempts, or 50%. The 15-attempt group has three times the influence of the 5-attempt group.

**Teacher:** Correct. One nuance: a larger denominator tells us how many attempts the rate represents. It does not guarantee the group is unbiased or that its data are better in every sense. State the target and data assumptions before interpreting a pooled result.

## Knowledge captured

- A rate is a numerator divided by a denominator: [[40 Knowledge/P001 - A rate has a denominator]].
- Equal weighting answers an average-of-groups question; denominator weighting answers a pooled-attempt question: [[40 Knowledge/P003 - Choose the right weighting target]].
- The pooled-rate formula and its assumptions: [[40 Knowledge/P002 - Combined rates require group weights]] and [[50 Arguments/A001 - Deriving a combined rate]].
- Worked transfer calculation: [[50 Arguments/A002 - Transfer calculation]].

## Graph

Open [[40 Knowledge/Weighted rates knowledge graph.canvas]] to see the concept and derivation links. Canvas edges are a hand-authored map; the plugin does not currently extract this graph automatically.
