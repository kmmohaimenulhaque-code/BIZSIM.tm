// Principles library. Every idea is paraphrased in BIZSIM's own words and
// attributed to the book it comes from. No passages are reproduced.
// Cases and AI-generated analysis may only cite principle ids listed here.

export const BOOKS = [
  { id: '48laws', title: 'The 48 Laws of Power', author: 'Robert Greene', year: 1998, theme: 'Power' },
  { id: 'power', title: 'Power: Why Some People Have It, and Others Don’t', author: 'Jeffrey Pfeffer', year: 2010, theme: 'Power' },
  { id: 'influence', title: 'Influence: The Psychology of Persuasion', author: 'Robert B. Cialdini', year: 1984, theme: 'Persuasion' },
  { id: 'carnegie', title: 'How to Win Friends and Influence People', author: 'Dale Carnegie', year: 1936, theme: 'Persuasion' },
  { id: 'prince', title: 'The Prince', author: 'Niccolò Machiavelli', year: 1532, theme: 'Power' },
  { id: 'voss', title: 'Never Split the Difference', author: 'Chris Voss with Tahl Raz', year: 2016, theme: 'Negotiation' },
  { id: 'rumelt', title: 'Good Strategy Bad Strategy', author: 'Richard Rumelt', year: 2011, theme: 'Strategy' },
  { id: 'porter', title: 'Competitive Strategy', author: 'Michael E. Porter', year: 1980, theme: 'Strategy' },
  { id: 'blueocean', title: 'Blue Ocean Strategy', author: 'W. Chan Kim & Renée Mauborgne', year: 2005, theme: 'Strategy' },
  { id: 'playtowin', title: 'Playing to Win', author: 'A.G. Lafley & Roger L. Martin', year: 2013, theme: 'Strategy' },
  { id: 'christensen', title: 'The Innovator’s Dilemma', author: 'Clayton M. Christensen', year: 1997, theme: 'Innovation' },
  { id: 'suntzu', title: 'The Art of War', author: 'Sun Tzu', year: -500, theme: 'Strategy' },
  { id: 'brooks', title: 'Business Adventures', author: 'John Brooks', year: 1969, theme: 'Business history' },
  { id: 'ceoexcellence', title: 'CEO Excellence', author: 'Carolyn Dewar, Scott Keller & Vikram Malhotra', year: 2022, theme: 'Leadership' },
  { id: 'goodtogreat', title: 'Good to Great', author: 'Jim Collins', year: 2001, theme: 'Leadership' },
  { id: 'drucker', title: 'The Effective Executive', author: 'Peter F. Drucker', year: 1967, theme: 'Leadership' },
  { id: 'ownership', title: 'Extreme Ownership', author: 'Jocko Willink & Leif Babin', year: 2015, theme: 'Leadership' },
  { id: 'okr', title: 'Measure What Matters', author: 'John Doerr', year: 2018, theme: 'Execution' },
  { id: 'zerotoone', title: 'Zero to One', author: 'Peter Thiel with Blake Masters', year: 2014, theme: 'Innovation' },
  { id: 'millionairemind', title: 'Secrets of the Millionaire Mind', author: 'T. Harv Eker', year: 2005, theme: 'Wealth mindset' },
  { id: 'psychmoney', title: 'The Psychology of Money', author: 'Morgan Housel', year: 2020, theme: 'Money' },
  { id: 'principles', title: 'Principles', author: 'Ray Dalio', year: 2017, theme: 'Decision-making' },
  { id: 'thinkgrow', title: 'Think and Grow Rich', author: 'Napoleon Hill', year: 1937, theme: 'Wealth mindset' },
  { id: 'fastlane', title: 'The Millionaire Fastlane', author: 'MJ DeMarco', year: 2011, theme: 'Wealth mindset' },
  { id: 'paranoid', title: 'Only the Paranoid Survive', author: 'Andrew S. Grove', year: 1996, theme: 'Strategy' },
  { id: '7powers', title: '7 Powers', author: 'Hamilton Helmer', year: 2016, theme: 'Strategy' },
  { id: 'kahneman', title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', year: 2011, theme: 'Decision-making' },
  { id: 'blackswan', title: 'The Black Swan', author: 'Nassim Nicholas Taleb', year: 2007, theme: 'Risk' },
  { id: 'intelligentinvestor', title: 'The Intelligent Investor', author: 'Benjamin Graham', year: 1949, theme: 'Money' },
  { id: 'hardthings', title: 'The Hard Thing About Hard Things', author: 'Ben Horowitz', year: 2014, theme: 'Leadership' },
];

// Principles, each one paraphrased, never quoted.
export const PRINCIPLES = [
  // The 48 Laws of Power
  { id: '48laws-concentrate', book: '48laws', name: 'Concentrate your forces', idea: 'Strength spread across many fronts is easily overwhelmed; concentrated resources at the decisive point win more than thin coverage everywhere.' },
  { id: '48laws-plan-end', book: '48laws', name: 'Plan all the way to the end', idea: 'Judge a move by where it leaves you several steps later, not by the satisfaction it gives today. Many victories are lost after they are won.' },
  { id: '48laws-formless', book: '48laws', name: 'Assume formlessness', idea: 'Rigid structures invite attack and break under change. Staying adaptable denies opponents a fixed target.' },
  { id: '48laws-self-interest', book: '48laws', name: 'Appeal to self-interest', idea: 'When you need others to act, show them what they gain. Appeals to gratitude or mercy are weaker than a clear shared benefit.' },
  { id: '48laws-dependence', book: '48laws', name: 'Make others depend on you', idea: 'The more a system relies on what only you provide, the stronger and more durable your position becomes.' },
  { id: '48laws-actions', book: '48laws', name: 'Win through actions, not argument', idea: 'Demonstration persuades more reliably than debate; a visible result ends arguments that words prolong.' },

  // Power: Pfeffer
  { id: 'power-resources', book: 'power', name: 'Control valued resources', idea: 'Influence follows control of what others need, money, access, information or capability. Build or acquire those resources deliberately.' },
  { id: 'power-network', book: 'power', name: 'Build networks before you need them', idea: 'Relationships and alliances are assets that compound; they are hard to create in a crisis and decisive when one arrives.' },

  // Influence: Cialdini
  { id: 'influence-reciprocity', book: 'influence', name: 'Reciprocity', idea: 'People feel obliged to return what they have received. A meaningful first concession often unlocks cooperation.' },
  { id: 'influence-commitment', book: 'influence', name: 'Commitment and consistency', idea: 'Once people take a public position they tend to defend it, which helps persuasion and also traps leaders in failing courses.' },
  { id: 'influence-socialproof', book: 'influence', name: 'Social proof', idea: 'Under uncertainty people copy what similar others do. Markets and boards herd for the same reason.' },
  { id: 'influence-authority', book: 'influence', name: 'Authority', idea: 'Credible expertise and visible signals of legitimacy make people more willing to follow a recommendation.' },
  { id: 'influence-scarcity', book: 'influence', name: 'Scarcity', idea: 'Things seem more valuable when they are rare or about to disappear; scarcity can also be used to create urgency.' },

  // Carnegie
  { id: 'carnegie-eager-want', book: 'carnegie', name: 'Arouse an eager want', idea: 'People act for their own reasons. Frame a proposal around what the other side already wants.' },
  { id: 'carnegie-save-face', book: 'carnegie', name: 'Let the other person save face', idea: 'Reversals and concessions are easier when nobody is humiliated by them.' },

  // The Prince
  { id: 'prince-new-order', book: 'prince', name: 'New orders are hardest to introduce', idea: 'Reformers face fierce enemies among those who benefit from the old system and only lukewarm support from those who might gain from the new one.' },
  { id: 'prince-fortune', book: 'prince', name: 'Fortune and preparation', idea: 'Fortune governs much of what happens, but prepared leaders build defences in calm times so that floods do less damage.' },
  { id: 'prince-own-arms', book: 'prince', name: 'Rely on your own arms', idea: 'Capabilities you own and control are more dependable than borrowed or hired ones whose loyalty lies elsewhere.' },

  // Voss
  { id: 'voss-empathy', book: 'voss', name: 'Tactical empathy', idea: 'Understanding and naming the counterpart’s position and emotions lowers resistance and reveals what they really need.' },
  { id: 'voss-calibrated', book: 'voss', name: 'Calibrated questions', idea: 'Open “how” and “what” questions let the other side solve your problem while feeling in control.' },

  // Rumelt
  { id: 'rumelt-kernel', book: 'rumelt', name: 'The kernel of strategy', idea: 'Good strategy has three parts: an honest diagnosis of the challenge, a guiding policy for dealing with it, and coherent actions that carry it out.' },
  { id: 'rumelt-focus', book: 'rumelt', name: 'Focus creates leverage', idea: 'Strategy means choosing what not to do. Concentrating effort where it can tip the outcome beats spreading it across every goal.' },
  { id: 'rumelt-bad', book: 'rumelt', name: 'Recognise bad strategy', idea: 'Fluffy goals, a refusal to face the real problem and long lists of objectives are signs that hard choices are being avoided.' },

  // Porter
  { id: 'porter-five-forces', book: 'porter', name: 'The five forces', idea: 'Industry profitability is shaped by rivalry, the threat of entrants and substitutes, and the bargaining power of buyers and suppliers.' },
  { id: 'porter-generic', book: 'porter', name: 'Choose a generic strategy', idea: 'Firms win through cost leadership, differentiation, or focus on a niche. Trying to do all of them at once tends to leave a firm stuck in the middle.' },
  { id: 'porter-barriers', book: 'porter', name: 'Entry barriers', idea: 'Scale economies, capital requirements, access to channels and legal privileges protect incumbents from newcomers.' },

  // Blue Ocean
  { id: 'blueocean-value', book: 'blueocean', name: 'Value innovation', idea: 'Instead of fighting rivals in a crowded market, create uncontested space by raising buyer value while lowering cost.' },
  { id: 'blueocean-errc', book: 'blueocean', name: 'Eliminate, reduce, raise, create', idea: 'Rebuild the offer by asking which industry factors to remove, cut back, increase, or invent.' },

  // Playing to Win
  { id: 'ptw-cascade', book: 'playtowin', name: 'The strategy choice cascade', idea: 'Strategy is a linked set of choices: winning aspiration, where to play, how to win, the capabilities required, and the management systems that sustain them.' },
  { id: 'ptw-where-play', book: 'playtowin', name: 'Where to play, how to win', idea: 'The two central choices are which markets and customers to serve, and what advantage will make you win there.' },

  // Christensen
  { id: 'christensen-disruption', book: 'christensen', name: 'Disruptive innovation', idea: 'Simpler, cheaper technologies start in markets incumbents ignore, then improve until they displace the leaders.' },
  { id: 'christensen-best-customers', book: 'christensen', name: 'Listening to the best customers', idea: 'Well-run incumbents fail precisely because they serve their most profitable customers, who do not want the disruptive product at first.' },
  { id: 'christensen-separate', book: 'christensen', name: 'Separate the new business', idea: 'A disruptive venture often needs its own organisation and cost structure so that the core business does not starve it.' },

  // Sun Tzu
  { id: 'suntzu-terrain', book: 'suntzu', name: 'Choose the terrain', idea: 'The side that picks the ground, where the opponent’s strengths cannot be used, can defeat a larger force.' },
  { id: 'suntzu-know', book: 'suntzu', name: 'Know the enemy and yourself', idea: 'Accurate knowledge of both your own and your opponent’s strengths is the basis of every sound plan.' },
  { id: 'suntzu-without-fighting', book: 'suntzu', name: 'Win without fighting', idea: 'The best victories make battle unnecessary, by outmanoeuvring, disrupting alliances, or making resistance pointless.' },

  // Business Adventures
  { id: 'brooks-human', book: 'brooks', name: 'Corporate outcomes are human stories', idea: 'Careful case histories show that corporate triumphs and failures turn on judgment, timing and personalities more than on formulas.' },

  // CEO Excellence
  { id: 'ceo-bold-direction', book: 'ceoexcellence', name: 'Set a bold direction', idea: 'The best chief executives define the playing field boldly and make large, early resource moves instead of incremental tweaks.' },
  { id: 'ceo-align', book: 'ceoexcellence', name: 'Align the organisation', idea: 'Structure, culture and talent have to be redesigned to fit the strategy; the “soft” elements are treated as hard work.' },

  // Good to Great
  { id: 'gtg-brutal-facts', book: 'goodtogreat', name: 'Confront the brutal facts', idea: 'Lasting companies face reality directly while keeping faith that they will prevail in the end.' },
  { id: 'gtg-hedgehog', book: 'goodtogreat', name: 'The hedgehog concept', idea: 'Focus on the intersection of what you can be best at, what drives your economic engine, and what you are deeply passionate about.' },
  { id: 'gtg-flywheel', book: 'goodtogreat', name: 'The flywheel', idea: 'Breakthroughs come from consistent pushes in one direction that build momentum, not from one dramatic action.' },
  { id: 'gtg-first-who', book: 'goodtogreat', name: 'First who, then what', idea: 'Get the right people in the right seats before deciding exactly where to drive the organisation.' },

  // Drucker
  { id: 'drucker-first-things', book: 'drucker', name: 'First things first', idea: 'Effective executives concentrate on a few priorities, and deliberately abandon yesterday’s activities that no longer contribute.' },
  { id: 'drucker-decision', book: 'drucker', name: 'Effective decisions', idea: 'Good decisions start from a correct definition of the problem and the boundary conditions a solution must satisfy.' },
  { id: 'drucker-strengths', book: 'drucker', name: 'Build on strengths', idea: 'Organisations perform by making strengths productive rather than by fixing every weakness.' },

  // Extreme Ownership
  { id: 'ownership-own-it', book: 'ownership', name: 'Extreme ownership', idea: 'Leaders own every outcome in their world, including failures they did not directly cause, and fix them instead of assigning blame.' },
  { id: 'ownership-prioritize', book: 'ownership', name: 'Prioritise and execute', idea: 'Under pressure, identify the single most important problem, solve it, then move to the next.' },
  { id: 'ownership-decentralized', book: 'ownership', name: 'Decentralised command', idea: 'Frontline leaders who understand the intent can make decisions faster than any central command.' },

  // Measure What Matters
  { id: 'okr-focus', book: 'okr', name: 'Objectives and key results', idea: 'Set a few ambitious objectives with measurable key results so the whole organisation knows what matters and can track it.' },

  // Zero to One
  { id: 'zto-monopoly', book: 'zerotoone', name: 'Escape competition', idea: 'Durable profits come from building something unique enough to dominate a market; head-to-head competition erodes profits for everyone.' },
  { id: 'zto-last-mover', book: 'zerotoone', name: 'Last-mover advantage', idea: 'What matters is not being first but being the company that makes the last great move in a market and holds it.' },

  // Secrets of the Millionaire Mind
  { id: 'eker-opportunity', book: 'millionairemind', name: 'Focus on opportunities', idea: 'People who build wealth look first at the possible gain and manage the risk, rather than letting obstacles define the decision.' },
  { id: 'eker-think-big', book: 'millionairemind', name: 'Think big', idea: 'The scale of the problem you choose to solve sets the ceiling on the value you can create.' },

  // Psychology of Money
  { id: 'housel-room-error', book: 'psychmoney', name: 'Room for error', idea: 'Plans fail in ways nobody predicts. A margin of safety lets you survive long enough for good decisions to pay off.' },
  { id: 'housel-compounding', book: 'psychmoney', name: 'Compounding needs time', idea: 'The largest results come from modest advantages held for a very long time; interrupting compounding is the costliest mistake.' },
  { id: 'housel-enough', book: 'psychmoney', name: 'Know what is enough', idea: 'Taking risks with what you have and need to gain what you do not need is how fortunes are lost.' },

  // Principles: Dalio
  { id: 'dalio-pain-reflection', book: 'principles', name: 'Pain plus reflection equals progress', idea: 'Painful setbacks are the best teachers when you examine them honestly and turn the lesson into a rule.' },
  { id: 'dalio-believability', book: 'principles', name: 'Believability-weighted decisions', idea: 'Weigh opinions by the track record and reasoning of the people who hold them, not by rank or volume.' },
  { id: 'dalio-reality', book: 'principles', name: 'Embrace reality', idea: 'Deal with things as they are, not as you wish them to be; denial delays the adjustments that matter.' },

  // Think and Grow Rich
  { id: 'hill-definiteness', book: 'thinkgrow', name: 'Definiteness of purpose', idea: 'A clear, specific aim backed by a concrete plan concentrates effort in a way vague ambition cannot.' },
  { id: 'hill-mastermind', book: 'thinkgrow', name: 'The mastermind alliance', idea: 'Allies who combine knowledge and effort toward a common aim multiply what any individual could achieve.' },

  // Millionaire Fastlane
  { id: 'fastlane-cents', book: 'fastlane', name: 'Control, entry, need, time, scale', idea: 'Strong business systems control their own fate, have barriers to entry, meet a real need, run without the owner’s time, and can scale.' },

  // Only the Paranoid Survive
  { id: 'grove-inflection', book: 'paranoid', name: 'Strategic inflection points', idea: 'A tenfold change in a force acting on the business alters its fundamentals; leaders who recognise it early can adapt, those who do not decline.' },
  { id: 'grove-new-ceo', book: 'paranoid', name: 'Think like a new CEO', idea: 'Asking what a newly appointed leader without emotional ties to the past would do can break the hold of sunk commitments.' },

  // 7 Powers
  { id: '7p-scale', book: '7powers', name: 'Scale economies', idea: 'Unit costs that fall as volume grows give the largest player a lasting cost advantage.' },
  { id: '7p-network', book: '7powers', name: 'Network effects', idea: 'When each new user makes the product more valuable to others, the leader becomes very hard to catch.' },
  { id: '7p-cornered', book: '7powers', name: 'Cornered resource', idea: 'Exclusive access to a valuable asset (a licence, a patent, a location, talent) can sustain advantage.' },
  { id: '7p-counter', book: '7powers', name: 'Counter-positioning', idea: 'A newcomer adopts a model the incumbent cannot copy without damaging its existing business.' },
  { id: '7p-branding', book: '7powers', name: 'Branding', idea: 'A durable reputation lets a firm charge more for an objectively similar product.' },

  // Kahneman
  { id: 'kahneman-sunk', book: 'kahneman', name: 'Loss aversion and sunk costs', idea: 'Losses loom larger than equal gains, so organisations cling to failing investments to avoid admitting a loss.' },
  { id: 'kahneman-outside-view', book: 'kahneman', name: 'Take the outside view', idea: 'Check a plan against the base rate of similar ventures rather than trusting the confident inside story.' },

  // Black Swan
  { id: 'taleb-fragility', book: 'blackswan', name: 'Beware hidden fragility', idea: 'Rare, high-impact events dominate outcomes; exposures that look safe in normal times can be ruinous in extreme ones.' },

  // Intelligent Investor
  { id: 'graham-margin', book: 'intelligentinvestor', name: 'Margin of safety', idea: 'Insist on a buffer between the value you expect and the price or risk you accept, because estimates are often wrong.' },

  // Hard Thing About Hard Things
  { id: 'horowitz-wartime', book: 'hardthings', name: 'Wartime leadership', idea: 'When the company faces an existential threat, leaders must act decisively and break protocol in ways peacetime management would not.' },
];

export const BOOK_BY_ID = Object.fromEntries(BOOKS.map((b) => [b.id, b]));
export const PRINCIPLE_BY_ID = Object.fromEntries(PRINCIPLES.map((p) => [p.id, p]));
