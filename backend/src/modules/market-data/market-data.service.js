
const TEST_STOCKS = {
  // Energy and Conglomerates
  RELIANCE: {
    symbol: 'RELIANCE',
    companyName: 'Reliance Industries',
    exchange: 'NSE',
    pricePaise: 118200, // ₹1,182.00
  },
  ONGC: {
    symbol: 'ONGC',
    companyName: 'Oil and Natural Gas Corporation',
    exchange: 'NSE',
    pricePaise: 24500, // ₹245.00
  },
  NTPC: {
    symbol: 'NTPC',
    companyName: 'NTPC Limited',
    exchange: 'NSE',
    pricePaise: 33500, // ₹335.00
  },
  POWERGRID: {
    symbol: 'POWERGRID',
    companyName: 'Power Grid Corporation of India',
    exchange: 'NSE',
    pricePaise: 30500, // ₹305.00
  },

  // Information Technology
  TCS: {
    symbol: 'TCS',
    companyName: 'Tata Consultancy Services',
    exchange: 'NSE',
    pricePaise: 203240, // ₹2,032.40
  },
  INFY: {
    symbol: 'INFY',
    companyName: 'Infosys',
    exchange: 'NSE',
    pricePaise: 101540, // ₹1,015.40
  },
  HCLTECH: {
    symbol: 'HCLTECH',
    companyName: 'HCL Technologies',
    exchange: 'NSE',
    pricePaise: 165000, // ₹1,650.00
  },
  WIPRO: {
    symbol: 'WIPRO',
    companyName: 'Wipro Limited',
    exchange: 'NSE',
    pricePaise: 25000, // ₹250.00
  },

  // Banking and Financial Services
  HDFCBANK: {
    symbol: 'HDFCBANK',
    companyName: 'HDFC Bank',
    exchange: 'NSE',
    pricePaise: 72270, // ₹722.70
  },
  ICICIBANK: {
    symbol: 'ICICIBANK',
    companyName: 'ICICI Bank',
    exchange: 'NSE',
    pricePaise: 125000, // ₹1,250.00
  },
  SBIN: {
    symbol: 'SBIN',
    companyName: 'State Bank of India',
    exchange: 'NSE',
    pricePaise: 82000, // ₹820.00
  },
  KOTAKBANK: {
    symbol: 'KOTAKBANK',
    companyName: 'Kotak Mahindra Bank',
    exchange: 'NSE',
    pricePaise: 205000, // ₹2,050.00
  },

  // Automobiles
  TATAMOTORS: {
    symbol: 'TATAMOTORS',
    companyName: 'Tata Motors',
    exchange: 'NSE',
    pricePaise: 70000, // ₹700.00
  },
  MARUTI: {
    symbol: 'MARUTI',
    companyName: 'Maruti Suzuki India',
    exchange: 'NSE',
    pricePaise: 1250000, // ₹12,500.00
  },
  'M&M': {
    symbol: 'M&M',
    companyName: 'Mahindra & Mahindra',
    exchange: 'NSE',
    pricePaise: 320000, // ₹3,200.00
  },

  // FMCG
  ITC: {
    symbol: 'ITC',
    companyName: 'ITC Limited',
    exchange: 'NSE',
    pricePaise: 26035, // ₹260.35
  },
  HINDUNILVR: {
    symbol: 'HINDUNILVR',
    companyName: 'Hindustan Unilever',
    exchange: 'NSE',
    pricePaise: 250000, // ₹2,500.00
  },
  TATACONSUM: {
    symbol: 'TATACONSUM',
    companyName: 'Tata Consumer Products',
    exchange: 'NSE',
    pricePaise: 110000, // ₹1,100.00
  },

  // Telecom
  BHARTIARTL: {
    symbol: 'BHARTIARTL',
    companyName: 'Bharti Airtel',
    exchange: 'NSE',
    pricePaise: 195000, // ₹1,950.00
  },

  // Pharmaceuticals
  SUNPHARMA: {
    symbol: 'SUNPHARMA',
    companyName: 'Sun Pharmaceutical Industries',
    exchange: 'NSE',
    pricePaise: 175000, // ₹1,750.00
  },
  DRREDDY: {
    symbol: 'DRREDDY',
    companyName: "Dr. Reddy's Laboratories",
    exchange: 'NSE',
    pricePaise: 1250000, // ₹12,500.00
  },
};



export const getStockQuote = async (symbol) => {
  const normalizedSymbol = symbol.trim().toUpperCase();

  const stock = TEST_STOCKS[normalizedSymbol];

  if (!stock) {
    return null;
  }

  return {
    ...stock,
    currency: 'INR',
    priceSource: 'TEST_DATA',
  };
};

export const getAvailableStocks = async () => {
  return Object.values(TEST_STOCKS).map((stock) => ({
    ...stock,
    currency: 'INR',
    priceSource: 'TEST_DATA',
  }));
};
