// SimulationEngine.js - Complete simulation engine faithful to the paper
// "Coordination Through Stochastic Channels"

import Decimal from 'decimal.js';

// Configure decimal.js for high precision
Decimal.set({
  precision: 50,
  rounding: 4,
  toExpNeg: -30,
  toExpPos: 30,
  maxE: 9e15,
  minE: -9e15,
  modulo: 1,
  crypto: false
});

// Helper function to convert to Decimal safely
function toDecimal(value) {
  if (value instanceof Decimal) return value;
  if (typeof value === 'number' || typeof value === 'string') {
    return new Decimal(value);
  }
  return new Decimal(0);
}

// Helper function to generate random numbers using Decimal
function randomDecimal() {
  return new Decimal(Math.random());
}

// Helper function for powers with Decimal
function pow(base, exponent) {
  return toDecimal(base).pow(toDecimal(exponent));
}

// Helper function for absolute value
function abs(value) {
  return toDecimal(value).abs();
}

// Helper function for maximum
function max(...values) {
  return values.reduce((max, current) => {
    const decCurrent = toDecimal(current);
    return decCurrent.gt(max) ? decCurrent : max;
  }, toDecimal(values[0] || 0));
}

// Helper function for minimum
function min(...values) {
  return values.reduce((min, current) => {
    const decCurrent = toDecimal(current);
    return decCurrent.lt(min) ? decCurrent : min;
  }, toDecimal(values[0] || Infinity));
}

// Theta value for 3 players (approximately 0.35)
const THETA = 0.346;

