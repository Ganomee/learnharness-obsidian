"""Create a reproducible, explicitly simulated 120-note statistics knowledge base."""
from pathlib import Path
import re
import json

ROOT = Path(__file__).resolve().parents[1] / "test-vault"
KNOWLEDGE = ROOT / "40 Knowledge"
SESSIONS = ROOT / "20 Sessions"

# Topic, then ten title|claim pairs. The claims are short introductory-statistics
# references written for this demo; no learner/provider execution is implied.
TOPICS = [
    ("Data and variables", [
        ("Population and sample", "A population is the full set of units a question concerns; a sample is the subset actually observed."),
        ("Observational unit", "An observational unit is the person, object, or event on which a measurement is recorded."),
        ("Variable", "A variable records a characteristic that can take different values across observational units."),
        ("Categorical variable", "A categorical variable assigns observations to groups or labels; arithmetic on its labels is usually meaningless."),
        ("Quantitative variable", "A quantitative variable represents a count or measurement for which numerical differences have meaning."),
        ("Discrete variable", "A discrete quantitative variable has a countable set of possible values, often whole-number counts."),
        ("Continuous variable", "A continuous measurement can in principle take any value in an interval, subject to measurement precision."),
        ("Measurement scale", "Nominal, ordinal, interval, and ratio scales encode increasing structure; the scale limits meaningful comparisons."),
        ("Operational definition", "An operational definition states exactly how a concept is measured or classified in a study."),
        ("Data dictionary", "A data dictionary documents variable names, meanings, units, allowed values, and missing-value conventions."),
    ]),
    ("Study design and bias", [
        ("Observational study", "An observational study records exposure or conditions without assigning them to participants."),
        ("Experiment", "An experiment assigns a treatment or condition and measures outcomes under a defined protocol."),
        ("Random assignment", "Random assignment uses chance to allocate experimental units to conditions, helping balance confounders on average."),
        ("Random sampling", "Random sampling uses chance to select units from a target population, supporting population generalization when well executed."),
        ("Confounder", "A confounder is associated with both an exposure and an outcome and can distort their observed relationship."),
        ("Selection bias", "Selection bias occurs when inclusion or participation is related to variables relevant to the estimate."),
        ("Nonresponse bias", "Nonresponse bias can arise when respondents differ systematically from nonrespondents on the outcome of interest."),
        ("Measurement bias", "Measurement bias is systematic error caused by an instrument, procedure, or respondent behavior."),
        ("Blinding", "Blinding masks treatment assignment from specified people to reduce expectation-driven behavior or measurement."),
        ("Causal inference", "Causal conclusions require a design and assumptions that address alternative explanations, not merely an observed association."),
    ]),
    ("Describing distributions", [
        ("Frequency table", "A frequency table counts observations in categories or value ranges and makes the distribution inspectable."),
        ("Histogram", "A histogram displays quantitative values in adjacent bins; bin choices affect the visible shape."),
        ("Bar chart", "A bar chart compares category values with separated bars; bar heights encode counts, proportions, or another stated measure."),
        ("Center", "A measure of center summarizes a distribution’s typical or balancing value, but does not describe its full shape."),
        ("Mean", "The arithmetic mean is the sum of values divided by their count and is sensitive to extreme observations."),
        ("Median", "The median is the middle ordered value, or midpoint of the two middle values, and is resistant to extremes."),
        ("Mode", "The mode is a most frequent value or category; a distribution can have multiple modes or no uniquely useful mode."),
        ("Skewness", "A skewed distribution has an asymmetric tail; the tail direction names the skew, not the location of most observations."),
        ("Outlier", "An outlier is unusually distant relative to a stated rule or context and should be investigated rather than automatically removed."),
        ("Robust summary", "A robust summary changes relatively little when a small number of observations are extreme; median and IQR are common examples."),
    ]),
    ("Spread and position", [
        ("Range", "The range is maximum minus minimum and depends only on the two most extreme observations."),
        ("Quartiles", "Quartiles divide ordered data into four portions according to a stated quantile convention."),
        ("Interquartile range", "The interquartile range is Q3 minus Q1 and describes the spread of the middle half of observations."),
        ("Five-number summary", "The five-number summary reports minimum, first quartile, median, third quartile, and maximum."),
        ("Box plot", "A box plot summarizes quartiles and median; whisker and outlier conventions should be stated because they vary."),
        ("Variance", "Variance is the average squared deviation using a specified divisor; its units are the squared units of the data."),
        ("Standard deviation", "Standard deviation is the square root of variance and describes spread in the original measurement units."),
        ("Z-score", "A z-score is a value minus a reference mean, divided by a positive reference standard deviation."),
        ("Percentile rank", "A percentile describes a position in a distribution; conventions differ, especially with small samples and ties."),
        ("Coefficient of variation", "The coefficient of variation is standard deviation divided by mean and is useful only for meaningful ratio-scale values with a suitable nonzero mean."),
    ]),
    ("Probability foundations", [
        ("Sample space", "A sample space lists the possible outcomes of a random process under a chosen description."),
        ("Event", "An event is a set of outcomes in a sample space, and its probability lies between zero and one."),
        ("Complement rule", "The probability that an event does not occur is one minus the probability that it occurs."),
        ("Addition rule", "For events A and B, P(A or B) equals P(A)+P(B)-P(A and B)."),
        ("Disjoint events", "Disjoint events cannot occur together, so their intersection probability is zero."),
        ("Conditional probability", "P(A given B) is P(A and B) divided by P(B), provided P(B) is positive."),
        ("Independence", "Events A and B are independent when learning that one occurred does not change the probability of the other."),
        ("Multiplication rule", "P(A and B)=P(A)P(B given A); under independence this reduces to P(A)P(B)."),
        ("Bayes rule", "Bayes’ rule reverses conditioning by combining a likelihood with prior probabilities and normalizing."),
        ("Base-rate neglect", "A diagnostic result’s meaning depends on prevalence as well as test accuracy; ignoring prevalence can mislead."),
    ]),
    ("Random variables and distributions", [
        ("Random variable", "A random variable assigns a numerical value to each outcome of a random process."),
        ("Probability distribution", "A probability distribution assigns probabilities to possible values or ranges and must total one."),
        ("Expected value", "The expected value is the probability-weighted average of outcomes over repeated trials; it need not be an attainable outcome."),
        ("Linearity of expectation", "The expected value of a sum equals the sum of expected values when those expectations exist, without requiring independence."),
        ("Variance of a sum", "For two variables, variance of their sum includes twice their covariance; variances simply add only when covariance is zero."),
        ("Bernoulli trial", "A Bernoulli variable records one binary outcome with success probability p and failure probability 1-p."),
        ("Binomial model", "A binomial count models successes in a fixed number of independent Bernoulli trials with a common success probability."),
        ("Normal distribution", "A normal distribution is a symmetric, bell-shaped continuous model defined by its mean and standard deviation."),
        ("Standard normal", "The standard normal distribution has mean zero and standard deviation one."),
        ("Law of large numbers", "Under suitable conditions, an average of repeated observations approaches its expected value as the number of observations grows."),
    ]),
    ("Sampling and the central limit theorem", [
        ("Sampling distribution", "A sampling distribution describes how a statistic varies across repeated samples under a specified design."),
        ("Standard error", "A standard error is the standard deviation of a statistic’s sampling distribution, often estimated from sample data."),
        ("Sample mean standard error", "For independent observations with finite variance, the sample mean’s standard error is population SD divided by square root of n."),
        ("Central limit theorem", "Under common regularity conditions, standardized sums or means become approximately normal as sample size grows."),
        ("Sample size effect", "Larger independent samples usually reduce standard errors at a rate proportional to one over square root of sample size."),
        ("Finite population correction", "Sampling a substantial fraction without replacement from a finite population can reduce variance relative to an infinite-population approximation."),
        ("Stratified sampling", "Stratified sampling samples within defined subgroups and can improve precision when allocation and analysis reflect the design."),
        ("Cluster sampling", "Cluster sampling selects groups first; similarity within clusters can make the effective information smaller than the raw count suggests."),
        ("Bootstrap", "The bootstrap approximates a statistic’s sampling variability by resampling observed units with replacement, subject to design assumptions."),
        ("Permutation test", "A permutation test compares a statistic to values generated by rearrangements allowed under a null exchangeability assumption."),
    ]),
    ("Confidence intervals", [
        ("Point estimate", "A point estimate is one sample-based value used to estimate a population quantity."),
        ("Confidence level", "A 95% confidence procedure covers the true parameter in about 95% of repeated samples when its assumptions hold."),
        ("Confidence interval", "A confidence interval is an interval produced by a procedure with a stated long-run coverage property."),
        ("Margin of error", "Margin of error is the half-width of an interval around an estimate under a specified method and confidence level."),
        ("Critical value", "A critical value is a quantile of a reference distribution used to set an interval or test threshold."),
        ("t distribution", "The t distribution accounts for estimating a normal population’s standard deviation and has heavier tails at smaller degrees of freedom."),
        ("Proportion interval", "An interval for a proportion should use a method with adequate performance for its sample size and observed rate."),
        ("Interval width", "All else equal, higher confidence and greater variability widen an interval, while larger sample size narrows it."),
        ("Practical significance", "An estimate can be statistically precise yet too small to matter for a real decision; context sets practical importance."),
        ("Interval interpretation", "A confidence interval does not assign a 95% probability to a fixed parameter after the interval is computed in the frequentist framework."),
    ]),
    ("Hypothesis testing", [
        ("Null hypothesis", "The null hypothesis specifies a reference claim or parameter value used to calibrate a test statistic."),
        ("Alternative hypothesis", "The alternative hypothesis identifies departures from the null that the test is designed to detect."),
        ("Test statistic", "A test statistic summarizes sample evidence in a scale whose null distribution is known or approximated."),
        ("P-value", "A p-value is the probability, assuming the null and model, of a test statistic at least as extreme as the observed one."),
        ("Significance level", "The significance level alpha is a chosen bound on the long-run Type I error rate under the test’s assumptions."),
        ("Type I error", "A Type I error rejects a true null hypothesis; its probability is controlled approximately by the test level under assumptions."),
        ("Type II error", "A Type II error fails to reject a false null; its probability depends on the alternative, design, and sample size."),
        ("Statistical power", "Power is the probability a test rejects the null under a specified alternative and design."),
        ("One-sided test", "A one-sided test places its rejection region in one direction, which must be justified and set before seeing results."),
        ("Failure to reject", "Failure to reject a null is not proof that it is true; the data may be insufficiently informative."),
    ]),
    ("Comparisons and categorical data", [
        ("Difference in means", "A difference in means compares arithmetic averages on the same scale and should be paired with uncertainty and context."),
        ("Paired data", "Paired data contain linked measurements; analysis should preserve pairing, often by studying within-pair differences."),
        ("Two-sample comparison", "A two-sample comparison requires checking design, independence or pairing, distributional conditions, and the target quantity."),
        ("Pooled proportion", "For disjoint groups measuring the same outcome, the pooled proportion is total successes divided by total trials."),
        ("Contingency table", "A contingency table displays counts for combinations of categorical-variable values."),
        ("Expected cell count", "An expected contingency-table count is calculated under a specified independence model, not read from observed data."),
        ("Chi-square statistic", "A chi-square statistic aggregates squared observed-minus-expected differences scaled by expected counts."),
        ("Risk difference", "Risk difference subtracts two outcome probabilities and is measured in probability points."),
        ("Risk ratio", "Risk ratio divides one outcome probability by another positive probability and is dimensionless."),
        ("Simpson’s paradox", "An aggregate association can differ from subgroup associations when group composition differs; inspect relevant stratification and causal structure."),
    ]),
    ("Correlation and regression", [
        ("Scatterplot", "A scatterplot displays paired quantitative observations and helps reveal form, direction, clusters, and unusual points."),
        ("Covariance", "Covariance measures joint linear variation and depends on the units of both variables."),
        ("Correlation", "Pearson correlation measures linear association on a scale from -1 to 1 and can be sensitive to outliers."),
        ("Correlation is not causation", "An association alone does not establish causation because confounding, reverse direction, and selection can explain it."),
        ("Least squares line", "The least squares line minimizes the sum of squared vertical residuals for the observed data."),
        ("Slope", "In a linear model, slope is the fitted change in mean response per one-unit increase in the predictor."),
        ("Intercept", "The intercept is the fitted response at predictor zero and may lack practical meaning if zero is outside the data context."),
        ("Residual", "A residual is observed response minus fitted response and measures vertical prediction error in the sample."),
        ("R-squared", "R-squared summarizes the fraction of sample response variation explained by a fitted model under a specified definition; it is not causal proof."),
        ("Extrapolation", "Extrapolation predicts beyond the observed predictor range and can fail when the relationship changes outside that range."),
    ]),
    ("Data quality and communication", [
        ("Missing data", "Missingness can change estimates; its pattern and plausible mechanism should be examined before choosing a method."),
        ("Duplicate records", "Duplicate records can inflate counts and distort estimates; deduplication rules should match the unit and data-generation process."),
        ("Unit of analysis", "The unit of analysis is the entity represented by each analytic observation and must match the research question."),
        ("Data leakage", "Data leakage occurs when information unavailable at prediction time enters model training or evaluation."),
        ("Train-test split", "A train-test split evaluates predictions on held-out data, but split design must respect time, groups, and dependence."),
        ("Reproducibility", "Reproducible analysis records data provenance, transformations, software, assumptions, and executable steps."),
        ("Uncertainty statement", "A useful uncertainty statement names the estimate, interval or uncertainty measure, method, and key assumptions."),
        ("Denominator transparency", "A reported rate should state its numerator, denominator, population, time window, and exclusions."),
        ("Visualization integrity", "A truthful chart labels axes and units, uses suitable scales, and avoids visual choices that distort comparisons."),
        ("Ethical data use", "Ethical data use considers consent, privacy, access, potential harms, and whether collection and reuse are justified."),
    ]),
]

