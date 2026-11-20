// The ten bipolar dimensions of strategic thinking used by the BIZSIM profile.
// Each runs from -100 (left pole) to +100 (right pole), starting at 0.
export const DIMENSIONS = [
  { id: 'TIME_HORIZON', name: 'Time horizon', left: 'Near-term liquidity', right: 'Long-term compounding' },
  { id: 'SUCCESS_METRIC', name: 'Success metric', left: 'Unit profit & cash', right: 'Scale & share' },
  { id: 'RISK_APPETITE', name: 'Risk appetite', left: 'Capital preservation', right: 'Asymmetric bets' },
  { id: 'CONCENTRATION', name: 'Concentration', left: 'Diversified', right: 'Single-core focus' },
  { id: 'LEADERSHIP', name: 'Leadership', left: 'Decentralised', right: 'Directed command' },
  { id: 'DECISION_STYLE', name: 'Decision style', left: 'Data-first', right: 'Conviction-first' },
  { id: 'SOCIAL_PROOF', name: 'Social proof', left: 'Industry consensus', right: 'First principles' },
  { id: 'COMMITMENT', name: 'Commitment', left: 'Keep options open', right: 'Irreversible commitment' },
  { id: 'VALUE_SIGNAL', name: 'Value signal', left: 'Cost & utility', right: 'Brand & pricing power' },
  { id: 'ROOT_CAUSE', name: 'Root cause', left: 'Structural forces', right: 'Execution choices' },
];

export const DIMENSION_IDS = DIMENSIONS.map((d) => d.id);

export const DOMAINS = {
  CAPITAL: 'Investing & Capital',
  STRATEGY: 'Business Models & Strategy',
  BRAND: 'Marketing & Brand',
  MACRO: 'Money & Macro',
  REVENUE: 'Sales & Revenue',
  OPERATIONS: 'Operations & Scale',
  POWER: 'Power & Negotiation',
};

export const ERAS = {
  ANCIENT: 'Ancient',
  MEDIEVAL: 'Medieval',
  EARLY_MODERN: 'Early modern',
  INDUSTRIAL: 'Industrial',
  MODERN: 'Modern',
  CONTEMPORARY: 'Contemporary',
  LATEST: 'Latest move',
};

// The six executive pillars of the BIZSIM curriculum.
export const PILLARS = {
  STRATEGY: { name: 'Strategy & Competition', long: 'Corporate Strategy, War & Competitive Positioning', focus: 'Asymmetric advantage, choosing the battlefield, mergers, and outmanoeuvring entrenched rivals.' },
  FINANCE: { name: 'Finance & Capital', long: 'Finance, Sovereign Wealth & Capital Allocation', focus: 'Unit economics, leverage, bubbles, cash-flow discipline and compounding returns.' },
  BRAND: { name: 'Brand & Go-to-Market', long: 'Brand, Art, Patronage & Go-To-Market', focus: 'Storytelling, cultural taste, pricing power, network effects and distribution.' },
  OPERATIONS: { name: 'Operations & Scale', long: 'Operations, Logistics, Engineering & Scaling', focus: 'Supply chains, bottlenecks, standardisation, speed and complex physical systems.' },
  TURNAROUND: { name: 'Turnarounds & Crises', long: 'Turnarounds, Post-Mortems & Crisis Management', focus: 'Surviving existential shocks, diagnosing failure, PR containment and radical restructuring.' },
  LEADERSHIP: { name: 'Leadership & Governance', long: 'Leadership, Culture, Statecraft & Governance', focus: 'Succession, boardroom power, incentives, psychological safety and institutional longevity.' },
};

export const DIFFICULTY = {
  1: 'Foundational',
  2: 'Operator',
  3: 'Executive',
};

// The six steps every BIZSIM case follows.
export const METHOD = ['Situation', 'Concept', 'Evidence', 'Episodes', 'Outcome', 'Insight'];
