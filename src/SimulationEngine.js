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
    simulateRound: function(values, p, algorithm = "auto", meetingPoint = 0.5, knownValuesSets = null, originalValues = null) {
  if (algorithm === "auto") {
    const decP = toDecimal(p);
    algorithm = decP.gt(0.5) ? "AMP" : "FV";
  }
  
  const decP = toDecimal(p);
  const processCount = values.length;
  const newValues = [...values];
  const messages = [];
  const messageDelivery = [];
  
  // Para algoritmo MIN: usar valores originales si se proporcionan
  const valuesToSend = algorithm === "MIN" && originalValues ? originalValues : values;
  
  // Simular envío de mensajes
  for (let i = 0; i < processCount; i++) {
    const senderMessages = [];
    const deliveryStatus = [];
    
    for (let j = 0; j < processCount; j++) {
      if (i !== j) {
        // Para MIN: siempre enviar el valor original, no el actual
        const messageValue = valuesToSend[i];
        const delivered = randomDecimal().lte(decP);
        
        senderMessages.push({
          to: j,
          value: messageValue,
          delivered
        });
        
        deliveryStatus.push(delivered);
      }
    }
    
    messages.push(senderMessages);
    messageDelivery.push(deliveryStatus);
  }
  
  // Procesar mensajes recibidos y actualizar valores
  let updatedKnownValuesSets = knownValuesSets ? 
    knownValuesSets.map(set => new Set(set)) : 
    null;
    

  for (let i = 0; i < processCount; i++) {
    const receivedMessages = [];
    
    // Recolectar mensajes recibidos
    for (let j = 0; j < processCount; j++) {
      if (i !== j && messages[j]) {
        const msgToI = messages[j].find(m => m.to === i);
        if (msgToI && msgToI.delivered) {
          receivedMessages.push(msgToI.value);
          
          // Para MIN: actualizar conjunto de valores conocidos
          if (algorithm === "MIN" && updatedKnownValuesSets) {
            updatedKnownValuesSets[i].add(msgToI.value);
          }
        }
      }
    }
    
    // Aplicar algoritmo correspondiente
    if (algorithm === "MIN") {
      // MIN no cambia valores durante las rondas, solo actualiza el conjunto
      newValues[i] = values[i];
    } else if (algorithm === "AMP") {
      // AMP: si recibe cualquier valor diferente, va al meeting point
      if (receivedMessages.length > 0) {
        const receivedDifferentValue = receivedMessages.find(val => val !== values[i]);
        if (receivedDifferentValue !== undefined) {
          const decMeetingPoint = toDecimal(meetingPoint);
          newValues[i] = decMeetingPoint.toNumber();
        }
      }
    } else if (algorithm === "FV") {
      // FV: adopta el primer valor diferente que recibe
      if (receivedMessages.length > 0) {
        // Buscar valores diferentes recibidos
        const differentValues = receivedMessages.filter(val => val !== values[i]);
        if (differentValues.length > 0) {
          // FV toma el primer valor diferente recibido
          newValues[i] = differentValues[0];
        }
        // Si solo recibe su propio valor, no cambia
      }
      // Si no recibe mensajes, mantiene su valor actual
    }
  }
  
  // Para MIN: devolver los conjuntos actualizados
  if (algorithm === "MIN") {
    return {
      newValues,
      messages,
      messageDelivery,
      discrepancy: 0, // Se calculará al final
      knownValuesSets: updatedKnownValuesSets
    };
  }
  
  // Calcular discrepancia para otros algoritmos
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
  
  // Para algoritmo MIN: mantener conjunto de valores conocidos y valores originales
  let knownValuesSets = null;
  const originalValues = [...initialValues];
  

  if (algorithm === "MIN") {
    // Validar que todos los valores sean positivos para MIN
    const hasNegativeValues = initialValues.some(v => v < 0);
    if (hasNegativeValues) {
      console.warn("MIN algorithm works best with non-negative values");
    }
    
    // Para MIN, el meeting point no se usa
    if (meetingPoint !== 0.5) {
      console.info("MIN algorithm ignores meeting point parameter");
    }
  }
  if (algorithm === "MIN") {
    // Inicializar conjuntos con el valor propio de cada proceso
    knownValuesSets = initialValues.map(val => new Set([val]));
  }
  
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
    messages: [],
    knownValuesSets: algorithm === "MIN" ? knownValuesSets.map(set => Array.from(set)) : null
  }];
  
  // Execute rounds
  for (let r = 1; r <= rounds; r++) {
    const result = SimulationEngine.simulateRound(
      values, 
      p, 
      algorithm, 
      meetingPoint,
      knownValuesSets,
      originalValues // Para MIN: pasar valores originales
    );
    
    values = result.newValues;
    if (algorithm === "MIN") {
      knownValuesSets = result.knownValuesSets;
    }
    
    // Para la última ronda de MIN, decidir valores finales
    if (algorithm === "MIN" && r === rounds) {
      // Cada proceso decide el mínimo de su conjunto
      for (let i = 0; i < processCount; i++) {
        const minValue = Math.min(...Array.from(knownValuesSets[i]));
        values[i] = minValue;
      }
      
      // Calcular discrepancia final
      let maxDiscrepancy = new Decimal(0);
      for (let i = 0; i < processCount; i++) {
        for (let j = i+1; j < processCount; j++) {
          const discrepancy = abs(toDecimal(values[i]).minus(toDecimal(values[j])));
          if (discrepancy.gt(maxDiscrepancy)) {
            maxDiscrepancy = discrepancy;
          }
        }
      }
      result.discrepancy = maxDiscrepancy.toNumber();
    }
    
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
      messages: result.messages,
      knownValuesSets: algorithm === "MIN" ? knownValuesSets.map(set => Array.from(set)) : null
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
  const actualAlgorithm = algorithm === "auto"
    ? (decP.gt(0.5) ? "AMP" : "FV")
    : algorithm;
  
  // For n > 2, always use meeting point 0.5 for AMP
   const actualMeetingPoint = meetingPoint;
  
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
  const mean = decDiscrepancies
    .reduce((sum, d) => sum.plus(d), new Decimal(0))
    .div(decDiscrepancies.length);
  
  const sorted = [...decDiscrepancies].sort((a, b) => a.minus(b).toNumber());
  const median = sorted.length % 2 === 0
    ? sorted[sorted.length / 2 - 1].plus(sorted[sorted.length / 2]).div(2)
    : sorted[Math.floor(sorted.length / 2)];
  
  const minVal = min(...decDiscrepancies);
  const maxVal = max(...decDiscrepancies);
  
  // CORRECCIÓN: varianza muestral (Bessel) cuando hay más de 1 punto
  const variance = decDiscrepancies.length > 1
    ? decDiscrepancies
        .reduce((sum, d) => sum.plus(pow(d.minus(mean), 2)), new Decimal(0))
        .div(decDiscrepancies.length - 1)
    : new Decimal(0);
  const std = variance.sqrt();
  
  // Calculate theoretical discrepancy
  let theoretical = null;
  
  // Count number of processes with value 0
  let m = 0;
  initialValues.forEach(val => {
    if (val === 0) m++;
  });
  
  if (processCount === 2) {
    theoretical = this.calculateExpectedDiscrepancyMultiRound(
      p,
      rounds,
      actualAlgorithm
    );
  } else if (processCount === 3) {
    theoretical = this.calculateExpectedDiscrepancy3Players(p, initialValues, meetingPoint);
    if (rounds > 1) {
      const reductionFactor = this.getReductionFactor3Players(p);
      theoretical = theoretical * Math.pow(reductionFactor, rounds - 1);
    }
  } else {
    theoretical = this.calculateExpectedDiscrepancyNProcesses(
      p,
      processCount,
      m,
      actualAlgorithm,
      actualMeetingPoint
    );
    if (rounds > 1) {
      const q = toDecimal(1).minus(decP);
      const reductionFactor = actualAlgorithm === "AMP"
        ? q.toNumber()
        : (pow(decP, 2).plus(pow(q, 2))).toNumber();
      theoretical = theoretical * Math.pow(reductionFactor, rounds - 1);
    }
  }
  
  // Cálculo de errores estándar y CIs al 95%
  const se = std.toNumber() / Math.sqrt(repetitions);                 // std / √runs
  const ci95 = 2 * se;                                                // ±2·se
  const theoSE = Math.sqrt(theoretical * (1 - theoretical) / repetitions); // SE teórico binomial
  const theoCI95 = 2 * theoSE;                                        // ±2·theoSE
  
  return {
    mean: mean.toNumber(),
    median: median.toNumber(),
    min: minVal.toNumber(),
    max: maxVal.toNumber(),
    std: std.toNumber(),
    variance: variance.toNumber(),
    se,
    ci95,
    theoSE,
    theoCI95,
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
  
  // MIN no tiene fórmula teórica
  if (algorithm === "MIN") {
    return null; // o NaN para indicar que no hay valor teórico
  }
  
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
    if (algorithm === "MIN") {
      return null;
    }
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
  calculateExpectedDiscrepancy3Players: function(p, initialValues, meetingPoint) {
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
      
      return toDecimal(meetingPoint).mul(term1.plus(term2).plus(term3).plus(term4)).plus(term5).toNumber();
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
    const a = toDecimal(meetingPoint);  // respeta el valor pasado para todos n
    
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
    const actualMeetingPoint = meetingPoint;
    return this.runExperiment(initialValues, p, rounds, algorithm, actualMeetingPoint);
  },

  // Run multiple experiments with n processes
  runMultipleNProcessExperiments: function(initialValues, p, rounds, repetitions, algorithm = "auto", meetingPoint = 0.5) {
    
    const actualMeetingPoint = meetingPoint;
    return this.runMultipleExperiments(initialValues, p, rounds, repetitions, algorithm, actualMeetingPoint);
  },

  // Agregar al SimulationEngine.js

// Calcular varianza teórica de D(p)
  calculateTheoreticalVariance: function(p, n, m, algorithm, rounds = 1) {
    const q = 1 - p;
    
    if (n === 2) {
      // Fórmulas exactas para 2 procesos
      if (algorithm === "AMP") {
        // Para 1 ronda: Var[D] = 0.5 * p * (1-p)
        // Para k rondas: aproximación
        const varOneRound = 0.5 * p * q;
        // La varianza disminuye con las rondas pero no tan rápido como E[D]
        return varOneRound * Math.pow(q, rounds - 1);
      } else { // FV
        const pSquaredPlusQSquared = p*p + q*q;
        // Para 1 ronda: Var[D] = q(1-q) donde q = p² + (1-p)²
        const varOneRound = pSquaredPlusQSquared * (1 - pSquaredPlusQSquared);
        return varOneRound * Math.pow(pSquaredPlusQSquared, rounds - 1);
      }
    } else {
      // Para n > 2: aproximación basada en la estructura
      // La varianza depende de la probabilidad de consenso parcial
      
      if (algorithm === "AMP") {
        // Aproximación: la varianza es máxima cuando p ≈ 0.5
        // y decrece hacia los extremos
        const baseVar = 0.25 * Math.sqrt(n/2); // Factor de escala con n
        const pFactor = 4 * p * q; // Máximo en p=0.5
        const varOneRound = baseVar * pFactor;
        return varOneRound * Math.pow(q, rounds - 1);
      } else { // FV
        // Para FV la varianza tiene comportamiento más complejo
        const pSquaredPlusQSquared = p*p + q*q;
        const baseVar = 0.3 * Math.sqrt(n/2);
        const pFactor = pSquaredPlusQSquared * (1 - pSquaredPlusQSquared);
        const varOneRound = baseVar * pFactor;
        return varOneRound * Math.pow(pSquaredPlusQSquared, rounds - 1);
      }
    }
  },

  // Calcular coeficiente de variación teórico
  calculateTheoreticalCV: function(p, n, m, algorithm, meetingPoint, rounds = 1) {
    const expectedD = this.calculateExpectedDiscrepancyNProcesses(p, n, m, algorithm, meetingPoint);
    const variance = this.calculateTheoreticalVariance(p, n, m, algorithm, rounds);
    const stdDev = Math.sqrt(variance);
    
    if (expectedD === 0) return Infinity;
    return stdDev / Math.abs(expectedD);
  },

  // Calcular error relativo esperado
  calculateExpectedRelativeError: function(p, n, m, algorithm, rounds, repetitions) {
    const cv = this.calculateTheoreticalCV(p, n, m, algorithm, rounds);
    return cv / Math.sqrt(repetitions);
  },

  // Identificar zonas de alto error relativo
  identifyHighErrorZones: function(minP, maxP, n, m, algorithm, rounds, repetitions, threshold = 0.2) {
    const zones = [];
    const steps = 100;
    const stepSize = (maxP - minP) / steps;
    
    for (let i = 0; i <= steps; i++) {
      const p = minP + i * stepSize;
      const expectedRelError = this.calculateExpectedRelativeError(p, n, m, algorithm, rounds, repetitions);
      
      if (expectedRelError > threshold) {
        // Inicio de zona de alto error
        if (zones.length === 0 || p - zones[zones.length - 1].end > stepSize * 2) {
          zones.push({ start: p, end: p, maxError: expectedRelError });
        } else {
          // Extender zona actual
          zones[zones.length - 1].end = p;
          zones[zones.length - 1].maxError = Math.max(zones[zones.length - 1].maxError, expectedRelError);
        }
      }
    }
    
    return zones;
  }
};