def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")

def write_new(path: Path, text: str) -> None:
    if path.exists():
        raise SystemExit(f"Refusing to overwrite existing file: {path}")
    path.write_text(text.rstrip() + "\n", encoding="utf-8")

def main() -> None:
    if sum(len(items) for _, items in TOPICS) != 120:
        raise SystemExit("Expected exactly 120 concepts")
    for folder in (KNOWLEDGE, SESSIONS):
        folder.mkdir(parents=True, exist_ok=True)
    next_id = 10
    for topic_number, (topic, concepts) in enumerate(TOPICS, start=1):
        session_name = f"DEMO-STAT-{topic_number:02d} - {topic} role-play"
        session_path = SESSIONS / f"{session_name}.md"
        session_link = f"[[20 Sessions/{session_name}]]"
        concepts_data = []
        for title, claim in concepts:
            note_id = f"demo-p{next_id:03d}"
            filename = f"P{next_id:03d} - {slug(title)}.md"
            concepts_data.append((note_id, title, claim, filename))
            next_id += 1
        dialogue = [
            "---", 'type: simulated-study-session', "demo: true", 'simulation: "assistant-authored role-play; no provider call"', f'topic: "{topic}"', "---", f"# {session_name}", "",
            "> [!warning] Simulation provenance", "> Assistant-authored learner/teacher dialogue for populating a demo graph. It was not generated by an active LearnHarness session, external model, or API. The linked concept notes are reviewable introductory references.", "",
            "## Dialogue", "",
        ]
        for turn, (note_id, title, claim, filename) in enumerate(concepts_data, start=1):
            link = f"[[40 Knowledge/{filename.removesuffix('.md')}]]"
            dialogue.extend([f"### Turn {turn}: {title}", f"**Learner:** How should I understand {title.lower()}?", f"**Teacher:** {claim} The linked note records the concept and its conditions: {link}", ""])
        dialogue += ["## Outcome", "", f"The simulated learner reviewed 10 connected concepts in **{topic}**. Check each proposition and its linked prerequisites before relying on it.", ""]
        write_new(session_path, "\n".join(dialogue))
        for ix, (note_id, title, claim, filename) in enumerate(concepts_data):
            prev = f"[[40 Knowledge/{concepts_data[ix-1][3].removesuffix('.md')}]]" if ix > 0 else None
            nxt = f"[[40 Knowledge/{concepts_data[ix+1][3].removesuffix('.md')}]]" if ix + 1 < len(concepts_data) else None
            next_ids = f"next_ids: [{concepts_data[ix+1][0]}]" if ix + 1 < len(concepts_data) else "next_ids: []"
            next_reasoning = ""
            if ix + 1 < len(concepts_data):
                next_title, next_claim = concepts_data[ix + 1][1:3]
                next_reasoning = "next_reasoning: " + json.dumps(f"Sequence rationale: First establish {title} ({claim}) and then extend to {next_title} ({next_claim}). This is the authored teaching order, not a formal logical entailment.", ensure_ascii=False)
            lines = ["---", f"id: {note_id}", "type: proposition", "demo: true", f'source: "{session_link}"', f'topic: "{topic}"', "simulation: synthetic-roleplay", next_ids, next_reasoning, "---", f"# {title}", "", "## Claim", claim, "", "## Study dialogue", f"Learner asks how to understand **{title.lower()}**. Teacher explanation: {claim}", "", "## Connections"]
            if prev:
                lines.append(f"Prerequisite: {prev}.")
            if nxt:
                lines.append(f"Builds toward: {nxt}.")
            lines.extend([f"Source session: {session_link}.", ""])
            write_new(KNOWLEDGE / filename, "\n".join(lines))
    print("Created 120 proposition notes and 12 simulated dialogue notes; concepts are connected directly without an index hub.")

if __name__ == "__main__":
    main()
