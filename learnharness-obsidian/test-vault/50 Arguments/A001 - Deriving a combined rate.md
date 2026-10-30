---
id: demo-a001
type: argument
demo: true
premise_ids: [demo-p001]
conclusion_ids: [demo-p002]
---
# Deriving a combined rate

Premise: [[40 Knowledge/P001 - A rate has a denominator]]
Conclusion: [[40 Knowledge/P002 - Combined rates require group weights]]

For disjoint groups, successes and attempts each add. If group i has nᵢ attempts and rate rᵢ, its successes are nᵢrᵢ. The combined rate is therefore Σ(nᵢrᵢ)/Σnᵢ. This equals Σ(wᵢrᵢ) for wᵢ = nᵢ/Σnᵢ.

This explains why averaging group rates directly only works generally when group sizes are equal.

Source context: [[20 Sessions/DEMO-001 - Why averages can mislead]]
