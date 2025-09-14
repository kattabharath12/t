
// State Tax Rates for Popular US States (2024 Tax Year)
export interface StateTaxBracket {
  min: number
  max: number
  rate: number
}

export interface StateStandardDeduction {
  single: number
  marriedFilingJointly: number
  marriedFilingSeparately: number
  headOfHousehold: number
  qualifyingSurvivingSpouse?: number
}

export interface StateTaxInfo {
  stateName: string
  stateCode: string
  hasIncomeTax: boolean
  brackets: Record<string, StateTaxBracket[]>
  standardDeduction: StateStandardDeduction
  personalExemption?: number
  notes?: string
}

// 2024 State Tax Data for Popular US States
export const STATE_TAX_DATA: Record<string, StateTaxInfo> = {
  CA: {
    stateName: 'California',
    stateCode: 'CA',
    hasIncomeTax: true,
    brackets: {
      single: [
        { min: 0, max: 10099, rate: 0.01 },
        { min: 10100, max: 23942, rate: 0.02 },
        { min: 23943, max: 37788, rate: 0.04 },
        { min: 37789, max: 52455, rate: 0.06 },
        { min: 52456, max: 66295, rate: 0.08 },
        { min: 66296, max: 338639, rate: 0.093 },
        { min: 338640, max: 406364, rate: 0.103 },
        { min: 406365, max: 677278, rate: 0.113 },
        { min: 677279, max: Infinity, rate: 0.123 },
      ],
      marriedfilingjointly: [
        { min: 0, max: 20198, rate: 0.01 },
        { min: 20199, max: 47884, rate: 0.02 },
        { min: 47885, max: 75576, rate: 0.04 },
        { min: 75577, max: 104910, rate: 0.06 },
        { min: 104911, max: 132590, rate: 0.08 },
        { min: 132591, max: 677278, rate: 0.093 },
        { min: 677279, max: 812728, rate: 0.103 },
        { min: 812729, max: 1354556, rate: 0.113 },
        { min: 1354557, max: Infinity, rate: 0.123 },
      ],
      marriedfilingseparately: [
        { min: 0, max: 10099, rate: 0.01 },
        { min: 10100, max: 23942, rate: 0.02 },
        { min: 23943, max: 37788, rate: 0.04 },
        { min: 37789, max: 52455, rate: 0.06 },
        { min: 52456, max: 66295, rate: 0.08 },
        { min: 66296, max: 338639, rate: 0.093 },
        { min: 338640, max: 406364, rate: 0.103 },
        { min: 406365, max: 677278, rate: 0.113 },
        { min: 677279, max: Infinity, rate: 0.123 },
      ],
      headofhousehold: [
        { min: 0, max: 20212, rate: 0.01 },
        { min: 20213, max: 47887, rate: 0.02 },
        { min: 47888, max: 61214, rate: 0.04 },
        { min: 61215, max: 75768, rate: 0.06 },
        { min: 75769, max: 90563, rate: 0.08 },
        { min: 90564, max: 460547, rate: 0.093 },
        { min: 460548, max: 552658, rate: 0.103 },
        { min: 552659, max: 921095, rate: 0.113 },
        { min: 921096, max: Infinity, rate: 0.123 },
      ],
    },
    standardDeduction: {
      single: 5202,
      marriedFilingJointly: 10404,
      marriedFilingSeparately: 5202,
      headOfHousehold: 10404,
    },
  },

  NY: {
    stateName: 'New York',
    stateCode: 'NY',
    hasIncomeTax: true,
    brackets: {
      single: [
        { min: 0, max: 8500, rate: 0.04 },
        { min: 8501, max: 11700, rate: 0.045 },
        { min: 11701, max: 13900, rate: 0.0525 },
        { min: 13901, max: 80650, rate: 0.055 },
        { min: 80651, max: 215400, rate: 0.06 },
        { min: 215401, max: 1077550, rate: 0.0685 },
        { min: 1077551, max: 5000000, rate: 0.0965 },
        { min: 5000001, max: 25000000, rate: 0.103 },
        { min: 25000001, max: Infinity, rate: 0.109 },
      ],
      marriedfilingjointly: [
        { min: 0, max: 17150, rate: 0.04 },
        { min: 17151, max: 23600, rate: 0.045 },
        { min: 23601, max: 27900, rate: 0.0525 },
        { min: 27901, max: 161550, rate: 0.055 },
        { min: 161551, max: 323200, rate: 0.06 },
        { min: 323201, max: 2155350, rate: 0.0685 },
        { min: 2155351, max: 5000000, rate: 0.0965 },
        { min: 5000001, max: 25000000, rate: 0.103 },
        { min: 25000001, max: Infinity, rate: 0.109 },
      ],
      marriedfilingseparately: [
        { min: 0, max: 8500, rate: 0.04 },
        { min: 8501, max: 11700, rate: 0.045 },
        { min: 11701, max: 13900, rate: 0.0525 },
        { min: 13901, max: 80650, rate: 0.055 },
        { min: 80651, max: 215400, rate: 0.06 },
        { min: 215401, max: 1077550, rate: 0.0685 },
        { min: 1077551, max: 5000000, rate: 0.0965 },
        { min: 5000001, max: 25000000, rate: 0.103 },
        { min: 25000001, max: Infinity, rate: 0.109 },
      ],
      headofhousehold: [
        { min: 0, max: 12800, rate: 0.04 },
        { min: 12801, max: 17650, rate: 0.045 },
        { min: 17651, max: 20900, rate: 0.0525 },
        { min: 20901, max: 107650, rate: 0.055 },
        { min: 107651, max: 269300, rate: 0.06 },
        { min: 269301, max: 1616450, rate: 0.0685 },
        { min: 1616451, max: 5000000, rate: 0.0965 },
        { min: 5000001, max: 25000000, rate: 0.103 },
        { min: 25000001, max: Infinity, rate: 0.109 },
      ],
    },
    standardDeduction: {
      single: 8000,
      marriedFilingJointly: 16050,
      marriedFilingSeparately: 8000,
      headOfHousehold: 11200,
    },
  },

  TX: {
    stateName: 'Texas',
    stateCode: 'TX',
    hasIncomeTax: false,
    brackets: {},
    standardDeduction: {
      single: 0,
      marriedFilingJointly: 0,
      marriedFilingSeparately: 0,
      headOfHousehold: 0,
    },
    notes: 'Texas has no state income tax',
  },

  FL: {
    stateName: 'Florida',
    stateCode: 'FL',
    hasIncomeTax: false,
    brackets: {},
    standardDeduction: {
      single: 0,
      marriedFilingJointly: 0,
      marriedFilingSeparately: 0,
      headOfHousehold: 0,
    },
    notes: 'Florida has no state income tax',
  },

  IL: {
    stateName: 'Illinois',
    stateCode: 'IL',
    hasIncomeTax: true,
    brackets: {
      single: [
        { min: 0, max: Infinity, rate: 0.0495 }, // Flat tax rate
      ],
      marriedfilingjointly: [
        { min: 0, max: Infinity, rate: 0.0495 }, // Flat tax rate
      ],
      marriedfilingseparately: [
        { min: 0, max: Infinity, rate: 0.0495 }, // Flat tax rate
      ],
      headofhousehold: [
        { min: 0, max: Infinity, rate: 0.0495 }, // Flat tax rate
      ],
    },
    standardDeduction: {
      single: 2425,
      marriedFilingJointly: 4850,
      marriedFilingSeparately: 2425,
      headOfHousehold: 2425,
    },
    personalExemption: 2775,
  },

  PA: {
    stateName: 'Pennsylvania',
    stateCode: 'PA',
    hasIncomeTax: true,
    brackets: {
      single: [
        { min: 0, max: Infinity, rate: 0.0307 }, // Flat tax rate
      ],
      marriedfilingjointly: [
        { min: 0, max: Infinity, rate: 0.0307 }, // Flat tax rate
      ],
      marriedfilingseparately: [
        { min: 0, max: Infinity, rate: 0.0307 }, // Flat tax rate
      ],
      headofhousehold: [
        { min: 0, max: Infinity, rate: 0.0307 }, // Flat tax rate
      ],
    },
    standardDeduction: {
      single: 0, // No standard deduction
      marriedFilingJointly: 0,
      marriedFilingSeparately: 0,
      headOfHousehold: 0,
    },
  },

  OH: {
    stateName: 'Ohio',
    stateCode: 'OH',
    hasIncomeTax: true,
    brackets: {
      single: [
        { min: 0, max: 26050, rate: 0.0 },
        { min: 26051, max: 46100, rate: 0.0285 },
        { min: 46101, max: 92150, rate: 0.0333 },
        { min: 92151, max: 115300, rate: 0.0380 },
        { min: 115301, max: Infinity, rate: 0.0399 },
      ],
      marriedfilingjointly: [
        { min: 0, max: 26050, rate: 0.0 },
        { min: 26051, max: 46100, rate: 0.0285 },
        { min: 46101, max: 92150, rate: 0.0333 },
        { min: 92151, max: 115300, rate: 0.0380 },
        { min: 115301, max: Infinity, rate: 0.0399 },
      ],
      marriedfilingseparately: [
        { min: 0, max: 26050, rate: 0.0 },
        { min: 26051, max: 46100, rate: 0.0285 },
        { min: 46101, max: 92150, rate: 0.0333 },
        { min: 92151, max: 115300, rate: 0.0380 },
        { min: 115301, max: Infinity, rate: 0.0399 },
      ],
      headofhousehold: [
        { min: 0, max: 26050, rate: 0.0 },
        { min: 26051, max: 46100, rate: 0.0285 },
        { min: 46101, max: 92150, rate: 0.0333 },
        { min: 92151, max: 115300, rate: 0.0380 },
        { min: 115301, max: Infinity, rate: 0.0399 },
      ],
    },
    standardDeduction: {
      single: 0, // Ohio does not have a standard deduction
      marriedFilingJointly: 0,
      marriedFilingSeparately: 0,
      headOfHousehold: 0,
    },
  },

  GA: {
    stateName: 'Georgia',
    stateCode: 'GA',
    hasIncomeTax: true,
    brackets: {
      single: [
        { min: 0, max: 750, rate: 0.01 },
        { min: 751, max: 2250, rate: 0.02 },
        { min: 2251, max: 3750, rate: 0.03 },
        { min: 3751, max: 5250, rate: 0.04 },
        { min: 5251, max: 7000, rate: 0.05 },
        { min: 7001, max: Infinity, rate: 0.0575 },
      ],
      marriedfilingjointly: [
        { min: 0, max: 1000, rate: 0.01 },
        { min: 1001, max: 3000, rate: 0.02 },
        { min: 3001, max: 5000, rate: 0.03 },
        { min: 5001, max: 7000, rate: 0.04 },
        { min: 7001, max: 10000, rate: 0.05 },
        { min: 10001, max: Infinity, rate: 0.0575 },
      ],
      marriedfilingseparately: [
        { min: 0, max: 500, rate: 0.01 },
        { min: 501, max: 1500, rate: 0.02 },
        { min: 1501, max: 2500, rate: 0.03 },
        { min: 2501, max: 3500, rate: 0.04 },
        { min: 3501, max: 5000, rate: 0.05 },
        { min: 5001, max: Infinity, rate: 0.0575 },
      ],
      headofhousehold: [
        { min: 0, max: 1000, rate: 0.01 },
        { min: 1001, max: 3000, rate: 0.02 },
        { min: 3001, max: 5000, rate: 0.03 },
        { min: 5001, max: 7000, rate: 0.04 },
        { min: 7001, max: 10000, rate: 0.05 },
        { min: 10001, max: Infinity, rate: 0.0575 },
      ],
    },
    standardDeduction: {
      single: 12000,
      marriedFilingJointly: 24000,
      marriedFilingSeparately: 12000,
      headOfHousehold: 18000,
    },
    personalExemption: 2700,
  },

  NC: {
    stateName: 'North Carolina',
    stateCode: 'NC',
    hasIncomeTax: true,
    brackets: {
      single: [
        { min: 0, max: Infinity, rate: 0.0475 }, // Flat tax rate
      ],
      marriedfilingjointly: [
        { min: 0, max: Infinity, rate: 0.0475 }, // Flat tax rate
      ],
      marriedfilingseparately: [
        { min: 0, max: Infinity, rate: 0.0475 }, // Flat tax rate
      ],
      headofhousehold: [
        { min: 0, max: Infinity, rate: 0.0475 }, // Flat tax rate
      ],
    },
    standardDeduction: {
      single: 12750,
      marriedFilingJointly: 25500,
      marriedFilingSeparately: 12750,
      headOfHousehold: 19125,
    },
  },

  MI: {
    stateName: 'Michigan',
    stateCode: 'MI',
    hasIncomeTax: true,
    brackets: {
      single: [
        { min: 0, max: Infinity, rate: 0.0425 }, // Flat tax rate
      ],
      marriedfilingjointly: [
        { min: 0, max: Infinity, rate: 0.0425 }, // Flat tax rate
      ],
      marriedfilingseparately: [
        { min: 0, max: Infinity, rate: 0.0425 }, // Flat tax rate
      ],
      headofhousehold: [
        { min: 0, max: Infinity, rate: 0.0425 }, // Flat tax rate
      ],
    },
    standardDeduction: {
      single: 5100,
      marriedFilingJointly: 10200,
      marriedFilingSeparately: 5100,
      headOfHousehold: 5100,
    },
    personalExemption: 5100,
  },

  // No state income tax states
  WA: {
    stateName: 'Washington',
    stateCode: 'WA',
    hasIncomeTax: false,
    brackets: {},
    standardDeduction: {
      single: 0,
      marriedFilingJointly: 0,
      marriedFilingSeparately: 0,
      headOfHousehold: 0,
    },
    notes: 'Washington has no state income tax',
  },

  NV: {
    stateName: 'Nevada',
    stateCode: 'NV',
    hasIncomeTax: false,
    brackets: {},
    standardDeduction: {
      single: 0,
      marriedFilingJointly: 0,
      marriedFilingSeparately: 0,
      headOfHousehold: 0,
    },
    notes: 'Nevada has no state income tax',
  },

  SD: {
    stateName: 'South Dakota',
    stateCode: 'SD',
    hasIncomeTax: false,
    brackets: {},
    standardDeduction: {
      single: 0,
      marriedFilingJointly: 0,
      marriedFilingSeparately: 0,
      headOfHousehold: 0,
    },
    notes: 'South Dakota has no state income tax',
  },

  TN: {
    stateName: 'Tennessee',
    stateCode: 'TN',
    hasIncomeTax: false,
    brackets: {},
    standardDeduction: {
      single: 0,
      marriedFilingJointly: 0,
      marriedFilingSeparately: 0,
      headOfHousehold: 0,
    },
    notes: 'Tennessee has no state income tax (as of 2021)',
  },

  WY: {
    stateName: 'Wyoming',
    stateCode: 'WY',
    hasIncomeTax: false,
    brackets: {},
    standardDeduction: {
      single: 0,
      marriedFilingJointly: 0,
      marriedFilingSeparately: 0,
      headOfHousehold: 0,
    },
    notes: 'Wyoming has no state income tax',
  },

  UT: {
    stateName: 'Utah',
    stateCode: 'UT',
    hasIncomeTax: true,
    brackets: {
      single: [
        { min: 0, max: Infinity, rate: 0.0485 }, // Flat tax rate (4.85%)
      ],
      marriedfilingjointly: [
        { min: 0, max: Infinity, rate: 0.0485 }, // Flat tax rate (4.85%)
      ],
      marriedfilingseparately: [
        { min: 0, max: Infinity, rate: 0.0485 }, // Flat tax rate (4.85%)
      ],
      headofhousehold: [
        { min: 0, max: Infinity, rate: 0.0485 }, // Flat tax rate (4.85%)
      ],
    },
    standardDeduction: {
      single: 3100,           // Utah specific standard deduction
      marriedFilingJointly: 6200,
      marriedFilingSeparately: 3100,
      headOfHousehold: 4550,  // Estimated based on Utah tax structure
    },
    personalExemption: 1941, // Per dependent
    notes: 'Utah has a flat 4.85% income tax rate with state-specific standard deductions',
  },

  AZ: {
    stateName: 'Arizona',
    stateCode: 'AZ',
    hasIncomeTax: true,
    brackets: {
      single: [
        { min: 0, max: 29200, rate: 0.0255 },      // 2.55%
        { min: 29201, max: 73400, rate: 0.0288 },  // 2.88%
        { min: 73401, max: 146800, rate: 0.0336 }, // 3.36%
        { min: 146801, max: 366200, rate: 0.0424 }, // 4.24%
        { min: 366201, max: Infinity, rate: 0.045 }, // 4.5%
      ],
      marriedfilingjointly: [
        { min: 0, max: 58400, rate: 0.0255 },       // 2.55%
        { min: 58401, max: 146800, rate: 0.0288 },  // 2.88%
        { min: 146801, max: 293600, rate: 0.0336 }, // 3.36%
        { min: 293601, max: 732400, rate: 0.0424 }, // 4.24%
        { min: 732401, max: Infinity, rate: 0.045 }, // 4.5%
      ],
      marriedfilingseparately: [
        { min: 0, max: 29200, rate: 0.0255 },      // 2.55%
        { min: 29201, max: 73400, rate: 0.0288 },  // 2.88%
        { min: 73401, max: 146800, rate: 0.0336 }, // 3.36%
        { min: 146801, max: 366200, rate: 0.0424 }, // 4.24%
        { min: 366201, max: Infinity, rate: 0.045 }, // 4.5%
      ],
      headofhousehold: [
        { min: 0, max: 43850, rate: 0.0255 },       // 2.55%
        { min: 43851, max: 110100, rate: 0.0288 },  // 2.88%
        { min: 110101, max: 220200, rate: 0.0336 }, // 3.36%
        { min: 220201, max: 549300, rate: 0.0424 }, // 4.24%
        { min: 549301, max: Infinity, rate: 0.045 }, // 4.5%
      ],
    },
    standardDeduction: {
      single: 14600,           // Arizona standard deduction (2024)
      marriedFilingJointly: 29200,
      marriedFilingSeparately: 14600,
      headOfHousehold: 21900,
    },
    personalExemption: 2400,   // Per person/dependent
    notes: 'Arizona has progressive tax brackets ranging from 2.55% to 4.5%',
  },
}

// Helper function to get all states with income tax
export function getStatesWithIncomeTax(): StateTaxInfo[] {
  return Object.values(STATE_TAX_DATA).filter(state => state.hasIncomeTax)
}

// Helper function to get all states without income tax
export function getStatesWithoutIncomeTax(): StateTaxInfo[] {
  return Object.values(STATE_TAX_DATA).filter(state => !state.hasIncomeTax)
}

// Helper function to get state info by state code
export function getStateInfo(stateCode: string): StateTaxInfo | undefined {
  return STATE_TAX_DATA[stateCode?.toUpperCase()]
}

// Helper function to get list of all supported states
export function getAllSupportedStates(): Array<{ code: string; name: string; hasIncomeTax: boolean }> {
  return Object.entries(STATE_TAX_DATA).map(([code, info]) => ({
    code,
    name: info.stateName,
    hasIncomeTax: info.hasIncomeTax,
  })).sort((a, b) => a.name.localeCompare(b.name))
}