// Simulation engine
export const SimulationEngine = {
  // Simulate one round of message exchange - CORRECT IMPLEMENTATION
  simulateRound: function(values, p, algorithm = "auto", meetingPoint = 0.5) {
    const processCount = values.length;
    const newValues = [...values];
    const messages = [];
    const messageDelivery = {};
    const decP = toDecimal(p);
    const decMeetingPoint = toDecimal(meetingPoint);
    
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    // Generate message delivery matrix
    for (let i = 0; i < processCount; i++) {
      for (let j = 0; j < processCount; j++) {
        if (i !== j) {
          const delivered = randomDecimal().lt(decP);
          const key = `from${j}to${i}`;
          messageDelivery[key] = delivered;
          messages.push({
            from: j,
            to: i,
            fromName: j < 3 ? ["Alice", "Bob", "Charlie"][j] : `P${j+1}`,
            toName: i < 3 ? ["Alice", "Bob", "Charlie"][i] : `P${i+1}`,
            delivered: delivered,
            value: values[j]
          });
        }
      }
    }
    
    // Process messages for each process
    for (let i = 0; i < processCount; i++) {
      const receivedValues = [];
      
      // Collect ALL received values (including duplicates)
      for (let j = 0; j < processCount; j++) {
        if (i !== j && messageDelivery[`from${j}to${i}`]) {
          receivedValues.push(values[j]);
        }
      }
      
      // Apply algorithm based on process count
      if (processCount === 2) {
        // Simple 2-player rules
        const receivedDifferentValue = receivedValues.find(val => val !== values[i]);
        
        if (receivedDifferentValue !== undefined) {
          if (algorithm === "AMP") {
            newValues[i] = decMeetingPoint.toNumber();
          } else { // FV
            newValues[i] = receivedDifferentValue;
          }
        }
      } else if (processCount === 3) {
        // 3-player specific rules from the paper
        const myValue = values[i];
        const notMyValue = myValue === 0 ? 1 : 0;
        
        // Count how many times we received ¬x (the opposite value)
        const countNotMyValue = receivedValues.filter(v => v === notMyValue).length;
        
        if (decP.gte(0.5)) {
          // p >= 1/2: use AMP with meeting point at 1/2
          // If received ¬x (once or twice), output 1/2, otherwise output x
          if (countNotMyValue >= 1) {
            newValues[i] = 0.5;
          } else {
            newValues[i] = myValue;
          }
        } else if (decP.gte(THETA)) {
          // θ <= p < 1/2
          // If received ¬x twice, output ¬x; if received ¬x once, output 1/2; otherwise output x
          if (countNotMyValue >= 2) {
            newValues[i] = notMyValue;
          } else if (countNotMyValue === 1) {
            newValues[i] = 0.5;
          } else {
            newValues[i] = myValue;
          }
        } else {
          // p < θ
          // If received x (once or twice) or received nothing, output x; 
          // otherwise (received no x and at least one ¬x), output ¬x
          const countMyValue = receivedValues.filter(v => v === myValue).length;
          
          if (countMyValue >= 1 || receivedValues.length === 0) {
            newValues[i] = myValue;
          } else {
            // Received no x and at least one ¬x
            newValues[i] = notMyValue;
          }
        }
      } else {
        // For n > 3, use generalized rules
        // The paper shows that as n → ∞, optimal meeting point is 1/2
        if (algorithm === "AMP") {
          // For AMP with n > 3, use meeting point 1/2 if we receive any different value
          const receivedDifferentValue = receivedValues.find(val => val !== values[i]);
          if (receivedDifferentValue !== undefined) {
            newValues[i] = 0.5;
          } else {
            newValues[i] = values[i];
          }
        } else {
          // For FV with n > 3, adopt the first different value received
          const receivedDifferentValue = receivedValues.find(val => val !== values[i]);
          if (receivedDifferentValue !== undefined) {
            newValues[i] = receivedDifferentValue;
          } else {
            newValues[i] = values[i];
          }
        }
      }
    }
    
    // Calculate maximum discrepancy
    let maxDiscrepancy = new Decimal(0);
    for (let i = 0; i < processCount; i++) {
      for (let j = i+1; j < processCount; j++) {
        const discrepancy = abs(toDecimal(newValues[i]).minus(toDecimal(newValues[j])));
        if (discrepancy.gt(maxDiscrepancy)) {
          maxDiscrepancy = discrepancy;
        }
      }
    }
    
    return {
      newValues,
      messages,
      messageDelivery,
      discrepancy: maxDiscrepancy.toNumber()
    };
  },

  // Run a complete experiment
  runExperiment: function(initialValues, p, rounds, algorithm = "auto", meetingPoint = 0.5) {
    let values = [...initialValues];
    const processCount = values.length;
    const processNames = [];
    
    // Generate process names
    for (let i = 0; i < processCount; i++) {
      if (i < 3) {
        processNames.push(["Alice", "Bob", "Charlie"][i]);
      } else {
        processNames.push(`Process${i+1}`);
      }
    }
    
    // Calculate initial discrepancy
    let initialDiscrepancy = new Decimal(0);
    for (let i = 0; i < processCount; i++) {
      for (let j = i+1; j < processCount; j++) {
        const discrepancy = abs(toDecimal(values[i]).minus(toDecimal(values[j])));
        if (discrepancy.gt(initialDiscrepancy)) {
          initialDiscrepancy = discrepancy;
        }
      }
    }
    
    // Simulation history
    const history = [{
      round: 0,
      values: [...values],
      processValues: values.reduce((obj, val, idx) => {
        obj[processNames[idx].toLowerCase()] = val;
        return obj;
      }, {}),
      discrepancy: initialDiscrepancy.toNumber(),
      messages: []
    }];
    
    // Execute rounds
    for (let r = 1; r <= rounds; r++) {
      const result = SimulationEngine.simulateRound(values, p, algorithm, meetingPoint);
      values = result.newValues;
      
      // Record results for this round
      history.push({
        round: r,
        values: [...values],
        processValues: values.reduce((obj, val, idx) => {
          obj[processNames[idx].toLowerCase()] = val;
          return obj;
        }, {}),
        discrepancy: result.discrepancy,
        messageDelivery: result.messageDelivery,
        messages: result.messages
      });
    }
    
    return history;
  },

  // Run multiple experiments for statistical analysis
  runMultipleExperiments: function(initialValues, p, rounds, repetitions, algorithm = "auto", meetingPoint = 0.5) {
    const allDiscrepancies = [];
    const allRuns = [];
    const processCount = initialValues.length;
    const decP = toDecimal(p);
    
    // Determine actual algorithm if auto
    const actualAlgorithm = algorithm === "auto" ? (decP.gt(0.5) ? "AMP" : "FV") : algorithm;
    
    // For n > 2, always use meeting point 0.5 for AMP
    const actualMeetingPoint = processCount > 2 ? 0.5 : meetingPoint;
    
    // Run multiple simulations
    for (let i = 0; i < repetitions; i++) {
      const history = SimulationEngine.runExperiment(
        initialValues, 
        p, 
        rounds, 
        algorithm, 
        actualMeetingPoint
      );
      
      const finalDiscrepancy = history[history.length - 1].discrepancy;
      allDiscrepancies.push(finalDiscrepancy);
      allRuns.push(history);
    }
    
    // Calculate statistics using Decimal
    const decDiscrepancies = allDiscrepancies.map(d => toDecimal(d));
    const mean = decDiscrepancies.reduce((sum, d) => sum.plus(d), new Decimal(0)).div(decDiscrepancies.length);
    
    const sorted = [...decDiscrepancies].sort((a, b) => a.minus(b).toNumber());
    const median = sorted.length % 2 === 0 ?
      sorted[sorted.length / 2 - 1].plus(sorted[sorted.length / 2]).div(2) : 
      sorted[Math.floor(sorted.length / 2)];
    
    const minVal = min(...decDiscrepancies);
    const maxVal = max(...decDiscrepancies);
    
    const variance = decDiscrepancies.reduce((sum, d) => sum.plus(pow(d.minus(mean), 2)), new Decimal(0)).div(decDiscrepancies.length);
    const std = variance.sqrt();
    
    // Calculate theoretical discrepancy
    let theoretical = null;
    
    // Count number of processes with value 0
    let m = 0;
    initialValues.forEach(val => {
      if (val === 0) m++;
    });
    
    if (processCount === 2) {
      theoretical = this.calculateExpectedDiscrepancyMultiRound(p, rounds, actualAlgorithm);
    } else if (processCount === 3) {
      theoretical = this.calculateExpectedDiscrepancy3Players(p, initialValues);
      if (rounds > 1) {
        // Apply reduction factor for multiple rounds
        const reductionFactor = this.getReductionFactor3Players(p);
        theoretical = theoretical * Math.pow(reductionFactor, rounds - 1);
      }
    } else {
      // For n > 3, use n-process formulas with limitations
      theoretical = this.calculateExpectedDiscrepancyNProcesses(
        p, processCount, m, actualAlgorithm, actualMeetingPoint
      );
      
      if (rounds > 1) {
        const q = toDecimal(1).minus(decP);
        const reductionFactor = actualAlgorithm === "AMP" ? 
          q.toNumber() : 
          (pow(decP, 2).plus(pow(q, 2))).toNumber();
        theoretical = theoretical * Math.pow(reductionFactor, rounds - 1);
      }
    }
    
    return {
      mean: mean.toNumber(),
      median: median.toNumber(),
      min: minVal.toNumber(),
      max: maxVal.toNumber(),
      std: std.toNumber(),
      allValues: allDiscrepancies,
      theoretical,
      algorithm: actualAlgorithm,
      processCount,
      allRuns,
      n: processCount,
      m: m
    };
  },

  // Calculate expected discrepancy for 2 processes
  calculateExpectedDiscrepancy: function(p, algorithm = "auto", rounds = 1) {
    const decP = toDecimal(p);
    
    if (rounds === 1) {
      if (algorithm === "auto") {
        algorithm = decP.gt(0.5) ? "AMP" : "FV";
      }
      
      const q = toDecimal(1).minus(decP);
      const result = algorithm === "AMP" ? q : (pow(decP, 2).plus(pow(q, 2)));
      return result.toNumber();
    } else {
      return this.calculateExpectedDiscrepancyMultiRound(p, rounds, algorithm);
    }
  },
  
  // Calculate expected discrepancy for multiple rounds (2 processes)
  calculateExpectedDiscrepancyMultiRound: function(p, rounds, algorithm = "auto") {
    const decP = toDecimal(p);
    
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    const q = toDecimal(1).minus(decP);
    
    if (algorithm === "AMP") {
      return pow(q, rounds).toNumber();
    } else {
      const pSquaredPlusQSquared = pow(decP, 2).plus(pow(q, 2));
      return pow(pSquaredPlusQSquared, rounds).toNumber();
    }
  },

  // Calculate expected discrepancy for 3 players according to paper
  calculateExpectedDiscrepancy3Players: function(p, initialValues) {
    const decP = toDecimal(p);
    const q = toDecimal(1).minus(decP);
    
    // Determine input type
    const zeros = initialValues.filter(v => v === 0).length;
    const ones = initialValues.filter(v => v === 1).length;
    
    // For 3 players, the paper gives specific formulas
    // From Theorem 13 in the paper
    
    if (decP.gte(0.5)) {
      // For p >= 1/2, expected discrepancy is q
      return q.toNumber();
    } else if (decP.gte(THETA)) {
      // For θ <= p < 1/2
      // E[D] = 1/2 * (2pq² + p³ + pq(1-q²) + p²q²) + q²(1-p²)
      const term1 = toDecimal(2).mul(decP).mul(pow(q, 2));
      const term2 = pow(decP, 3);
      const term3 = decP.mul(q).mul(toDecimal(1).minus(pow(q, 2)));
      const term4 = pow(decP, 2).mul(pow(q, 2));
      const term5 = pow(q, 2).mul(toDecimal(1).minus(pow(decP, 2)));
      
      return toDecimal(0.5).mul(term1.plus(term2).plus(term3).plus(term4)).plus(term5).toNumber();
    } else {
      // For p < θ
      // E[D] = p(1-p²) + q²(1-pq)
      const term1 = decP.mul(toDecimal(1).minus(pow(decP, 2)));
      const term2 = pow(q, 2).mul(toDecimal(1).minus(decP.mul(q)));
      
      return term1.plus(term2).toNumber();
    }
  },

  // Get reduction factor for 3 players
  getReductionFactor3Players: function(p) {
    const decP = toDecimal(p);
    const q = toDecimal(1).minus(decP);
    
    if (decP.gte(0.5)) {
      return q.toNumber();
    } else if (decP.gte(THETA)) {
      // For middle range, the reduction is more complex
      // Approximate based on the dominant terms
      return Math.max(q.toNumber(), (pow(decP, 2).plus(pow(q, 2))).toNumber());
    } else {
      // For p < θ, similar to FV
      return (pow(decP, 2).plus(pow(q, 2))).toNumber();
    }
  },

  // Calculate convergence rate
  calculateConvergenceRate: function(p, algorithm, rounds) {
    const decP = toDecimal(p);
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    const q = toDecimal(1).minus(decP);
    const rates = [];
    
    for (let r = 1; r <= rounds; r++) {
      let theoreticalDiscrepancy, previousDiscrepancy;
      
      if (algorithm === "AMP") {
        theoreticalDiscrepancy = pow(q, r);
        previousDiscrepancy = pow(q, r-1);
      } else {
        const pSquaredPlusQSquared = pow(decP, 2).plus(pow(q, 2));
        theoreticalDiscrepancy = pow(pSquaredPlusQSquared, r);
        previousDiscrepancy = pow(pSquaredPlusQSquared, r-1);
      }
      
      const convergenceRate = previousDiscrepancy.gt(0) ? 
        toDecimal(1).minus(theoreticalDiscrepancy.div(previousDiscrepancy)) : new Decimal(0);
      
      rates.push({
        round: r,
        discrepancy: theoreticalDiscrepancy.toNumber(),
        convergenceRate: convergenceRate.toNumber(),
        reductionFactor: previousDiscrepancy.gt(0) ? 
          theoreticalDiscrepancy.div(previousDiscrepancy).toNumber() : 0
      });
    }
    
    return {
      probability: p,
      algorithm,
      theoreticalFactor: algorithm === "AMP" ? q.toNumber() : (pow(decP, 2).plus(pow(q, 2))).toNumber(),
      convergenceRates: rates
    };
  },

  // Calculate expected discrepancy for n processes (with limitations for n > 3)
  calculateExpectedDiscrepancyNProcesses: function(p, n, m, algorithm = "auto", meetingPoint = 0.5) {
    const decP = toDecimal(p);
    const q = toDecimal(1).minus(decP);
    
    if (algorithm === "auto") {
      algorithm = decP.gt(0.5) ? "AMP" : "FV";
    }
    
    // For n > 3, always use meeting point 0.5 for AMP
    const a = n > 3 ? toDecimal(0.5) : toDecimal(meetingPoint);
    
    // For large n, the paper shows discrepancy → 0 as n → ∞
    // For practical purposes, we use the formulas but note they have limitations
    
    if (algorithm === "AMP") {
      // From paper: A = Pr[each 0 player received at least one 1 message]
      // A = (1 - q^(n-m))^m
      const A = pow(toDecimal(1).minus(pow(q, n-m)), m);
      
      // B = Pr[each 1 player received at least one 0 message]
      // B = (1 - q^m)^(n-m)
      const B = pow(toDecimal(1).minus(pow(q, m)), n-m);
      
      // E[D] = 1 - (aA + (1-a)B)
      // For n > 3, using a = 0.5 as optimal
      return toDecimal(1).minus(a.mul(A).plus(toDecimal(1).minus(a).mul(B))).toNumber();
    } else {
      // FV algorithm
      // From paper formulas
      const A = pow(toDecimal(1).minus(pow(q, n-m)), m);
      const B = pow(toDecimal(1).minus(pow(q, m)), n-m);
      
      // C = Pr[no 0 player received any 1 message AND no 1 player received any 0 message]
      // This is approximated as q^(m*(n-m))
      const C = pow(q, m*(n-m));
      
      // E[D] = 1 - C(A + B)
      // Note: This formula has limitations for n > 3
      return toDecimal(1).minus(C.mul(A.plus(B))).toNumber();
    }
  },

  // Run experiment with n processes
  runNProcessExperiment: function(initialValues, p, rounds, algorithm = "auto", meetingPoint = 0.5) {
    // For n > 2, always use meeting point 0.5 for AMP
    const actualMeetingPoint = initialValues.length > 2 ? 0.5 : meetingPoint;
    return this.runExperiment(initialValues, p, rounds, algorithm, actualMeetingPoint);
  },

  // Run multiple experiments with n processes
  runMultipleNProcessExperiments: function(initialValues, p, rounds, repetitions, algorithm = "auto", meetingPoint = 0.5) {
    // For n > 2, always use meeting point 0.5 for AMP
    const actualMeetingPoint = initialValues.length > 2 ? 0.5 : meetingPoint;
    return this.runMultipleExperiments(initialValues, p, rounds, repetitions, algorithm, actualMeetingPoint);
  }
};