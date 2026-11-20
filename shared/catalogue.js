// BIZSIM case catalogue: 200 seasons of 4 episodes across six executive pillars.
// 1-130 follow the BIZSIM master curriculum (fact-checked; corrections in
// docs/CATALOGUE.md); 131-150 were added by the BIZSIM team; 151-200 are the
// faith-era and modern strategy expansion (shared/catalogue2.js). Every season
// is built in and playable offline.
import { EXPANSION } from './catalogue2.js';

export const CATALOGUE = [
 {
  "id": "c001",
  "n": 1,
  "title": "Hannibal & The Second Punic War",
  "when": "218 BC",
  "yearSort": -218,
  "era": "ANCIENT",
  "pillar": "STRATEGY",
  "summary": "Hannibal encircled a Roman army twice his size by turning their forward momentum into a trap.",
  "episodes": [
   "Crossing the Alps",
   "Fog Ambush at Trasimene",
   "Double Envelopment at Cannae",
   "The Fabian Siege Trap"
  ],
  "reading": "Ghosts of Cannae by Robert L. O’Connell",
  "wiki": "Second Punic War"
 },
 {
  "id": "c002",
  "n": 2,
  "title": "The Peloponnesian War",
  "when": "431 BC",
  "yearSort": -431,
  "era": "ANCIENT",
  "pillar": "STRATEGY",
  "summary": "Athens’ naval empire overextended into Sicily while Sparta adapted by building a fleet with Persian gold.",
  "episodes": [
   "Pericles’ Walls Strategy",
   "The Plague of Athens",
   "The Sicilian Expedition Overreach",
   "Sparta’s Persian Naval Pivot"
  ],
  "reading": "History of the Peloponnesian War by Thucydides",
  "wiki": "Peloponnesian War"
 },
 {
  "id": "c003",
  "n": 3,
  "title": "Oda Nobunaga at Nagashino",
  "when": "1575",
  "yearSort": 1575,
  "era": "EARLY_MODERN",
  "pillar": "STRATEGY",
  "summary": "Nobunaga’s musketeers fired from behind wooden palisades and shattered the Takeda cavalry charges. The famous “rotating three-rank volley” is the traditional account; modern historians debate it.",
  "episodes": [
   "Breaking Buddhist Warrior Monks",
   "Stockpiling Matchlock Muskets",
   "Building Wooden Palisades",
   "Concentrated Musket Fire (the “Rotating Volley” Debate)"
  ],
  "reading": "Japonius Tyrannus by Jeroen Lamers",
  "wiki": "Battle of Nagashino"
 },
 {
  "id": "c004",
  "n": 4,
  "title": "Dutch East India Company / VOC",
  "when": "1602",
  "yearSort": 1602,
  "era": "EARLY_MODERN",
  "pillar": "STRATEGY",
  "summary": "Created the first joint-stock megacorporation to pool sovereign risk and monopolize Asian trade routes.",
  "episodes": [
   "Merging Rival Spice Cartels",
   "Inventing Permanent Stock Shares",
   "Seizing the Banda Islands",
   "Dividend Drain & Collapse"
  ],
  "reading": "Merchant Kings by Stephen R. Bown",
  "wiki": "Dutch East India Company",
  "caseId": "voc-permanent-capital"
 },
 {
  "id": "c005",
  "n": 5,
  "title": "Napoleon’s Ulm & Austerlitz Campaigns",
  "when": "1805",
  "yearSort": 1805,
  "era": "INDUSTRIAL",
  "pillar": "STRATEGY",
  "summary": "Used decentralized corps (\"march divided, fight united\") to force an entire Austrian army to surrender virtually without a major battle.",
  "episodes": [
   "Decentralized Corps System",
   "Encircling Ulm Without a Battle",
   "Feigning Weakness at Pratzen Heights",
   "The Continental Blockade Overreach"
  ],
  "reading": "The Campaigns of Napoleon by David G. Chandler",
  "wiki": "War of the Third Coalition"
 },
 {
  "id": "c006",
  "n": 6,
  "title": "Standard Oil",
  "when": "1870s",
  "yearSort": 1870,
  "era": "INDUSTRIAL",
  "pillar": "STRATEGY",
  "summary": "John D. Rockefeller controlled railroad rebates and pipelines to buy out distressed oil refineries cheaply.",
  "episodes": [
   "Vertical Barrel Integration",
   "Secret Railroad Rebates",
   "The Cleveland Massacre Buyouts",
   "Building Pipelines & Antitrust Split"
  ],
  "reading": "Titan by Ron Chernow",
  "wiki": "Standard Oil"
 },
 {
  "id": "c007",
  "n": 7,
  "title": "General Motors vs. Ford",
  "when": "1920s",
  "yearSort": 1920,
  "era": "INDUSTRIAL",
  "pillar": "STRATEGY",
  "summary": "Alfred P. Sloan segmented GM into \"a car for every purse and purpose\" while Henry Ford stubbornly offered only the black Model T.",
  "episodes": [
   "Surviving the 1920 Inventory Crash",
   "\"A Car for Every Purse\" Segmentation",
   "Annual Model Year Styling",
   "Overtaking the Black Model T"
  ],
  "reading": "My Years with General Motors by Alfred P. Sloan",
  "wiki": "General Motors"
 },
 {
  "id": "c008",
  "n": 8,
  "title": "Southwest Airlines",
  "when": "1971",
  "yearSort": 1971,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Bypassed expensive hub-and-spoke airports, flew only Boeing 737s, and turned planes around in 15 minutes.",
  "episodes": [
   "Fighting Regulatory Lawsuits",
   "Bypassing Hub Airports",
   "Single-Aircraft (Boeing 737) Standardization",
   "15-Minute Gate Turnarounds"
  ],
  "reading": "HBS Case Southwest Airlines",
  "wiki": "Southwest Airlines"
 },
 {
  "id": "c009",
  "n": 9,
  "title": "Honda’s US Entry",
  "when": "1959",
  "yearSort": 1959,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Planned to sell big bikes, failed, and pivoted to small 50cc Super Cubs when executives noticed locals admiring their delivery scooters.",
  "episodes": [
   "Failing with Big Motorcycles",
   "Noticing Admirers of 50cc Delivery Cubs",
   "Pivoting to Sporting Goods Stores",
   "\"You Meet the Nicest People\" Campaign"
  ],
  "reading": "Richard Pascale’s Honda Effect",
  "wiki": "American Honda Motor Company"
 },
 {
  "id": "c010",
  "n": 10,
  "title": "Cola Wars: Coke vs. Pepsi",
  "when": "1970s–1990s",
  "yearSort": 1970,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Examines how two giants maintained massive profitability through concentrate economics, bottler networks, and brand segmentation rather than price wars.",
  "episodes": [
   "Concentrate Economics & Bottler Lock-in",
   "The Pepsi Challenge Blind Taste Test",
   "The New Coke Disaster",
   "Global Duopoly Pricing Discipline"
  ],
  "reading": "HBS Case Cola Wars Continue",
  "wiki": "Cola wars"
 },
 {
  "id": "c011",
  "n": 11,
  "title": "Microsoft’s IBM OS Deal",
  "when": "1980",
  "yearSort": 1980,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Bill Gates licensed MS-DOS non-exclusively to IBM while retaining rights to sell to clone PC makers, capturing the software layer.",
  "episodes": [
   "Buying QDOS for $50k",
   "Non-Exclusive Licensing to IBM",
   "Capturing the PC Clone Boom",
   "Locking In Office + Windows"
  ],
  "reading": "Hard Drive by James Wallace",
  "wiki": "MS-DOS"
 },
 {
  "id": "c012",
  "n": 12,
  "title": "Walmart’s Rural Saturation",
  "when": "1962",
  "yearSort": 1962,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Sam Walton placed big-box stores in small towns ignored by Sears and Kmart, expanding outward around regional distribution hubs.",
  "episodes": [
   "Avoiding Sears & Kmart in Small Towns",
   "Hub-and-Spoke Distribution Centers",
   "Everyday Low Prices vs. Sales Flyers",
   "Cross-Docking & Barcode Data"
  ],
  "reading": "Made in America by Sam Walton",
  "wiki": "History of Walmart"
 },
 {
  "id": "c013",
  "n": 13,
  "title": "Disney’s IP Acquisition Spree",
  "when": "2006–2012",
  "yearSort": 2006,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Bob Iger revitalized Disney's creative engine by acquiring premier IP studios and plugging them into Disney’s global monetization flywheel.",
  "episodes": [
   "Healing the Pixar Rift",
   "Acquiring Marvel’s Character Vault",
   "Buying Lucasfilm & Star Wars",
   "Plugging IP into Parks & Streaming"
  ],
  "reading": "The Ride of a Lifetime by Robert Iger",
  "wiki": "Bob Iger"
 },
 {
  "id": "c014",
  "n": 14,
  "title": "Netflix’s Three-Time Pivot",
  "when": "1997–2023",
  "yearSort": 1997,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Reed Hastings cannibalized his own profitable DVD-by-mail business before studios could cut off Netflix's content supply.",
  "episodes": [
   "Killing Late Fees via DVD Subscriptions",
   "Surviving Blockbuster’s Price War",
   "Cannibalizing DVDs for Streaming",
   "Committing to Two Seasons of House of Cards"
  ],
  "reading": "No Rules Rules by Reed Hastings",
  "wiki": "Netflix",
  "caseId": "netflix-streaming"
 },
 {
  "id": "c015",
  "n": 15,
  "title": "Cirque du Soleil",
  "when": "1984",
  "yearSort": 1984,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Cut costly animal acts and star performers while blending theater and acrobatics to charge Broadway ticket prices to adults.",
  "episodes": [
   "Eliminating Costly Animal Acts",
   "Dropping Star Performer Salaries",
   "Blending Theater with Acrobatics",
   "Charging Broadway Prices to Adults"
  ],
  "reading": "Blue Ocean Strategy by Kim & Mauborgne",
  "wiki": "Cirque du Soleil"
 },
 {
  "id": "c016",
  "n": 16,
  "title": "Nintendo Wii’s Asymmetric Bet",
  "when": "2006",
  "yearSort": 2006,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Refused to fight Sony and Microsoft on expensive graphics chips, using simple motion controls to win non-gamers and families.",
  "episodes": [
   "Refusing the HD Graphics Arms Race",
   "Designing Motion Controls for Non-Gamers",
   "Bundling Wii Sports",
   "Surviving the Wii U Follow-Up Misstep"
  ],
  "reading": "Ask Iwata by Satoru Iwata",
  "wiki": "Wii"
 },
 {
  "id": "c017",
  "n": 17,
  "title": "Amazon Web Services / AWS",
  "when": "2006",
  "yearSort": 2006,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Amazon turned its internal server infrastructure burden into a high-margin utility sold even to direct retail and tech competitors.",
  "episodes": [
   "Fixing Internal Spaghetti Code",
   "Standardizing Internal APIs",
   "Renting Excess Server Capacity",
   "Selling Infrastructure to Direct Rivals"
  ],
  "reading": "Working Backwards by Bryar & Carr",
  "wiki": "Amazon Web Services"
 },
 {
  "id": "c018",
  "n": 18,
  "title": "LVMH Luxury Roll-Up",
  "when": "1987",
  "yearSort": 1987,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Bernard Arnault centralized finance and real estate clout while keeping heritage fashion houses creatively independent.",
  "episodes": [
   "Seizing Dior via Textile Restructuring",
   "Winning the LVMH Boardroom Coup",
   "Centralizing Real Estate & Finance",
   "Giving Rebel Designers Creative Freedom"
  ],
  "reading": "The Luxury Strategy by Jean-Noël Kapferer and Vincent Bastien",
  "wiki": "LVMH"
 },
 {
  "id": "c019",
  "n": 19,
  "title": "Nvidia’s 20-Year CUDA Bet",
  "when": "2006",
  "yearSort": 2006,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Jensen Huang invested billions into software architecture for GPUs years before the AI boom created trillion-dollar demand.",
  "episodes": [
   "Pivoting from 30 Days to Bankruptcy",
   "Launching the GeForce 256 “GPU”",
   "Funding CUDA Software Wall Street Hated",
   "Becoming the AI Compute Chokepoint"
  ],
  "reading": "The Nvidia Way by Tae Kim",
  "wiki": "Nvidia"
 },
 {
  "id": "c020",
  "n": 20,
  "title": "Microsoft & OpenAI Alliance",
  "when": "2019",
  "yearSort": 2019,
  "era": "CONTEMPORARY",
  "pillar": "STRATEGY",
  "summary": "Satya Nadella traded Azure compute and capital for deep access to OpenAI’s models, putting Microsoft at the front of the generative-AI wave.",
  "episodes": [
   "Trading Azure Compute for Equity",
   "Securing Exclusive Commercial API Rights",
   "Integrating Copilots Across Office",
   "Surviving the 2023 OpenAI Board Coup"
  ],
  "reading": "Compare with Google’s DeepMind deal",
  "wiki": "OpenAI"
 },
 {
  "id": "c021",
  "n": 21,
  "title": "The Medici Bank",
  "when": "1397",
  "yearSort": 1397,
  "era": "MEDIEVAL",
  "pillar": "FINANCE",
  "summary": "Cosimo de’ Medici structured foreign branches as separate partnerships so one bad branch could not bankrupt the family.",
  "episodes": [
   "Bypassing Church Usury Laws via FX",
   "Ring-Fencing Foreign Branches as Partnerships",
   "Becoming the Pope’s Exclusive Banker",
   "Over-Lending to Kings & Collapse"
  ],
  "reading": "The Rise and Decline of the Medici Bank by Raymond de Roover",
  "wiki": "Medici Bank",
  "caseId": "medici-bank"
 },
 {
  "id": "c022",
  "n": 22,
  "title": "Jakob Fugger & The Habsburgs",
  "when": "1519",
  "yearSort": 1519,
  "era": "EARLY_MODERN",
  "pillar": "FINANCE",
  "summary": "Jakob Fugger bankrolled Charles V’s election as Holy Roman Emperor in exchange for monopoly mining rights in silver and copper.",
  "episodes": [
   "Cornering Tyrolean Silver & Copper Mines",
   "Bankrolling Charles V’s Imperial Election",
   "Collecting Debts from Spanish Crown Revenues",
   "Managing Royal Defaults"
  ],
  "reading": "The Richest Man Who Ever Lived by Greg Steinmetz",
  "wiki": "Jakob Fugger"
 },
 {
  "id": "c023",
  "n": 23,
  "title": "Dutch Tulip Mania",
  "when": "1637",
  "yearSort": 1637,
  "era": "EARLY_MODERN",
  "pillar": "FINANCE",
  "summary": "Shows how informal futures contracts on rare bulbs turned a scarce commodity into a speculative frenzy. Modern historians (e.g. Anne Goldgar) argue the mania was far smaller than the classic account claims.",
  "episodes": [
   "Rare Broken-Color Bulb Scarcity",
   "Shifting from Physical Sales to Tavern Futures",
   "Zero-Margin Speculation by Weavers",
   "The Haarlem Auction Freeze (1637)"
  ],
  "reading": "Extraordinary Popular Delusions by Charles Mackay",
  "wiki": "Tulip mania"
 },
 {
  "id": "c024",
  "n": 24,
  "title": "The South Sea Bubble",
  "when": "1720",
  "yearSort": 1720,
  "era": "EARLY_MODERN",
  "pillar": "FINANCE",
  "summary": "Shows how debt-for-equity swaps backed by government hype destroy even brilliant analytical minds when FOMO takes over.",
  "episodes": [
   "Swapping British War Debt for Company Stock",
   "Bribing Parliament & Hyping Trade Monopolies",
   "Isaac Newton’s Early Exit & FOMO Re-Entry",
   "The Bubble Act Crash"
  ],
  "reading": "Money for Nothing by Thomas Levenson",
  "wiki": "South Sea Company"
 },
 {
  "id": "c025",
  "n": 25,
  "title": "Nathan Rothschild & the Waterloo Legend",
  "when": "1815",
  "yearSort": 1815,
  "era": "INDUSTRIAL",
  "pillar": "FINANCE",
  "summary": "Rothschild’s private courier network brought European news to London fast, but the famous story of a huge bond-market killing on Waterloo is largely myth, a lesson in how legends form around information advantages.",
  "episodes": [
   "Shipping Gold to Wellington’s Army",
   "Building a Private Courier Network",
   "The Waterloo Legend vs. the Record",
   "Betting on Post-War British Consols"
  ],
  "reading": "The House of Rothschild by Niall Ferguson",
  "wiki": "Nathan Mayer Rothschild"
 },
 {
  "id": "c026",
  "n": 26,
  "title": "J.P. Morgan & The Panic of 1907",
  "when": "1907",
  "yearSort": 1907,
  "era": "INDUSTRIAL",
  "pillar": "FINANCE",
  "summary": "Locked Wall Street bank presidents in his library to pool private liquidity and rescue solvent institutions before the Federal Reserve existed.",
  "episodes": [
   "Stopping the Knickerbocker Trust Contagion",
   "Locking Bank Presidents in His Library",
   "Rescuing Moore & Schley via US Steel Merger",
   "Inspiring the Federal Reserve Act"
  ],
  "reading": "The Panic of 1907 by Bruner & Carr",
  "wiki": "Panic of 1907"
 },
 {
  "id": "c027",
  "n": 27,
  "title": "DuPont ROI Formula",
  "when": "1914",
  "yearSort": 1914,
  "era": "INDUSTRIAL",
  "pillar": "FINANCE",
  "summary": "Donaldson Brown broke profitability into profit margin, asset turnover, and leverage to manage sprawling industrial divisions.",
  "episodes": [
   "Consolidating Explosives Monopolies",
   "Donaldson Brown’s Margin × Turnover Equation",
   "Rescuing General Motors via Capital Controls",
   "Diversifying into Nylon & Chemicals"
  ],
  "reading": "DuPont Analysis Framework",
  "wiki": "DuPont analysis"
 },
 {
  "id": "c028",
  "n": 28,
  "title": "Teledyne’s Buyback Masterclass",
  "when": "1960",
  "yearSort": 1960,
  "era": "MODERN",
  "pillar": "FINANCE",
  "summary": "Henry Singleton issued stock when his P/E ratio was high to buy companies, then repurchased 90% of Teledyne’s shares when markets crashed.",
  "episodes": [
   "Using High-P/E Stock to Acquire 130 Firms",
   "Halting Acquisitions When Multiples Compress",
   "Repurchasing 90% of Teledyne’s Own Shares",
   "Spinning Off Insurance Subsidiaries"
  ],
  "reading": "The Outsiders by William N. Thorndike",
  "wiki": "Henry Singleton"
 },
 {
  "id": "c029",
  "n": 29,
  "title": "Berkshire Hathaway Float Engine",
  "when": "1967",
  "yearSort": 1967,
  "era": "MODERN",
  "pillar": "FINANCE",
  "summary": "Warren Buffett acquired National Indemnity and GEICO to invest policyholder premiums (\"negative-cost float\") into compounding equities.",
  "episodes": [
   "Escaping the Dying Textile Mill",
   "Buying National Indemnity for Insurance Float",
   "Paying Up for See’s Candies Pricing Power",
   "Acting as 2008 Lender of Last Resort"
  ],
  "reading": "Warren Buffett’s Ground Rules by Jeremy C. Miller",
  "wiki": "Berkshire Hathaway"
 },
 {
  "id": "c030",
  "n": 30,
  "title": "George Soros Breaking the Bank of England",
  "when": "1992",
  "yearSort": 1992,
  "era": "MODERN",
  "pillar": "FINANCE",
  "summary": "Spotted an unsustainable currency peg in the European Exchange Rate Mechanism and risked $10 billion on an asymmetric short.",
  "episodes": [
   "Spotting UK-German Interest Rate Mismatch",
   "Building a $1.5B Short Position",
   "\"Go For the Jugular\" ($10B Bet)",
   "Black Wednesday Sterling Devaluation"
  ],
  "reading": "More Money Than God by Sebastian Mallaby",
  "wiki": "Black Wednesday"
 },
 {
  "id": "c031",
  "n": 31,
  "title": "KKR & RJR Nabisco LBO",
  "when": "1988",
  "yearSort": 1988,
  "era": "MODERN",
  "pillar": "FINANCE",
  "summary": "Illustrates the power and perils of massive debt financing, ego-driven bidding wars, and stripping corporate bloat.",
  "episodes": [
   "CEO Ross Johnson’s Management Buyout Bid",
   "Henry Kravis’ Hostile Counter-Offer",
   "Junk Bond Financing & Bidding Frenzy",
   "Debt Paydown & Asset Stripping"
  ],
  "reading": "Barbarians at the Gate by Burrough & Helyar",
  "wiki": "RJR Nabisco"
 },
 {
  "id": "c032",
  "n": 32,
  "title": "Long-Term Capital Management",
  "when": "1998",
  "yearSort": 1998,
  "era": "MODERN",
  "pillar": "FINANCE",
  "summary": "Nobel laureate quants blew up $4.6 billion using 25-to-1 leverage when Russian debt defaults broke historical correlation models.",
  "episodes": [
   "Nobel Laureate Bond Arbitrage",
   "Scaling Leverage to 25-to-1",
   "Russian Debt Default Breaking Correlations",
   "The $3.6B Fed-Brokered Bailout"
  ],
  "reading": "When Genius Failed by Roger Lowenstein",
  "wiki": "Long-Term Capital Management"
 },
 {
  "id": "c033",
  "n": 33,
  "title": "Amazon’s Negative Cash Cycle",
  "when": "1997",
  "yearSort": 1997,
  "era": "MODERN",
  "pillar": "FINANCE",
  "summary": "Collected cash from customers immediately while paying suppliers weeks later, using that negative cash conversion cycle to help fund expansion.",
  "episodes": [
   "Collecting Customer Card Payments Day 1",
   "Negotiating Longer Supplier Payment Terms",
   "Funding Fulfillment Centers via Vendor Float",
   "Surviving the 2000 Dot-Com Crash"
  ],
  "reading": "Jeff Bezos’ 1997 Shareholder Letter",
  "wiki": "History of Amazon"
 },
 {
  "id": "c034",
  "n": 34,
  "title": "Porsche’s Volkswagen Short Squeeze",
  "when": "2008",
  "yearSort": 2008,
  "era": "MODERN",
  "pillar": "FINANCE",
  "summary": "An automaker quietly accumulated options on VW stock during a recession, briefly making VW the most valuable company on earth via financial engineering.",
  "episodes": [
   "Secretly Accumulating VW Cash-Settled Options",
   "Announcing 74.1% Control in a Recession",
   "Trapping Hedge Funds with <6% Free Float",
   "Reverse-Takeover Debt Hangover"
  ],
  "reading": "Compare with 2021 GameStop Squeeze",
  "wiki": "Porsche SE"
 },
 {
  "id": "c035",
  "n": 35,
  "title": "Apple’s Supply Chain Prepayments",
  "when": "2012",
  "yearSort": 2012,
  "era": "MODERN",
  "pillar": "FINANCE",
  "summary": "Tim Cook combined high-margin hardware cash flows with massive upfront supplier capex deals and disciplined share buybacks.",
  "episodes": [
   "Pre-Buying Global Flash Memory & CNC Machines",
   "Locking Rivals Out of Component Supply",
   "Launching Massive Dividend & Buyback Programs",
   "Monetizing the Installed Base via Services"
  ],
  "reading": "Tim Cook by Leander Kahney",
  "wiki": "Tim Cook"
 },
 {
  "id": "c036",
  "n": 36,
  "title": "Constellation Software VMS Roll-Up",
  "when": "1995",
  "yearSort": 1995,
  "era": "MODERN",
  "pillar": "FINANCE",
  "summary": "Mark Leonard acquired hundreds of tiny, unglamorous niche software firms using strict hurdle rates without issuing new equity.",
  "episodes": [
   "Targeting Tiny Vertical Market Software",
   "Enforcing Strict Hurdle Rates Without Issuing Stock",
   "Decentralizing Operations to Portfolio Managers",
   "Compounding Hundreds of Micro-Acquisitions"
  ],
  "reading": "Mark Leonard’s President’s Letters",
  "wiki": "Constellation Software"
 },
 {
  "id": "c037",
  "n": 37,
  "title": "Norway’s Sovereign Wealth Fund",
  "when": "1990",
  "yearSort": 1990,
  "era": "MODERN",
  "pillar": "FINANCE",
  "summary": "Solved \"Dutch Disease\" by investing North Sea oil revenues exclusively abroad under strict sovereign governance rules.",
  "episodes": [
   "Avoiding \"Dutch Disease\" Currency Inflation",
   "Investing 100% of Oil Surplus Abroad",
   "Enforcing the 3% Fiscal Spending Rule",
   "Ethical Exclusion & Passive Indexing"
  ],
  "reading": "Read NBIM’s annual reports at nbim.no",
  "wiki": "Government Pension Fund of Norway"
 },
 {
  "id": "c038",
  "n": 38,
  "title": "WeWork’s Unit Economics Implosion",
  "when": "2019",
  "yearSort": 2019,
  "era": "CONTEMPORARY",
  "pillar": "FINANCE",
  "summary": "Exposed the fatal mismatch of signing 15-year commercial office leases while selling 30-day cancellable memberships wrapped in tech valuation multiples.",
  "episodes": [
   "Wrapping Office Subleases in Tech Valuations",
   "Borrowing Short (30-Day Desks) vs. Long (15-Year Leases)",
   "The S-1 IPO Governance Disaster",
   "SoftBank Bailout & Bankruptcy"
  ],
  "reading": "The Cult of We by Brown & Farrell",
  "wiki": "WeWork"
 },
 {
  "id": "c039",
  "n": 39,
  "title": "Silicon Valley Bank Run",
  "when": "2023",
  "yearSort": 2023,
  "era": "CONTEMPORARY",
  "pillar": "FINANCE",
  "summary": "Parked uninsured startup deposits into long-dated Treasury bonds just before rapid interest rate hikes triggered a 48-hour digital bank run.",
  "episodes": [
   "Taking Uninsured Startup Deposits",
   "Locking Deposits into Long-Dated Bonds",
   "Fed Rate Hikes Creating Unrealized Losses",
   "The 48-Hour Twitter & Slack Bank Run"
  ],
  "reading": "Federal Reserve SVB Post-Mortem",
  "wiki": "Collapse of Silicon Valley Bank"
 },
 {
  "id": "c040",
  "n": 40,
  "title": "Renaissance Technologies Medallion Fund",
  "when": "1988",
  "yearSort": 1988,
  "era": "MODERN",
  "pillar": "FINANCE",
  "summary": "Jim Simons hired physicists and cryptographers instead of MBAs to extract short-term statistical anomalies across global markets.",
  "episodes": [
   "Firing Fundamental Traders for Physicists",
   "Cleaning Decades of Tick-by-Tick Data",
   "Discovering Non-Intuitive Statistical Anomalies",
   "Capping Fund Size & Returning Outside Capital"
  ],
  "reading": "The Man Who Solved the Market by Gregory Zuckerman",
  "wiki": "Renaissance Technologies"
 },
 {
  "id": "c041",
  "n": 41,
  "title": "Emperor Augustus’ Visual Rebrand",
  "when": "27 BC",
  "yearSort": -27,
  "era": "ANCIENT",
  "pillar": "BRAND",
  "summary": "Used coinage, poetry (The Aeneid), and marble architecture to market an autocratic transition as the \"restoration of the Republic.\"",
  "episodes": [
   "Minting Propaganda Coins Across Provinces",
   "Patronising Virgil’s Aeneid",
   "Rebuilding Rome in Marble",
   "Selling Autocracy as Republican Restoration"
  ],
  "reading": "The Power of Images in the Age of Augustus by Paul Zanker",
  "wiki": "Augustus"
 },
 {
  "id": "c042",
  "n": 42,
  "title": "Martin Luther’s Viral Pamphlets",
  "when": "1517",
  "yearSort": 1517,
  "era": "EARLY_MODERN",
  "pillar": "BRAND",
  "summary": "Luther wrote short, vernacular German tracts tailored for local printers, turning a theological dispute into Europe’s first mass-media movement.",
  "episodes": [
   "Switching from Academic Latin to Vernacular German",
   "Designing Short Illustrated Quarto Tracts",
   "Decentralized Reprinting Across German Cities",
   "Surviving Imperial Censorship"
  ],
  "reading": "Brand Luther by Andrew Pettegree",
  "wiki": "Martin Luther"
 },
 {
  "id": "c043",
  "n": 43,
  "title": "Shakespeare & The Globe Theatre",
  "when": "1599",
  "yearSort": 1599,
  "era": "EARLY_MODERN",
  "pillar": "BRAND",
  "summary": "Made key actors and the playwright equity owners (\"sharers\") in the physical venue, aligning artistic output with box office economics.",
  "episodes": [
   "Dismantling \"The Theatre\" Overnight to Evade Rent",
   "Giving Lead Actors Equity Shares in the Building",
   "Writing Multi-Layered Plays for Nobles and Groundlings",
   "Surviving Plague Closures"
  ],
  "reading": "1599 by James Shapiro",
  "wiki": "Globe Theatre"
 },
 {
  "id": "c044",
  "n": 44,
  "title": "Josiah Wedgwood’s Luxury Marketing",
  "when": "1760s",
  "yearSort": 1760,
  "era": "EARLY_MODERN",
  "pillar": "BRAND",
  "summary": "Won a royal commission from Queen Charlotte in 1765, then marketed his creamware as “Queen’s Ware”, pioneering royal endorsement, showrooms and illustrated catalogues.",
  "episodes": [
   "Winning Queen Charlotte’s Commission (“Queen’s Ware”)",
   "Opening West End London Showrooms",
   "Printing Illustrated Direct-Mail Catalogs",
   "Creating Limited-Edition Collector Pieces"
  ],
  "reading": "Brand New by Nancy F. Koehn",
  "wiki": "Josiah Wedgwood"
 },
 {
  "id": "c045",
  "n": 45,
  "title": "Paul Durand-Ruel & The Impressionists",
  "when": "1870s",
  "yearSort": 1870,
  "era": "INDUSTRIAL",
  "pillar": "BRAND",
  "summary": "Bought thousands of unsellable Monet and Renoir canvases upfront, staged solo exhibitions abroad, and controlled supply to build asset value.",
  "episodes": [
   "Buying Rejected Monet & Renoir Canvases in Bulk",
   "Cornering Supply to Control Art Prices",
   "Staging Solo Gallery Exhibitions",
   "Breaking Into the New York Collector Market"
  ],
  "reading": "Discovering the Impressionists by Sylvie Patry",
  "wiki": "Paul Durand-Ruel"
 },
 {
  "id": "c046",
  "n": 46,
  "title": "De Beers’ Diamond Scarcity",
  "when": "1947",
  "yearSort": 1947,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "N.W. Ayer & Son linked diamond rings to eternal romance while discouraging resale, manufacturing both consumer demand and artificial scarcity.",
  "episodes": [
   "Controlling Global Rough Diamond Cartel Supply",
   "Launching \"A Diamond Is Forever\"",
   "Anchoring Engagement Spend to Two Months’ Salary",
   "Discouraging Second-Hand Resale"
  ],
  "reading": "The Heartless Stone by Tom Zoellner",
  "wiki": "De Beers"
 },
 {
  "id": "c047",
  "n": 47,
  "title": "Christian Dior’s \"New Look\"",
  "when": "1947",
  "yearSort": 1947,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "Restored Paris as the fashion capital post-WWII and pioneered licensing haute couture prestige onto everyday hosiery, ties, and perfume.",
  "episodes": [
   "Defying Post-War Fabric Rationing with Lush Silhouettes",
   "Restoring Paris as Global Fashion Capital",
   "Pioneering Name Licensing on Stockings & Ties",
   "Launching Miss Dior Fragrance Cash Flow"
  ],
  "reading": "Christian Dior and I by Christian Dior",
  "wiki": "Christian Dior"
 },
 {
  "id": "c048",
  "n": 48,
  "title": "Motown’s \"Hitsville U.S.A.\" Assembly Line",
  "when": "1959",
  "yearSort": 1959,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "Berry Gordy applied Detroit auto-plant quality control meetings and artist etiquette training to cross over Black soul music to global pop charts.",
  "episodes": [
   "Borrowing $800 to Record Local Detroit Talent",
   "Friday Morning Quality-Control Listening Meetings",
   "Artist Finishing School for Crossover Appeal",
   "Retaining Publishing Rights via Jobete Music"
  ],
  "reading": "To Be Loved by Berry Gordy",
  "wiki": "Motown"
 },
 {
  "id": "c049",
  "n": 49,
  "title": "Sony Walkman Personal Audio",
  "when": "1979",
  "yearSort": 1979,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "Akio Morita ignored market research saying nobody wanted a tape player that couldn't record, observing instead how youth craved portable music.",
  "episodes": [
   "Ignoring Focus Groups Saying It Needed Recording",
   "Removing Speakers to Shrink Chassis Size",
   "Seeding Walkmans with Celebrities & Commuters",
   "Defining Portable Youth Culture"
  ],
  "reading": "Made in Japan by Akio Morita",
  "wiki": "Walkman"
 },
 {
  "id": "c050",
  "n": 50,
  "title": "Nike & Rookie Michael Jordan",
  "when": "1984",
  "yearSort": 1984,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "Risked Nike’s entire basketball endorsement budget and gave equity-style royalties on a single athlete to overturn Converse and Adidas.",
  "episodes": [
   "Betting the Entire Basketball Budget on One Rookie",
   "Offering Signature Shoe Royalties",
   "Turning an NBA Uniform Warning into the “Banned” Ad",
   "Scaling Jordan Brand into a Multi-Billion Empire"
  ],
  "reading": "Shoe Dog by Phil Knight",
  "wiki": "Air Jordan"
 },
 {
  "id": "c051",
  "n": 51,
  "title": "Hermès Birkin Bag Scarcity",
  "when": "1984",
  "yearSort": 1984,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "Uses artisan craftsmanship bottlenecks and non-public store allocation to maintain decades-long pricing power without traditional ad spend.",
  "episodes": [
   "Designing a Bag with Jane Birkin on a Flight",
   "Training Single Artisans to Hand-Stitch Each Bag",
   "Restricting Store Supply to Build Organic Waitlists",
   "Maintaining Zero-Discount Pricing Power"
  ],
  "reading": "Deluxe by Dana Thomas",
  "wiki": "Birkin bag"
 },
 {
  "id": "c052",
  "n": 52,
  "title": "Red Bull’s Media House Model",
  "when": "1987",
  "yearSort": 1987,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "Outsourced beverage manufacturing and logistics entirely so leadership could focus 100% on brand myth-making, F1 teams, and stunt media.",
  "episodes": [
   "Importing Thai Krating Daeng Tonic to Austria",
   "Outsourcing All Bottling & Distribution",
   "Seeding Clubs & Extreme Sports Athletes",
   "Owning F1 Teams & Stratos Space Jumps"
  ],
  "reading": "INSEAD Red Bull Case",
  "wiki": "Red Bull GmbH"
 },
 {
  "id": "c053",
  "n": 53,
  "title": "Apple’s “Think Different” Resurrection",
  "when": "1997",
  "yearSort": 1997,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "Steve Jobs simplified a bloated product grid to four quadrants and marketed identity and rebellion rather than processor clock speeds.",
  "episodes": [
   "Killing Clones & Complex Product Grids",
   "Hiring TBWA\\Chiat\\Day to Celebrate Misfits",
   "Launching Iconic Silhouette iPod Ads",
   "Opening Apple Retail Stores"
  ],
  "reading": "Insanely Simple by Ken Segall",
  "wiki": "Think different"
 },
 {
  "id": "c054",
  "n": 54,
  "title": "PayPal’s eBay Viral Loop",
  "when": "1999",
  "yearSort": 1999,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "Paid cash bonuses to new users and referrers while targeting eBay sellers, reportedly growing around 7% a day before scaling back incentives.",
  "episodes": [
   "Paying $10 Signup & Referral Bounties",
   "Targeting eBay PowerSellers with Automated Badges",
   "Achieving 7% Daily Compounding Growth",
   "Phasing Out Cash Subsidies Once Network Locked In"
  ],
  "reading": "The PayPal Wars by Eric M. Jackson",
  "wiki": "PayPal"
 },
 {
  "id": "c055",
  "n": 55,
  "title": "Marvel Studios’ Shared Universe",
  "when": "2008",
  "yearSort": 2008,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "Used B-list characters like Iron Man (since Spider-Man and X-Men were licensed away) to cross-pollinate audiences across interconnected sequels.",
  "episodes": [
   "Borrowing $525M Against Character Rights",
   "Casting Robert Downey Jr. in Iron Man",
   "Testing Nick Fury Post-Credits Teasers",
   "Culminating in The Avengers Crossover"
  ],
  "reading": "MCU by Robinson, Gonzales, & Edwards",
  "wiki": "Marvel Cinematic Universe"
 },
 {
  "id": "c056",
  "n": 56,
  "title": "Hamilton on Broadway",
  "when": "2015",
  "yearSort": 2015,
  "era": "CONTEMPORARY",
  "pillar": "BRAND",
  "summary": "Lin-Manuel Miranda fused hip-hop with Founding Father history, and the producers later raised premium seat prices to capture part of the secondary-market resale margin.",
  "episodes": [
   "Fusing Hip-Hop with Founding Father Biography",
   "Diversity-First Casting Reimagining History",
   "Dynamic Ticket Pricing to Beat Scalpers",
   "Selling Streaming Rights to Disney+ for $75M"
  ],
  "reading": "Hamilton: The Revolution by Miranda & McCarter",
  "wiki": "Hamilton (musical)"
 },
 {
  "id": "c057",
  "n": 57,
  "title": "Rihanna’s Fenty Beauty Launch",
  "when": "2017",
  "yearSort": 2017,
  "era": "CONTEMPORARY",
  "pillar": "BRAND",
  "summary": "Launched simultaneously across 17 countries with 40 foundation shades, exposing an underserved market gap that legacy cosmetics giants had ignored.",
  "episodes": [
   "Partnering with LVMH’s Kendo Incubator",
   "Launching 40 Foundation Shades Day One",
   "Selling Out Darker Shades Globally",
   "Forcing Legacy Cosmetics Giants to Expand Ranges"
  ],
  "reading": "HBS Case Fenty Beauty",
  "wiki": "Fenty Beauty"
 },
 {
  "id": "c058",
  "n": 58,
  "title": "Taylor Swift’s \"Taylor’s Version\"",
  "when": "2021",
  "yearSort": 2021,
  "era": "CONTEMPORARY",
  "pillar": "BRAND",
  "summary": "Re-recorded her catalog to neutralize hostile master-recording ownership and bypassed traditional movie studio middlemen for her concert film.",
  "episodes": [
   "Boycotting Spotify Over Free-Tier Royalties",
   "Losing Original Masters in a Private Equity Sale",
   "Re-Recording Albums to Devalue Originals",
   "Bypassing Studios for Direct AMC Theater Distribution"
  ],
  "reading": "Compare with Prince vs. Warner Bros",
  "wiki": "Taylor Swift masters dispute"
 },
 {
  "id": "c059",
  "n": 59,
  "title": "Liquid Death Water Disruption",
  "when": "2019",
  "yearSort": 2019,
  "era": "CONTEMPORARY",
  "pillar": "BRAND",
  "summary": "Packaged plain mountain water in tallboy beer cans with heavy-metal branding so sober concertgoers felt cool holding a drink.",
  "episodes": [
   "Validating Demand with a $1,500 Viral Video",
   "Canning Mountain Water in Tallboy Beer Cans",
   "Entering Bars & Concerts Before Grocery Stores",
   "Scaling into a $1B+ Beverage Brand"
  ],
  "reading": "How I Built This (Mike Cessario)",
  "wiki": "Liquid Death"
 },
 {
  "id": "c060",
  "n": 60,
  "title": "Duolingo’s Gamified Streak Engine",
  "when": "2012",
  "yearSort": 2012,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "Replaced paid acquisition with loss-aversion habit loops and unhinged mascot videos, converting tiny percentages of massive free cohorts into subscribers.",
  "episodes": [
   "Crowdsourcing Web Translation as the Business Model",
   "Building Loss-Aversion Streak Notifications",
   "Launching Unhinged Duo Owl TikTok Videos",
   "Converting 8% of Free Users into Paid Subscribers"
  ],
  "reading": "Hooked by Nir Eyal",
  "wiki": "Duolingo"
 },
 {
  "id": "c061",
  "n": 61,
  "title": "Roman Road & Aqueduct Network",
  "when": "312 BC",
  "yearSort": -312,
  "era": "ANCIENT",
  "pillar": "OPERATIONS",
  "summary": "Built durable, standardized stone highways so legions, tax collectors, and trade goods could move in all weather across three continents.",
  "episodes": [
   "Standardized Multi-Layer Stone Road Engineering",
   "Building Imperial Courier Stations (Cursus Publicus)",
   "Gravity-Fed Aqueduct Urban Sanitation",
   "Integrating Conquered Provinces via Trade"
  ],
  "reading": "Vitruvius, De Architectura",
  "wiki": "Roman roads"
 },
 {
  "id": "c062",
  "n": 62,
  "title": "The Venetian Arsenal",
  "when": "1320s",
  "yearSort": 1320,
  "era": "MEDIEVAL",
  "pillar": "OPERATIONS",
  "summary": "Standardised ship parts moved along a canal past specialised workshops; at its peak the Arsenal reportedly completed a galley in a single day.",
  "episodes": [
   "Centralizing State Shipbuilding in One Walled Complex",
   "Standardizing Interchangeable Oars, Masts & Ribs",
   "Moving Hulls Down a Canal Assembly Line",
   "Assembling a Galley in a Single Day (1574)"
  ],
  "reading": "Venice: A Maritime Republic by Frederic C. Lane",
  "wiki": "Venetian Arsenal"
 },
 {
  "id": "c063",
  "n": 63,
  "title": "Genghis Khan’s Yam Logistics",
  "when": "1200s",
  "yearSort": 1200,
  "era": "MEDIEVAL",
  "pillar": "OPERATIONS",
  "summary": "Relay stations spaced across Eurasia let Mongol messengers change horses and carry orders and intelligence well over 100 miles a day.",
  "episodes": [
   "Placing Horse Relay Posts Across Eurasia",
   "Issuing Metal Paiza VIP Passports",
   "Moving Riders and Intelligence at Record Speed",
   "Coordinating Multi-Army Pincers Across Continents"
  ],
  "reading": "Genghis Khan by Jack Weatherford",
  "wiki": "Yam (route)"
 },
 {
  "id": "c064",
  "n": 64,
  "title": "Springfield Armory Interchangeable Parts",
  "when": "1815",
  "yearSort": 1815,
  "era": "INDUSTRIAL",
  "pillar": "OPERATIONS",
  "summary": "Standardized precision milling gauges so broken musket components could be swapped in the field without custom gunsmithing.",
  "episodes": [
   "Replacing Master Gunsmiths with Precision Milling",
   "Enforcing Go/No-Go Inspection Gauges",
   "Tracking Piece-Rate Worker Output",
   "Birthing the \"American System\" of Manufacturing"
  ],
  "reading": "From the American System to Mass Production by David A. Hounshell",
  "wiki": "Springfield Armory"
 },
 {
  "id": "c065",
  "n": 65,
  "title": "The Panama Canal Turnaround",
  "when": "1905",
  "yearSort": 1905,
  "era": "INDUSTRIAL",
  "pillar": "OPERATIONS",
  "summary": "Realized the canal wasn't a digging problem, it was a railroad dirt-disposal and mosquito-eradication (yellow fever) logistics problem.",
  "episodes": [
   "Halting French-Style Sea-Level Digging",
   "Eradicating Yellow Fever Mosquitoes First",
   "Building a Railroad Dirt-Disposal Conveyor",
   "Constructing Lock-and-Lake Elevation Systems"
  ],
  "reading": "The Path Between the Seas by David McCullough",
  "wiki": "John Frank Stevens"
 },
 {
  "id": "c066",
  "n": 66,
  "title": "Ford’s Moving Assembly Line",
  "when": "1913",
  "yearSort": 1913,
  "era": "INDUSTRIAL",
  "pillar": "OPERATIONS",
  "summary": "Cut Model T chassis assembly time from 12.5 hours to 93 minutes while doubling daily wages to $5 to stop crippling worker turnover.",
  "episodes": [
   "Bringing Parts to Stationary Chassis",
   "Moving Chassis Past Specialised Workers (≈93 Minutes)",
   "Doubling Pay to $5/Day to Stop 370% Turnover",
   "Slashing Model T Prices to Create Mass Demand"
  ],
  "reading": "Today and Tomorrow by Henry Ford",
  "wiki": "Ford Model T",
  "caseId": "ford-model-t"
 },
 {
  "id": "c067",
  "n": 67,
  "title": "D-Day & Mulberry Harbors",
  "when": "1944",
  "yearSort": 1944,
  "era": "INDUSTRIAL",
  "pillar": "OPERATIONS",
  "summary": "Allied planners towed prefabricated concrete harbors and laid undersea fuel pipelines (PLUTO) across the English Channel to sustain invasion forces.",
  "episodes": [
   "Deciding Against Defended French Ports",
   "Towing Prefabricated Concrete Harbors Across the Channel",
   "Laying Undersea Fuel Pipelines (PLUTO)",
   "Surviving the Great Channel Storm"
  ],
  "reading": "How the War Was Won by Phillips Payson O’Brien",
  "wiki": "Mulberry harbours"
 },
 {
  "id": "c068",
  "n": 68,
  "title": "The Berlin Airlift",
  "when": "1948",
  "yearSort": 1948,
  "era": "MODERN",
  "pillar": "OPERATIONS",
  "summary": "General William Tunner synchronized aircraft landings every three minutes with standardized coal and flour loads to feed 2 million besieged citizens.",
  "episodes": [
   "Calculating Daily Caloric & Coal Tonnage for 2M People",
   "Synchronizing 3-Minute Landing Intervals",
   "Standardizing Plane Loads & Maintenance Crews",
   "Forcing Stalin to Lift the Blockade"
  ],
  "reading": "The Candy Bombers by Andrei Cherny",
  "wiki": "Berlin Blockade"
 },
 {
  "id": "c069",
  "n": 69,
  "title": "Malcom McLean’s Shipping Container",
  "when": "1956",
  "yearSort": 1956,
  "era": "MODERN",
  "pillar": "OPERATIONS",
  "summary": "Designed intermodal steel boxes that shifted seamlessly from trucks to cranes to ships, slashing global port loading costs by over 90%.",
  "episodes": [
   "Lifting Whole Truck Trailers onto Converted Tankers",
   "Releasing Container Corner-Lock Patents Royalty-Free",
   "Automating Crane Ports & Slashing Loading Costs 90%",
   "Enabling Global Just-in-Time Supply Chains"
  ],
  "reading": "The Box by Marc Levinson",
  "wiki": "Malcom McLean"
 },
 {
  "id": "c070",
  "n": 70,
  "title": "Toyota Production System",
  "when": "1950s",
  "yearSort": 1950,
  "era": "MODERN",
  "pillar": "OPERATIONS",
  "summary": "Taiichi Ohno introduced Just-in-Time inventory and the Andon cord, empowering any line worker to halt production to fix root-cause defects.",
  "episodes": [
   "Studying American Supermarket Shelf Restocking",
   "Eliminating Warehouse Buffers via Just-in-Time",
   "Installing the Andon Cord to Stop Defects Early",
   "Training Suppliers in Kaizen Continuous Improvement"
  ],
  "reading": "The Machine That Changed the World by Womack et al",
  "wiki": "Toyota Production System"
 },
 {
  "id": "c071",
  "n": 71,
  "title": "McDonald’s Speedee & Real Estate",
  "when": "1948",
  "yearSort": 1948,
  "era": "MODERN",
  "pillar": "OPERATIONS",
  "summary": "The McDonald brothers choreographed kitchen ergonomics like tennis courts; Ray Kroc scaled consistency by owning the underlying franchise land.",
  "episodes": [
   "Choreographing Kitchen Ergonomics on a Tennis Court",
   "Cutting Menu to 9 Items for 30-Second Service",
   "Ray Kroc Franchise Expansion",
   "Buying Franchise Land to Capture Real Estate Margin"
  ],
  "reading": "Grinding It Out by Ray Kroc",
  "wiki": "History of McDonald's"
 },
 {
  "id": "c072",
  "n": 72,
  "title": "NASA’s Apollo Systems Engineering",
  "when": "1961",
  "yearSort": 1961,
  "era": "MODERN",
  "pillar": "OPERATIONS",
  "summary": "George Mueller introduced \"all-up testing\" and rigorous interface control across 400,000 contractors to hit Kennedy’s decade deadline.",
  "episodes": [
   "Choosing Lunar Orbit Rendezvous Over Direct Ascent",
   "Implementing \"All-Up\" Rocket Testing",
   "Coordinating 400,000 Contractors via Interface Control",
   "Landing Apollo 11 Before 1970"
  ],
  "reading": "Apollo by Murray & Cox",
  "wiki": "Apollo program"
 },
 {
  "id": "c073",
  "n": 73,
  "title": "Zara’s Fast-Fashion Supply Chain",
  "when": "1980s",
  "yearSort": 1980,
  "era": "MODERN",
  "pillar": "OPERATIONS",
  "summary": "Amancio Ortega kept 50%+ of manufacturing close to Spain instead of chasing the cheapest Asian labor, cutting design-to-rack cycles to 15 days.",
  "episodes": [
   "Keeping Manufacturing in Spain & Portugal Instead of Asia",
   "Buying Un-Dyed Fabric to React to Trends Late",
   "Twice-Weekly Store Shipments Creating Scarcity",
   "15-Day Design-to-Rack Turnaround"
  ],
  "reading": "HBS Case Zara",
  "wiki": "Zara (retailer)"
 },
 {
  "id": "c074",
  "n": 74,
  "title": "Intel’s \"Copy Exactly!\" Scaling",
  "when": "1990s",
  "yearSort": 1990,
  "era": "MODERN",
  "pillar": "OPERATIONS",
  "summary": "Intel required new fabs to replicate the development line exactly (equipment, settings and processes) to protect yields when scaling.",
  "episodes": [
   "Diagnosing Mysterious Yield Drops in New Chip Fabs",
   "Mandating Identical Equipment, Settings & Processes",
   "Eliminating Scientific Ego in Process Transfers",
   "Dominating 90s PC Microprocessors"
  ],
  "reading": "High Output Management by Andrew S. Grove",
  "wiki": "Intel"
 },
 {
  "id": "c075",
  "n": 75,
  "title": "TSMC’s Foundry Model",
  "when": "1987",
  "yearSort": 1987,
  "era": "MODERN",
  "pillar": "OPERATIONS",
  "summary": "Morris Chang promised never to design chips that competed with customers, enabling fabless startups like Nvidia, Qualcomm, and Apple to thrive.",
  "episodes": [
   "Convincing Philips & Taiwan to Fund Pure-Play Fabs",
   "Mastering Standard Design Rules for Fabless Clients",
   "Surviving Yield Crashes on Leading Nodes",
   "Enabling Nvidia, Apple, and AMD to Flourish"
  ],
  "reading": "Chip War by Chris Miller",
  "wiki": "TSMC"
 },
 {
  "id": "c076",
  "n": 76,
  "title": "IKEA’s Flat-Pack Engineering",
  "when": "1956",
  "yearSort": 1956,
  "era": "MODERN",
  "pillar": "OPERATIONS",
  "summary": "Ingvar Kamprad engineered tables starting from the target retail price tag first, shifting final assembly and transport labor onto the customer.",
  "episodes": [
   "Removing Table Legs to Fit Inside a Car Trunk",
   "Designing Products Backward from Target Price Tags",
   "Shifting Assembly Labor onto Customers",
   "Sourcing Through Eastern European Factories During the Cold War"
  ],
  "reading": "Leading by Design by Ingvar Kamprad",
  "wiki": "IKEA"
 },
 {
  "id": "c077",
  "n": 77,
  "title": "Amazon’s Kiva Robotics Integration",
  "when": "2012",
  "yearSort": 2012,
  "era": "MODERN",
  "pillar": "OPERATIONS",
  "summary": "Bought its key warehouse automation supplier for $775 million, flipping fulfillment from people walking to shelves to shelves driving to people.",
  "episodes": [
   "Buying Kiva Systems for $775M",
   "Cutting Off Rival Retailers from Kiva Robots",
   "Bringing Shelves to Pickers Instead of Walking Miles",
   "Enabling One-Day Prime Delivery"
  ],
  "reading": "The Everything Store by Brad Stone",
  "wiki": "Amazon Robotics"
 },
 {
  "id": "c078",
  "n": 78,
  "title": "SpaceX’s Falcon 9 Reusability",
  "when": "2008",
  "yearSort": 2008,
  "era": "MODERN",
  "pillar": "OPERATIONS",
  "summary": "Abandoned cost-plus aerospace practice in favour of vertical integration, reusable first stages and rapid, hardware-rich testing.",
  "episodes": [
   "Vertical Integration of Valves, Avionics & Engines",
   "Iterative Test-to-Failure Hardware Culture",
   "Propulsive First-Stage Booster Landings",
   "Reflying Boosters 20+ Times to Slash Launch Costs"
  ],
  "reading": "Reentry by Eric Berger",
  "wiki": "Falcon 9"
 },
 {
  "id": "c079",
  "n": 79,
  "title": "Costco’s 4,000-SKU Flywheel",
  "when": "1983",
  "yearSort": 1983,
  "era": "MODERN",
  "pillar": "OPERATIONS",
  "summary": "Keeps only about 4,000 products, caps markups at roughly 14–15%, and earns most of its operating profit from membership fees.",
  "episodes": [
   "Capping Product Markups at 14–15%",
   "Limiting SKUs to 4,000 to Maximize Vendor Volume",
   "Launching Kirkland Signature Private Label",
   "Generating Net Profit Almost Entirely from Memberships"
  ],
  "reading": "Acquired Podcast Costco Episode",
  "wiki": "Costco"
 },
 {
  "id": "c080",
  "n": 80,
  "title": "Operation Warp Speed",
  "when": "2020",
  "yearSort": 2020,
  "era": "CONTEMPORARY",
  "pillar": "OPERATIONS",
  "summary": "Paired advance government purchase guarantees with parallel clinical trials and dry-ice logistics to compress a 10-year pharma timeline into 10 months.",
  "episodes": [
   "Funding 6 Vaccine Candidates in Parallel",
   "At-Risk Manufacturing Before Phase 3 Results",
   "Solving Ultra-Cold Dry-Ice Logistics",
   "Delivering Approved Vaccines in 10 Months"
  ],
  "reading": "A Shot to Save the World by Gregory Zuckerman",
  "wiki": "Operation Warp Speed"
 },
 {
  "id": "c081",
  "n": 81,
  "title": "Fabius Maximus’ Delaying Strategy",
  "when": "217 BC",
  "yearSort": -217,
  "era": "ANCIENT",
  "pillar": "TURNAROUND",
  "summary": "Refused pitched battles after Roman defeats, shadowing Hannibal and cutting his supply lines despite furious political backlash in Rome.",
  "episodes": [
   "Refusing Pitched Battles After Lake Trasimene",
   "Shadowing Hannibal & Burning Crops",
   "Surviving Political Mockery (\"The Delayer\")",
   "Starving Carthage’s Army in Italy"
  ],
  "reading": "Plutarch’s Lives",
  "wiki": "Quintus Fabius Maximus Verrucosus"
 },
 {
  "id": "c082",
  "n": 82,
  "title": "Queen Elizabeth I & The Spanish Armada",
  "when": "1588",
  "yearSort": 1588,
  "era": "EARLY_MODERN",
  "pillar": "TURNAROUND",
  "summary": "Combined fiscal restraint, privateer disruption (Francis Drake), fireships, and inspirational crisis communication at Tilbury.",
  "episodes": [
   "Licensing Francis Drake to Raid Spanish Gold",
   "Building Fast, Long-Range Galleons",
   "Launching Fireships at Gravelines",
   "Delivering the Tilbury Crisis Speech"
  ],
  "reading": "The Armada by Garrett Mattingly",
  "wiki": "Spanish Armada"
 },
 {
  "id": "c083",
  "n": 83,
  "title": "Shackleton’s Endurance Rescue",
  "when": "1914",
  "yearSort": 1914,
  "era": "INDUSTRIAL",
  "pillar": "TURNAROUND",
  "summary": "When pack ice crushed his ship, Ernest Shackleton abandoned his exploration goal immediately, prioritizing morale, routine, and keeping troublemakers close to his tent.",
  "episodes": [
   "Abandoning the Trans-Antarctic Goal Once Trapped in Ice",
   "Maintaining Daily Routines & Morale on Ice Floes",
   "Navigating 800 Miles in an Open Lifeboat",
   "Rescuing Every Single Crew Member Alive"
  ],
  "reading": "Endurance by Alfred Lansing",
  "wiki": "Imperial Trans-Antarctic Expedition"
 },
 {
  "id": "c084",
  "n": 84,
  "title": "Apollo 13 In-Flight Rescue",
  "when": "1970",
  "yearSort": 1970,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Gene Kranz’s Mission Control improvised a carbon-dioxide scrubber adapter from plastic bags, cardboard and duct tape, while rationing spacecraft power.",
  "episodes": [
   "Shutting Down the Command Module to Save Power",
   "Improvising Square-to-Round CO2 Scrubbers",
   "Manual Re-Entry Alignment Without Computers",
   "Safe Splashdown (\"Successful Failure\")"
  ],
  "reading": "Failure Is Not an Option by Gene Kranz",
  "wiki": "Apollo 13"
 },
 {
  "id": "c085",
  "n": 85,
  "title": "Chrysler’s 1979 Turnaround",
  "when": "1979",
  "yearSort": 1979,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Lee Iacocca took a $1 salary, negotiated union concessions, secured loan guarantees, and bet the company on the K-car platform and minivan.",
  "episodes": [
   "Taking a $1 CEO Salary to Win Congressional Loans",
   "Negotiating Union Wage Concessions",
   "Launching the Fuel-Efficient K-Car Platform",
   "Inventing the Minivan Category & Repaying Loans Early"
  ],
  "reading": "Iacocca by Lee Iacocca",
  "wiki": "Chrysler Corporation Loan Guarantee Act of 1979"
 },
 {
  "id": "c086",
  "n": 86,
  "title": "J&J’s Tylenol Cyanide Recall",
  "when": "1982",
  "yearSort": 1982,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "CEO James Burke pulled 31 million bottles ($100M cost) off shelves immediately before knowing the tampering was local, inventing tamper-evident packaging and saving trust.",
  "episodes": [
   "Recalling 31 Million Bottles Immediately ($100M Hit)",
   "Recalling Nationwide Against Official Advice",
   "Inventing Triple-Seal Tamper-Resistant Packaging",
   "Recovering Market Share Within Months"
  ],
  "reading": "Compare with Boeing 737 MAX",
  "wiki": "Chicago Tylenol murders"
 },
 {
  "id": "c087",
  "n": 87,
  "title": "Harley-Davidson’s Revival",
  "when": "1981",
  "yearSort": 1981,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Executives bought the failing division back from AMF, adopted Japanese statistical quality control, and built the Harley Owners Group (HOG) community.",
  "episodes": [
   "Management Buyout from AMF Conglomerate",
   "Adopting Japanese Just-in-Time & Statistical Quality",
   "Securing Temporary Tariffs While Re-Engineering Engines",
   "Building the Harley Owners Group (HOG) Cult"
  ],
  "reading": "Well Made in America by Peter C. Reid",
  "wiki": "Harley-Davidson"
 },
 {
  "id": "c088",
  "n": 88,
  "title": "IBM’s Services Pivot",
  "when": "1993",
  "yearSort": 1993,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Outsider CEO Lou Gerstner refused Wall Street pressure to break up \"Big Blue,\" realizing enterprise clients paid for integrated IT solutions, not parts.",
  "episodes": [
   "Halting Wall Street’s Plan to Break Up IBM",
   "Slashing Mainframe Prices & Bureaucracy",
   "Building Hardware-Agnostic IT Consulting",
   "Embracing Linux & E-Business"
  ],
  "reading": "Who Says Elephants Can’t Dance? by Lou Gerstner",
  "wiki": "Lou Gerstner"
 },
 {
  "id": "c089",
  "n": 89,
  "title": "Continental Airlines \"Worst to First\"",
  "when": "1994",
  "yearSort": 1994,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Gordon Bethune tore up punitive cost-cutting rules, burned the bureaucratic employee manual in a parking lot, and paid every worker $65 whenever monthly flights arrived on time.",
  "episodes": [
   "Grounding Unprofitable Routes & Aircraft Types",
   "Burning the Bureaucratic Employee Manual",
   "Paying $65 Monthly On-Time Bonuses to Every Worker",
   "Jumping from Last to #1 in Customer Satisfaction"
  ],
  "reading": "From Worst to First by Gordon Bethune",
  "wiki": "Gordon Bethune"
 },
 {
  "id": "c090",
  "n": 90,
  "title": "Apple’s 90-Day Rescue",
  "when": "1997",
  "yearSort": 1997,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Returning founder Steve Jobs killed 70% of Apple's products (including the Newton) and secured a shocking $150M lifeline and Office commitment from arch-rival Microsoft.",
  "episodes": [
   "Canceling Newton & 70% of Product Lines",
   "Securing $150M & Office Support from Microsoft",
   "Moving to Just-in-Time Manufacturing Under Tim Cook",
   "Launching the Translucent iMac"
  ],
  "reading": "Steve Jobs by Walter Isaacson",
  "wiki": "History of Apple Inc.",
  "caseId": "apple-1997-turnaround"
 },
 {
  "id": "c091",
  "n": 91,
  "title": "Enron’s Fraud Implosion",
  "when": "2001",
  "yearSort": 2001,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Shows how \"rank-and-yank\" incentives and off-balance-sheet Special Purpose Vehicles turn smart executives into systemic fraudsters.",
  "episodes": [
   "Booking Future Projected Profits Day 1 (Mark-to-Market)",
   "Hiding Debt in Off-Balance-Sheet SPVs",
   "\"Rank-and-Yank\" Culture Silencing Whistleblowers",
   "Liquidity Freeze & Bankruptcy"
  ],
  "reading": "The Smartest Guys in the Room by McLean & Elkind",
  "wiki": "Enron scandal"
 },
 {
  "id": "c092",
  "n": 92,
  "title": "Nissan’s Alliance Revival",
  "when": "1999",
  "yearSort": 1999,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Carlos Ghosn broke Japanese keiretsu supplier taboos with cross-functional internal teams, returning a debt-crushed automaker to profit in twelve months (before his later governance downfall).",
  "episodes": [
   "Breaking Keiretsu Supplier Ties to Cut Costs 20%",
   "Cross-Functional Teams Bypassing Seniority",
   "Closing 5 Domestic Plants & Launching New Models",
   "Returning to Record Profits in One Year"
  ],
  "reading": "Shift by Carlos Ghosn",
  "wiki": "Carlos Ghosn"
 },
 {
  "id": "c093",
  "n": 93,
  "title": "LEGO’s Near-Death Refocus",
  "when": "2003",
  "yearSort": 2003,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Jørgen Vig Knudstorp sold off theme parks, slashed custom piece counts by half, and re-centered product design around core fan builders and Star Wars IP.",
  "episodes": [
   "Selling Legoland Theme Parks for Cash",
   "Halving the Number of Unique Brick Elements",
   "Re-Centering Design Around Core Brick Builders",
   "Expanding Star Wars & Ninjago IP"
  ],
  "reading": "Brick by Brick by David Robertson",
  "wiki": "The Lego Group"
 },
 {
  "id": "c094",
  "n": 94,
  "title": "Ford Avoiding 2008 Bankruptcy",
  "when": "2006",
  "yearSort": 2006,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Alan Mulally mortgaged every Ford asset, including the blue oval logo, for a $23.6B credit line before the 2008 crash, allowing Ford to skip government bailouts.",
  "episodes": [
   "Mortgaging All Assets (Including the Logo) for $23.6B",
   "Ending Toxic Politics via Weekly Color-Coded BPRs",
   "Selling Jaguar/Land Rover & Killing Mercury",
   "Surviving 2008 Without Taxpayer Bailouts"
  ],
  "reading": "American Icon by Bryce G. Hoffman",
  "wiki": "Alan Mulally"
 },
 {
  "id": "c095",
  "n": 95,
  "title": "Kodak’s Digital Paralysis",
  "when": "1975–2012",
  "yearSort": 1975,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Kodak built the first digital camera in 1975 but kept its strategy centred on highly profitable film for decades.",
  "episodes": [
   "Inventing the Digital Camera in 1975 & Shelving It",
   "Protecting Highly Profitable Film Sales",
   "Half-Hearted Digital Pivots Too Late",
   "Filing Chapter 11 While Fujifilm Pivots to Skincare & Medical"
  ],
  "reading": "Compare Kodak vs. Fujifilm",
  "wiki": "Kodak",
  "caseId": "kodak-digital"
 },
 {
  "id": "c096",
  "n": 96,
  "title": "Domino’s Radical Honesty Turnaround",
  "when": "2009",
  "yearSort": 2009,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Patrick Doyle aired commercials admitting Domino's pizza tasted like cardboard, overhauled the recipe, and rebuilt Domino’s as a mobile ordering tech company.",
  "episodes": [
   "Airing Focus-Group Ads Calling Their Own Pizza Cardboard",
   "Rebuilding the Sauce, Crust & Cheese from Scratch",
   "Launching the Domino’s Pizza Tracker App",
   "Outperforming Tech Stocks Over the Next Decade"
  ],
  "reading": "HBS Case Domino’s Pizza",
  "wiki": "Domino's"
 },
 {
  "id": "c097",
  "n": 97,
  "title": "Nokia & BlackBerry Smartphone Collapse",
  "when": "2007",
  "yearSort": 2007,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Treated smartphones as carrier-controlled hardware devices with physical keyboards while Apple and Android turned phones into developer app platforms.",
  "episodes": [
   "Dismissing the iPhone’s Lack of Physical Keyboard & Battery",
   "Clinging to Fragmented Symbian & Carrier-Controlled Deals",
   "Ignoring Developer App Ecosystems",
   "Losing Global Dominance in Five Years"
  ],
  "reading": "Losing the Signal by McNish & Silcoff",
  "wiki": "Nokia",
  "caseId": "nokia-smartphone"
 },
 {
  "id": "c098",
  "n": 98,
  "title": "BP Deepwater Horizon Disaster",
  "when": "2010",
  "yearSort": 2010,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Cost-cutting on cement well casings met tone-deaf executive communication (\"I'd like my life back\"), costing over $65 billion in cleanup and fines.",
  "episodes": [
   "Skipping Cement Bond Logs to Save $128k & Rig Time",
   "Blowout Preventer Failure in the Gulf of Mexico",
   "Tone-Deaf CEO PR (\"I'd Like My Life Back\")",
   "Paying $65B+ in Fines & Asset Sales"
  ],
  "reading": "Run to Failure by Abrahm Lustgarten",
  "wiki": "Deepwater Horizon oil spill"
 },
 {
  "id": "c099",
  "n": 99,
  "title": "Airbnb’s COVID-19 Revenue Cliff",
  "when": "2020",
  "yearSort": 2020,
  "era": "CONTEMPORARY",
  "pillar": "TURNAROUND",
  "summary": "Lost 80% of bookings in eight weeks; Brian Chesky paused futuristic side bets (flights, media), reorganized functionally rather than divisionally, and went public stronger months later.",
  "episodes": [
   "Losing 80% of Bookings in 8 Weeks",
   "Pausing Flights, Studios & Side Projects",
   "Reorganizing into Functional Teams (Founder Mode)",
   "Riding Remote Work Stays to a Blockbuster IPO"
  ],
  "reading": "Brian Chesky’s Founder Mode Talks",
  "wiki": "Airbnb"
 },
 {
  "id": "c100",
  "n": 100,
  "title": "Theranos Governance Failure",
  "when": "2013",
  "yearSort": 2013,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Proves how a prestigious board filled with statesmen rather than domain scientists can miss elementary product fabrication.",
  "episodes": [
   "Hiding Non-Working Edison Blood Machines",
   "Stacking the Board with Politicians Instead of Scientists",
   "Signing Retail Deals with Walgreens via NDA Secrecy",
   "Whistleblower Exposé & Criminal Convictions"
  ],
  "reading": "Bad Blood by John Carreyrou",
  "wiki": "Theranos"
 },
 {
  "id": "c101",
  "n": 101,
  "title": "Cyrus the Great’s Imperial Governance",
  "when": "539 BC",
  "yearSort": -539,
  "era": "ANCIENT",
  "pillar": "LEADERSHIP",
  "summary": "Allowed conquered Babylonians and Jews to keep local gods, laws, and customs in exchange for taxes and military levies, minimizing rebellion costs.",
  "episodes": [
   "Conquering Babylon Without Sacking the City",
   "Releasing Exiled Peoples & Restoring Local Temples",
   "Appointing Satraps Checked by Royal Inspectors",
   "Securing Low-Rebellion Tributary Loyalty"
  ],
  "reading": "Cyropaedia by Xenophon",
  "wiki": "Cyrus the Great"
 },
 {
  "id": "c102",
  "n": 102,
  "title": "Pericles’ Civic Alignment",
  "when": "431 BC",
  "yearSort": -431,
  "era": "ANCIENT",
  "pillar": "LEADERSHIP",
  "summary": "Defined shared cultural values and meritocracy to rally democratic citizens before a grueling multi-decade struggle.",
  "episodes": [
   "Framing Athenian Democracy as a Meritocratic Ideal",
   "Funding Public Festivals & Naval Jury Pay",
   "Managing Populist Pressure During Spartan Invasions",
   "Leadership Vacuum After His Death"
  ],
  "reading": "Pericles of Athens by Donald Kagan",
  "wiki": "Pericles's Funeral Oration"
 },
 {
  "id": "c103",
  "n": 103,
  "title": "Tokugawa’s Sankin-kōtai System",
  "when": "1603",
  "yearSort": 1603,
  "era": "EARLY_MODERN",
  "pillar": "LEADERSHIP",
  "summary": "Required rival feudal lords (daimyo) to spend alternate years in Edo and leave families behind, draining their war chests on ceremonial travel and securing 250 years of peace.",
  "episodes": [
   "Redistributing Domains to Isolate Rival Lords",
   "Mandating Alternate-Year Attendance in Edo",
   "Holding Lordly Families as Permanent Hostages",
   "Draining Regional War Chests on Travel Expenses"
  ],
  "reading": "The Making of Modern Japan by Marius B. Jansen",
  "wiki": "Sankin-kōtai"
 },
 {
  "id": "c104",
  "n": 104,
  "title": "George Washington Stepping Down Twice",
  "when": "1783 & 1796",
  "yearSort": 1783,
  "era": "EARLY_MODERN",
  "pillar": "LEADERSHIP",
  "summary": "Voluntarily surrendered military command and later the presidency, establishing peaceful executive succession and institutional trust over personal monarchy.",
  "episodes": [
   "Quelling the Newburgh Military Coup Conspiracy",
   "Surrendering Army Command Back to Congress",
   "Stepping Down After Two Presidential Terms",
   "Establishing Peaceful Transfer of Power"
  ],
  "reading": "Washington: A Life by Ron Chernow",
  "wiki": "George Washington"
 },
 {
  "id": "c105",
  "n": 105,
  "title": "Lincoln’s \"Team of Rivals\"",
  "when": "1861",
  "yearSort": 1861,
  "era": "INDUSTRIAL",
  "pillar": "LEADERSHIP",
  "summary": "Appointed his fiercest political competitors (Seward, Chase, Stanton) to top posts to harness the nation’s best talent and prevent fractured opposition.",
  "episodes": [
   "Appointing Seward, Chase, and Stanton to Cabinet",
   "Absorbing Public Insults to Keep Talent Focused",
   "Timing the Emancipation Proclamation After Antietam",
   "Passing the 13th Amendment"
  ],
  "reading": "Team of Rivals by Doris Kearns Goodwin",
  "wiki": "Abraham Lincoln"
 },
 {
  "id": "c106",
  "n": 106,
  "title": "Bletchley Park Codebreakers",
  "when": "1939",
  "yearSort": 1939,
  "era": "INDUSTRIAL",
  "pillar": "LEADERSHIP",
  "summary": "British intelligence gave quirky mathematicians, crossword champions, and Alan Turing unconventional autonomy while keeping military bureaucracy off their backs.",
  "episodes": [
   "Recruiting Chess Champions & Crossword Solvers",
   "Giving Alan Turing Autonomy to Build the Bombe",
   "Bypassing Military Bureaucracy via Direct Churchill Memo",
   "Using Ultra Intelligence Without Tipping Off Germany"
  ],
  "reading": "The Secret Life of Bletchley Park by Sinclair McKay",
  "wiki": "Bletchley Park"
 },
 {
  "id": "c107",
  "n": 107,
  "title": "Lockheed Skunk Works",
  "when": "1943",
  "yearSort": 1943,
  "era": "INDUSTRIAL",
  "pillar": "LEADERSHIP",
  "summary": "Kelly Johnson isolated small, high-trust engineering teams from main corporate red tape, delivering the U-2 spy plane and SR-71 Blackbird ahead of schedule and under budget.",
  "episodes": [
   "Isolating 23 Engineers in a Circus Tent Next to a Plastics Factory",
   "Enforcing Kelly Johnson’s 14 Operating Rules",
   "Delivering the XP-80 Jet in 143 Days",
   "Building the U-2 and SR-71 Blackbird"
  ],
  "reading": "Skunk Works by Ben R. Rich",
  "wiki": "Skunk Works"
 },
 {
  "id": "c108",
  "n": 108,
  "title": "Bell Labs Innovation Crucible",
  "when": "1925",
  "yearSort": 1925,
  "era": "INDUSTRIAL",
  "pillar": "LEADERSHIP",
  "summary": "Combined long-horizon AT&T monopoly funding with open corridors where theorists and experimentalists collided, producing the transistor, laser, Unix, and solar cell.",
  "episodes": [
   "Funding Pure Research with AT&T Monopoly Profits",
   "Designing Long Corridors Where Theorists & Engineers Collided",
   "Inventing the Transistor, Laser & Solar Cell",
   "Failing to Commercialize Own Inventions Before Breakup"
  ],
  "reading": "The Idea Factory by Jon Gertner",
  "wiki": "Bell Labs"
 },
 {
  "id": "c109",
  "n": 109,
  "title": "Lee Kuan Yew’s Singapore Governance",
  "when": "1965",
  "yearSort": 1965,
  "era": "MODERN",
  "pillar": "LEADERSHIP",
  "summary": "Turned a resource-poor island port into a global financial hub through anti-corruption enforcement, benchmarked ministerial pay, public housing ownership, and English fluency.",
  "episodes": [
   "Enforcing Strict Anti-Corruption Laws",
   "Pegging Ministerial Pay to Top Private-Sector Earners",
   "Making English the Shared Business Language",
   "Building Public Home Ownership"
  ],
  "reading": "From Third World to First by Lee Kuan Yew",
  "wiki": "Lee Kuan Yew"
 },
 {
  "id": "c110",
  "n": 110,
  "title": "Nucor Steel’s Egalitarian Culture",
  "when": "1965",
  "yearSort": 1965,
  "era": "MODERN",
  "pillar": "LEADERSHIP",
  "summary": "Ken Iverson eliminated executive dining rooms and jets, pushed operational power to four management layers, and tied hourly steelworker bonuses directly to team output.",
  "episodes": [
   "Eliminating Executive Jets, Reserved Parking & Dining Rooms",
   "Flattening Management to Four Layers",
   "Tying Weekly Worker Bonuses to Defect-Free Tonnage",
   "Displacing Integrated Steel Giants via Mini-Mills"
  ],
  "reading": "Plain Talk by Ken Iverson",
  "wiki": "Nucor"
 },
 {
  "id": "c111",
  "n": 111,
  "title": "GE Succession: Welch to Immelt",
  "when": "2001",
  "yearSort": 2001,
  "era": "MODERN",
  "pillar": "LEADERSHIP",
  "summary": "Shows how short-term earnings management via GE Capital masked industrial decay and left a handpicked successor with a fragile conglomerate.",
  "episodes": [
   "Running a Horse-Race Succession That Drove Losers Away",
   "Masking Industrial Slowdowns via GE Capital Earnings",
   "Immelt Takes Over Days Before 9/11",
   "2008 Financial Crash Exposing Conglomerate Fragility"
  ],
  "reading": "Lights Out by Gryta & Mann",
  "wiki": "Jeff Immelt"
 },
 {
  "id": "c112",
  "n": 112,
  "title": "Columbia Space Shuttle Groupthink",
  "when": "2003",
  "yearSort": 2003,
  "era": "MODERN",
  "pillar": "LEADERSHIP",
  "summary": "NASA managers dismissed lower-level engineers’ requests for satellite photos of wing damage because past foam strikes hadn't caused crashes (\"normalization of deviance\").",
  "episodes": [
   "Normalizing Foam Strikes as Non-Fatal Maintenance Issues",
   "Managers Blocking Engineers’ Requests for Spy-Satellite Photos",
   "PowerPoint Slide Ambiguity Masking Critical Risk",
   "Re-Entry Disintegration & Safety Culture Overhaul"
  ],
  "reading": "The Fearless Organization by Amy Edmondson",
  "wiki": "Space Shuttle Columbia disaster"
 },
 {
  "id": "c113",
  "n": 113,
  "title": "Pixar’s \"Braintrust\" Culture",
  "when": "1995",
  "yearSort": 1995,
  "era": "MODERN",
  "pillar": "LEADERSHIP",
  "summary": "Ed Catmull built candid peer-review rooms where directors dissected rough story reels with zero hierarchy, separating creative critique from boss authority.",
  "episodes": [
   "Separating Candid Peer Story Critique from Boss Authority",
   "Rewriting Toy Story 2 in Nine Months",
   "Integrating Disney Animation Without Killing Pixar’s Soul",
   "Sustaining a Historic Box-Office Streak"
  ],
  "reading": "Creativity, Inc. by Ed Catmull",
  "wiki": "Pixar"
 },
 {
  "id": "c114",
  "n": 114,
  "title": "Bridgewater’s Radical Transparency",
  "when": "1990s",
  "yearSort": 1990,
  "era": "MODERN",
  "pillar": "LEADERSHIP",
  "summary": "Recorded every internal meeting and used \"baseball cards\" of employee weaknesses to weight decisions by believability rather than seniority, showing both high clarity and cultural friction.",
  "episodes": [
   "Recording Every Meeting to Eliminate Hallway Politics",
   "Creating Employee \"Baseball Cards\" of Strengths & Flaws",
   "Believability-Weighted Voting Over Hierarchy",
   "Balancing High Clarity with Emotional Burnout"
  ],
  "reading": "Principles by Ray Dalio & The Fund by Rob Copeland",
  "wiki": "Bridgewater Associates"
 },
 {
  "id": "c115",
  "n": 115,
  "title": "Sir Alex Ferguson at Manchester United",
  "when": "1986",
  "yearSort": 1986,
  "era": "MODERN",
  "pillar": "LEADERSHIP",
  "summary": "Rebuilt championship squads repeatedly across 26 years, moving on from star players when they threatened team standards.",
  "episodes": [
   "Surviving Four Trophy-Less Years to Rebuild Youth Academies",
   "Selling Superstars (Beckham, Keane, van Nistelrooy) When Ego Threatened Standards",
   "Rotating Assistant Coaches to Prevent Stagnation",
   "Winning 13 Premier League Titles Through Rebuilds"
  ],
  "reading": "Leading by Ferguson & Moritz",
  "wiki": "Alex Ferguson"
 },
 {
  "id": "c116",
  "n": 116,
  "title": "Valve Corporation’s Flat Structure",
  "when": "1996",
  "yearSort": 1996,
  "era": "MODERN",
  "pillar": "LEADERSHIP",
  "summary": "Operates with wheeled desks and zero formal managers where developers vote with their feet on projects, demonstrating where flat structures shine (creative hits) and struggle (hardware coordination).",
  "episodes": [
   "Putting Desks on Wheels with Zero Managers",
   "Letting Developers Vote with Their Feet on Projects",
   "Creating Half-Life and the Steam Monopoly",
   "Struggling with Hardware Coordination & Ship Dates"
  ],
  "reading": "Valve Handbook for New Employees",
  "wiki": "Valve Corporation"
 },
 {
  "id": "c117",
  "n": 117,
  "title": "Microsoft’s Cultural Reset",
  "when": "2014",
  "yearSort": 2014,
  "era": "MODERN",
  "pillar": "LEADERSHIP",
  "summary": "Dismantled Steve Ballmer’s warring internal fiefdoms, embraced open-source Linux, and shifted the company from \"know-it-alls\" to Carol Dweck’s \"learn-it-all\" mindset.",
  "episodes": [
   "Ending Stack-Ranking Internal Sabotage",
   "Shifting from \"Know-It-Alls\" to \"Learn-It-Alls\"",
   "Embracing Open-Source Linux & iOS Apps",
   "Reclaiming Trillion-Dollar Market Cap via Azure"
  ],
  "reading": "Hit Refresh by Satya Nadella",
  "wiki": "Satya Nadella"
 },
 {
  "id": "c118",
  "n": 118,
  "title": "Wells Fargo’s Cross-Selling Scandal",
  "when": "2016",
  "yearSort": 2016,
  "era": "CONTEMPORARY",
  "pillar": "LEADERSHIP",
  "summary": "Proves Charlie Munger’s rule (\"Show me the incentive and I will show you the outcome\") after impossible \"Eight is Great\" retail quotas drove employees to open millions of fake accounts.",
  "episodes": [
   "Setting Impossible \"Eight is Great\" Account Quotas",
   "Firing Branch Managers Who Missed Daily Targets",
   "Employees Opening 3.5 Million Fake Customer Accounts",
   "Executive Clawbacks & the Fed Asset Cap"
  ],
  "reading": "Wells Fargo Board Investigation Report",
  "wiki": "Wells Fargo cross-selling scandal"
 },
 {
  "id": "c119",
  "n": 119,
  "title": "Patagonia’s Purpose-Trust Transfer",
  "when": "2022",
  "yearSort": 2022,
  "era": "CONTEMPORARY",
  "pillar": "LEADERSHIP",
  "summary": "Yvon Chouinard transferred 98% of non-voting economic stock to an environmental nonprofit and 2% voting stock to a family trust to prevent future activist investors from diluting its mission.",
  "episodes": [
   "Donating 1% of Sales to Grassroots Environmentalists",
   "Running \"Don’t Buy This Jacket\" Anti-Consumerism Ads",
   "Rejecting Traditional IPOs & Private Equity Exits",
   "Transferring 98% Non-Voting Stock to a Climate Nonprofit"
  ],
  "reading": "Let My People Go Surfing by Yvon Chouinard",
  "wiki": "Patagonia, Inc."
 },
 {
  "id": "c120",
  "n": 120,
  "title": "OpenAI’s Boardroom Coup",
  "when": "2023",
  "yearSort": 2023,
  "era": "CONTEMPORARY",
  "pillar": "LEADERSHIP",
  "summary": "When a nonprofit board fired CEO Sam Altman over communication trust without aligning Microsoft or staff, 95% of employees threatened to resign, showing that talent loyalty outweighs legal bylaws when human capital is the core asset.",
  "episodes": [
   "Nonprofit Board Firing Sam Altman Over Candor",
   "Failing to Align Microsoft or Key Researchers First",
   "95% of Staff Signing Resignation Ultimatum",
   "Reinstating Altman & Overhauling Governance"
  ],
  "reading": "New Yorker & NYT OpenAI Governance Breakdowns",
  "wiki": "Removal of Sam Altman from OpenAI"
 },
 {
  "id": "n121",
  "n": 121,
  "title": "ByteDance & TikTok: The Recommendation Graph",
  "when": "2012–Present",
  "yearSort": 2012,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Built Toutiao and then TikTok around interest-based recommendations instead of a social graph, merged Musical.ly to go global, and became a geopolitical flashpoint.",
  "episodes": [
   "Building Toutiao News Feed Without Social Graphs",
   "Acquiring Musical.ly & Merging with TikTok",
   "Training Short-Video Interest Algorithms",
   "Navigating US National Security & Divestment Battles"
  ],
  "reading": "Attention Factory by Matthew Brennan",
  "wiki": "ByteDance",
  "bonus": true
 },
 {
  "id": "n122",
  "n": 122,
  "title": "ASML: Monopolizing Extreme Ultraviolet Lithography",
  "when": "1984–Present",
  "yearSort": 1984,
  "era": "MODERN",
  "pillar": "OPERATIONS",
  "summary": "Grew from a 1984 Philips joint venture into the only maker of EUV lithography machines, co-funded by its own biggest customers.",
  "episodes": [
   "Spinning Out of Philips in a Shed",
   "Co-Investing with Intel, TSMC & Samsung to Fund EUV",
   "Mastering Tin-Droplet Plasma & Zeiss Mirrors",
   "Becoming the Single Irreplaceable Chokepoint of Moore’s Law"
  ],
  "reading": "Focus: The ASML Way by Marc Hijink",
  "wiki": "ASML",
  "bonus": true
 },
 {
  "id": "n123",
  "n": 123,
  "title": "Stripe: Winning Developers with 7 Lines of Code",
  "when": "2010–Present",
  "yearSort": 2010,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "Replaced weeks of merchant-account paperwork with a few lines of code, won developers first, then expanded into a full financial-infrastructure suite.",
  "episodes": [
   "Replacing Bank Merchant Onboarding Weeks with Instant APIs",
   "Obsessing Over Documentation & Developer Experience",
   "Expanding into Global Treasury, Billing & Fraud",
   "Navigating Post-ZIRP Valuation Resets"
  ],
  "reading": "The Collison Brothers Interviews on Invest Like the Best",
  "wiki": "Stripe, Inc.",
  "bonus": true
 },
 {
  "id": "n124",
  "n": 124,
  "title": "Spotify: Rescuing Music from Piracy",
  "when": "2006–Present",
  "yearSort": 2006,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Gave record labels equity and licence fees for their catalogues, offered listeners a legal instant alternative to piracy, then expanded into podcasts and audiobooks.",
  "episodes": [
   "Building Instant Zero-Latency Streaming in Sweden",
   "Trading Equity to Record Labels for Catalog Licenses",
   "Algorithmic Discovery (Discover Weekly)",
   "Expanding into Podcasts & Audiobooks for Margin"
  ],
  "reading": "The Spotify Play by Carlsson & Leijonhufvud",
  "wiki": "Spotify",
  "bonus": true
 },
 {
  "id": "n125",
  "n": 125,
  "title": "Uber: Blitzscaling vs. Regulatory Siege",
  "when": "2009–2023",
  "yearSort": 2009,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Scaled ride-hailing city by city while fighting regulators, then rebuilt its culture and reached profitability under a new CEO.",
  "episodes": [
   "Launching Black Cars in San Francisco",
   "Launching UberX Peer-to-Peer Liquidity",
   "Fighting City Taxi Regulators Globally",
   "Dara Khosrowshahi Cleaning Up Culture & Reaching GAAP Profitability"
  ],
  "reading": "Super Pumped by Mike Isaac",
  "wiki": "Uber",
  "bonus": true
 },
 {
  "id": "c137",
  "n": 126,
  "title": "Alibaba & Taobao: Defeating eBay in China",
  "when": "1999–2014",
  "yearSort": 1999,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Alibaba launched Taobao with free listings and Alipay escrow to solve buyer trust, pushing eBay out of China.",
  "episodes": [
   "Launching Free Taobao Listings Against eBay’s Fees",
   "Inventing Alipay Escrow to Solve Low Buyer Trust",
   "Winning Singles’ Day (11.11) Logistics Scale",
   "Navigating Regulatory Crackdowns"
  ],
  "reading": "Alibaba by Duncan Clark",
  "wiki": "Taobao",
  "bonus": true
 },
 {
  "id": "n127",
  "n": 127,
  "title": "Shein: Real-Time Retail & Ultra-Fast Supply",
  "when": "2012–Present",
  "yearSort": 2012,
  "era": "MODERN",
  "pillar": "OPERATIONS",
  "summary": "Tests designs in tiny batches, reorders the winners using real-time app data, and ships direct to consumers worldwide.",
  "episodes": [
   "Testing Micro-Batches of 100 Garments Instead of 10,000",
   "Wiring Guangzhou Factories into Live App Click Data",
   "Shipping Direct-to-Consumer via Air Freight Loopholes",
   "Facing ESG & Tariff Scrutiny"
  ],
  "reading": "Rest of World Shein Supply Chain Reports",
  "wiki": "Shein",
  "bonus": true
 },
 {
  "id": "n128",
  "n": 128,
  "title": "Patreon & The Creator Economy Shift",
  "when": "2013–Present",
  "yearSort": 2013,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "Musician Jack Conte built recurring fan memberships so creators depend less on volatile advertising revenue.",
  "episodes": [
   "Musician Jack Conte Solving YouTube Ad-Rate Volatility",
   "Building Recurring Membership Tiers",
   "Surviving Creator Fee-Structure Backlashes",
   "Direct-to-Fan Ownership vs. Algorithm Dependency"
  ],
  "reading": "The Creator Economy essays by Li Jin",
  "wiki": "Patreon",
  "bonus": true
 },
 {
  "id": "n129",
  "n": 129,
  "title": "The Manhattan Project: Managing Secret Megaprojects",
  "when": "1942–1945",
  "yearSort": 1942,
  "era": "INDUSTRIAL",
  "pillar": "OPERATIONS",
  "summary": "General Leslie Groves ran a secret, multi-site wartime megaproject: parallel technical paths, strict compartmentalisation, and a scientific director chosen despite security concerns.",
  "episodes": [
   "General Groves Choosing Oppenheimer Despite Security Flags",
   "Pursuing Uranium & Plutonium Enrichment in Parallel",
   "Isolating Scientists in Los Alamos While Enforcing Compartmentalization",
   "Trinity Test & Moral Governance"
  ],
  "reading": "The Making of the Atomic Bomb by Richard Rhodes",
  "wiki": "Manhattan Project",
  "bonus": true
 },
 {
  "id": "c131",
  "n": 130,
  "title": "Grameen Bank & Microfinance Scaling",
  "when": "1976–Present",
  "yearSort": 1976,
  "era": "MODERN",
  "pillar": "FINANCE",
  "summary": "Muhammad Yunus lent small sums to poor borrowers, mostly women, using peer groups instead of collateral; he and the bank shared the 2006 Nobel Peace Prize.",
  "episodes": [
   "Muhammad Yunus Lends $27 to 42 Villagers",
   "Replacing Physical Collateral with Five-Person Peer Lending Groups",
   "Reporting Very High Repayment Rates",
   "Scaling Microcredit Globally & Managing Commercialization Debates"
  ],
  "reading": "Banker to the Poor by Muhammad Yunus",
  "wiki": "Grameen Bank",
  "bonus": true
 },
 {
  "id": "c121",
  "n": 131,
  "title": "Athens Invests the Laurion Silver Windfall",
  "when": "483 BC",
  "yearSort": -483,
  "era": "ANCIENT",
  "pillar": "FINANCE",
  "summary": "Themistocles persuaded Athens to build a fleet with a silver windfall instead of sharing it out, the fleet that won at Salamis.",
  "episodes": [
   "Allocating the Silver Windfall",
   "Choosing the Battlefield at Salamis",
   "Organising the Delian League",
   "Pericles’ Walls Strategy (431 BC)"
  ],
  "reading": "Herodotus, Histories, Book 7",
  "wiki": "Themistocles",
  "added": true,
  "caseId": "athens-silver-fleet"
 },
 {
  "id": "c122",
  "n": 132,
  "title": "Augustus Funds the Army’s Pensions",
  "when": "AD 6",
  "yearSort": 6,
  "era": "ANCIENT",
  "pillar": "FINANCE",
  "summary": "Turned soldiers’ rewards from generals’ gifts into a state fund financed by new taxes, the aerarium militare.",
  "episodes": [
   "Buying Land for the Veterans",
   "Keeping the Frontier Legions (27 BC)",
   "Fixed Terms and Cash Bonuses",
   "Founding the Military Treasury"
  ],
  "reading": "Res Gestae Divi Augusti",
  "wiki": "Aerarium militare",
  "added": true,
  "caseId": "rome-military-treasury"
 },
 {
  "id": "c123",
  "n": 133,
  "title": "Intel Exits Memory Chips",
  "when": "1985",
  "yearSort": 1985,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Grove and Moore asked what a new CEO would do, then left the DRAM business Intel was founded on to focus on microprocessors.",
  "episodes": [
   "Walking Out of the DRAM Business",
   "Sole-Sourcing the 386",
   "Branding the Ingredient: Intel Inside",
   "The Pentium Division Bug"
  ],
  "reading": "Only the Paranoid Survive by Andrew S. Grove",
  "wiki": "Andrew Grove",
  "added": true,
  "caseId": "intel-exit-memory"
 },
 {
  "id": "c124",
  "n": 134,
  "title": "The Code of Hammurabi’s Commercial Rules",
  "when": "c. 1754 BC",
  "yearSort": -1754,
  "era": "ANCIENT",
  "pillar": "LEADERSHIP",
  "summary": "One of the earliest written legal codes set rules for trade, loans, wages and liability, showing how predictable rules lower the cost of doing business.",
  "episodes": [
   "Unifying Mesopotamia Under One King",
   "Publishing the Law on Public Stelae",
   "Setting Rules for Loans, Wages & Fees",
   "Making Builders Liable for Collapses"
  ],
  "reading": "Law Collections from Mesopotamia and Asia Minor by Martha T. Roth",
  "wiki": "Code of Hammurabi",
  "added": true
 },
 {
  "id": "c125",
  "n": 135,
  "title": "Crassus and the Private Fire Brigade",
  "when": "c. 70s BC",
  "yearSort": -70,
  "era": "ANCIENT",
  "pillar": "LEADERSHIP",
  "summary": "Plutarch says Crassus bought burning buildings cheaply before his slaves put out the fires, a case study in exploiting a public-goods failure, and its ethics.",
  "episodes": [
   "Profiting from Sulla’s Proscriptions",
   "The Private Fire Brigade Gambit",
   "Bankrolling Caesar’s Career",
   "Seeking Military Glory at Carrhae"
  ],
  "reading": "Plutarch, Life of Crassus",
  "wiki": "Marcus Licinius Crassus",
  "added": true
 },
 {
  "id": "c126",
  "n": 136,
  "title": "The Hanseatic League’s Trading Network",
  "when": "1356–1669",
  "yearSort": 1356,
  "era": "MEDIEVAL",
  "pillar": "OPERATIONS",
  "summary": "A league of merchant towns shared trading privileges, standards and collective bargaining power across the Baltic and North Sea for three centuries.",
  "episodes": [
   "Merchants Banding Together Abroad",
   "Building the Kontor Network",
   "The Trade War with Denmark",
   "Losing Ground to Territorial States"
  ],
  "reading": "The German Hansa by Philippe Dollinger",
  "wiki": "Hanseatic League",
  "added": true
 },
 {
  "id": "c127",
  "n": 137,
  "title": "The War of the Currents: Edison vs. Westinghouse",
  "when": "1880s–1890s",
  "yearSort": 1880,
  "era": "INDUSTRIAL",
  "pillar": "STRATEGY",
  "summary": "Edison’s direct current fought Westinghouse and Tesla’s alternating current; AC’s long-distance economics won despite a fierce publicity campaign.",
  "episodes": [
   "Edison’s Direct-Current Systems",
   "Westinghouse Licenses Tesla’s AC Patents",
   "The Publicity War Over Safety",
   "Lighting the 1893 World’s Fair & Niagara"
  ],
  "reading": "Empires of Light by Jill Jonnes",
  "wiki": "War of the currents",
  "added": true
 },
 {
  "id": "c128",
  "n": 138,
  "title": "Sears’ Mail-Order Catalogue",
  "when": "1888",
  "yearSort": 1888,
  "era": "INDUSTRIAL",
  "pillar": "BRAND",
  "summary": "Used railways, rural mail delivery and a money-back promise to sell to farmers far from any store.",
  "episodes": [
   "Selling Watches by Mail",
   "Riding Rural Free Delivery",
   "The Money-Back Guarantee",
   "Opening Stores for the Car Age"
  ],
  "reading": "Compare with Case 12 (Walmart)",
  "wiki": "Sears",
  "added": true
 },
 {
  "id": "c129",
  "n": 139,
  "title": "VHS vs. Betamax",
  "when": "1975–1988",
  "yearSort": 1975,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Sony’s Betamax was first, but JVC’s VHS won by licensing widely and offering longer recording times, standards wars are won by ecosystems.",
  "episodes": [
   "Sony Launches Betamax First",
   "JVC Licenses VHS Widely",
   "Longer Recording Times Win Buyers",
   "Sony Concedes and Makes VHS"
  ],
  "reading": "Compare with Case 11 (Microsoft and IBM)",
  "wiki": "Videotape format war",
  "added": true
 },
 {
  "id": "c130",
  "n": 140,
  "title": "Xerox PARC Invents the Future, for Others",
  "when": "1979",
  "yearSort": 1979,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Xerox researchers created the graphical interface, Ethernet and laser printing, but the company commercialised little of it; Apple and others did.",
  "episodes": [
   "Founding a Blue-Sky Lab in Palo Alto",
   "Inventing the Alto, Ethernet & Laser Printing",
   "Showing Apple the Interface",
   "Launching the Star: Too Expensive, Too Late"
  ],
  "reading": "Fumbling the Future by Douglas K. Smith and Robert C. Alexander",
  "wiki": "PARC (company)",
  "added": true
 },
 {
  "id": "c132",
  "n": 141,
  "title": "New Coke",
  "when": "1985",
  "yearSort": 1985,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "Coca-Cola replaced its formula after winning blind taste tests, then restored “Coca-Cola Classic” within months after a public backlash, brand loyalty is not taste.",
  "episodes": [
   "Losing Share to the Pepsi Challenge",
   "Winning the Taste Tests",
   "Replacing the 99-Year-Old Formula",
   "Bringing Back Coca-Cola Classic"
  ],
  "reading": "For God, Country, and Coca-Cola by Mark Pendergrast",
  "wiki": "New Coke",
  "added": true
 },
 {
  "id": "c133",
  "n": 142,
  "title": "Samsung’s “New Management” Declaration",
  "when": "1993",
  "yearSort": 1993,
  "era": "MODERN",
  "pillar": "LEADERSHIP",
  "summary": "Lee Kun-hee told executives in Frankfurt to change everything about how they worked, shifting Samsung from quantity to quality.",
  "episodes": [
   "The Frankfurt “Change Everything” Speech",
   "Burning Defective Phones in Public",
   "Betting on Memory Chips & Displays",
   "Becoming a Global Design Brand"
  ],
  "reading": "Compare with Case 117 (Nadella)",
  "wiki": "Lee Kun-hee",
  "added": true
 },
 {
  "id": "c134",
  "n": 143,
  "title": "Grameenphone’s Village Phone Ladies",
  "when": "1997",
  "yearSort": 1997,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "Put shared mobile phones in Bangladeshi villages through microcredit-funded entrepreneurs, reaching customers no conventional network targeted.",
  "episodes": [
   "Winning a Mobile Licence with Telenor",
   "Village Phones Financed by Microcredit",
   "Driving Down Call Rates",
   "Becoming Bangladesh’s Largest Operator"
  ],
  "reading": "You Can Hear Me Now by Nicholas P. Sullivan",
  "wiki": "Grameenphone",
  "added": true
 },
 {
  "id": "c135",
  "n": 144,
  "title": "The First Browser War",
  "when": "1995–2001",
  "yearSort": 1995,
  "era": "MODERN",
  "pillar": "STRATEGY",
  "summary": "Microsoft bundled Internet Explorer with Windows to overtake Netscape, then faced an antitrust case over the tactic.",
  "episodes": [
   "Netscape’s Browser and IPO",
   "Microsoft Bundles Internet Explorer",
   "Netscape Open-Sources Its Code",
   "United States v. Microsoft"
  ],
  "reading": "Competing on Internet Time by Michael Cusumano and David Yoffie",
  "wiki": "Browser wars",
  "added": true
 },
 {
  "id": "c136",
  "n": 145,
  "title": "Blockbuster Declines to Buy Netflix",
  "when": "2000",
  "yearSort": 2000,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Netflix’s founders reportedly offered the company to Blockbuster for $50 million; Blockbuster declined and filed for bankruptcy a decade later.",
  "episodes": [
   "Late Fees as a Profit Engine",
   "Declining to Buy Netflix",
   "Going Online and Dropping Late Fees",
   "Bankruptcy"
  ],
  "reading": "That Will Never Work by Marc Randolph",
  "wiki": "Blockbuster (retailer)",
  "added": true
 },
 {
  "id": "c138",
  "n": 146,
  "title": "M-Pesa Mobile Money",
  "when": "2007",
  "yearSort": 2007,
  "era": "MODERN",
  "pillar": "BRAND",
  "summary": "Safaricom let Kenyans send money by text message through a network of shop agents, bringing banking to millions without bank accounts.",
  "episodes": [
   "A Microfinance Repayment Pilot",
   "Pivoting to Person-to-Person Transfers",
   "Building an Agent Network in Shops",
   "Becoming Kenya’s Payment Backbone"
  ],
  "reading": "Compare with bKash (next case)",
  "wiki": "M-Pesa",
  "added": true
 },
 {
  "id": "c139",
  "n": 147,
  "title": "Tata Nano: The One-Lakh Car",
  "when": "2008",
  "yearSort": 2008,
  "era": "MODERN",
  "pillar": "TURNAROUND",
  "summary": "Tata built the world’s cheapest car, but marketing it as “cheapest” hurt its appeal to aspirational buyers.",
  "episodes": [
   "Promising a One-Lakh Car",
   "Moving the Factory from Singur to Sanand",
   "Marketing It as the Cheapest Car",
   "Ending Production"
  ],
  "reading": "Compare with Case 7 (General Motors)",
  "wiki": "Tata Nano",
  "added": true
 },
 {
  "id": "c140",
  "n": 148,
  "title": "bKash Builds Mobile Finance in Bangladesh",
  "when": "2011",
  "yearSort": 2011,
  "era": "MODERN",
  "pillar": "OPERATIONS",
  "summary": "A BRAC Bank subsidiary used agents and simple USSD menus to bring mobile money to tens of millions of Bangladeshis.",
  "episodes": [
   "Launching as a BRAC Bank Subsidiary",
   "Recruiting Shop Agents Nationwide",
   "Menus That Work on Basic Phones",
   "Salaries, Bills and a Smartphone App"
  ],
  "reading": "Compare with M-Pesa",
  "wiki": "BKash",
  "added": true
 },
 {
  "id": "c141",
  "n": 149,
  "title": "Reliance Jio’s Free-Data Launch",
  "when": "2016",
  "yearSort": 2016,
  "era": "CONTEMPORARY",
  "pillar": "STRATEGY",
  "summary": "Launched with free voice and months of free 4G data, signing up tens of millions quickly and forcing a wave of consolidation among Indian telecoms.",
  "episodes": [
   "Building a 4G-Only Network",
   "Free Voice and Data at Launch",
   "The Price War and Consolidation",
   "Selling Platform Stakes to Global Investors"
  ],
  "reading": "Compare with Case 54 (PayPal)",
  "wiki": "Jio",
  "added": true
 },
 {
  "id": "c142",
  "n": 150,
  "title": "Boeing 737 MAX Groundings",
  "when": "2019",
  "yearSort": 2019,
  "era": "CONTEMPORARY",
  "pillar": "TURNAROUND",
  "summary": "Two fatal crashes linked to a flight-control system grounded the fleet worldwide and exposed engineering and oversight failures.",
  "episodes": [
   "Re-Engining the 737 Instead of a New Plane",
   "MCAS and Minimal Pilot Training",
   "Two Crashes and a Worldwide Grounding",
   "Rebuilding Trust with Regulators"
  ],
  "reading": "Flying Blind by Peter Robison",
  "wiki": "Boeing 737 MAX groundings",
  "added": true
 }
];

CATALOGUE.push(...EXPANSION);

// Every season is built in: the 10 hand-written ones keep their own ids, the rest
// are compiled from shared/seasons as `season-<catalogue id>`.
for (const e of CATALOGUE) if (!e.caseId) e.caseId = `season-${e.id}`;

export const CATALOGUE_BY_ID = Object.fromEntries(CATALOGUE.map((c) => [c.id, c]));

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
